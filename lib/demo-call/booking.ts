import 'server-only';
import { FieldValue, type Timestamp } from 'firebase-admin/firestore';
import { getDb } from '@/lib/firebase-admin';

// The `demoBookings/{calBookingUid}` doc written by the calDemoBookingWebhook
// cloud function and read by /api/demo-call/init. The doc id IS the Cal.com
// booking UID — same value substituted into the user's confirmation email
// link as `samwise.life/demo-call/{Booking.uid}`.
export interface DemoBookingDoc {
  roomName: string;
  therapistId: string;
  prospectKey: string;
  prospect: { name: string; email: string; phone: string };
  language: 'en' | 'es';
  scheduledFor: string; // ISO 8601
  status: 'scheduled' | 'in_progress' | 'completed' | 'cancelled';
  egressId?: string;
  createdAt?: Timestamp;
  startedAt?: Timestamp;
}

export async function readDemoBooking(
  bookingId: string,
): Promise<DemoBookingDoc | null> {
  const snap = await getDb().collection('demoBookings').doc(bookingId).get();
  if (!snap.exists) return null;
  return snap.data() as DemoBookingDoc;
}

export async function markBookingInProgress(args: {
  bookingId: string;
  egressId: string;
}): Promise<void> {
  await getDb().collection('demoBookings').doc(args.bookingId).update({
    status: 'in_progress',
    egressId: args.egressId,
    startedAt: FieldValue.serverTimestamp(),
  });
}
