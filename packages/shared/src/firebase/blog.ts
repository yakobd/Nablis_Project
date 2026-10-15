import { doc, increment, updateDoc, type Timestamp } from 'firebase/firestore';
import { db } from './config';

export const BLOG_CATEGORIES = [
  'Spiritual Education', 'Church Visits', 'Monthly Meeting', 'Prayers',
  'Testimonies', 'Family Support', 'Bible Study', 'Wellness & Prayer',
] as const;

export interface BlogDoc {
  id: string;
  authorId: string;
  authorName: string;
  authorPhotoURL?: string | null;
  title: string;
  content: string;
  category: string;
  imageURL?: string | null;
  imageAlt?: string | null;
  /** Uploaded video, or a YouTube link. */
  videoURL?: string | null;
  destLink?: string | null;
  pinned?: boolean;
  /** Internal = members only; otherwise also shown on the public website. */
  internal?: boolean;
  enableComments?: boolean;
  status: 'draft' | 'published';
  publishAt?: Timestamp | null;
  views?: number;
  createdAt?: Timestamp;
}

export function isScheduled(b: Pick<BlogDoc, 'publishAt'>): boolean {
  const t = b.publishAt?.toMillis?.();
  return !!t && t > Date.now();
}

export function blogExcerpt(b: Pick<BlogDoc, 'content'>, length = 160): string {
  const text = (b.content ?? '').replace(/\s+/g, ' ').trim();
  return text.length > length ? `${text.slice(0, length).trimEnd()}…` : text;
}

/** YouTube embed URL for a watch/short/youtu.be link, else null. */
export function youTubeEmbed(url?: string | null): string | null {
  if (!url) return null;
  const m = url.match(/(?:youtube\.com\/(?:watch\?v=|shorts\/|embed\/)|youtu\.be\/)([\w-]{11})/);
  return m ? `https://www.youtube.com/embed/${m[1]}` : null;
}

export function youTubeThumb(url?: string | null): string | null {
  const m = url?.match(/(?:youtube\.com\/(?:watch\?v=|shorts\/|embed\/)|youtu\.be\/)([\w-]{11})/);
  return m ? `https://img.youtube.com/vi/${m[1]}/hqdefault.jpg` : null;
}

/** Counts a read (members may only add one; see firestore.rules). */
export function countBlogView(id: string) {
  return updateDoc(doc(db, 'blogPosts', id), { views: increment(1) }).catch(() => {});
}
