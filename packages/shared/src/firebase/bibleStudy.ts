import { arrayRemove, arrayUnion, doc, serverTimestamp, setDoc, type Timestamp } from 'firebase/firestore';
import { db } from './config';
import { toIsoDate } from './appointments';

export interface StudySection { heading: string; html: string }
export interface RoutineItem { title: string; details?: string }
export interface StudySession { title: string; date: Timestamp }
export interface StudyMaterial { title?: string; url: string; type?: string }

export const STUDY_THEMES = {
  white:    { label: 'White',    bg: '#FFFFFF', swatch: '#FFFFFF' },
  blue:     { label: 'Blue',     bg: '#EEF4FF', swatch: '#E0EAFF' },
  green:    { label: 'Green',    bg: '#ECFDF5', swatch: '#D1FAE5' },
  yellow:   { label: 'Yellow',   bg: '#FFFBEB', swatch: '#FEF3C7' },
  gradient: { label: 'Gradient', bg: 'linear-gradient(135deg,#FFF7ED 0%,#FDE68A 100%)', swatch: 'linear-gradient(135deg,#FDBA74,#FDE68A)' },
} as const;
export type StudyThemeColor = keyof typeof STUDY_THEMES;

export const STUDY_FONTS = ['Public Sans', 'Inter', 'Lexend', 'Georgia', 'Noto Serif Ethiopic'] as const;

export interface StudyTheme {
  color: StudyThemeColor;
  font: string;
  fontSize: number;
  lineHeight: number;
}

export const DEFAULT_STUDY_THEME: StudyTheme = { color: 'white', font: 'Public Sans', fontSize: 16, lineHeight: 1.6 };

export interface BibleStudyDoc {
  id: string;
  title: string;
  /** Short tag shown above the title, e.g. "GENESIS I". */
  book?: string;
  description?: string;
  teacherId?: string;
  teacherName: string;
  imageURL?: string | null;
  startDate?: Timestamp | null;
  status?: 'pending' | 'started' | 'completed' | 'active' | 'upcoming';
  /** Enrolled member ids (older studies may contain emails). */
  members?: string[];
  materials?: (string | StudyMaterial)[];
  sections?: StudySection[];
  routine?: RoutineItem[];
  sessions?: StudySession[];
  theme?: Partial<StudyTheme>;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

/** studyProgress/{studyId}_{uid}: which routine items the member ticked each day. */
export interface StudyProgress {
  userId: string;
  studyId: string;
  checks?: Record<string, number[]>;
}

export function isEnrolled(s: Pick<BibleStudyDoc, 'members'>, user: { id: string; email?: string | null }): boolean {
  const m = s.members ?? [];
  return m.includes(user.id) || (!!user.email && m.includes(user.email.toLowerCase()));
}

export function studyStatus(s: BibleStudyDoc): 'pending' | 'started' | 'completed' {
  if (s.status === 'completed') return 'completed';
  const start = s.startDate?.toDate?.();
  return start && start.getTime() > Date.now() ? 'pending' : 'started';
}

export function materialLink(m: string | StudyMaterial): { title: string; url: string } {
  if (typeof m === 'string') return { title: decodeURIComponent(m.split('/').pop()?.split('?')[0] || 'Material'), url: m };
  return { title: m.title || decodeURIComponent(m.url.split('/').pop()?.split('?')[0] || 'Material'), url: m.url };
}

/** Monday-based dates (YYYY-MM-DD) of the current week. */
export function currentWeek(): string[] {
  const d = new Date();
  const monday = new Date(d);
  monday.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return Array.from({ length: 7 }, (_, i) => {
    const x = new Date(monday);
    x.setDate(monday.getDate() + i);
    return toIsoDate(x);
  });
}

/**
 * Weekly goal = tick every daily-routine item of your enrolled, unfinished
 * studies at least once this week. Returns done/total counts.
 */
export function weeklyProgress(
  studies: BibleStudyDoc[],
  progress: Record<string, StudyProgress | undefined>
): { done: number; total: number; pct: number } {
  const week = new Set(currentWeek());
  let done = 0;
  let total = 0;
  for (const s of studies) {
    if (studyStatus(s) === 'completed') continue;
    const items = s.routine?.length ?? 0;
    total += items;
    const checks = progress[s.id]?.checks ?? {};
    const ticked = new Set<number>();
    for (const [day, idx] of Object.entries(checks)) if (week.has(day)) idx.forEach((i) => ticked.add(i));
    done += Math.min(items, ticked.size);
  }
  return { done, total, pct: total ? Math.round((done / total) * 100) : 0 };
}

export async function setRoutineCheck(studyId: string, userId: string, index: number, done: boolean, isoDate = toIsoDate(new Date())) {
  await setDoc(doc(db, 'studyProgress', `${studyId}_${userId}`), {
    userId,
    studyId,
    checks: { [isoDate]: done ? arrayUnion(index) : arrayRemove(index) },
    updatedAt: serverTimestamp(),
  }, { merge: true });
}
