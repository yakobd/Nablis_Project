import {
  collection, doc, serverTimestamp, Timestamp, writeBatch,
} from 'firebase/firestore';
import { db } from './config';

// Appointment service types shared by web and mobile. `value` is what gets
// stored in Firestore; `label` is what users see.
export const SERVICE_TYPES = [
  { value: 'confession',  label: 'Confession',           icon: '🕊️', description: 'Sacrament of reconciliation and spiritual cleansing.' },
  { value: 'counseling',  label: 'Spiritual Counseling', icon: '🙏', description: 'Personal guidance on your faith journey.' },
  { value: 'youth',       label: 'Youth Guidance',       icon: '✨', description: 'Support and mentorship for younger members.' },
  { value: 'family',      label: 'Family Support',       icon: '🏠', description: 'Prayer and advice for household harmony.' },
  { value: 'marriage',    label: 'Marriage Guidance',    icon: '💍', description: 'Counsel for couples and those preparing to marry.' },
  { value: 'bible_study', label: 'Group Bible Study',    icon: '📖', description: 'Study the Scriptures together in a small group.' },
  { value: 'prayer',      label: 'Prayer Session',       icon: '🕯️', description: 'A quiet time of prayer with the Father.' },
  { value: 'other',       label: 'Other',                icon: '📋', description: 'Anything else you would like to discuss.' },
] as const;

export type ServiceType = (typeof SERVICE_TYPES)[number]['value'];

function findService(value?: string | null) {
  if (!value) return undefined;
  const v = value.toLowerCase();
  // Older mobile bookings stored the label ("Spiritual Counseling") instead of the value.
  return SERVICE_TYPES.find((s) => s.value === v || s.label.toLowerCase() === v);
}

// Apps can supply translated service names (see setServiceLocalizer).
type ServiceLocalizer = (value: string, field: 'label' | 'description') => string | undefined;
let localize: ServiceLocalizer | null = null;
export function setServiceLocalizer(fn: ServiceLocalizer | null) {
  localize = fn;
}

export function serviceLabel(value?: string | null): string {
  const s = findService(value);
  return (s && localize?.(s.value, 'label')) || s?.label || value || 'Other';
}

export function serviceDescription(value?: string | null): string {
  const s = findService(value);
  return (s && localize?.(s.value, 'description')) || s?.description || '';
}

export function serviceIcon(value?: string | null): string {
  return findService(value)?.icon ?? '📋';
}

// ─── Time slots ──────────────────────────────────────────────────────────────
// Each booked slot is a doc in appointmentSlots/{YYYY-MM-DD_HHMM}. Firestore
// rules forbid overwriting an existing slot, so two members can't take the
// same time. Slot docs hold no personal details beyond the member id.

/** Default times used when the Spiritual Father hasn't set his availability. */
export const SLOT_TIMES = ['09:00', '10:30', '11:00', '13:30', '15:00', '16:30'] as const;
const SLOT_TIMES_LIST: string[] = [...SLOT_TIMES];
export const SESSION_MINUTES = 30;

// ─── Availability (optional, set by the Spiritual Father) ───────────────────
// Stored at settings/availability. When `enabled` is false or the doc is
// missing, SLOT_TIMES apply every day.

export interface Availability {
  enabled: boolean;
  /** Weekday (0 = Sunday … 6 = Saturday) → "HH:MM" start times. Empty = not available that day. */
  weekly: Record<string, string[]>;
  /** YYYY-MM-DD dates with no appointments (travel, feasts…). */
  blockedDates: string[];
  /** Whether members may request a time outside the listed slots. */
  allowCustomTimes: boolean;
}

export const DEFAULT_AVAILABILITY: Availability = {
  enabled: false,
  weekly: Object.fromEntries([0, 1, 2, 3, 4, 5, 6].map((d) => [String(d), [...SLOT_TIMES_LIST]])),
  blockedDates: [],
  allowCustomTimes: true,
};

export function normalizeAvailability(data?: Partial<Availability> | null): Availability {
  return {
    ...DEFAULT_AVAILABILITY,
    ...(data ?? {}),
    weekly: { ...DEFAULT_AVAILABILITY.weekly, ...(data?.weekly ?? {}) },
    blockedDates: data?.blockedDates ?? [],
  };
}

/** Bookable start times for a date, honouring the optional weekly schedule. */
export function slotsForDate(avail: Availability, isoDate: string): string[] {
  if (avail.blockedDates.includes(isoDate)) return [];
  if (!avail.enabled) return [...SLOT_TIMES_LIST];
  const weekday = new Date(`${isoDate}T00:00`).getDay();
  return [...(avail.weekly[String(weekday)] ?? [])].sort();
}

/** True if no booking (listed or custom) is possible that day. */
export function isDayClosed(avail: Availability, isoDate: string): boolean {
  if (avail.blockedDates.includes(isoDate)) return true;
  return avail.enabled && slotsForDate(avail, isoDate).length === 0;
}

export function slotId(isoDate: string, time: string): string {
  return `${isoDate}_${time.replace(':', '')}`;
}

/** "13:30" → "01:30 PM" */
export function formatTime12(time?: string | null): string {
  if (!time || !/^\d{1,2}:\d{2}$/.test(time)) return time ?? '';
  const [h, m] = time.split(':').map(Number);
  const hh = ((h + 11) % 12) + 1;
  return `${String(hh).padStart(2, '0')}:${String(m).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`;
}

/** Local YYYY-MM-DD for a Date. */
export function toIsoDate(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export interface BookingInput {
  memberId: string;
  memberName: string;
  serviceType: ServiceType;
  isoDate: string;
  time: string;
  privateNote?: string;
  /** True when the member asked for a time outside the listed slots. */
  customTime?: boolean;
}

/** Creates the appointment and claims its slot atomically. Throws if the slot is taken. */
export async function bookAppointment(input: BookingInput): Promise<string> {
  const apptRef = doc(collection(db, 'appointments'));
  const sid = slotId(input.isoDate, input.time);
  const batch = writeBatch(db);
  batch.set(apptRef, {
    memberId:    input.memberId,
    userId:      input.memberId,
    memberName:  input.memberName,
    serviceType: input.serviceType,
    date:        Timestamp.fromDate(new Date(`${input.isoDate}T${input.time}`)),
    time:        input.time,
    slotId:      sid,
    customTime:  !!input.customTime,
    privateNote: input.privateNote?.trim() || null,
    status:      'pending',
    createdAt:   serverTimestamp(),
  });
  batch.set(doc(db, 'appointmentSlots', sid), {
    memberId: input.memberId, appointmentId: apptRef.id, createdAt: serverTimestamp(),
  });
  await batch.commit();
  return apptRef.id;
}

/** Moves an appointment to a new slot (back to pending), freeing the old one. */
export async function rescheduleAppointment(
  appt: { id: string; memberId: string; slotId?: string | null },
  isoDate: string,
  time: string
): Promise<void> {
  const sid = slotId(isoDate, time);
  const batch = writeBatch(db);
  batch.update(doc(db, 'appointments', appt.id), {
    date: Timestamp.fromDate(new Date(`${isoDate}T${time}`)),
    time,
    slotId: sid,
    status: 'pending',
    updatedAt: serverTimestamp(),
  });
  if (appt.slotId !== sid) {
    if (appt.slotId) batch.delete(doc(db, 'appointmentSlots', appt.slotId));
    batch.set(doc(db, 'appointmentSlots', sid), {
      memberId: appt.memberId, appointmentId: appt.id, createdAt: serverTimestamp(),
    });
  }
  await batch.commit();
}

/** Sets a cancelled/rejected status and frees the slot. */
export async function closeAppointment(
  appt: { id: string; slotId?: string | null },
  status: 'cancelled' | 'rejected'
): Promise<void> {
  const batch = writeBatch(db);
  batch.update(doc(db, 'appointments', appt.id), { status, updatedAt: serverTimestamp() });
  if (appt.slotId) batch.delete(doc(db, 'appointmentSlots', appt.slotId));
  await batch.commit();
}
