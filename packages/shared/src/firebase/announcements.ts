import {
  collection, doc, getDoc, serverTimestamp, setDoc, Timestamp, updateDoc, writeBatch,
} from 'firebase/firestore';
import { db } from './config';
import { checkInId, newAttendanceCode } from './attendance';

// Announcements may require attendance. When they do, an attendance session
// with the SAME id is created (attendance/{id} + attendanceCodes/{id}) so the
// check-ins feed the regular Attendance reports. At the door, staff scan each
// member's personal pass QR to check them in.

export interface Announcement {
  id: string;
  title: string;
  body: string;
  imageURL?: string | null;
  /** When the gathering happens (optional). */
  eventDate?: Timestamp | null;
  location?: string;
  attendanceRequired: boolean;
  createdBy: string;
  createdByName: string;
  createdAt?: Timestamp;
}

export interface AnnouncementInput {
  title: string;
  body: string;
  imageURL?: string | null;
  eventDate?: Date | null;
  location?: string;
  attendanceRequired: boolean;
}

/** Creates the announcement and, if attendance is mandatory, its attendance session. */
export async function createAnnouncement(
  input: AnnouncementInput,
  author: { id: string; displayName?: string | null; email?: string | null }
): Promise<string> {
  const ref = doc(collection(db, 'announcements'));
  const when = input.eventDate ? Timestamp.fromDate(input.eventDate) : null;
  const batch = writeBatch(db);
  batch.set(ref, {
    title: input.title.trim(),
    body: input.body.trim(),
    imageURL: input.imageURL ?? null,
    eventDate: when,
    location: input.location?.trim() ?? '',
    attendanceRequired: input.attendanceRequired,
    createdBy: author.id,
    createdByName: author.displayName || author.email || 'Ministry',
    createdAt: serverTimestamp(),
  });
  if (input.attendanceRequired) {
    batch.set(doc(db, 'attendance', ref.id), {
      meetingTitle: input.title.trim(),
      date: when ?? serverTimestamp(),
      totalCapacity: 0,
      status: 'active',
      announcementId: ref.id,
      createdAt: serverTimestamp(),
    });
    batch.set(doc(db, 'attendanceCodes', ref.id), { code: newAttendanceCode() });
  }
  await batch.commit();
  return ref.id;
}

/** Turns mandatory attendance on for an existing announcement. */
export async function enableAnnouncementAttendance(a: Announcement): Promise<void> {
  const batch = writeBatch(db);
  batch.update(doc(db, 'announcements', a.id), { attendanceRequired: true });
  batch.set(doc(db, 'attendance', a.id), {
    meetingTitle: a.title,
    date: a.eventDate ?? serverTimestamp(),
    totalCapacity: 0,
    status: 'active',
    announcementId: a.id,
    createdAt: serverTimestamp(),
  }, { merge: true });
  batch.set(doc(db, 'attendanceCodes', a.id), { code: newAttendanceCode() }, { merge: true });
  await batch.commit();
}

// ─── Member pass ──────────────────────────────────────────────────────────────
// QR value: nablis-member:{uid}:{passCode}. passCode lives on the user doc
// (readable by staff), so a pass can't be forged from a uid alone.

const PASS_PREFIX = 'nablis-member';

export function memberPassValue(uid: string, passCode: string): string {
  return `${PASS_PREFIX}:${uid}:${passCode}`;
}

export function parseMemberPass(value: string): { uid: string; passCode: string } | null {
  const [prefix, uid, passCode] = value.trim().split(':');
  return prefix === PASS_PREFIX && uid && passCode ? { uid, passCode } : null;
}

/** Returns the member's pass code, creating one the first time. */
export async function ensurePassCode(user: { id: string; passCode?: string | null }): Promise<string> {
  if (user.passCode) return user.passCode;
  const code = Array.from({ length: 12 }, () => Math.floor(Math.random() * 36).toString(36)).join('').toUpperCase();
  await updateDoc(doc(db, 'users', user.id), { passCode: code });
  return code;
}

export type StaffCheckInResult =
  | { status: 'ok' | 'already'; name: string; photoURL?: string | null }
  | { status: 'invalid' | 'inactive' | 'closed'; name?: string };

/**
 * Staff checks a member in by scanning their pass (or picking them manually,
 * in which case passCode is null and only the uid is used).
 */
export async function staffCheckIn(
  sessionId: string,
  memberId: string,
  passCode: string | null,
  staff: { id: string; displayName?: string | null }
): Promise<StaffCheckInResult> {
  const session = await getDoc(doc(db, 'attendance', sessionId));
  if (!session.exists() || session.data().status !== 'active') return { status: 'closed' };

  const member = await getDoc(doc(db, 'users', memberId));
  if (!member.exists()) return { status: 'invalid' };
  const m = member.data();
  const name = m.displayName || m.email || 'Member';
  if (passCode !== null && m.passCode !== passCode) return { status: 'invalid' };
  if (m.status !== 'active') return { status: 'inactive', name };

  const ref = doc(db, 'checkIns', checkInId(sessionId, memberId));
  if ((await getDoc(ref)).exists()) return { status: 'already', name, photoURL: m.photoURL };
  await setDoc(ref, {
    sessionId,
    userId: memberId,
    userName: name,
    method: passCode === null ? 'manual' : 'scan',
    checkedInBy: staff.id,
    checkedInByName: staff.displayName || 'Staff',
    checkedInAt: serverTimestamp(),
  });
  return { status: 'ok', name, photoURL: m.photoURL };
}
