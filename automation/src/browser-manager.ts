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
    const context = await chromium.launchPersistentContext(userDataDir, {
      headless: !isDebug,
      slowMo,
      // Use a system-installed Chrome when set (e.g. on hosts where Playwright's
      // bundled Chromium isn't available). Falls back to bundled chromium locally.
      executablePath: process.env.CHROMIUM_PATH || undefined,
      viewport: { width: 1280, height: 720 },
      args: ['--disable-blink-features=AutomationControlled']
    });

    activeContexts.set(userId, { context, lastAccessed: Date.now() });
    console.log(`[BrowserManager] Persistent context launched (headless=${!isDebug}, slowMo=${slowMo}ms) for user: ${userId}`);
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
