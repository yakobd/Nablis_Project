'use client';
import { useEffect, useState } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../config';
import { DEFAULT_AVAILABILITY, normalizeAvailability, type Availability } from '../appointments';

/** Live settings/availability (defaults if the Spiritual Father hasn't set it). */
export function useAvailability(): { availability: Availability; loading: boolean } {
  const [availability, setAvailability] = useState<Availability>(DEFAULT_AVAILABILITY);
  const [loading, setLoading] = useState(true);

  useEffect(() => onSnapshot(
    doc(db, 'settings', 'availability'),
    (snap) => {
      setAvailability(normalizeAvailability(snap.exists() ? (snap.data() as Partial<Availability>) : null));
      setLoading(false);
    },
    () => setLoading(false)
  ), []);

  return { availability, loading };
}
