/**
 * PoC: End-to-end repost validation
 *
 * Steps:
 * 1. Get a valid JWT by calling the handshake (needs existing session)
 * 2. Insert a test ad in Firestore with autoRepost=true, nextRepostAt=now-1min
 * 3. Trigger the scheduler manually via POST /api/scheduler/trigger
 * 4. Wait and validate the ad status changed + repost was attempted
 * 5. Report pass/fail for each step
 */

const admin = require('./node_modules/firebase-admin');
const fs = require('fs');
const path = require('path');
const axios = require('./node_modules/axios');

require('dotenv').config();

const API_BASE = 'http://localhost:3000/api';
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
const AUTOMATION_BASE = 'http://localhost:3001';
const INTERNAL_SECRET = process.env.INTERNAL_SECRET || 'dev_secret_key';

const cred = JSON.parse(fs.readFileSync('./firebase-credentials.json', 'utf8'));
if (!admin.apps.length) {
  admin.initializeApp({ credential: admin.credential.cert(cred), projectId: cred.project_id });
}
const db = admin.firestore();

function log(icon: string, msg: string, data?: any) {
  console.log(`${icon}  ${msg}`, data !== undefined ? JSON.stringify(data, null, 2) : '');
}

async function runPoC() {
  console.log('\n' + '═'.repeat(60));
  console.log('  REPOST END-TO-END PoC');
  console.log('═'.repeat(60) + '\n');

  // ── Step 1: Find or create a test user session ───────────────────
  log('🔍', 'Step 1: Setting up test user session in Firestore...');
  const sessionsSnap = await db.collection('sessions').get();
  let userId: string;
  if (!sessionsSnap.empty) {
    userId = sessionsSnap.docs[0].id;
    log('✅', `Found existing user: ${userId}`);
  } else {
    // Create synthetic test user for PoC
    userId = 'poc-test-user-' + Date.now();
    await db.collection('sessions').doc(userId).set({
      status: 'active',
      lastLogin: new Date().toISOString(),
      marketplaceCookies: 'poc-test-cookies',
    });
    log('✅', `Created synthetic test user: ${userId}`);
  }

  // ── Step 2: Get JWT for this user ─────────────────────────────────
  log('🔑', 'Step 2: Generating JWT for this user...');
  const jwt = require('./node_modules/jsonwebtoken');
  const token = jwt.sign({ sub: userId, type: 'marketplace_session' }, process.env.JWT_SECRET || 'fallback_secret_for_dev', { expiresIn: '1h' });
  log('✅', 'JWT generated', { token: token.substring(0, 40) + '...' });

  // ── Step 3: Check automation worker is running ────────────────────
  log('🤖', 'Step 3: Checking automation worker...');
  try {
    await axios.default.get(`${AUTOMATION_BASE}/`, { headers: { 'X-Internal-Secret': INTERNAL_SECRET }, timeout: 3000 });
    log('✅', 'Automation worker is running');
  } catch (e: any) {
    if (e.response?.status === 404 || e.code === 'ERR_BAD_REQUEST') {
      log('✅', 'Automation worker is running (returned non-200 for GET /)');
    } else {
      log('❌', `Automation worker not reachable: ${e.message}`);
      log('ℹ️', 'Start it with: cd automation && npm run dev');
      process.exit(1);
    }
  }

  // ── Step 4: Insert a test ad due for repost ───────────────────────
  log('📝', 'Step 4: Inserting test ad due for repost...');
  const testAdId = `poc-test-${Date.now()}`;
  const oneMinuteAgo = new Date(Date.now() - 60 * 1000).toISOString();
  const testAd = {
    id: testAdId,
    title: 'PoC Test Ad — Auto-Repost Validation',
    description: 'This is a test ad created by the PoC script.',
    price: '10',
    category: 'Test',
    autoRepost: true,
    status: 'active',
    nextRepostAt: oneMinuteAgo,   // overdue → should be picked up immediately
    repostIntervalMinutes: 1440,  // 24h interval after repost
    image: null,
    views: 0,
    syncedAt: new Date().toISOString(),
  };
  // Create parent user document (required — Firestore collection.get() only returns existing docs)
  await db.collection('users').doc(userId).set({ createdAt: new Date().toISOString() }, { merge: true });
  await db.collection('users').doc(userId).collection('ads').doc(testAdId).set(testAd);
  log('✅', `Test ad inserted: ${testAdId}`, { nextRepostAt: oneMinuteAgo });

  // ── Step 5: Trigger scheduler ─────────────────────────────────────
  log('⚡', 'Step 5: Triggering scheduler via POST /api/scheduler/trigger...');
  try {
    await axios.default.post(`${API_BASE}/scheduler/trigger`, {}, {
      headers: { Authorization: `Bearer ${token}` },
    });
    log('✅', 'Scheduler triggered');
  } catch (e: any) {
    log('❌', `Trigger failed: ${e.response?.data?.message || e.message}`);
    process.exit(1);
  }

  // ── Step 6: Wait and validate ─────────────────────────────────────
  log('⏳', 'Step 6: Waiting 15s for scheduler to process...');
  await new Promise(r => setTimeout(r, 15000));

  const adAfter = await db.collection('users').doc(userId).collection('ads').doc(testAdId).get();
  const adData = adAfter.data();

  console.log('\n' + '─'.repeat(60));
  console.log('  VALIDATION RESULTS');
  console.log('─'.repeat(60));

  const checks = [
    {
      name: 'Ad exists in Firestore after trigger',
      pass: adAfter.exists,
      detail: adAfter.exists ? 'Found' : 'Missing',
    },
    {
      name: 'Status changed from active (PENDING_REPOST or back to active)',
      pass: adData?.status !== 'active' || (adData?.nextRepostAt && adData.nextRepostAt !== oneMinuteAgo),
      detail: `status=${adData?.status}, nextRepostAt=${adData?.nextRepostAt}`,
    },
    {
      name: 'nextRepostAt was updated (rescheduled)',
      pass: adData?.nextRepostAt && adData.nextRepostAt !== oneMinuteAgo,
      detail: adData?.nextRepostAt || 'unchanged',
    },
    {
      name: 'lastRepostViewsGained recorded',
      pass: adData?.lastRepostViewsGained !== undefined,
      detail: `${adData?.lastRepostViewsGained ?? 'not set'}`,
    },
  ];

  let allPassed = true;
  for (const check of checks) {
    const icon = check.pass ? '✅' : '❌';
    console.log(`  ${icon}  ${check.name}`);
    console.log(`       → ${check.detail}`);
    if (!check.pass) allPassed = false;
  }

  // ── Step 7: Check scheduler meta ─────────────────────────────────
  const metaDoc = await db.collection('meta').doc('schedulerMeta').get();
  console.log('\n  📊 Scheduler Meta:');
  console.log(`     lastRunAt: ${metaDoc.data()?.lastRunAt || 'not set'}`);
  console.log(`     lastRepostAt: ${metaDoc.data()?.lastRepostAt || 'not set'}`);

  // ── Cleanup ───────────────────────────────────────────────────────
  await db.collection('users').doc(userId).collection('ads').doc(testAdId).delete();
  log('🧹', 'Test ad cleaned up');

  console.log('\n' + '═'.repeat(60));
  console.log(allPassed ? '  🎉 ALL CHECKS PASSED' : '  ⚠️  SOME CHECKS FAILED — see above');
  console.log('═'.repeat(60) + '\n');

  process.exit(allPassed ? 0 : 1);
}

runPoC().catch(e => {
  console.error('Fatal PoC error:', e.message);
  process.exit(1);
});
