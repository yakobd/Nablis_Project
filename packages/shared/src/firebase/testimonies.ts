import { arrayRemove, arrayUnion, doc, updateDoc, type Timestamp } from 'firebase/firestore';
import { db } from './config';

export const TESTIMONY_CATEGORIES = [
  { key: 'healing', label: 'Healing' },
  { key: 'answered_prayer', label: 'Answered Prayer' },
  { key: 'provision', label: 'Provision' },
  { key: 'restoration', label: 'Restoration' },
  { key: 'deliverance', label: 'Deliverance' },
  { key: 'guidance', label: 'Guidance' },
  { key: 'faith', label: 'Faith' },
  { key: 'other', label: 'Other' },
] as const;

export interface TestimonyAttachment {
  url: string;
  name: string;
  /** image | document */
  kind: 'image' | 'document';
}

export interface TestimonyDoc {
  id: string;
  authorId: string;
  authorName: string;
  authorPhotoURL?: string | null;
  /** Shown as "Anonymous" to other members; staff still see the author. */
  anonymous?: boolean;
  title: string;
  content: string;
  category: string;
  status: 'pending' | 'published' | 'rejected';
  attachments?: TestimonyAttachment[];
  /** Members who found the story encouraging. */
  encouragedBy?: string[];
  /** Legacy counter. */
  likes?: number;
  reviewedBy?: string | null;
  reviewedAt?: Timestamp | null;
  createdAt?: Timestamp;
}

/** Normalises old values such as "Healing" to the category key. */
export function testimonyCategoryKey(category?: string | null): string {
  const c = (category ?? 'other').toLowerCase().trim().replace(/\s+/g, '_');
  return TESTIMONY_CATEGORIES.some((x) => x.key === c) ? c : 'other';
}

export function testimonyCategoryLabel(category?: string | null): string {
  const key = testimonyCategoryKey(category);
  return TESTIMONY_CATEGORIES.find((x) => x.key === key)?.label ?? 'Other';
}

/** Name to show other members. */
export function testimonyAuthor(t: Pick<TestimonyDoc, 'anonymous' | 'authorName'>): string {
  return t.anonymous ? 'Anonymous' : t.authorName || 'Member';
}

export function encouragementCount(t: Pick<TestimonyDoc, 'encouragedBy' | 'likes'>): number {
  return (t.encouragedBy?.length ?? 0) + (t.likes ?? 0);
}

/** Short reference shown on the review screen, e.g. #TS-8F2KQ1. */
export function submissionId(id: string): string {
  return `#TS-${id.slice(0, 6).toUpperCase()}`;
}

export function toggleEncouraged(id: string, uid: string, on: boolean) {
  return updateDoc(doc(db, 'testimonies', id), {
    encouragedBy: on ? arrayUnion(uid) : arrayRemove(uid),
  });
}
