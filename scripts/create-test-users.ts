/**
 * Nablis — create test users script
 *
 * Creates 8 accounts in Firebase Auth + Firestore:
 *
 *   SUPER ADMIN (1):
 *     superadmin@nablis.com / Nablis2024!  → role: super_admin  (Aba Gorgorios)
 *
 *   ADMINS (2):
 *     admin1@nablis.com / Nablis2024!      → role: admin  (Deacon Dawit)
 *     admin2@nablis.com / Nablis2024!      → role: admin  (Deacon Henok)
 *
 *   ACTIVE MEMBERS (3):
 *     member1@nablis.com / Nablis2024!     → role: member, status: active (Mekdes Abebe)
 *     member2@nablis.com / Nablis2024!     → role: member, status: active (Sara Tefera)
 *     member3@nablis.com / Nablis2024!     → role: member, status: active (Dawit Haile)
 *
 *   PENDING MEMBERS (2):
 *     pending1@nablis.com / Nablis2024!    → role: member, status: pending (Tigist Bekele)
 *     pending2@nablis.com / Nablis2024!    → role: member, status: pending (Yonas Girma)
 *
 * SETUP (one-time):
 *   1. Firebase Console → Project Settings → Service Accounts → Generate new private key
 *      Save as scripts/service-account.json, OR set the FIREBASE_ADMIN_* env vars in .env.local
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

// ─── Types ────────────────────────────────────────────────────────────────────

interface UserParams {
  uid: string;
  email: string;
  password: string;
  displayName: string;
  role: 'super_admin' | 'admin' | 'member';
  status: 'active' | 'pending' | 'rejected';
  christianName?: string;
  parishChurch?: string;
  phoneNumber?: string;
  countryOfResidence?: string;
  cityOfResidence?: string;
  neighborhood?: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function upsertUser(params: UserParams) {
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
      email:               params.email,
      displayName:         params.displayName,
      photoURL:            null,
      role:                params.role,
      status:              params.status,
      christianName:       params.christianName  ?? null,
      parishChurch:        params.parishChurch   ?? null,
      phoneNumber:         params.phoneNumber    ?? null,
      countryOfResidence:  params.countryOfResidence ?? null,
      cityOfResidence:     params.cityOfResidence ?? null,
      neighborhood:        params.neighborhood   ?? null,
      createdAt:           Timestamp.now(),
    },
    { merge: true }
  );
  console.log(`  ✓  Firestore     → users/${params.uid}  (${params.role} / ${params.status})`);
}

// ─── Test accounts ────────────────────────────────────────────────────────────

async function main() {
  console.log('\n🔑  Creating Nablis test users...\n');

  // ── Super Admin ──────────────────────────────────────────────────────────────
  console.log('▸  Super Admin');
  await upsertUser({
    uid:                'nablis-superadmin',
    email:              'superadmin@nablis.com',
    password:           'Nablis2024!',
    displayName:        'Aba Gorgorios',
    role:               'super_admin',
    status:             'active',
    christianName:      'Gorgorios',
    parishChurch:       'Debre Selam Kidus Mikael',
    phoneNumber:        '+251911000001',
    countryOfResidence: 'Ethiopia',
    cityOfResidence:    'Addis Ababa',
    neighborhood:       'Bole',
  });

  // ── Admins ───────────────────────────────────────────────────────────────────
  console.log('\n▸  Admins');
  await upsertUser({
    uid:                'nablis-admin1',
    email:              'admin1@nablis.com',
    password:           'Nablis2024!',
    displayName:        'Deacon Dawit',
    role:               'admin',
    status:             'active',
    christianName:      'Dawit',
    parishChurch:       'Debre Selam Kidus Mikael',
    phoneNumber:        '+251911000002',
    countryOfResidence: 'Ethiopia',
    cityOfResidence:    'Addis Ababa',
    neighborhood:       'Kirkos',
  });

  await upsertUser({
    uid:                'nablis-admin2',
    email:              'admin2@nablis.com',
    password:           'Nablis2024!',
    displayName:        'Deacon Henok',
    role:               'admin',
    status:             'active',
    christianName:      'Henok',
    parishChurch:       'Debre Selam Kidus Mikael',
    phoneNumber:        '+251911000003',
    countryOfResidence: 'Ethiopia',
    cityOfResidence:    'Addis Ababa',
    neighborhood:       'Yeka',
  });

  // ── Active Members ───────────────────────────────────────────────────────────
  console.log('\n▸  Active Members');
  await upsertUser({
    uid:                'nablis-member1',
    email:              'member1@nablis.com',
    password:           'Nablis2024!',
    displayName:        'Mekdes Abebe',
    role:               'member',
    status:             'active',
    christianName:      'Mekdes',
    parishChurch:       'Kidane Mehret Church',
    phoneNumber:        '+251922000001',
    countryOfResidence: 'Ethiopia',
    cityOfResidence:    'Addis Ababa',
    neighborhood:       'Nifas Silk',
  });

  await upsertUser({
    uid:                'nablis-member2',
    email:              'member2@nablis.com',
    password:           'Nablis2024!',
    displayName:        'Sara Tefera',
    role:               'member',
    status:             'active',
    christianName:      'Sara',
    parishChurch:       'Bole Medhanealem Church',
    phoneNumber:        '+251922000002',
    countryOfResidence: 'Ethiopia',
    cityOfResidence:    'Addis Ababa',
    neighborhood:       'Bole',
  });

  await upsertUser({
    uid:                'nablis-member3',
    email:              'member3@nablis.com',
    password:           'Nablis2024!',
    displayName:        'Dawit Haile',
    role:               'member',
    status:             'active',
    christianName:      'Dawit',
    parishChurch:       'Lideta Mariam Church',
    phoneNumber:        '+251922000003',
    countryOfResidence: 'Ethiopia',
    cityOfResidence:    'Addis Ababa',
    neighborhood:       'Lideta',
  });

  // ── Pending Members ──────────────────────────────────────────────────────────
  console.log('\n▸  Pending Members (awaiting approval)');
  await upsertUser({
    uid:                'nablis-pending1',
    email:              'pending1@nablis.com',
    password:           'Nablis2024!',
    displayName:        'Tigist Bekele',
    role:               'member',
    status:             'pending',
    christianName:      'Tigist',
    parishChurch:       'Selassie Church Entoto',
    phoneNumber:        '+251933000001',
    countryOfResidence: 'Ethiopia',
    cityOfResidence:    'Addis Ababa',
    neighborhood:       'Entoto',
  });

  await upsertUser({
    uid:                'nablis-pending2',
    email:              'pending2@nablis.com',
    password:           'Nablis2024!',
    displayName:        'Yonas Girma',
    role:               'member',
    status:             'pending',
    christianName:      'Yonas',
    parishChurch:       'Kiddus Gebre Kristos',
    phoneNumber:        '+251933000002',
    countryOfResidence: 'Ethiopia',
    cityOfResidence:    'Addis Ababa',
    neighborhood:       'Akaki',
  });

  // ── Summary ──────────────────────────────────────────────────────────────────
  console.log('\n✅  Done! Created 8 test users:\n');
  console.log('  SUPER ADMIN:');
  console.log('    superadmin@nablis.com  / Nablis2024!   (Aba Gorgorios)');
  console.log('\n  ADMINS:');
  console.log('    admin1@nablis.com      / Nablis2024!   (Deacon Dawit)');
  console.log('    admin2@nablis.com      / Nablis2024!   (Deacon Henok)');
  console.log('\n  ACTIVE MEMBERS:');
  console.log('    member1@nablis.com     / Nablis2024!   (Mekdes Abebe)');
  console.log('    member2@nablis.com     / Nablis2024!   (Sara Tefera)');
  console.log('    member3@nablis.com     / Nablis2024!   (Dawit Haile)');
  console.log('\n  PENDING MEMBERS:');
  console.log('    pending1@nablis.com    / Nablis2024!   (Tigist Bekele)');
  console.log('    pending2@nablis.com    / Nablis2024!   (Yonas Girma)\n');

  process.exit(0);
}

main().catch((err) => {
  console.error('\n❌  Failed:', err);
  process.exit(1);
});
