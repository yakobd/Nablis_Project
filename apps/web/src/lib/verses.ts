// The built-in verse list now lives in @nablis/shared (verse.ts) so the web and
// mobile apps rotate through the same verses. Admins can override the Verse of
// the Day from Daily Prayers; see useVerseOfDay.
import { DEFAULT_VERSES, dayOfYear, rotatingVerse } from "@nablis/shared/firebase";

export const VERSES = DEFAULT_VERSES;
export { dayOfYear };

/** Today's verse from the built-in list; `offset` picks a different one from the same day. */
export function verseOfTheDay(offset = 0) {
  return rotatingVerse(offset);
}
