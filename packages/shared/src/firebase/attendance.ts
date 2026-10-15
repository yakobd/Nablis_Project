import { doc, getDoc, serverTimestamp, setDoc, type Timestamp } from 'firebase/firestore';
import { db } from './config';

// Attendance model:
//   attendance/{sessionId}       session info (readable by active members)
//   attendanceCodes/{sessionId}  { code } — staff only; shown as a QR code
//   checkIns/{sessionId}_{uid}   one check-in per member per session
// Firestore rules only accept a check-in while the session is active and the
// submitted code matches attendanceCodes.

const QR_PREFIX = 'nablis-checkin';
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no 0/O/1/I

export function newAttendanceCode(length = 6): string {
  let out = '';
  for (let i = 0; i < length; i++) out += ALPHABET[Math.floor(Math.random() * ALPHABET.length)];
  return out;
}

export function checkInQRValue(sessionId: string, code: string): string {
  return `${QR_PREFIX}:${sessionId}:${code}`;
}

export function parseCheckInQR(value: string): { sessionId: string; code: string } | null {
  const [prefix, sessionId, code] = value.trim().split(':');
  return prefix === QR_PREFIX && sessionId && code ? { sessionId, code } : null;
}

export function checkInId(sessionId: string, userId: string): string {
  return `${sessionId}_${userId}`;
}

export type CheckInResult = 'ok' | 'already' | 'invalid';

export async function checkIn(
  sessionId: string,
  code: string,
  user: { id: string; displayName?: string | null; email?: string | null }
): Promise<CheckInResult> {
  const ref = doc(db, 'checkIns', checkInId(sessionId, user.id));
  if ((await getDoc(ref)).exists()) return 'already';
  try {
    await setDoc(ref, {
      sessionId,
      userId: user.id,
      userName: user.displayName || user.email || 'Member',
      code: code.trim().toUpperCase(),
      checkedInAt: serverTimestamp(),
    });
    return 'ok';
  } catch {
    // Rejected by rules: wrong code or session not active.
    return 'invalid';
  }
}

export interface AttendanceSummary {
  attended: number;
  /** Sessions the member was expected at. */
  total: number;
  /** Rounded percentage, or null when there were no sessions yet. */
  percent: number | null;
}

interface SessionLike {
  id: string;
  status?: string;
  date?: Timestamp | null;
  createdAt?: Timestamp | null;
  attendees?: { userId: string }[];
}

/**
 * A member's attendance rate: sessions they checked in to, out of the
 * sessions that have started since they joined. `checkedIn` holds the
 * session ids from their checkIns; legacy inline attendees count too.
 */
export function attendanceSummary(
  sessions: SessionLike[],
  userId: string,
  checkedIn: Set<string>,
  joinedAt?: Timestamp | null,
  /** Rate as it stood at this time (epoch ms), e.g. the end of last month. */
  asOf?: number,
): AttendanceSummary {
  const since = joinedAt?.toMillis?.() ?? 0;
  const now = asOf ?? Date.now();
  const went = (s: SessionLike) => checkedIn.has(s.id) || (s.attendees ?? []).some((a) => a.userId === userId);
  const relevant = sessions.filter((s) => {
    if (s.status === 'upcoming') return false;
    const at = (s.date ?? s.createdAt)?.toMillis?.() ?? 0;
    // Gatherings that haven't happened yet only count once attended.
    if (at > now) return !asOf && went(s);
    // Sessions on the day they joined still count.
    return at >= since - 24 * 60 * 60 * 1000;
  });
  const attended = relevant.filter(went).length;
  return {
    attended,
    total: relevant.length,
    percent: relevant.length ? Math.round((attended / relevant.length) * 100) : null,
  };
}
