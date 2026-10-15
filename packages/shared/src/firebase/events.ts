import { deleteDoc, doc, serverTimestamp, setDoc, type Timestamp } from 'firebase/firestore';
import { db } from './config';

export const EVENT_CATEGORIES = [
  'Spiritual Retreats', 'Community Prayers', 'Bible Study', 'Pilgrimage', 'Festivals',
] as const;

export const PAYMENT_MODES = [
  { value: 'free',      label: 'Free' },
  { value: 'cash',      label: 'Cash' },
  { value: 'donation',  label: 'Donation' },
  { value: 'volunteer', label: 'Volunteer' },
] as const;
export type PaymentMode = (typeof PAYMENT_MODES)[number]['value'];

export const EVENT_REMINDERS = [
  { value: 'none', label: 'No reminder',            minutes: 0 },
  { value: '1h',   label: '1 Hour Before the event', minutes: 60 },
  { value: '1d',   label: '1 Day Before the event',  minutes: 60 * 24 },
  { value: '1w',   label: '1 Week Before the event', minutes: 60 * 24 * 7 },
] as const;
export type EventReminder = (typeof EVENT_REMINDERS)[number]['value'];

/** Shape of an events/{id} doc (older events may miss the newer fields). */
export interface EventDoc {
  id: string;
  title: string;
  description?: string;
  category?: string;
  startDate?: Timestamp | null;
  endDate?: Timestamp | null;
  /** "HH:MM"; empty means a full-day event (08:00–18:00). */
  time?: string;
  durationDays?: number;
  location?: string;
  meetingRoom?: string;
  guestEmails?: string[];
  paymentMode?: PaymentMode;
  price?: number;
  reminder?: EventReminder;
  imageURL?: string;
  attachments?: { name: string; url: string }[];
  featured?: boolean;
  totalCapacity?: number | null;
  /** Legacy RSVP list; new RSVPs live in events/{id}/rsvps/{uid}. */
  rsvps?: { userId: string; userName?: string }[];
  free?: boolean;
  volunteer?: boolean;
  createdAt?: Timestamp;
}

export interface RsvpDoc {
  userId: string;
  userName: string;
  status: 'attending' | 'not_attending';
  registeredAt?: Timestamp;
}

export function eventPaymentMode(e: EventDoc): PaymentMode {
  if (e.paymentMode) return e.paymentMode;
  if (e.volunteer) return 'volunteer';
  if (e.free || !e.price) return 'free';
  return 'cash';
}

/** Saves the member's RSVP (Yes/No). */
export async function setRsvp(
  eventId: string,
  user: { id: string; displayName?: string | null; email?: string | null },
  status: RsvpDoc['status']
): Promise<void> {
  await setDoc(doc(db, 'events', eventId, 'rsvps', user.id), {
    userId: user.id,
    userName: user.displayName || user.email || 'Member',
    status,
    registeredAt: serverTimestamp(),
  });
}

export async function clearRsvp(eventId: string, userId: string): Promise<void> {
  await deleteDoc(doc(db, 'events', eventId, 'rsvps', userId));
}

/** Start/end as Dates, applying the event's time and duration. */
export function eventRange(e: EventDoc): { start: Date; end: Date } | null {
  const base = e.startDate?.toDate?.();
  if (!base) return null;
  const start = new Date(base);
  const [h, m] = (e.time || '08:00').split(':').map(Number);
  start.setHours(h, m, 0, 0);
  const end = e.endDate?.toDate?.() ?? new Date(start);
  if (!e.endDate) {
    end.setDate(start.getDate() + Math.max(1, e.durationDays ?? 1) - 1);
    if (e.time) end.setHours(h + 2, m, 0, 0);
    else end.setHours(18, 0, 0, 0);
  }
  return { start, end };
}

/** iCalendar file so members can add the event to their own calendar. */
export function eventToIcs(e: EventDoc): string {
  const range = eventRange(e);
  if (!range) return '';
  const fmt = (d: Date) => d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  const esc = (s = '') => s.replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/,/g, '\\,').replace(/;/g, '\\;');
  const minutes = EVENT_REMINDERS.find((r) => r.value === e.reminder)?.minutes ?? 60 * 24;
  return [
    'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Nablis Ministry//Events//EN',
    'BEGIN:VEVENT',
    `UID:${e.id}@nablis`,
    `DTSTAMP:${fmt(new Date())}`,
    `DTSTART:${fmt(range.start)}`,
    `DTEND:${fmt(range.end)}`,
    `SUMMARY:${esc(e.title)}`,
    `DESCRIPTION:${esc(e.description)}`,
    `LOCATION:${esc([e.location, e.meetingRoom].filter(Boolean).join(' — '))}`,
    ...(minutes ? ['BEGIN:VALARM', 'ACTION:DISPLAY', `DESCRIPTION:${esc(e.title)}`, `TRIGGER:-PT${minutes}M`, 'END:VALARM'] : []),
    'END:VEVENT', 'END:VCALENDAR',
  ].join('\r\n');
}
