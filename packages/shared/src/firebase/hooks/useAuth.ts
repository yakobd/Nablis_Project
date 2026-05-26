import { useState, useEffect, useCallback } from 'react';
import { onAuthStateChanged, type User as FirebaseUser } from 'firebase/auth';
import { doc, onSnapshot } from 'firebase/firestore';
import { auth, db } from '../config';
import { signInWithEmail, signOut as fbSignOut } from '../auth';
import type { User } from '../types';

export interface AuthState {
  firebaseUser: FirebaseUser | null;
  user: User | null;
  role: 'admin' | 'member' | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
}

export function useAuth(): AuthState {
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [user, setUser] = useState<User | null>(null);
  // true until we've resolved both auth state AND firestore profile
  const [loading, setLoading] = useState(true);

  // 1. Subscribe to Firebase Auth state
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (fbUser) => {
      setFirebaseUser(fbUser);
      if (!fbUser) {
        setUser(null);
        setLoading(false);
      }
    });
    return unsub;
  }, []);

  // 2. When auth user changes, subscribe to their Firestore profile
  useEffect(() => {
    if (!firebaseUser) return;
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

  const signIn = useCallback(async (email: string, password: string) => {
    await signInWithEmail(email, password);
  }, []);

  const signOut = useCallback(async () => {
    await fbSignOut();
  }, []);

  return {
    firebaseUser,
    user,
    role: user?.role ?? null,
    loading,
    signIn,
    signOut,
  };
}
