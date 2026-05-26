/**
 * Nablis — create test users script
 *
 * Creates two accounts in Firebase Auth + Firestore:
 *   admin@nablis.com  / Nablis2024!  → role: admin  (Aba Gorgorios)
 *   member@nablis.com / Nablis2024!  → role: member (Mekdes Abebe)
 *
 * SETUP (one-time):
 *   1. Firebase Console → Project Settings → Service Accounts → Generate new private key
 *      Save as scripts/service-account.json, OR set the FIREBASE_ADMIN_* env vars in .env.local
 *   2. Copy .env.example → .env.local at the project root and fill in the values.
 *
 * RUN:
 *   cd scripts
 *   npm run create-test-users
 */

import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../.env.local') });
dotenv.config({ path: path.resolve(__dirname, '../.env') });

import { initializeApp, cert, getApps, type ServiceAccount } from 'firebase-admin/app';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';

// ─── Init ─────────────────────────────────────────────────────────────────────

let serviceAccount: ServiceAccount;

try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  serviceAccount = require('./service-account.json') as ServiceAccount;
} catch {
  const projectId   = process.env.FIREBASE_ADMIN_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL;
  const privateKey  = process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, '\n');

  if (!projectId || !clientEmail || !privateKey) {
    console.error(
      '\n❌  Firebase Admin credentials not found.\n' +
      '    Either place scripts/service-account.json or set:\n' +
      '      FIREBASE_ADMIN_PROJECT_ID\n' +
      '      FIREBASE_ADMIN_CLIENT_EMAIL\n' +
      '      FIREBASE_ADMIN_PRIVATE_KEY\n'
    );
    process.exit(1);
  }

  serviceAccount = { projectId, clientEmail, privateKey } as ServiceAccount;
}

if (!getApps().length) {
  initializeApp({ credential: cert(serviceAccount) });
}

const db     = getFirestore();
const fbAuth = getAuth();

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function upsertUser(params: {
  uid: string;
  email: string;
  password: string;
  displayName: string;
  role: 'admin' | 'member';
}) {
  // Auth user (create or update)
  try {
    await fbAuth.createUser({
      uid:         params.uid,
      email:       params.email,
      password:    params.password,
      displayName: params.displayName,
    });
    console.log(`  ✓  Auth created  → ${params.email}`);
  } catch (e: unknown) {
    const err = e as { code?: string };
    if (err.code === 'auth/uid-already-exists' || err.code === 'auth/email-already-exists') {
      await fbAuth.updateUser(params.uid, {
        email:       params.email,
        password:    params.password,
        displayName: params.displayName,
      });
      console.log(`  ↻  Auth updated  → ${params.email}`);
    } else {
      throw e;
    }
  }

  // Firestore user document
  await db.collection('users').doc(params.uid).set(
    {
      email:       params.email,
      displayName: params.displayName,
      photoURL:    null,
      role:        params.role,
      status:      'active',
      createdAt:   Timestamp.now(),
    },
    { merge: true }
  );
  console.log(`  ✓  Firestore     → users/${params.uid} (role: ${params.role})`);
}

// ─── Test accounts ────────────────────────────────────────────────────────────

async function main() {
  console.log('\n🔑  Creating Nablis test users...\n');

  await upsertUser({
    uid:         'test-admin-nablis',
    email:       'admin@nablis.com',
    password:    'Nablis2024!',
    displayName: 'Aba Gorgorios',
    role:        'admin',
  });

  await upsertUser({
    uid:         'test-member-nablis',
    email:       'member@nablis.com',
    password:    'Nablis2024!',
    displayName: 'Mekdes Abebe',
    role:        'member',
  });

  console.log('\n✅  Done.\n');
  console.log('  Admin  → admin@nablis.com  / Nablis2024!');
  console.log('  Member → member@nablis.com / Nablis2024!\n');
  process.exit(0);
}

main().catch((err) => {
  console.error('\n❌  Failed:', err);
  process.exit(1);
});
