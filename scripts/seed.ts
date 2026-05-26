/**
 * Nablis — Firestore seed script
 *
 * SETUP (one-time):
 *   1. Go to Firebase Console → Project Settings → Service Accounts
 *   2. Click "Generate new private key" and save as scripts/service-account.json
 *   3. Copy .env.example → .env.local in the project root and fill in values, OR
 *      set the three FIREBASE_ADMIN_* environment variables shown below.
 *
 * RUN:
 *   cd scripts
 *   npm install
 *   npm run seed
 *
 * DRY RUN (prints without writing):
 *   npm run seed:dry
 */

import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../.env.local') });
dotenv.config({ path: path.resolve(__dirname, '../.env') });

import { initializeApp, cert, getApps, type ServiceAccount } from 'firebase-admin/app';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';

// ─── Init ─────────────────────────────────────────────────────────────────────

const DRY_RUN = process.env.DRY_RUN === 'true';

let serviceAccount: ServiceAccount;

// Prefer a local service-account.json file; fall back to env vars
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

const db   = getFirestore();
const fbAuth = getAuth();

// ─── Helpers ──────────────────────────────────────────────────────────────────

function daysFromNow(n: number): Timestamp {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return Timestamp.fromDate(d);
}

function daysAgo(n: number): Timestamp {
  return daysFromNow(-n);
}

async function upsertAuthUser(params: {
  uid: string;
  email: string;
  password: string;
  displayName: string;
}) {
  if (DRY_RUN) {
    console.log(`  [DRY] Auth user → ${params.email}`);
    return;
  }
  try {
    await fbAuth.createUser(params);
  } catch (e: unknown) {
    const err = e as { code?: string };
    if (err.code === 'auth/uid-already-exists' || err.code === 'auth/email-already-exists') {
      await fbAuth.updateUser(params.uid, {
        email: params.email,
        password: params.password,
        displayName: params.displayName,
      });
    } else {
      throw e;
    }
  }
}

async function write(
  collection: string,
  id: string,
  data: Record<string, unknown>
) {
  if (DRY_RUN) {
    console.log(`  [DRY] ${collection}/${id}`, JSON.stringify(data).slice(0, 80));
    return;
  }
  await db.collection(collection).doc(id).set(data, { merge: true });
  console.log(`  ✓  ${collection}/${id}`);
}

// ─── Seed data ────────────────────────────────────────────────────────────────

const ADMIN_UID   = 'user-admin-001';
const MEMBER1_UID = 'user-member-001';
const MEMBER2_UID = 'user-member-002';
const MEMBER3_UID = 'user-member-003';

async function seedUsers() {
  console.log('\n👤  Users');

  const users = [
    {
      uid: ADMIN_UID,
      email: 'gorgorios@nablis.org',
      password: 'Admin@Nablis2024',
      displayName: 'Aba Gorgorios',
      firestoreData: {
        email: 'gorgorios@nablis.org',
        displayName: 'Aba Gorgorios',
        photoURL: null,
        role: 'admin',
        status: 'active',
        phone: '+251911000001',
        city: 'Addis Ababa',
        createdAt: daysAgo(365),
      },
    },
    {
      uid: MEMBER1_UID,
      email: 'mekdes@example.com',
      password: 'Member@2024',
      displayName: 'Mekdes Haile',
      firestoreData: {
        email: 'mekdes@example.com',
        displayName: 'Mekdes Haile',
        photoURL: null,
        role: 'member',
        status: 'active',
        phone: '+251922000001',
        city: 'Addis Ababa',
        birthday: Timestamp.fromDate(new Date('1992-03-15')),
        createdAt: daysAgo(90),
      },
    },
    {
      uid: MEMBER2_UID,
      email: 'dawit@example.com',
      password: 'Member@2024',
      displayName: 'Dawit Bekele',
      firestoreData: {
        email: 'dawit@example.com',
        displayName: 'Dawit Bekele',
        photoURL: null,
        role: 'member',
        status: 'active',
        phone: '+251933000001',
        city: 'Gondar',
        birthday: Timestamp.fromDate(new Date('1988-07-22')),
        createdAt: daysAgo(60),
      },
    },
    {
      uid: MEMBER3_UID,
      email: 'tigist@example.com',
      password: 'Member@2024',
      displayName: 'Tigist Alemu',
      firestoreData: {
        email: 'tigist@example.com',
        displayName: 'Tigist Alemu',
        photoURL: null,
        role: 'member',
        status: 'pending',
        phone: '+251944000001',
        city: 'Bahir Dar',
        createdAt: daysAgo(3),
      },
    },
  ];

  for (const u of users) {
    await upsertAuthUser({
      uid: u.uid,
      email: u.email,
      password: u.password,
      displayName: u.displayName,
    });
    await write('users', u.uid, u.firestoreData);
  }
}

async function seedAppointments() {
  console.log('\n📅  Appointments');
  await write('appointments', 'appt-001', {
    memberId:    MEMBER1_UID,
    memberName:  'Mekdes Haile',
    serviceType: 'confession',
    date:        daysFromNow(3),
    time:        '10:00',
    status:      'confirmed',
    privateNote: 'First-time confession session.',
    createdAt:   daysAgo(2),
  });
  await write('appointments', 'appt-002', {
    memberId:    MEMBER2_UID,
    memberName:  'Dawit Bekele',
    serviceType: 'counseling',
    date:        daysFromNow(7),
    time:        '14:00',
    status:      'pending',
    createdAt:   daysAgo(1),
  });
}

async function seedDailyPrayers() {
  console.log('\n🙏  Daily Prayers');
  const prayers = [
    {
      id: 'prayer-morning',
      type: 'morning',
      time: '06:00',
      message: 'Start your day in the presence of the Lord. Offer your plans to Him and trust His guidance.',
      bibleVerse: 'Psalm 5:3 — In the morning, LORD, you hear my voice; in the morning I lay my requests before you.',
    },
    {
      id: 'prayer-afternoon',
      type: 'afternoon',
      time: '12:00',
      message: 'Pause in the middle of your day to give thanks and seek renewed strength.',
      bibleVerse: 'Psalm 55:17 — Evening, morning and noon I cry out in distress, and he hears my voice.',
    },
    {
      id: 'prayer-evening',
      type: 'evening',
      time: '20:00',
      message: 'Close the day with gratitude. Reflect on God\'s faithfulness and rest in His peace.',
      bibleVerse: 'Psalm 4:8 — In peace I will lie down and sleep, for you alone, LORD, make me dwell in safety.',
    },
  ];
  for (const p of prayers) {
    await write('dailyPrayers', p.id, { ...p, createdAt: daysAgo(30) });
  }
}

async function seedPrayerLogs() {
  console.log('\n📖  Prayer Logs');
  await write('prayerLogs', 'plog-001', {
    userId:      MEMBER1_UID,
    prayerType:  'morning',
    prayedAt:    daysAgo(0),
    streak:      7,
  });
  await write('prayerLogs', 'plog-002', {
    userId:      MEMBER2_UID,
    prayerType:  'evening',
    prayedAt:    daysAgo(1),
    streak:      3,
  });
}

async function seedAttendance() {
  console.log('\n✅  Attendance');
  await write('attendance', 'att-001', {
    meetingTitle:  'Sunday Service',
    date:          daysAgo(7),
    totalCapacity: 200,
    attendees: [
      { userId: MEMBER1_UID, name: 'Mekdes Haile',  checkedInAt: daysAgo(7) },
      { userId: MEMBER2_UID, name: 'Dawit Bekele',  checkedInAt: daysAgo(7) },
    ],
    qrCode:  'QR_ATT_001',
    status:  'completed',
  });
  await write('attendance', 'att-002', {
    meetingTitle:  'Wednesday Bible Study',
    date:          daysFromNow(2),
    totalCapacity: 50,
    attendees:     [],
    qrCode:        'QR_ATT_002',
    status:        'upcoming',
  });
}

async function seedBlogPosts() {
  console.log('\n📝  Blog Posts');
  await write('blogPosts', 'blog-001', {
    authorId:   ADMIN_UID,
    authorName: 'Aba Gorgorios',
    title:      'Walking in Faith: A Reflection',
    content:    'Faith is not the absence of doubt — it is the courage to move forward despite it. '
              + 'In this reflection, we explore what it means to trust God in uncertain times...',
    category:   'Devotional',
    imageURL:   'https://via.placeholder.com/800x400',
    pinned:     true,
    status:     'published',
    publishAt:  daysAgo(14),
    createdAt:  daysAgo(14),
    comments:   [],
  });
  await write('blogPosts', 'blog-002', {
    authorId:   ADMIN_UID,
    authorName: 'Aba Gorgorios',
    title:      'Community Update — May 2026',
    content:    'Dear congregation, we are excited to share updates on our building project '
              + 'and upcoming events for the coming months...',
    category:   'Announcement',
    pinned:     false,
    status:     'draft',
    createdAt:  daysAgo(1),
    comments:   [],
  });
}

async function seedEvents() {
  console.log('\n🎉  Events');
  await write('events', 'event-001', {
    title:       'Annual Church Picnic',
    description: 'Join us for a day of fellowship, food, and fun at Entoto Park. '
                + 'All families welcome!',
    date:        daysFromNow(14),
    endDate:     daysFromNow(14),
    time:        '10:00',
    duration:    360,
    location:    'Entoto Park, Addis Ababa',
    price:       0,
    paymentMode: 'free',
    guestEmails: [],
    posterURL:   'https://via.placeholder.com/600x400',
    reminderTime: 1440,
    rsvps:       [],
    createdAt:   daysAgo(7),
  });
  await write('events', 'event-002', {
    title:       'Youth Prayer Night',
    description: 'A special evening of worship and prayer for the youth of our congregation.',
    date:        daysFromNow(5),
    time:        '19:00',
    duration:    120,
    location:    'Main Sanctuary',
    price:       0,
    paymentMode: 'free',
    guestEmails: ['youth@example.com'],
    reminderTime: 60,
    rsvps:       [
      {
        userId:       MEMBER1_UID,
        name:         'Mekdes Haile',
        email:        'mekdes@example.com',
        status:       'attending',
        registeredAt: daysAgo(2),
      },
    ],
    createdAt: daysAgo(10),
  });
}

async function seedGallery() {
  console.log('\n🖼   Gallery');
  const items = [
    { id: 'gal-001', title: 'Easter Sunday 2026',   category: 'Celebrations' },
    { id: 'gal-002', title: 'Christmas Program',    category: 'Celebrations' },
    { id: 'gal-003', title: 'Community Outreach',   category: 'Outreach'     },
  ];
  for (const item of items) {
    await write('gallery', item.id, {
      imageURL:   `https://via.placeholder.com/800x600?text=${item.title.replace(/ /g, '+')}`,
      title:      item.title,
      category:   item.category,
      churchName: 'Nablis Church',
      date:       daysAgo(Math.floor(Math.random() * 60) + 1),
      uploadedBy: ADMIN_UID,
      createdAt:  daysAgo(30),
    });
  }
}

async function seedMessages() {
  console.log('\n💬  Messages');
  await write('messages', 'msg-001', {
    senderId:   MEMBER1_UID,
    receiverId: MEMBER2_UID,
    content:    'Peace be with you, Dawit! Are you coming to the prayer night on Friday?',
    read:       true,
    createdAt:  daysAgo(2),
  });
  await write('messages', 'msg-002', {
    senderId:   MEMBER2_UID,
    receiverId: MEMBER1_UID,
    content:    'Yes, I will be there! God bless you, Mekdes.',
    read:       false,
    createdAt:  daysAgo(2),
  });
}

async function seedTestimonies() {
  console.log('\n✨  Testimonies');
  await write('testimonies', 'test-001', {
    authorId:   MEMBER1_UID,
    authorName: 'Mekdes Haile',
    title:      'Healing from Illness',
    content:    'After months of illness that doctors could not explain, I prayed with the '
              + 'congregation and within a week my health was fully restored. '
              + 'To God be all the glory!',
    category:   'healing',
    status:     'published',
    likes:      24,
    createdAt:  daysAgo(21),
  });
  await write('testimonies', 'test-002', {
    authorId:   MEMBER3_UID,
    authorName: 'Tigist Alemu',
    title:      'God Provided for My Family',
    content:    'When I lost my job and had no way to pay rent, I prayed and committed '
              + 'my situation to the Lord. Within two weeks I had a new job and back-pay '
              + 'that covered everything.',
    category:   'provision',
    status:     'pending',
    likes:      0,
    createdAt:  daysAgo(3),
  });
}

async function seedBibleStudies() {
  console.log('\n📚  Bible Studies');
  await write('bibleStudies', 'study-001', {
    title:     'The Gospel of John — Deep Dive',
    teacher:   'Aba Gorgorios',
    members:   [MEMBER1_UID, MEMBER2_UID],
    startDate: daysAgo(14),
    materials: [
      { title: 'Session 1 Notes', url: 'https://example.com/john-s1.pdf', type: 'pdf' },
      { title: 'Introduction Video', url: 'https://example.com/john-intro', type: 'video' },
    ],
    status: 'started',
  });
  await write('bibleStudies', 'study-002', {
    title:     'Psalms for Daily Living',
    teacher:   'Aba Gorgorios',
    members:   [],
    startDate: daysFromNow(7),
    materials: [],
    status:    'pending',
  });
}

async function seedNotifications() {
  console.log('\n🔔  Notifications');
  await write('notifications', 'notif-001', {
    userId:    MEMBER1_UID,
    type:      'appointment_confirmed',
    title:     'Appointment Confirmed',
    body:      'Your confession appointment on ' + new Date(Date.now() + 3 * 86400000).toDateString() + ' at 10:00 has been confirmed.',
    read:      false,
    createdAt: daysAgo(1),
  });
  await write('notifications', 'notif-002', {
    userId:    MEMBER2_UID,
    type:      'new_event',
    title:     'New Event: Youth Prayer Night',
    body:      'A new prayer night event has been scheduled for Friday. Tap to learn more.',
    read:      false,
    createdAt: daysAgo(1),
  });
}

async function seedChallenges() {
  console.log('\n🏆  Challenges');
  await write('challenges', 'challenge-001', {
    title:        '30 Days of Prayer',
    description:  'Commit to praying every morning for 30 days. Log each session using the Daily Prayers feature.',
    startDate:    daysAgo(5),
    endDate:      daysFromNow(25),
    createdBy:    ADMIN_UID,
    participants: [MEMBER1_UID, MEMBER2_UID],
  });
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log(DRY_RUN ? '🧪  DRY RUN — no data will be written\n' : '🌱  Seeding Nablis Firestore...');

  await seedUsers();
  await seedAppointments();
  await seedDailyPrayers();
  await seedPrayerLogs();
  await seedAttendance();
  await seedBlogPosts();
  await seedEvents();
  await seedGallery();
  await seedMessages();
  await seedTestimonies();
  await seedBibleStudies();
  await seedNotifications();
  await seedChallenges();

  console.log('\n✅  Seed complete.\n');
  process.exit(0);
}

main().catch((err) => {
  console.error('\n❌  Seed failed:', err);
  process.exit(1);
});
