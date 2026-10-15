import { arrayRemove, arrayUnion, doc, serverTimestamp, setDoc, type Timestamp } from 'firebase/firestore';
import { db } from './config';

// Reading plan model:
//   readingPlans/{planId}                 the yearly plan (staff write, members read)
//   readingProgress/{planId}_{uid}         { completed: ['YYYY-MM-DD', …] } per member
// Dates are local calendar days ("YYYY-MM-DD"), matching toIsoDate().

export interface ReadingEntry {
  date: string;
  reading: string;
}

export interface ReadingPlan {
  id: string;
  title: string;
  description?: string;
  year: number;
  entries: ReadingEntry[];
  /** Only one plan is active at a time; members follow the active plan. */
  active: boolean;
  createdBy?: string;
  createdAt?: Timestamp;
}

export interface ReadingProgress {
  id: string;
  planId: string;
  userId: string;
  userName?: string;
  completed: string[];
  updatedAt?: Timestamp;
}

export function readingProgressId(planId: string, uid: string) {
  return `${planId}_${uid}`;
}

function iso(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
export function isoToday() {
  return iso(new Date());
}
export function parseIso(s: string) {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
}

/** Marks or unmarks one day's reading for the signed-in member. */
export function setReadingDone(
  plan: Pick<ReadingPlan, 'id'>,
  user: { id: string; displayName?: string | null },
  date: string,
  done: boolean,
) {
  return setDoc(doc(db, 'readingProgress', readingProgressId(plan.id, user.id)), {
    planId: plan.id,
    userId: user.id,
    userName: user.displayName || 'Member',
    completed: done ? arrayUnion(date) : arrayRemove(date),
    updatedAt: serverTimestamp(),
  }, { merge: true });
}

// ─── Progress maths ───────────────────────────────────────────────────────────

export interface PlanProgress {
  /** Readings completed (any day). */
  done: number;
  /** Readings scheduled up to and including today. */
  due: number;
  /** Readings in the whole plan. */
  total: number;
  /** Of the readings due so far, how many are done (0–100). */
  onTrackPct: number;
  /** Share of the whole plan completed (0–100). */
  overallPct: number;
  /** Due readings not yet done. */
  behind: number;
}

export function planProgress(plan: Pick<ReadingPlan, 'entries'>, completed: string[], today = isoToday()): PlanProgress {
  const done = new Set(completed);
  const dueEntries = plan.entries.filter((e) => e.date <= today);
  const doneDue = dueEntries.filter((e) => done.has(e.date)).length;
  const doneAll = plan.entries.filter((e) => done.has(e.date)).length;
  return {
    done: doneAll,
    due: dueEntries.length,
    total: plan.entries.length,
    onTrackPct: dueEntries.length ? Math.round((doneDue / dueEntries.length) * 100) : 100,
    overallPct: plan.entries.length ? Math.round((doneAll / plan.entries.length) * 100) : 0,
    behind: dueEntries.length - doneDue,
  };
}

export interface MonthPerformance {
  /** 0–11 */
  month: number;
  due: number;
  done: number;
  /** null for months that haven't started. */
  pct: number | null;
}

/** Completion per calendar month, counting only readings due so far. */
export function monthlyPerformance(plan: Pick<ReadingPlan, 'entries'>, completed: string[], today = isoToday()): MonthPerformance[] {
  const done = new Set(completed);
  const months: MonthPerformance[] = Array.from({ length: 12 }, (_, month) => ({ month, due: 0, done: 0, pct: null }));
  for (const e of plan.entries) {
    if (e.date > today) continue;
    const m = Number(e.date.slice(5, 7)) - 1;
    months[m].due++;
    if (done.has(e.date)) months[m].done++;
  }
  for (const m of months) m.pct = m.due ? Math.round((m.done / m.due) * 100) : null;
  return months;
}

/** Consecutive plan days read, counting back from today (or yesterday if today isn't done yet). */
export function readingStreak(plan: Pick<ReadingPlan, 'entries'>, completed: string[], today = isoToday()): number {
  const done = new Set(completed);
  const days = plan.entries.map((e) => e.date).filter((d) => d <= today).sort().reverse();
  let i = days[0] === today && !done.has(today) ? 1 : 0;
  let streak = 0;
  for (; i < days.length && done.has(days[i]); i++) streak++;
  return streak;
}

// ─── Building plans ───────────────────────────────────────────────────────────

const BOOKS: [string, number][] = [
  ['Genesis', 50], ['Exodus', 40], ['Leviticus', 27], ['Numbers', 36], ['Deuteronomy', 34], ['Joshua', 24],
  ['Judges', 21], ['Ruth', 4], ['1 Samuel', 31], ['2 Samuel', 24], ['1 Kings', 22], ['2 Kings', 25],
  ['1 Chronicles', 29], ['2 Chronicles', 36], ['Ezra', 10], ['Nehemiah', 13], ['Esther', 10], ['Job', 42],
  ['Psalms', 150], ['Proverbs', 31], ['Ecclesiastes', 12], ['Song of Songs', 8], ['Isaiah', 66], ['Jeremiah', 52],
  ['Lamentations', 5], ['Ezekiel', 48], ['Daniel', 12], ['Hosea', 14], ['Joel', 3], ['Amos', 9], ['Obadiah', 1],
  ['Jonah', 4], ['Micah', 7], ['Nahum', 3], ['Habakkuk', 3], ['Zephaniah', 3], ['Haggai', 2], ['Zechariah', 14],
  ['Malachi', 4],
  ['Matthew', 28], ['Mark', 16], ['Luke', 24], ['John', 21], ['Acts', 28], ['Romans', 16], ['1 Corinthians', 16],
  ['2 Corinthians', 13], ['Galatians', 6], ['Ephesians', 6], ['Philippians', 4], ['Colossians', 4],
  ['1 Thessalonians', 5], ['2 Thessalonians', 3], ['1 Timothy', 6], ['2 Timothy', 4], ['Titus', 3], ['Philemon', 1],
  ['Hebrews', 13], ['James', 5], ['1 Peter', 5], ['2 Peter', 3], ['1 John', 5], ['2 John', 1], ['3 John', 1],
  ['Jude', 1], ['Revelation', 22],
];
const NEW_TESTAMENT_START = 39;

export type PlanTemplate = 'whole_bible' | 'new_testament';

/** Every calendar day of a year as YYYY-MM-DD. */
export function daysOfYear(year: number): string[] {
  const out: string[] = [];
  for (let d = new Date(year, 0, 1); d.getFullYear() === year; d.setDate(d.getDate() + 1)) out.push(iso(d));
  return out;
}

/**
 * Spreads the chapters evenly, in canonical order: the whole Bible over every
 * day of the year, the New Testament over the weekdays (Mon–Fri).
 */
export function generatePlan(template: PlanTemplate, year: number): ReadingEntry[] {
  const books = template === 'new_testament' ? BOOKS.slice(NEW_TESTAMENT_START) : BOOKS;
  const chapters: [string, number][] = books.flatMap(([b, n]) => Array.from({ length: n }, (_, i) => [b, i + 1] as [string, number]));
  const days = (template === 'new_testament'
    ? daysOfYear(year).filter((d) => { const w = parseIso(d).getDay(); return w !== 0 && w !== 6; })
    : daysOfYear(year)
  ).slice(0, chapters.length); // never more days than chapters
  return days.map((date, i) => {
    const slice = chapters.slice(Math.floor((i * chapters.length) / days.length), Math.floor(((i + 1) * chapters.length) / days.length));
    // Group consecutive chapters of the same book: "Genesis 1–3; Exodus 1".
    const parts: string[] = [];
    for (const [book, ch] of slice) {
      const last = parts[parts.length - 1];
      if (last?.startsWith(`${book} `)) {
        const first = last.slice(book.length + 1).split('–')[0];
        parts[parts.length - 1] = `${book} ${first}–${ch}`;
      } else parts.push(`${book} ${ch}`);
    }
    return { date, reading: parts.join('; ') || 'Reflection & catch-up' };
  });
}

export interface ParsedPlan {
  entries: ReadingEntry[];
  errors: string[];
}

/**
 * Reads an uploaded plan (CSV or pasted lines). Each line is either
 * "YYYY-MM-DD, reading", "Day N, reading", or just "reading" (taken day by
 * day from 1 January). A header row is ignored.
 */
export function parsePlanText(text: string, year: number): ParsedPlan {
  const days = daysOfYear(year);
  const byDate = new Map<string, string>();
  const errors: string[] = [];
  let next = 0;
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  lines.forEach((line, idx) => {
    const cells = splitCsv(line);
    const first = cells[0] ?? '';
    if (idx === 0 && /^(date|day)$/i.test(first) && /reading|passage|chapter/i.test(cells[1] ?? '')) return;
    let date: string | null = null;
    let reading = '';
    const ymd = first.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
    const dmy = first.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    const dayN = first.match(/^day\s*(\d+)$/i) ?? (cells.length > 1 ? first.match(/^(\d{1,3})$/) : null);
    if (ymd) {
      date = `${ymd[1]}-${ymd[2].padStart(2, '0')}-${ymd[3].padStart(2, '0')}`;
      reading = cells.slice(1).join(', ');
    } else if (dmy) {
      date = `${dmy[3]}-${dmy[2].padStart(2, '0')}-${dmy[1].padStart(2, '0')}`;
      reading = cells.slice(1).join(', ');
    } else if (dayN) {
      date = days[Number(dayN[1]) - 1] ?? null;
      if (!date) errors.push(`Line ${idx + 1}: day ${dayN[1]} is outside ${year}.`);
      reading = cells.slice(1).join(', ');
    } else {
      date = days[next] ?? null;
      reading = cells.join(', ');
      if (!date) errors.push(`Line ${idx + 1}: more readings than days in ${year}.`);
    }
    if (!date) return;
    if (!date.startsWith(String(year))) { errors.push(`Line ${idx + 1}: ${date} is not in ${year}.`); return; }
    if (!reading.trim()) { errors.push(`Line ${idx + 1}: no reading given.`); return; }
    byDate.set(date, reading.trim());
    next = Math.max(next, days.indexOf(date) + 1);
  });
  const entries = [...byDate.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([date, reading]) => ({ date, reading }));
  return { entries, errors };
}

function splitCsv(line: string): string[] {
  const out: string[] = [];
  let cur = '';
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') {
      if (quoted && line[i + 1] === '"') { cur += '"'; i++; } else quoted = !quoted;
    } else if ((c === ',' || c === '\t' || c === ';') && !quoted && out.length === 0) {
      // Only the first separator splits date from reading; readings may contain ";".
      out.push(cur.trim());
      cur = '';
    } else cur += c;
  }
  out.push(cur.trim());
  return out.filter((c, i) => i === 0 || c !== '');
}
