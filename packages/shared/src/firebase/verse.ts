'use client';
import { useEffect, useState } from 'react';
import { deleteDoc, doc, onSnapshot, serverTimestamp, setDoc, type Timestamp } from 'firebase/firestore';
import { db } from './config';

// Verse of the Day.
//   settings/verseOfDay   set by admins; shown to everyone until changed or cleared
// With no verse set, the app rotates through DEFAULT_VERSES, one per day.

export interface Verse {
  text: string;
  ref: string;
}

export interface VerseOfDayDoc extends Verse {
  updatedAt?: Timestamp | null;
  updatedBy?: string;
  updatedByName?: string;
}

export const DEFAULT_VERSES: Verse[] = [
  { text: 'Pray without ceasing.', ref: '1 Thessalonians 5:17' },
  { text: 'But seek first the kingdom of God and his righteousness, and all these things will be added to you.', ref: 'Matthew 6:33' },
  { text: 'Be still, and know that I am God.', ref: 'Psalm 46:10' },
  { text: 'The Lord is my shepherd; I shall not want.', ref: 'Psalm 23:1' },
  { text: 'Cast all your anxiety on him because he cares for you.', ref: '1 Peter 5:7' },
  { text: 'I can do all things through Christ who strengthens me.', ref: 'Philippians 4:13' },
  { text: 'Your word is a lamp to my feet and a light to my path.', ref: 'Psalm 119:105' },
  { text: 'Come to me, all you who are weary and burdened, and I will give you rest.', ref: 'Matthew 11:28' },
  { text: 'Rejoice always, pray without ceasing, give thanks in all circumstances.', ref: '1 Thessalonians 5:16-18' },
  { text: 'The Lord is near to all who call on him.', ref: 'Psalm 145:18' },
];

export function dayOfYear(d = new Date()): number {
  return Math.floor((d.getTime() - new Date(d.getFullYear(), 0, 0).getTime()) / 86400000);
}

/** Today's verse from the built-in list; `offset` picks a different one for the same day. */
export function rotatingVerse(offset = 0): Verse {
  return DEFAULT_VERSES[(dayOfYear() + offset) % DEFAULT_VERSES.length];
}

const verseRef = () => doc(db, 'settings', 'verseOfDay');

/**
 * Live Verse of the Day. `custom` is the admin-set verse (null when the daily
 * rotation is in use); `verse` is what to show either way.
 */
export function useVerseOfDay(): { verse: Verse; custom: VerseOfDayDoc | null; loading: boolean } {
  const [custom, setCustom] = useState<VerseOfDayDoc | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => onSnapshot(
    verseRef(),
    (snap) => {
      const d = snap.exists() ? (snap.data() as VerseOfDayDoc) : null;
      setCustom(d && d.text?.trim() ? d : null);
      setLoading(false);
    },
    () => setLoading(false)
  ), []);

  return { verse: custom ?? rotatingVerse(), custom, loading };
}

export function saveVerseOfDay(v: Verse, by: { id: string; displayName?: string | null }): Promise<void> {
  return setDoc(verseRef(), {
    text: v.text.trim(),
    ref: v.ref.trim(),
    updatedAt: serverTimestamp(),
    updatedBy: by.id,
    updatedByName: by.displayName ?? '',
  });
}

/** Goes back to the automatic daily rotation. */
export function clearVerseOfDay(): Promise<void> {
  return deleteDoc(verseRef());
}
