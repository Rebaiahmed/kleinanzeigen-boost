import express from 'express';
import { executeRepostFlow } from './repost';

const app = express();
const port = process.env.PORT || 3001;
const internalSecret = process.env.INTERNAL_SECRET || 'dev_secret_key'; // Ensure this matches backend

app.use(express.json());

import { executeLoginFlow, submit2FAFlow } from './login';

// Security check middleware
app.use((req, res, next) => {
  const secret = req.header('X-Internal-Secret');
  if (secret !== internalSecret) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  next();
});

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
    return res.json(result); // returns { success: false, requires_2fa: true, sessionId } or { success: true, cookies }
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

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
