import type { DailyPrayer, PrayerLog } from './types';
import { toIsoDate } from './appointments';

// Default reminders (spec: 6:00 AM, 12:00 PM, 9:00 PM) used until the ministry
// configures its own in Daily Prayers.
export const DEFAULT_PRAYERS: Pick<DailyPrayer, 'type' | 'name' | 'time' | 'message' | 'bibleVerse'>[] = [
  { type: 'morning',   name: 'Morning Prayer',   time: '06:00', message: 'Heavenly Father, thank you for this new dawn. Guide my steps today.', bibleVerse: 'Psalm 5:3' },
  { type: 'afternoon', name: 'Afternoon Prayer', time: '12:00', message: 'Lord, give me strength in this midday hour. Renew my spirit.', bibleVerse: '1 Thessalonians 5:17' },
  { type: 'evening',   name: 'Evening Prayer',   time: '21:00', message: 'As the day ends, I release my worries to You. Thank You for Your protection.', bibleVerse: 'Psalm 4:8' },
];

/** Display name; older reminders only had a type. */
export function prayerName(p: Pick<DailyPrayer, 'name' | 'type'>): string {
  if (p.name) return p.name;
  return p.type ? `${p.type.charAt(0).toUpperCase()}${p.type.slice(1)} Prayer` : 'Prayer';
}

/** Value stored in prayerLogs.prayerType for this reminder. */
export function prayerKey(p: Pick<DailyPrayer, 'id' | 'type'>): string {
  return p.type ?? p.id;
}

/** Enabled reminders sorted by time of day. */
export function activePrayers<T extends Pick<DailyPrayer, 'time' | 'enabled'>>(list: T[]): T[] {
  return list.filter((p) => p.enabled !== false).sort((a, b) => a.time.localeCompare(b.time));
}

/** Days (YYYY-MM-DD) on which at least one prayer was logged. */
export function prayedDays(logs: Pick<PrayerLog, 'prayedAt'>[]): Set<string> {
  const days = new Set<string>();
  for (const l of logs) {
    const d = l.prayedAt?.toDate?.();
    if (d) days.add(toIsoDate(d));
  }
  return days;
}

/** Consecutive days with a prayer, ending today (or yesterday if today isn't logged yet). */
export function currentStreak(logs: Pick<PrayerLog, 'prayedAt'>[]): number {
  const days = prayedDays(logs);
  const d = new Date();
  if (!days.has(toIsoDate(d))) d.setDate(d.getDate() - 1);
  let streak = 0;
  while (days.has(toIsoDate(d))) {
    streak++;
    d.setDate(d.getDate() - 1);
  }
  return streak;
}
