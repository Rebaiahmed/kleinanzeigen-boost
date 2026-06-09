/**
 * Firestore test-data cleanup.
 *
 * Works in both modes the backend supports:
 *  - Real Firestore (firebase-credentials.json present) → uses the Admin SDK
 *  - File-based dev mock (no credentials) → clears .dev-store.json
 *
 * Usage (from backend/):
 *   npm run cleanup:firestore -- --user <userId>     # wipe ONE user's data
 *   npm run cleanup:firestore -- --all --yes         # wipe ALL test collections
 *   npm run cleanup:firestore -- --help
 *
 * --all requires --yes to avoid accidents.
 */
import * as admin from 'firebase-admin';
import * as fs from 'fs';
import * as path from 'path';

// Top-level collections that hold test data. Extend if you add more.
const TEST_COLLECTIONS = ['users', 'sessions', 'aiUsage', 'handshakes', 'loginJobs', 'meta'];
const STORE_FILE = path.resolve(process.cwd(), '.dev-store.json');

function parseArgs() {
  const args = process.argv.slice(2);
  const get = (flag: string) => {
    const i = args.indexOf(flag);
    return i >= 0 ? args[i + 1] : undefined;
  };
  return {
    user: get('--user'),
    all: args.includes('--all'),
    yes: args.includes('--yes'),
    help: args.includes('--help') || args.length === 0,
  };
}

function printHelp() {
  console.log(`
Firestore cleanup — remove test data.

  --user <userId>   Delete one user's data (users/<id> + subcollections, sessions/<id>, aiUsage/<id>)
  --all             Delete ALL data from test collections: ${TEST_COLLECTIONS.join(', ')}
  --yes             Required confirmation for --all
  --help            Show this help

Examples:
  npm run cleanup:firestore -- --user abc123
  npm run cleanup:firestore -- --all --yes
`);
}

function findCredentials(): string | null {
  const candidates = [
    path.resolve(process.cwd(), 'firebase-credentials.json'),
    path.resolve(__dirname, '../firebase-credentials.json'),
    path.resolve(__dirname, '../../firebase-credentials.json'),
  ];
  return candidates.find((f) => fs.existsSync(f)) || null;
}

// ---- Mock mode (.dev-store.json) ----
function cleanupMock(opts: { user?: string; all?: boolean }) {
  if (!fs.existsSync(STORE_FILE)) {
    console.log('Mock store .dev-store.json not found — nothing to clean.');
    return;
  }
  if (opts.all) {
    fs.writeFileSync(STORE_FILE, '{}');
    console.log('✅ Mock store cleared (.dev-store.json → {}).');
    return;
  }
  // Per-user: drop keys that belong to this user
  const store = JSON.parse(fs.readFileSync(STORE_FILE, 'utf8'));
  const prefixes = [`users/${opts.user}`, `sessions/${opts.user}`, `aiUsage/${opts.user}`];
  let removed = 0;
  for (const key of Object.keys(store)) {
    if (prefixes.some((p) => key === p || key.startsWith(`${p}/`))) {
      delete store[key];
      removed++;
    }
  }
  fs.writeFileSync(STORE_FILE, JSON.stringify(store, null, 2));
  console.log(`✅ Mock store: removed ${removed} document(s) for user ${opts.user}.`);
}

// ---- Real Firestore mode ----
async function cleanupReal(credFile: string, opts: { user?: string; all?: boolean }) {
  const credentialObj = JSON.parse(fs.readFileSync(credFile, 'utf8'));
  admin.initializeApp({
    credential: admin.credential.cert(credentialObj),
    projectId: credentialObj.project_id,
  });
  const db = admin.firestore();
  console.log(`Connected to project: ${credentialObj.project_id}`);

  if (opts.all) {
    for (const col of TEST_COLLECTIONS) {
      await db.recursiveDelete(db.collection(col));
      console.log(`  ✓ cleared collection: ${col}`);
    }
    console.log('✅ All test collections cleared.');
    return;
  }

  // Per-user
  await db.recursiveDelete(db.collection('users').doc(opts.user!)); // users/<id> + all subcollections
  await db.collection('sessions').doc(opts.user!).delete();
  await db.collection('aiUsage').doc(opts.user!).delete();
  console.log(`✅ Deleted all data for user ${opts.user}.`);
}

async function main() {
  const opts = parseArgs();
  if (opts.help) return printHelp();

  if (!opts.all && !opts.user) {
    console.error('Error: specify --user <id> or --all --yes. See --help.');
    process.exit(1);
  }
  if (opts.all && !opts.yes) {
    console.error('Refusing to wipe ALL data without --yes. Re-run: --all --yes');
    process.exit(1);
  }

  const credFile = findCredentials();
  if (credFile) {
    console.log('Mode: real Firestore (firebase-credentials.json found)');
    await cleanupReal(credFile, opts);
  } else {
    console.log('Mode: file-based mock (no credentials found)');
    cleanupMock(opts);
  }
  process.exit(0);
}

main().catch((e) => {
  console.error('Cleanup failed:', e.message);
  process.exit(1);
});
