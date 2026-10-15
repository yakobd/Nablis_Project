import { doc, serverTimestamp, updateDoc, type Timestamp } from 'firebase/firestore';
import { closeAppointment, notify, serviceLabel } from '@nablis/shared/firebase';
import { db } from './firebase';

interface AppointmentRef {
  id: string;
  memberId?: string;
  userId?: string;
  serviceType: string;
  date?: Timestamp | null;
  slotId?: string | null;
}

// Approves or rejects a booking and tells the member (in-app + push).
// Rejecting also frees the time slot.
export async function decideAppointment(apt: AppointmentRef, status: 'confirmed' | 'rejected') {
  if (status === 'rejected') await closeAppointment(apt, 'rejected');
  else await updateDoc(doc(db, 'appointments', apt.id), { status, notified: true, updatedAt: serverTimestamp() });

  const memberId = apt.memberId || apt.userId;
  if (!memberId) return;
  const when = apt.date
    ? apt.date.toDate().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    : 'the requested date';
  await notify({
    userId: memberId,
    type: status === 'confirmed' ? 'appointment_confirmed' : 'appointment_rejected',
    title: status === 'confirmed' ? 'Appointment Confirmed' : 'Appointment Not Approved',
    description: status === 'confirmed'
      ? `Your ${serviceLabel(apt.serviceType)} appointment on ${when} has been confirmed.`
      : `Your ${serviceLabel(apt.serviceType)} appointment on ${when} was not approved.`,
    link: '/appointment',
  });
}
