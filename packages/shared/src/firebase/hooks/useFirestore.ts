'use client';
import { useState, useEffect, useRef } from 'react';
import {
  collection,
  doc,
  query,
  onSnapshot,
  addDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  serverTimestamp,
  type QueryConstraint,
  type DocumentData,
  type UpdateData,
  type WithFieldValue,
} from 'firebase/firestore';
import { db } from '../config';

// ─── useCollection ────────────────────────────────────────────────────────────
// Real-time collection listener. Pass a stable `constraints` array (memoize
// with useMemo at the call site if the constraints depend on reactive values).

export interface UseCollectionResult<T> {
  data: T[];
  loading: boolean;
  error: Error | null;
}

export function useCollection<T extends DocumentData>(
  collectionPath: string,
  constraints: QueryConstraint[] = []
): UseCollectionResult<T> {
  const [data, setData] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  // Stable ref so effect doesn't re-run on every render
  const constraintsRef = useRef(constraints);
  constraintsRef.current = constraints;

  // Resubscribe when the path changes; constraints are expected to be stable.
  useEffect(() => {
    const q = query(collection(db, collectionPath), ...constraintsRef.current);
    const unsub = onSnapshot(
      q,
      (snapshot) => {
        setData(snapshot.docs.map((d) => ({ id: d.id, ...d.data() } as unknown as T)));
        setLoading(false);
        setError(null);
      },
      (err) => {
        setError(err);
        setLoading(false);
      }
    );
    return unsub;
  }, [collectionPath]); // eslint-disable-line react-hooks/exhaustive-deps

  return { data, loading, error };
}

// ─── useDocument ──────────────────────────────────────────────────────────────

export interface UseDocumentResult<T> {
  data: T | null;
  loading: boolean;
  error: Error | null;
}

export function useDocument<T extends DocumentData>(
  collectionPath: string,
  docId: string | null | undefined
): UseDocumentResult<T> {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(!!docId);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!docId) {
      setData(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    const unsub = onSnapshot(
      doc(db, collectionPath, docId),
      (snap) => {
        setData(snap.exists() ? ({ id: snap.id, ...snap.data() } as unknown as T) : null);
        setLoading(false);
        setError(null);
      },
      (err) => {
        setError(err);
        setLoading(false);
      }
    );
    return unsub;
  }, [collectionPath, docId]);

  return { data, loading, error };
}

// ─── useFirestoreMutation ─────────────────────────────────────────────────────
// Generic CRUD helpers tied to a collection path.

export interface MutationHelpers<T extends DocumentData> {
  add: (data: Omit<T, 'id' | 'createdAt'>) => Promise<string>;
  set: (id: string, data: WithFieldValue<Omit<T, 'id'>>) => Promise<void>;
  update: (id: string, data: UpdateData<T>) => Promise<void>;
  remove: (id: string) => Promise<void>;
}

export function useFirestoreMutation<T extends DocumentData>(
  collectionPath: string
): MutationHelpers<T> {
  const add = async (data: Omit<T, 'id' | 'createdAt'>): Promise<string> => {
    const ref = await addDoc(collection(db, collectionPath), {
      ...data,
      createdAt: serverTimestamp(),
    });
    return ref.id;
  };

  const set = (id: string, data: WithFieldValue<Omit<T, 'id'>>) =>
    setDoc(doc(db, collectionPath, id), data);

  const update = (id: string, data: UpdateData<T>) =>
    updateDoc(doc(db, collectionPath, id), data);

  const remove = (id: string) => deleteDoc(doc(db, collectionPath, id));

  return { add, set, update, remove };
}
