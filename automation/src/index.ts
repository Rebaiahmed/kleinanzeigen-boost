import express from 'express';

const app = express();
const port = process.env.PORT || 3001;
const internalSecret = process.env.AUTOMATION_INTERNAL_SECRET;

app.use(express.json());

// Security check middleware
app.use((req, res, next) => {
  const secret = req.header('X-Internal-Secret');
  if (secret !== internalSecret) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  next();
});

app.post('/automate/login', async (req, res) => {
  res.json({ success: true, message: 'Stubbed login' });
});

app.post('/automate/fetch-ads', async (req, res) => {
  res.json({ ads: [], count: 0 });
});

app.post('/automate/repost', async (req, res) => {
  res.json({ success: true });
});

app.listen(port, () => {
  console.log(`Automation service listening on port ${port}`);
});
