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
  /** In-call kind. Drives which visuals the /meet call-room renders and which
   *  rep control samwise-app's WalkInShell mounts. Optional for backwards
   *  compat with pre-2026-06-17 docs (which have no `kind`); the call-room
   *  treats absent as the default prospect demo. */
  kind?: 'demo' | 'therapist-demo';
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
  kind?: 'demo' | 'therapist-demo';
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
      kind: args.kind ?? 'demo',
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
