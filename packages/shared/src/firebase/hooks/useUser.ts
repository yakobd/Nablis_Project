import { useState, useEffect } from 'react';
import { type User as FirebaseUser } from 'firebase/auth';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../config';
import type { User } from '../types';

export interface UseUserResult {
  user: User | null;
  loading: boolean;
}

export function useUser(firebaseUser: FirebaseUser | null): UseUserResult {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(!!firebaseUser);

  useEffect(() => {
    if (!firebaseUser) {
      setUser(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    const unsub = onSnapshot(
      doc(db, 'users', firebaseUser.uid),
      (snap) => {
        setUser(snap.exists() ? ({ id: snap.id, ...snap.data() } as User) : null);
        setLoading(false);
      },
      () => setLoading(false)
    );
    return unsub;
  }, [firebaseUser?.uid]); // eslint-disable-line react-hooks/exhaustive-deps

  return { user, loading };
}
