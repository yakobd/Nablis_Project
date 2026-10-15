'use client';
import { useEffect } from 'react';
import { doc, serverTimestamp, updateDoc, type Timestamp } from 'firebase/firestore';
import { db } from './config';
import { tx } from './localize';

const HEARTBEAT_MS = 60_000;
const ONLINE_WINDOW_MS = 2 * 60_000;

/** Keeps users/{uid}.lastSeen fresh while the app is open. */
export function usePresenceHeartbeat(userId: string | null | undefined) {
  useEffect(() => {
    if (!userId) return;
    const beat = () => updateDoc(doc(db, 'users', userId), { lastSeen: serverTimestamp() }).catch(() => {});
    beat();
    const id = setInterval(beat, HEARTBEAT_MS);
    return () => clearInterval(id);
  }, [userId]);
}

export function isOnline(lastSeen?: Timestamp | null): boolean {
  const t = lastSeen?.toMillis?.();
  return !!t && Date.now() - t < ONLINE_WINDOW_MS;
}

/** "Online", "Active 5m ago", "Active yesterday"… */
export function presenceLabel(lastSeen?: Timestamp | null): string {
  const t = lastSeen?.toMillis?.();
  if (!t) return tx('presence.offline', 'Offline');
  const diff = Date.now() - t;
  if (diff < ONLINE_WINDOW_MS) return tx('presence.online', 'Online');
  const mins = Math.floor(diff / 60_000);
  if (mins < 60) return tx('presence.mins', 'Active {{n}}m ago', { n: mins });
  const hours = Math.floor(mins / 60);
  if (hours < 24) return tx('presence.hours', 'Active {{n}}h ago', { n: hours });
  const days = Math.floor(hours / 24);
  return days === 1 ? tx('presence.yesterday', 'Active yesterday') : tx('presence.days', 'Active {{n}}d ago', { n: days });
}
