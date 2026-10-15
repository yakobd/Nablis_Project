import { arrayRemove, arrayUnion, doc, increment, serverTimestamp, setDoc, type Timestamp } from 'firebase/firestore';
import { db } from './config';

// Challenge model:
//   challenges/{id}                      created by staff
//   challengeProgress/{id}_{uid}         a member's progress once they join
//
// Three kinds:
//   daily      do it every day from start to end (e.g. 40 days of prayer)
//   goal       reach a total (e.g. read 50 Psalms); members log amounts
//   checklist  complete a list of steps

export type ChallengeKind = 'daily' | 'goal' | 'checklist';

export const CHALLENGE_CATEGORIES = [
  { key: 'prayer', label: 'Prayer' },
  { key: 'fasting', label: 'Fasting' },
  { key: 'scripture', label: 'Scripture' },
  { key: 'service', label: 'Service' },
  { key: 'worship', label: 'Worship' },
  { key: 'other', label: 'Other' },
] as const;

export interface ChallengeDoc {
  id: string;
  title: string;
  description: string;
  category: string;
  kind: ChallengeKind;
  /** YYYY-MM-DD, inclusive. */
  startDate: string;
  endDate: string;
  /** goal: the total to reach. */
  target?: number;
  /** goal: what is counted, e.g. "chapters". */
  unit?: string;
  /** checklist: the steps. */
  steps?: string[];
  imageURL?: string | null;
  createdBy?: string;
  createdAt?: Timestamp;
}

export interface ChallengeProgress {
  id: string;
  challengeId: string;
  userId: string;
  userName?: string;
  /** daily: days done (YYYY-MM-DD). */
  days?: string[];
  /** goal: amount logged so far. */
  count?: number;
  /** checklist: indices of finished steps. */
  stepsDone?: number[];
  joinedAt?: Timestamp;
  updatedAt?: Timestamp;
}

export function challengeProgressId(challengeId: string, uid: string) {
  return `${challengeId}_${uid}`;
}

function iso(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Every day of a challenge, start to end inclusive. */
export function challengeDays(c: Pick<ChallengeDoc, 'startDate' | 'endDate'>): string[] {
  const out: string[] = [];
  const [ys, ms, ds] = c.startDate.split('-').map(Number);
  const end = c.endDate;
  for (let d = new Date(ys, ms - 1, ds); iso(d) <= end && out.length < 400; d.setDate(d.getDate() + 1)) out.push(iso(d));
  return out;
}

export type ChallengeStatus = 'upcoming' | 'active' | 'ended';

export function challengeStatus(c: Pick<ChallengeDoc, 'startDate' | 'endDate'>, today = iso(new Date())): ChallengeStatus {
  if (today < c.startDate) return 'upcoming';
  if (today > c.endDate) return 'ended';
  return 'active';
}

export function challengeCategory(key?: string) {
  return CHALLENGE_CATEGORIES.find((c) => c.key === key) ?? CHALLENGE_CATEGORIES[CHALLENGE_CATEGORIES.length - 1];
}

/** Units of work in the challenge and how many are done. */
export function challengeTotals(c: ChallengeDoc, p?: Partial<ChallengeProgress> | null): { done: number; total: number; pct: number; complete: boolean } {
  let done = 0;
  let total = 1;
  if (c.kind === 'daily') {
    const days = new Set(challengeDays(c));
    total = days.size || 1;
    done = (p?.days ?? []).filter((d) => days.has(d)).length;
  } else if (c.kind === 'goal') {
    total = Math.max(1, c.target ?? 1);
    done = Math.min(total, Math.max(0, p?.count ?? 0));
  } else {
    total = Math.max(1, c.steps?.length ?? 1);
    done = new Set((p?.stepsDone ?? []).filter((i) => i >= 0 && i < total)).size;
  }
  return { done, total, pct: Math.round((done / total) * 100), complete: done >= total };
}

const base = (c: Pick<ChallengeDoc, 'id'>, user: { id: string; displayName?: string | null }) => ({
  challengeId: c.id,
  userId: user.id,
  userName: user.displayName || 'Member',
  updatedAt: serverTimestamp(),
});

export function joinChallenge(c: Pick<ChallengeDoc, 'id'>, user: { id: string; displayName?: string | null }) {
  return setDoc(doc(db, 'challengeProgress', challengeProgressId(c.id, user.id)), {
    ...base(c, user), days: [], count: 0, stepsDone: [], joinedAt: serverTimestamp(),
  }, { merge: true });
}

export function setChallengeDay(c: Pick<ChallengeDoc, 'id'>, user: { id: string; displayName?: string | null }, date: string, done: boolean) {
  return setDoc(doc(db, 'challengeProgress', challengeProgressId(c.id, user.id)), {
    ...base(c, user), days: done ? arrayUnion(date) : arrayRemove(date),
  }, { merge: true });
}

export function addChallengeCount(c: Pick<ChallengeDoc, 'id'>, user: { id: string; displayName?: string | null }, amount: number) {
  return setDoc(doc(db, 'challengeProgress', challengeProgressId(c.id, user.id)), {
    ...base(c, user), count: increment(amount),
  }, { merge: true });
}

export function setChallengeStep(c: Pick<ChallengeDoc, 'id'>, user: { id: string; displayName?: string | null }, index: number, done: boolean) {
  return setDoc(doc(db, 'challengeProgress', challengeProgressId(c.id, user.id)), {
    ...base(c, user), stepsDone: done ? arrayUnion(index) : arrayRemove(index),
  }, { merge: true });
}
