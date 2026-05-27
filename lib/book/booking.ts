import 'server-only';
import { FieldValue, type Timestamp } from 'firebase-admin/firestore';
import { getDb } from '@/lib/firebase-admin';

// `calendarBookings/{calEventId}` — written by /api/book/create after
// the Google Calendar event lands. Read by /meet/[id] when the prospect
// follows the email link, so the lobby + room init know who's coming.
//
// Same shape principle as walkIns/demoBookings: a flat record with
// roomName, prospectKey, prospect, language, scheduledFor — so all
// three booking flavors converge on the same /meet/[id] surface.

export interface CalendarBookingDoc {
  roomName: string;
  prospectKey: string;
  prospect: { name: string; email: string };
  language: 'en' | 'es';
  /** ISO 8601, Bogotá-local with offset */
  scheduledFor: string;
  /** Google Calendar event ID — duplicated here as the doc id */
  calEventId: string;
  status: 'scheduled' | 'in_progress' | 'completed' | 'cancelled';
  createdAt?: Timestamp;
}

export function emailToProspectKey(email: string): string {
  return `email:${email.trim().toLowerCase()}`;
}

export async function createCalendarBooking(args: {
  calEventId: string;
  roomName: string;
  prospectKey: string;
  prospect: { name: string; email: string };
  language: 'en' | 'es';
  scheduledFor: string;
}): Promise<void> {
  await getDb()
    .collection('calendarBookings')
    .doc(args.calEventId)
    .set({
      roomName: args.roomName,
      prospectKey: args.prospectKey,
      prospect: args.prospect,
      language: args.language,
      scheduledFor: args.scheduledFor,
      calEventId: args.calEventId,
      status: 'scheduled' as const,
      createdAt: FieldValue.serverTimestamp(),
    });
}

export async function readCalendarBooking(
  calEventId: string,
): Promise<CalendarBookingDoc | null> {
  const snap = await getDb()
    .collection('calendarBookings')
    .doc(calEventId)
    .get();
  if (!snap.exists) return null;
  return snap.data() as CalendarBookingDoc;
}
