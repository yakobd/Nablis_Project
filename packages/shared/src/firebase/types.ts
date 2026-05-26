import type { Timestamp } from 'firebase/firestore';

// ─── Shared sub-types ─────────────────────────────────────────────────────────

export interface Comment {
  id: string;
  authorId: string;
  authorName: string;
  content: string;
  createdAt: Timestamp;
}

export interface AttendeeEntry {
  userId: string;
  name: string;
  checkedInAt: Timestamp;
}

export interface RSVP {
  userId: string;
  name: string;
  email: string;
  status: 'attending' | 'maybe' | 'not_attending';
  registeredAt: Timestamp;
}

export interface Material {
  title: string;
  url: string;
  type: 'pdf' | 'video' | 'audio' | 'link';
}

// ─── Collection types ─────────────────────────────────────────────────────────

export interface User {
  id: string;
  email: string;
  displayName: string;
  photoURL: string | null;
  role: 'admin' | 'member';
  status: 'active' | 'pending' | 'rejected';
  createdAt: Timestamp;
  phone?: string;
  address?: string;
  birthday?: Timestamp;
  city?: string;
  zipCode?: string;
  documents?: string[];
}

export interface Appointment {
  id: string;
  memberId: string;
  memberName: string;
  serviceType: 'confession' | 'counseling' | 'marriage' | 'other';
  date: Timestamp;
  time: string;
  status: 'pending' | 'confirmed' | 'rejected';
  privateNote?: string;
  createdAt: Timestamp;
}

export interface DailyPrayer {
  id: string;
  type: 'morning' | 'afternoon' | 'evening';
  time: string;
  message: string;
  bibleVerse: string;
  createdAt: Timestamp;
}

export interface PrayerLog {
  id: string;
  userId: string;
  prayerType: 'morning' | 'afternoon' | 'evening';
  prayedAt: Timestamp;
  streak: number;
}

export interface Attendance {
  id: string;
  meetingTitle: string;
  date: Timestamp;
  totalCapacity: number;
  attendees: AttendeeEntry[];
  qrCode: string;
  status: 'upcoming' | 'active' | 'completed';
}

export interface BlogPost {
  id: string;
  authorId: string;
  authorName: string;
  title: string;
  content: string;
  category: string;
  imageURL?: string;
  videoURL?: string;
  pinned: boolean;
  status: 'draft' | 'published';
  publishAt?: Timestamp;
  createdAt: Timestamp;
  comments: Comment[];
}

export interface Event {
  id: string;
  title: string;
  description: string;
  date: Timestamp;
  endDate?: Timestamp;
  time: string;
  duration: number;
  location: string;
  price: number;
  paymentMode: 'free' | 'paid' | 'donation';
  guestEmails: string[];
  posterURL?: string;
  reminderTime: number;
  rsvps: RSVP[];
  createdAt: Timestamp;
}

export interface GalleryItem {
  id: string;
  imageURL: string;
  title: string;
  category: string;
  churchName: string;
  date: Timestamp;
  uploadedBy: string;
  createdAt: Timestamp;
}

export interface Message {
  id: string;
  senderId: string;
  receiverId: string;
  content: string;
  attachmentURL?: string;
  read: boolean;
  createdAt: Timestamp;
}

export interface Testimony {
  id: string;
  authorId: string;
  authorName: string;
  title: string;
  content: string;
  category: 'healing' | 'provision' | 'restoration' | 'other';
  status: 'pending' | 'published';
  likes: number;
  createdAt: Timestamp;
}

export interface BibleStudy {
  id: string;
  title: string;
  teacher: string;
  members: string[];
  startDate: Timestamp;
  materials: Material[];
  status: 'started' | 'pending' | 'completed';
}

export interface Notification {
  id: string;
  userId: string;
  type: string;
  title: string;
  body: string;
  read: boolean;
  createdAt: Timestamp;
}

export interface Challenge {
  id: string;
  title: string;
  description: string;
  startDate: Timestamp;
  endDate: Timestamp;
  createdBy: string;
  participants: string[];
}
