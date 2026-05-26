import {
  collection,
  type CollectionReference,
  type DocumentData,
  type QueryDocumentSnapshot,
  type WithFieldValue,
} from 'firebase/firestore';
import { db } from './config';
import type {
  User,
  Appointment,
  DailyPrayer,
  PrayerLog,
  Attendance,
  BlogPost,
  Event,
  GalleryItem,
  Message,
  Testimony,
  BibleStudy,
  Notification,
  Challenge,
} from './types';

function createConverter<T extends DocumentData>() {
  return {
    toFirestore(data: WithFieldValue<T>): DocumentData {
      return data as DocumentData;
    },
    fromFirestore(snap: QueryDocumentSnapshot): T {
      return { id: snap.id, ...snap.data() } as unknown as T;
    },
  };
}

function typedCol<T extends DocumentData>(path: string): CollectionReference<T> {
  return collection(db, path).withConverter(createConverter<T>());
}

export const Collections = {
  users:        typedCol<User>('users'),
  appointments: typedCol<Appointment>('appointments'),
  dailyPrayers: typedCol<DailyPrayer>('dailyPrayers'),
  prayerLogs:   typedCol<PrayerLog>('prayerLogs'),
  attendance:   typedCol<Attendance>('attendance'),
  blogPosts:    typedCol<BlogPost>('blogPosts'),
  events:       typedCol<Event>('events'),
  gallery:      typedCol<GalleryItem>('gallery'),
  messages:     typedCol<Message>('messages'),
  testimonies:  typedCol<Testimony>('testimonies'),
  bibleStudies: typedCol<BibleStudy>('bibleStudies'),
  notifications: typedCol<Notification>('notifications'),
  challenges:   typedCol<Challenge>('challenges'),
} as const;

export type CollectionName = keyof typeof Collections;
