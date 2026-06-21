import { chromium, BrowserContext } from 'playwright';
import * as path from 'path';

interface ContextEntry {
  context: BrowserContext;
  lastAccessed: number;
}

const activeContexts = new Map<string, ContextEntry>();
const bootingLocks = new Set<string>();

const IDLE_TIMEOUT_MS = 10 * 60 * 1000; // 10 minutes

/**
 * Optional residential proxy — OFF by default. Configure via env:
 *   PROXY_URL=http://user:pass@host:port   (or socks5://…)
 * or the split form: PROXY_SERVER=http://host:port  PROXY_USERNAME=…  PROXY_PASSWORD=…
 * Returns undefined when unset → Playwright runs with the host's direct IP (unchanged).
 */
function getProxyConfig(): { server: string; username?: string; password?: string } | undefined {
  const raw = process.env.PROXY_URL || process.env.PROXY_SERVER;
  if (!raw) return undefined;
  try {
    if (/^\w+:\/\//.test(raw)) {
      const u = new URL(raw);
      const cfg: { server: string; username?: string; password?: string } = { server: `${u.protocol}//${u.host}` };
      if (u.username) cfg.username = decodeURIComponent(u.username);
      if (u.password) cfg.password = decodeURIComponent(u.password);
      else if (process.env.PROXY_PASSWORD) cfg.password = process.env.PROXY_PASSWORD;
      if (!cfg.username && process.env.PROXY_USERNAME) cfg.username = process.env.PROXY_USERNAME;
      return cfg;
    }
    return { server: raw, username: process.env.PROXY_USERNAME || undefined, password: process.env.PROXY_PASSWORD || undefined };
  } catch {
    return { server: raw };
  }
}

// Third-party ad/analytics/marketing hosts — pure bandwidth waste. Blocked when
// resource-blocking is on (saves proxy cost without affecting the repost flow).
const BLOCKED_HOST_RE = /doubleclick|googlesyndication|google-analytics|googletagmanager|googleadservices|criteo|adsrvr\.org|adnxs|rtbhouse|creativecdn|bat\.bing|facebook\.com\/tr|connect\.facebook|hotjar|brandmetrics|taboola|outbrain|amazon-adsystem|scorecardresearch|content-cdn\.com/i;

/** Abort fonts/media + known trackers to cut bandwidth (keeps images, CSS, and
 *  Kleinanzeigen's own scripts so the React form + photo flow still work). */
async function applyResourceBlocking(context: BrowserContext): Promise<void> {
  await context.route('**/*', (route) => {
    try {
      const req = route.request();
      const type = req.resourceType();
      if (type === 'font' || type === 'media') return route.abort();
      if (BLOCKED_HOST_RE.test(req.url())) return route.abort();
      return route.continue();
    } catch {
      return route.continue();
    }
  });
}

/**
 * Cleanup job: runs every minute to close contexts idle for >10 minutes.
 */
setInterval(async () => {
  const now = Date.now();
  for (const [userId, entry] of activeContexts.entries()) {
    if (now - entry.lastAccessed > IDLE_TIMEOUT_MS) {
      console.log(`[BrowserManager] Closing idle persistent context for user: ${userId}`);
      try {
        await entry.context.close();
      } catch (e) {
        console.error(`[BrowserManager] Error closing context for ${userId}:`, e);
      } finally {
        activeContexts.delete(userId);
      }
    }
  }
}, 60 * 1000);

/**
 * Returns a persistent BrowserContext scoped to the userId.
 * Updates lastAccessed timestamp.
 */
export async function getPersistentContext(userId: string): Promise<BrowserContext> {
  // 1. If already active, touch it and return
  if (activeContexts.has(userId)) {
    const entry = activeContexts.get(userId)!;
    entry.lastAccessed = Date.now();
    return entry.context;
  }

  // 2. If booting, wait for lock to release
  if (bootingLocks.has(userId)) {
    while (bootingLocks.has(userId)) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    if (activeContexts.has(userId)) {
      const entry = activeContexts.get(userId)!;
      entry.lastAccessed = Date.now();
      return entry.context;
    }
  }

  // 3. Boot new context
  bootingLocks.add(userId);
  try {
    const isDebug = process.env.DEBUG_BROWSER === 'true';
    const userDataDir = path.resolve(__dirname, `../../automation/user-data-dir/${userId}`);
    
    // DEBUG_BROWSER=true → visible (headed) browser. DEBUG_SLOWMO (ms) slows each
    // Playwright action so you can watch the flow; defaults to 600ms in debug.
    const slowMo = isDebug ? Number(process.env.DEBUG_SLOWMO || 600) : 0;
    const proxy = getProxyConfig();
    const context = await chromium.launchPersistentContext(userDataDir, {
      headless: !isDebug,
      slowMo,
      // Use a system-installed Chrome when set (e.g. on hosts where Playwright's
      // bundled Chromium isn't available). Falls back to bundled chromium locally.
      executablePath: process.env.CHROMIUM_PATH || undefined,
      viewport: { width: 1280, height: 720 },
      proxy, // undefined when unset → direct connection (unchanged default)
      args: ['--disable-blink-features=AutomationControlled']
    });

    // Bandwidth-saving resource blocking: on by default when a proxy is used (to
    // cut its per-GB cost); force on/off anytime via BLOCK_RESOURCES=true|false.
    const blockResources = process.env.BLOCK_RESOURCES === 'true' || (!!proxy && process.env.BLOCK_RESOURCES !== 'false');
    if (blockResources) await applyResourceBlocking(context);

    activeContexts.set(userId, { context, lastAccessed: Date.now() });
    console.log(`[BrowserManager] Persistent context launched (headless=${!isDebug}, slowMo=${slowMo}ms, proxy=${proxy ? proxy.server : 'none'}, blockResources=${blockResources}) for user: ${userId}`);
    return context;
  } catch (error) {
    console.error(`[BrowserManager] Failed to launch context for ${userId}:`, error);
    throw error;
  } finally {
    bootingLocks.delete(userId);
  }
}

/**
 * Force close a context (e.g. if explicitly logging out or resetting)
 */
export async function closePersistentContext(userId: string) {
  if (activeContexts.has(userId)) {
    await activeContexts.get(userId)!.context.close();
    activeContexts.delete(userId);
    console.log(`[BrowserManager] Force closed context for ${userId}`);
  }
}
