// Minimal iCalendar (RFC 5545) generator for booking confirmation
// emails. The Samwise email writes this as `message.icalEvent` on the
// `mail/` doc — Firebase Trigger Email (Nodemailer under the hood)
// embeds it as a multipart/alternative calendar part AND attaches it,
// which is what makes Gmail / Apple Mail / Outlook render the "Add to
// calendar" button inline rather than just a download.
//
// We had to go this route because personal Gmail accounts (non-
// Workspace) reject `attendees` on service-account-created Google
// Calendar events ("forbiddenForServiceAccounts"), so Google can't
// send the invite for us. We send it ourselves via .ics — the
// prospect's calendar app does the parsing.

function escapeICS(s: string): string {
  return s
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r?\n/g, '\\n');
}

function toICSDate(d: Date): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  const h = String(d.getUTCHours()).padStart(2, '0');
  const mn = String(d.getUTCMinutes()).padStart(2, '0');
  const s = String(d.getUTCSeconds()).padStart(2, '0');
  return `${y}${m}${day}T${h}${mn}${s}Z`;
}

export function buildICS(args: {
  uid: string;
  startUTC: Date;
  endUTC: Date;
  summary: string;
  description: string;
  location: string;
  organizerName: string;
  organizerEmail: string;
  attendeeName: string;
  attendeeEmail: string;
}): string {
  const now = new Date();
  // CRLF line endings per RFC 5545 — non-negotiable; some parsers
  // (Outlook in particular) reject plain LF.
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Samwise//Booking//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:REQUEST',
    'BEGIN:VEVENT',
    `UID:${args.uid}`,
    `DTSTAMP:${toICSDate(now)}`,
    `DTSTART:${toICSDate(args.startUTC)}`,
    `DTEND:${toICSDate(args.endUTC)}`,
    `SUMMARY:${escapeICS(args.summary)}`,
    `DESCRIPTION:${escapeICS(args.description)}`,
    `LOCATION:${escapeICS(args.location)}`,
    `ORGANIZER;CN=${escapeICS(args.organizerName)}:mailto:${args.organizerEmail}`,
    `ATTENDEE;CN=${escapeICS(args.attendeeName)};RSVP=TRUE;ROLE=REQ-PARTICIPANT;PARTSTAT=NEEDS-ACTION:mailto:${args.attendeeEmail}`,
    'STATUS:CONFIRMED',
    'SEQUENCE:0',
    'END:VEVENT',
    'END:VCALENDAR',
  ];
  return lines.join('\r\n');
}
