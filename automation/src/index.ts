import express from 'express';
import { executeRepostFlow } from './repost';
import { executeVintedLogin } from './vinted-login';
import { executeVintedPost } from './vinted-post';
import { executeLoginFlow, executeVisibleLoginFlow, submit2FAFlow } from './login';

const app = express();
const port = process.env.PORT || 3001;
const internalSecret = process.env.INTERNAL_SECRET || 'dev_secret_key';

app.use(express.json());

// ─── In-process job store for visible login jobs ────────────────────────────
// Structure: jobId -> { status, cookies?, error? }
const visibleLoginJobs = new Map<string, {
  status: 'pending' | 'waiting-for-user' | 'success' | 'failed';
  cookies?: any;
  error?: string;
}>();

// ─── Security middleware ────────────────────────────────────────────────────
app.use((req, res, next) => {
  const secret = req.header('X-Internal-Secret');
  if (secret !== internalSecret) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  next();
});

// ─── Headless / automated login ─────────────────────────────────────────────
app.post('/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'Missing credentials' });
  }
  try {
    const result = await executeLoginFlow(email, password);
    if (!result.success && !result.requires_2fa) {
      return res.status(401).json({ error: result.error });
    }
    return res.json(result);
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

// ─── Visible (non-headless) login ────────────────────────────────────────────
/**
 * POST /login/visible
 * Launches a visible Playwright browser and returns 202 immediately.
 * The frontend polls GET /auth/login-status/:jobId on the backend, which
 * in turn polls GET /login/visible/:jobId here.
 */
app.post('/login/visible', (req, res) => {
  const { jobId, email } = req.body;
  if (!jobId || !email) {
    return res.status(400).json({ error: 'Missing jobId or email' });
  }

  // Seed the job entry
  visibleLoginJobs.set(jobId, { status: 'pending' });

  // Fire-and-forget: browser runs asynchronously
  executeVisibleLoginFlow(
    jobId,
    email,
    async (status, cookies, error) => {
      visibleLoginJobs.set(jobId, { status, cookies, error });
    },
  ).catch(err => {
    console.error(`[VisibleLogin] Job ${jobId} fatal error:`, err.message);
    visibleLoginJobs.set(jobId, { status: 'failed', error: err.message });
  });

  return res.status(202).json({ accepted: true, jobId });
});

/**
 * GET /login/visible/:jobId
 * Returns current status of a visible login job.
 */
app.get('/login/visible/:jobId', (req, res) => {
  const { jobId } = req.params;
  const job = visibleLoginJobs.get(jobId);
  if (!job) {
    return res.status(404).json({ error: 'Job not found' });
  }
  return res.json(job);
});

// ─── 2FA ────────────────────────────────────────────────────────────────────
app.post('/login/2fa', async (req, res) => {
  const { sessionId, code } = req.body;
  if (!sessionId || !code) {
    return res.status(400).json({ error: 'Missing sessionId or code' });
  }
  try {
    const result = await submit2FAFlow(sessionId, code);
    if (!result.success) {
      return res.status(401).json({ error: result.error });
    }
    return res.json(result);
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

// ─── Vinted ──────────────────────────────────────────────────────────────────
app.post('/automate/vinted-login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'Missing credentials' });
  }
  try {
    const result = await executeVintedLogin(email, password);
    if (!result.success) {
      return res.status(400).json({ error: result.error });
    }
    return res.json(result);
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

app.post('/automate/vinted-post', async (req, res) => {
  const { adData, cookies } = req.body;
  if (!adData || !cookies) {
    return res.status(400).json({ error: 'Missing adData or cookies' });
  }
  try {
    const result = await executeVintedPost(adData, cookies);
    if (!result.success) {
      if (result.error === 'categoryNotSupported') {
        return res.status(400).json({ error: 'categoryNotSupported' });
      }
      if (result.error === 'sessionExpired') {
        return res.status(401).json({ error: 'sessionExpired' });
      }
      return res.status(500).json({ error: result.error });
    }
    return res.json(result);
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

// ─── Sync & Repost ───────────────────────────────────────────────────────────
app.post('/sync', async (req, res) => {
  const { cookies } = req.body;
  if (!cookies || !Array.isArray(cookies)) {
    return res.status(400).json({ error: 'Missing or invalid cookies' });
  }
  try {
    const { executeSyncAds } = await import('./sync');
    const result = await executeSyncAds(cookies);
    if (!result.success) {
      if (result.error === 'SESSION_EXPIRED') {
        return res.status(401).json({ error: 'Session expired' });
      }
      console.error('Sync failed:', result.error);
      return res.status(500).json({ error: result.error });
    }
    return res.json(result);
  } catch (error: any) {
    console.error('Sync Exception:', error);
    return res.status(500).json({ error: error.message });
  }
});

app.post('/repost', async (req, res) => {
  const { userId, adId, adData } = req.body;
  if (!userId || !adId) {
    return res.status(400).json({ error: 'Missing userId or adId' });
  }
  try {
    const result = await executeRepostFlow(userId, adId, adData);
    if (!result.success) {
      return res.status(500).json({ error: result.error, step: result.step });
    }
    return res.json(result);
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

app.listen(port, () => {
  console.log(`Automation service listening on port ${port}`);
});
