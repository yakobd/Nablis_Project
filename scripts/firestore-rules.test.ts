/**
 * Firestore security rules tests.
 *
 * RUN (starts the Firestore emulator, needs Java 11+):
 *   npm run test:rules -w scripts
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { after, before, beforeEach, describe, test } from 'node:test';
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import {
  addDoc, arrayUnion, collection, deleteDoc, doc, getDoc, getDocs,
  orderBy, query, serverTimestamp, setDoc, updateDoc, where, type Firestore,
} from 'firebase/firestore';

let env: RulesTestEnvironment;

const db = (uid?: string): Firestore =>
  (uid ? env.authenticatedContext(uid) : env.unauthenticatedContext()).firestore() as unknown as Firestore;

const SA = 'super', AD = 'admin', M1 = 'm1', M2 = 'm2', P1 = 'p1';

before(async () => {
  env = await initializeTestEnvironment({
    projectId: 'demo-nablis',
    firestore: { rules: readFileSync(resolve(__dirname, '../firestore.rules'), 'utf8') },
  });
});

after(async () => { await env.cleanup(); });

beforeEach(async () => {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async (ctx) => {
    const s = ctx.firestore() as unknown as Firestore;
    const user = (id: string, role: string, status: string) =>
      setDoc(doc(s, 'users', id), { displayName: id, email: `${id}@x.com`, role, status });
    await user(SA, 'super_admin', 'active');
    await user(AD, 'admin', 'active');
    await user(M1, 'member', 'active');
    await user(M2, 'member', 'active');
    await user(P1, 'member', 'pending');

    await setDoc(doc(s, 'appointments', 'a1'), { memberId: M1, userId: M1, status: 'pending', time: '10:00' });
    await setDoc(doc(s, 'appointments', 'a2'), { memberId: M2, status: 'pending', time: '11:00' });
    await setDoc(doc(s, 'conversations', 'c1'), { memberId: M1, memberName: 'm1', unread: 0 });
    await setDoc(doc(s, 'conversations', 'c2'), { memberId: M2, memberName: 'm2', unread: 0 });
    await setDoc(doc(s, 'conversations', 'c2', 'messages', 'x'), { senderId: M2, content: 'private' });
    await setDoc(doc(s, 'notifications', 'n1'), { userId: M1, title: 'Hi', read: false });
    await setDoc(doc(s, 'blogPosts', 'pub'), { status: 'published', internal: false, title: 'Public' });
    await setDoc(doc(s, 'blogPosts', 'int'), { status: 'published', internal: true, title: 'Internal' });
    await setDoc(doc(s, 'events', 'e1'), { title: 'Liturgy', rsvps: [] });
    await setDoc(doc(s, 'bibleStudies', 'b1'), { title: 'John', members: [M2] });
    await setDoc(doc(s, 'prayerLogs', 'l1'), { userId: M2, prayerType: 'morning' });
  });
});

describe('users', () => {
  test('sign-up creates own pending member doc', () =>
    assertSucceeds(setDoc(doc(db('new'), 'users', 'new'), { role: 'member', status: 'pending', email: 'n@x.com' })));
  test('sign-up cannot create itself as super_admin', () =>
    assertFails(setDoc(doc(db('new'), 'users', 'new'), { role: 'super_admin', status: 'active' })));
  test('sign-up cannot create itself as active', () =>
    assertFails(setDoc(doc(db('new'), 'users', 'new'), { role: 'member', status: 'active' })));

  test('member edits own profile', () => assertSucceeds(updateDoc(doc(db(M1), 'users', M1), { displayName: 'New' })));
  test('member cannot promote self', () => assertFails(updateDoc(doc(db(M1), 'users', M1), { role: 'super_admin' })));
  test('pending user cannot self-approve', () => assertFails(updateDoc(doc(db(P1), 'users', P1), { status: 'active' })));
  test('member cannot read another member', () => assertFails(getDoc(doc(db(M1), 'users', M2))));
  test('member cannot list all users', () => assertFails(getDocs(collection(db(M1), 'users'))));
  test('pending user can find super admins (registration notice)', () =>
    assertSucceeds(getDocs(query(collection(db(P1), 'users'), where('role', '==', 'super_admin')))));

  test('admin reads members', () => assertSucceeds(getDocs(collection(db(AD), 'users'))));
  test('admin edits a member profile', () => assertSucceeds(updateDoc(doc(db(AD), 'users', M1), { city: 'Dubai' })));
  test('admin cannot approve members', () => assertFails(updateDoc(doc(db(AD), 'users', P1), { status: 'active' })));
  test('admin cannot edit super admin', () => assertFails(updateDoc(doc(db(AD), 'users', SA), { displayName: 'x' })));
  test('super admin approves and promotes', () =>
    assertSucceeds(updateDoc(doc(db(SA), 'users', P1), { status: 'active', role: 'admin' })));
  test('member deletes own account', () => assertSucceeds(deleteDoc(doc(db(M1), 'users', M1))));
  test('member cannot delete others', () => assertFails(deleteDoc(doc(db(M1), 'users', M2))));
});

describe('appointments', () => {
  const booking = (memberId: string, status = 'pending') =>
    ({ memberId, serviceType: 'confession', status, createdAt: serverTimestamp() });

  test('member books for self', () => assertSucceeds(addDoc(collection(db(M1), 'appointments'), booking(M1))));
  test('member cannot book for someone else', () => assertFails(addDoc(collection(db(M1), 'appointments'), booking(M2))));
  test('member cannot self-confirm a booking', () =>
    assertFails(addDoc(collection(db(M1), 'appointments'), booking(M1, 'confirmed'))));
  test('pending user cannot book', () => assertFails(addDoc(collection(db(P1), 'appointments'), booking(P1))));

  test('member lists own by memberId (web)', () =>
    assertSucceeds(getDocs(query(collection(db(M1), 'appointments'), where('memberId', '==', M1)))));
  test('member lists own by userId (mobile)', () =>
    assertSucceeds(getDocs(query(collection(db(M1), 'appointments'), where('userId', '==', M1)))));
  test('member cannot list all', () => assertFails(getDocs(collection(db(M1), 'appointments'))));
  test("member cannot read another's", () => assertFails(getDoc(doc(db(M1), 'appointments', 'a2'))));

  test('member reschedules own', () =>
    assertSucceeds(updateDoc(doc(db(M1), 'appointments', 'a1'), { time: '12:00', status: 'pending' })));
  test('member cancels own', () => assertSucceeds(updateDoc(doc(db(M1), 'appointments', 'a1'), { status: 'cancelled' })));
  test('member cannot confirm own', () => assertFails(updateDoc(doc(db(M1), 'appointments', 'a1'), { status: 'confirmed' })));
  test('member cannot reassign own', () => assertFails(updateDoc(doc(db(M1), 'appointments', 'a1'), { memberId: M2 })));
  test('admin lists all and confirms', async () => {
    await assertSucceeds(getDocs(collection(db(AD), 'appointments')));
    await assertSucceeds(updateDoc(doc(db(AD), 'appointments', 'a2'), { status: 'confirmed' }));
  });
});

describe('appointment slots', () => {
  beforeEach(async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore() as unknown as Firestore, 'appointmentSlots', '2026-10-20_0900'), { memberId: M2 });
    });
  });
  test('member claims a free slot', () =>
    assertSucceeds(setDoc(doc(db(M1), 'appointmentSlots', '2026-10-20_1030'), { memberId: M1 })));
  test('member cannot take a booked slot', () =>
    assertFails(setDoc(doc(db(M1), 'appointmentSlots', '2026-10-20_0900'), { memberId: M1 })));
  test('member cannot claim a slot for someone else', () =>
    assertFails(setDoc(doc(db(M1), 'appointmentSlots', '2026-10-20_1100'), { memberId: M2 })));
  test("member cannot free someone else's slot", () =>
    assertFails(deleteDoc(doc(db(M1), 'appointmentSlots', '2026-10-20_0900'))));
  test('owner frees own slot', () =>
    assertSucceeds(deleteDoc(doc(db(M2), 'appointmentSlots', '2026-10-20_0900'))));
  test('member sees which slots are taken', () =>
    assertSucceeds(getDocs(collection(db(M1), 'appointmentSlots'))));
  test('member reschedules with a new slot id', () =>
    assertSucceeds(updateDoc(doc(db(M1), 'appointments', 'a1'), { time: '10:30', slotId: '2026-10-20_1030', status: 'pending' })));
});

describe('messaging', () => {
  test('member starts own conversation', () =>
    assertSucceeds(addDoc(collection(db(M1), 'conversations'), { memberId: M1, unread: 0 })));
  test("member cannot read another member's conversation", () => assertFails(getDoc(doc(db(M1), 'conversations', 'c2'))));
  test("member cannot read another member's messages", () =>
    assertFails(getDocs(collection(db(M1), 'conversations', 'c2', 'messages'))));
  test('member cannot list all conversations', () => assertFails(getDocs(collection(db(M1), 'conversations'))));
  test('member lists own conversations', () =>
    assertSucceeds(getDocs(query(collection(db(M1), 'conversations'), where('memberId', '==', M1)))));
  test('member sends in own conversation', () =>
    assertSucceeds(addDoc(collection(db(M1), 'conversations', 'c1', 'messages'), { senderId: M1, content: 'hi' })));
  test('member cannot spoof sender', () =>
    assertFails(addDoc(collection(db(M1), 'conversations', 'c1', 'messages'), { senderId: SA, content: 'hi' })));
  test('member cannot post in another conversation', () =>
    assertFails(addDoc(collection(db(M1), 'conversations', 'c2', 'messages'), { senderId: M1, content: 'hi' })));
  test('admin reads inbox and replies', async () => {
    await assertSucceeds(getDocs(collection(db(AD), 'conversations')));
    await assertSucceeds(addDoc(collection(db(AD), 'conversations', 'c2', 'messages'), { senderId: AD, content: 'ok' }));
  });
});

describe('notifications', () => {
  test('new registrant notifies super admin', () =>
    assertSucceeds(addDoc(collection(db(P1), 'notifications'), { userId: SA, createdBy: P1, title: 'New member', read: false })));
  test('member cannot notify another member', () =>
    assertFails(addDoc(collection(db(M1), 'notifications'), { userId: M2, createdBy: M1, title: 'spam', read: false })));
  test('admin notifies a member', () =>
    assertSucceeds(addDoc(collection(db(AD), 'notifications'), { userId: M1, createdBy: AD, title: 'Confirmed', read: false })));
  test('cannot forge createdBy', () =>
    assertFails(addDoc(collection(db(AD), 'notifications'), { userId: M1, createdBy: SA, title: 'x', read: false })));
  test('member clears own unread counter', () =>
    assertSucceeds(updateDoc(doc(db(M1), 'conversations', 'c1'), { unreadByMember: 0 })));
  test('member lists own', () =>
    assertSucceeds(getDocs(query(collection(db(M1), 'notifications'), where('userId', '==', M1)))));
  test("member cannot read others'", () =>
    assertFails(getDocs(query(collection(db(M2), 'notifications'), where('userId', '==', M1)))));
  test('member marks read', () => assertSucceeds(updateDoc(doc(db(M1), 'notifications', 'n1'), { read: true })));
  test('member cannot rewrite content', () => assertFails(updateDoc(doc(db(M1), 'notifications', 'n1'), { title: 'x' })));
});

describe('blog', () => {
  const publicQuery = (f: Firestore) =>
    query(collection(f, 'blogPosts'), where('status', '==', 'published'), where('internal', '==', false));

  test('public site lists published posts', () => assertSucceeds(getDocs(publicQuery(db()))));
  test('public cannot read internal post', () => assertFails(getDoc(doc(db(), 'blogPosts', 'int'))));
  test('public cannot list everything', () => assertFails(getDocs(collection(db(), 'blogPosts'))));
  test('pending user cannot read internal post', () => assertFails(getDoc(doc(db(P1), 'blogPosts', 'int'))));
  test('member lists all', () => assertSucceeds(getDocs(collection(db(M1), 'blogPosts'))));
  test('member cannot write posts', () => assertFails(addDoc(collection(db(M1), 'blogPosts'), { title: 'x' })));
  test('member counts a view', () => assertSucceeds(updateDoc(doc(db(M1), 'blogPosts', 'pub'), { views: 1 })));
  test('member cannot inflate views', () => assertFails(updateDoc(doc(db(M1), 'blogPosts', 'pub'), { views: 50 })));
  test('member cannot edit a post', () => assertFails(updateDoc(doc(db(M1), 'blogPosts', 'pub'), { title: 'x' })));
  test('admin writes posts', () => assertSucceeds(addDoc(collection(db(AD), 'blogPosts'), { title: 'x' })));
  test('member comments as self', () =>
    assertSucceeds(addDoc(collection(db(M1), 'blogPosts', 'pub', 'comments'), { authorId: M1, content: 'Amen' })));
  test('member cannot comment as someone else', () =>
    assertFails(addDoc(collection(db(M1), 'blogPosts', 'pub', 'comments'), { authorId: M2, content: 'x' })));
});

describe('events, bible study, testimonies, prayers', () => {
  test('member RSVPs for self', () =>
    assertSucceeds(setDoc(doc(db(M1), 'events', 'e1', 'rsvps', M1), { userId: M1, userName: 'm1', status: 'attending' })));
  test('member cannot RSVP for someone else', () =>
    assertFails(setDoc(doc(db(M1), 'events', 'e1', 'rsvps', M2), { userId: M2, userName: 'm2', status: 'attending' })));
  test("member cannot read others' RSVPs", () => assertFails(getDocs(collection(db(M1), 'events', 'e1', 'rsvps'))));
  test('staff reads RSVP list', () => assertSucceeds(getDocs(collection(db(AD), 'events', 'e1', 'rsvps'))));
  test('member cannot edit event', () => assertFails(updateDoc(doc(db(M1), 'events', 'e1'), { title: 'x' })));
  test('member cannot tamper with legacy RSVP array', () =>
    assertFails(updateDoc(doc(db(M1), 'events', 'e1'), { rsvps: arrayUnion({ userId: M2 }) })));

  test('member joins study', () =>
    assertSucceeds(updateDoc(doc(db(M1), 'bibleStudies', 'b1'), { members: arrayUnion(M1) })));
  test('member cannot add someone else', () =>
    assertFails(updateDoc(doc(db(M1), 'bibleStudies', 'b1'), { members: arrayUnion('m3') })));
  test('member cannot remove others', () =>
    assertFails(updateDoc(doc(db(M1), 'bibleStudies', 'b1'), { members: [M1] })));

  test('member ticks own study routine', () =>
    assertSucceeds(setDoc(doc(db(M1), 'studyProgress', `b1_${M1}`), { userId: M1, studyId: 'b1', checks: { '2026-10-13': [0] } })));
  test("member cannot write someone else's progress", () =>
    assertFails(setDoc(doc(db(M1), 'studyProgress', `b1_${M2}`), { userId: M2, studyId: 'b1', checks: {} })));
  test('staff reads study progress', () => assertSucceeds(getDocs(collection(db(AD), 'studyProgress'))));
  test("member cannot read someone else's pending testimony", async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore() as unknown as Firestore, 'testimonies', 't-pending'), { authorId: M2, status: 'pending' });
    });
    await assertFails(getDoc(doc(db(M1), 'testimonies', 't-pending')));
    await assertSucceeds(getDoc(doc(db(M2), 'testimonies', 't-pending')));
  });
  test('member lists published testimonies', () =>
    assertSucceeds(getDocs(query(collection(db(M1), 'testimonies'), where('status', '==', 'published')))));
  test('member encourages a story (only self)', async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore() as unknown as Firestore, 'testimonies', 't-pub'), { authorId: M2, status: 'published', encouragedBy: [M2] });
    });
    await assertSucceeds(updateDoc(doc(db(M1), 'testimonies', 't-pub'), { encouragedBy: arrayUnion(M1) }));
    await assertFails(updateDoc(doc(db(M1), 'testimonies', 't-pub'), { encouragedBy: [] }));
  });
  test('member submits pending testimony', () =>
    assertSucceeds(addDoc(collection(db(M1), 'testimonies'), { authorId: M1, status: 'pending' })));
  test('member cannot self-publish testimony', () =>
    assertFails(addDoc(collection(db(M1), 'testimonies'), { authorId: M1, status: 'published' })));
  test('admin publishes testimony directly', () =>
    assertSucceeds(addDoc(collection(db(AD), 'testimonies'), { authorName: 'x', status: 'published' })));

  test('member logs own prayer', () =>
    assertSucceeds(addDoc(collection(db(M1), 'prayerLogs'), { userId: M1, prayerType: 'morning' })));
  test('member cannot log for others', () =>
    assertFails(addDoc(collection(db(M1), 'prayerLogs'), { userId: M2, prayerType: 'morning' })));
  test("member cannot read others' logs", () => assertFails(getDoc(doc(db(M1), 'prayerLogs', 'l1'))));
  test('super admin monitors all logs', () => assertSucceeds(getDocs(collection(db(SA), 'prayerLogs'))));
});

describe('attendance', () => {
  beforeEach(async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      const s = ctx.firestore() as unknown as Firestore;
      await setDoc(doc(s, 'attendance', 'live'), { meetingTitle: 'Monthly', status: 'active' });
      await setDoc(doc(s, 'attendanceCodes', 'live'), { code: 'ABC123' });
      await setDoc(doc(s, 'attendance', 'done'), { meetingTitle: 'Old', status: 'completed' });
      await setDoc(doc(s, 'attendanceCodes', 'done'), { code: 'OLD999' });
    });
  });
  const entry = (uid: string, sessionId: string, code: string) =>
    ({ userId: uid, sessionId, code, userName: uid, checkedInAt: serverTimestamp() });

  test('member checks in with the right code', () =>
    assertSucceeds(setDoc(doc(db(M1), 'checkIns', `live_${M1}`), entry(M1, 'live', 'ABC123'))));
  test('wrong code is rejected', () =>
    assertFails(setDoc(doc(db(M1), 'checkIns', `live_${M1}`), entry(M1, 'live', 'WRONG1'))));
  test('closed session is rejected', () =>
    assertFails(setDoc(doc(db(M1), 'checkIns', `done_${M1}`), entry(M1, 'done', 'OLD999'))));
  test('cannot check in someone else', () =>
    assertFails(setDoc(doc(db(M1), 'checkIns', `live_${M2}`), entry(M2, 'live', 'ABC123'))));
  test('doc id must match session and user', () =>
    assertFails(setDoc(doc(db(M1), 'checkIns', 'random'), entry(M1, 'live', 'ABC123'))));
  test('pending user cannot check in', () =>
    assertFails(setDoc(doc(db(P1), 'checkIns', `live_${P1}`), entry(P1, 'live', 'ABC123'))));
  test('member cannot read the code', () => assertFails(getDoc(doc(db(M1), 'attendanceCodes', 'live'))));
  test('member can probe own missing check-in', () => assertSucceeds(getDoc(doc(db(M1), 'checkIns', `live_${M1}`))));
  test('staff checks a member in by scanning', () =>
    assertSucceeds(setDoc(doc(db(AD), 'checkIns', `live_${M1}`), { sessionId: 'live', userId: M1, checkedInBy: AD, userName: 'm1' })));
  test('staff cannot check in to a closed session', () =>
    assertFails(setDoc(doc(db(AD), 'checkIns', `done_${M1}`), { sessionId: 'done', userId: M1, checkedInBy: AD, userName: 'm1' })));
  test('staff cannot forge who scanned', () =>
    assertFails(setDoc(doc(db(AD), 'checkIns', `live_${M2}`), { sessionId: 'live', userId: M2, checkedInBy: SA, userName: 'm2' })));
  test('member cannot check in others without a code', () =>
    assertFails(setDoc(doc(db(M1), 'checkIns', `live_${M2}`), { sessionId: 'live', userId: M2, checkedInBy: M1, userName: 'm2' })));
  test('staff posts an announcement', () =>
    assertSucceeds(setDoc(doc(db(AD), 'announcements', 'x'), { title: 'Gather up', attendanceRequired: true })));
  test('member reads announcements but cannot post', async () => {
    await assertSucceeds(getDocs(collection(db(M1), 'announcements')));
    await assertFails(setDoc(doc(db(M1), 'announcements', 'y'), { title: 'spam' }));
  });
  test('staff reads code and live check-ins', async () => {
    await assertSucceeds(getDoc(doc(db(AD), 'attendanceCodes', 'live')));
    await assertSucceeds(getDocs(query(collection(db(AD), 'checkIns'), where('sessionId', '==', 'live'))));
  });
});

describe('reading plan & challenges', () => {
  beforeEach(async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      const s = ctx.firestore() as unknown as Firestore;
      await setDoc(doc(s, 'readingPlans', 'rp1'), { title: 'Bible in a year', active: true, entries: [] });
      await setDoc(doc(s, 'challenges', 'c1'), { title: '40 days of prayer' });
    });
  });
  test('member reads the plan', () => assertSucceeds(getDoc(doc(db(M1), 'readingPlans', 'rp1'))));
  test('member cannot edit the plan', () => assertFails(updateDoc(doc(db(M1), 'readingPlans', 'rp1'), { active: false })));
  test('admin uploads a plan', () => assertSucceeds(setDoc(doc(db(AD), 'readingPlans', 'rp2'), { title: 'NT', active: false, entries: [] })));
  test('member ticks own reading', () =>
    assertSucceeds(setDoc(doc(db(M1), 'readingProgress', `rp1_${M1}`), { planId: 'rp1', userId: M1, completed: ['2026-10-13'] })));
  test("member cannot tick someone else's reading", () =>
    assertFails(setDoc(doc(db(M1), 'readingProgress', `rp1_${M2}`), { planId: 'rp1', userId: M2, completed: [] })));
  test('member reads own (missing) reading progress', () => assertSucceeds(getDoc(doc(db(M1), 'readingProgress', `rp1_${M1}`))));
  test('admin lists reading progress', () => assertSucceeds(getDocs(query(collection(db(AD), 'readingProgress'), where('planId', '==', 'rp1')))));
  test('member cannot list all reading progress', () => assertFails(getDocs(collection(db(M1), 'readingProgress'))));

  test('member cannot create a challenge', () => assertFails(addDoc(collection(db(M1), 'challenges'), { title: 'x' })));
  test('member joins a challenge', () =>
    assertSucceeds(setDoc(doc(db(M1), 'challengeProgress', `c1_${M1}`), { challengeId: 'c1', userId: M1, days: [] })));
  test('member cannot join a missing challenge', () =>
    assertFails(setDoc(doc(db(M1), 'challengeProgress', `nope_${M1}`), { challengeId: 'nope', userId: M1, days: [] })));
  test("member cannot write someone else's challenge progress", () =>
    assertFails(setDoc(doc(db(M1), 'challengeProgress', `c1_${M2}`), { challengeId: 'c1', userId: M2, days: [] })));
  test('pending user cannot join', () =>
    assertFails(setDoc(doc(db(P1), 'challengeProgress', `c1_${P1}`), { challengeId: 'c1', userId: P1, days: [] })));
});

describe('settings, gallery, contact', () => {
  test('public reads website settings', () => assertSucceeds(getDoc(doc(db(), 'settings', 'general'))));
  test('super admin saves settings', () =>
    assertSucceeds(setDoc(doc(db(SA), 'settings', 'general'), { ministryName: 'Nablis' })));
  test('super admin sets availability', () =>
    assertSucceeds(setDoc(doc(db(SA), 'settings', 'availability'), { enabled: true, weekly: { '1': ['09:00'] } })));
  test('admin cannot set availability', () =>
    assertFails(setDoc(doc(db(AD), 'settings', 'availability'), { enabled: false })));
  test('member reads availability', () => assertSucceeds(getDoc(doc(db(M1), 'settings', 'availability'))));
  test('public cannot read availability', () => assertFails(getDoc(doc(db(), 'settings', 'availability'))));
  test('admin cannot change settings', () =>
    assertFails(setDoc(doc(db(AD), 'settings', 'general'), { ministryName: 'x' })));
  test('admin sets the verse of the day', () =>
    assertSucceeds(setDoc(doc(db(AD), 'settings', 'verseOfDay'), { text: 'Be still', ref: 'Psalm 46:10' })));
  test('super admin clears the verse of the day', () =>
    assertSucceeds(deleteDoc(doc(db(SA), 'settings', 'verseOfDay'))));
  test('member reads the verse of the day', () => assertSucceeds(getDoc(doc(db(M1), 'settings', 'verseOfDay'))));
  test('member cannot change the verse of the day', () =>
    assertFails(setDoc(doc(db(M1), 'settings', 'verseOfDay'), { text: 'x', ref: 'y' })));
  test('super admin manages groups', () =>
    assertSucceeds(addDoc(collection(db(SA), 'groups'), { name: 'Choir', members: [] })));

  test('public views gallery', () => assertSucceeds(getDocs(collection(db(), 'gallery'))));
  test('member cannot upload to gallery', () => assertFails(addDoc(collection(db(M1), 'gallery'), { title: 'x' })));

  const contact = { senderName: 'A', senderEmail: 'a@x.com', senderPhone: '', serviceType: 'confession',
                    body: 'Hello', read: false, createdAt: serverTimestamp(), source: 'contact_form' };
  test('public submits contact form', () => assertSucceeds(addDoc(collection(db(), 'messages'), contact)));
  test('public cannot add arbitrary fields', () =>
    assertFails(addDoc(collection(db(), 'messages'), { ...contact, isAdmin: true })));
  test('public cannot read contact messages', () => assertFails(getDocs(collection(db(), 'messages'))));
  test('member cannot read contact messages', () => assertFails(getDocs(collection(db(M1), 'messages'))));
});

// Every list query the web and mobile screens run, as the role that runs it.
// Firestore rejects a whole query unless the rules allow every possible result.
describe('app queries', () => {
  const ok = (uid: string, q: (f: Firestore) => Parameters<typeof getDocs>[0]) => assertSucceeds(getDocs(q(db(uid))));
  const c = (f: Firestore, path: string, ...rest: string[]) => collection(f, path, ...rest);

  test('member: published blogs (mobile)', () => ok(M1, (f) => query(c(f, 'blogPosts'), where('status', '==', 'published'))));
  test('member: own blog posts (mobile profile)', () => ok(M1, (f) => query(c(f, 'blogPosts'), where('authorId', '==', M1))));
  test('member: blog comments, newest first', () => ok(M1, (f) => query(c(f, 'blogPosts', 'pub', 'comments'), orderBy('createdAt', 'desc'))));
  test('member: own testimonies', () => ok(M1, (f) => query(c(f, 'testimonies'), where('authorId', '==', M1))));
  test('member: unread notifications (bell)', () => ok(M1, (f) => query(c(f, 'notifications'), where('userId', '==', M1), where('read', '==', false))));
  test('member: own study progress', () => ok(M1, (f) => query(c(f, 'studyProgress'), where('userId', '==', M1))));
  test('member: own challenge progress', () => ok(M1, (f) => query(c(f, 'challengeProgress'), where('userId', '==', M1))));
  test('member: own check-ins', () => ok(M1, (f) => query(c(f, 'checkIns'), where('userId', '==', M1))));
  test('member: own prayer logs', () => ok(M1, (f) => query(c(f, 'prayerLogs'), where('userId', '==', M1))));
  test('member: active reading plan', () => ok(M1, (f) => query(c(f, 'readingPlans'), where('active', '==', true))));
  test('member: announcements, newest first', () => ok(M1, (f) => query(c(f, 'announcements'), orderBy('createdAt', 'desc'))));
  test('member: attendance sessions by date', () => ok(M1, (f) => query(c(f, 'attendance'), orderBy('date', 'desc'))));
  test('member: events by start date', () => ok(M1, (f) => query(c(f, 'events'), orderBy('startDate', 'asc'))));
  test('member: gallery, newest first', () => ok(M1, (f) => query(c(f, 'gallery'), orderBy('createdAt', 'desc'))));
  test('member: bible studies', () => ok(M1, (f) => c(f, 'bibleStudies')));
  test('member: daily prayers', () => ok(M1, (f) => c(f, 'dailyPrayers')));
  test('member: challenges', () => ok(M1, (f) => c(f, 'challenges')));
  test('member: own chat messages', () => ok(M1, (f) => query(c(f, 'conversations', 'c1', 'messages'), orderBy('createdAt', 'asc'))));
  test('member: cannot read another chat', () => assertFails(getDocs(query(c(db(M1), 'conversations', 'c2', 'messages'), orderBy('createdAt', 'asc')))));
  test('member: verse of the day and availability', async () => {
    await assertSucceeds(getDoc(doc(db(M1), 'settings', 'verseOfDay')));
    await assertSucceeds(getDoc(doc(db(M1), 'settings', 'availability')));
  });
  test('member: cannot list other members', () => assertFails(getDocs(query(c(db(M1), 'users'), where('status', '==', 'active')))));

  test('staff: active members', () => ok(AD, (f) => query(c(f, 'users'), where('status', '==', 'active'))));
  test('staff: active regular members', () => ok(AD, (f) => query(c(f, 'users'), where('role', '==', 'member'), where('status', '==', 'active'))));
  test('staff: pending registrations', () => ok(AD, (f) => query(c(f, 'users'), where('status', '==', 'pending'))));
  test('staff: all appointments by date', () => ok(AD, (f) => query(c(f, 'appointments'), orderBy('date', 'asc'))));
  test('staff: pending appointments', () => ok(AD, (f) => query(c(f, 'appointments'), where('status', '==', 'pending'))));
  test('staff: inbox by last message', () => ok(AD, (f) => query(c(f, 'conversations'), orderBy('lastAt', 'desc'))));
  test('staff: unread conversations', () => ok(AD, (f) => query(c(f, 'conversations'), where('unreadByStaff', '>', 0))));
  test('staff: prayer logs this week', () => ok(AD, (f) => query(c(f, 'prayerLogs'), where('prayedAt', '>=', new Date(0)))));
  test('staff: pending testimonies (mobile home)', () => ok(AD, (f) => query(c(f, 'testimonies'), where('status', '==', 'pending'))));
  test('staff: event RSVPs attending', () => ok(AD, (f) => query(c(f, 'events', 'e1', 'rsvps'), where('status', '==', 'attending'))));
  test('staff: challenge participants', () => ok(AD, (f) => query(c(f, 'challengeProgress'), where('challengeId', '==', 'ch1'))));
  test('staff: study participants', () => ok(AD, (f) => query(c(f, 'studyProgress'), where('studyId', '==', 'b1'))));
  test('staff: groups', () => ok(AD, (f) => c(f, 'groups')));

  test('admin cannot approve a registration (Spiritual Father only)', () =>
    assertFails(updateDoc(doc(db(AD), 'users', P1), { status: 'active', role: 'member' })));
  test('super admin approves a registration', () =>
    assertSucceeds(updateDoc(doc(db(SA), 'users', P1), { status: 'active', role: 'member' })));
  test('super admin notifies the approved member', () =>
    assertSucceeds(addDoc(collection(db(SA), 'notifications'), { userId: P1, type: 'member_approved', title: 't', description: 'd', read: false, createdBy: SA })));
  test('pending registrant notifies the Spiritual Father', () =>
    assertSucceeds(addDoc(collection(db(P1), 'notifications'), { userId: SA, type: 'new_member', title: 't', description: 'd', read: false, createdBy: P1 })));
  test('member notifies staff of a submitted testimony', () =>
    assertSucceeds(addDoc(collection(db(M1), 'notifications'), { userId: SA, type: 'testimony_submitted', title: 't', description: 'd', read: false, createdBy: M1 })));
});
