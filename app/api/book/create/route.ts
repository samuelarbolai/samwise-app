import { NextResponse } from 'next/server';
import { z } from 'zod';
import { freeBusy, insertEvent, patchEventDescription } from '@/lib/google-calendar';
import {
  slotToISORange,
  TIMEZONE,
  SLOT_DURATION_MIN,
} from '@/lib/book/availability';
import {
  createCalendarBooking,
  emailToProspectKey,
} from '@/lib/book/booking';
import { buildICS } from '@/lib/book/ics';
import { getDb } from '@/lib/firebase-admin';

export const runtime = 'nodejs';

// POST body:
//  - day:   "YYYY-MM-DD"   (Bogotá-local)
//  - slot:  "HH:mm"        (Bogotá-local)
//  - name:  prospect's full name
//  - email: prospect's email
//  - language: "en" | "es"
const RequestSchema = z.object({
  day: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  slot: z.string().regex(/^\d{2}:\d{2}$/),
  name: z.string().min(1).max(120),
  email: z.string().email().max(200),
  language: z.enum(['en', 'es']),
});

const ALLOWED_ORIGINS = [
  'https://samwise.life',
  'https://www.samwise.life',
  'http://localhost:3000',
  'http://localhost:3001',
];

function corsHeaders(origin: string | null): Record<string, string> {
  const allowed = origin && ALLOWED_ORIGINS.includes(origin) ? origin : '';
  return {
    'Access-Control-Allow-Origin': allowed,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    Vary: 'Origin',
  };
}

export async function OPTIONS(req: Request) {
  return new NextResponse(null, {
    status: 204,
    headers: corsHeaders(req.headers.get('origin')),
  });
}

export async function POST(req: Request) {
  const cors = corsHeaders(req.headers.get('origin'));

  const calendarId = process.env.BOOKING_CALENDAR_ID;
  if (!calendarId) {
    return NextResponse.json(
      { error: 'BOOKING_CALENDAR_ID not set on the server' },
      { status: 500, headers: cors },
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: 'Invalid JSON body' },
      { status: 400, headers: cors },
    );
  }
  const parsed = RequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid request' },
      { status: 400, headers: cors },
    );
  }
  const { day, slot, name, email, language } = parsed.data;

  // Resolve the slot to concrete UTC + Bogotá-ISO timestamps.
  let startISO: string;
  let endISO: string;
  try {
    ({ startISO, endISO } = slotToISORange({ day, slot }));
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Bad slot' },
      { status: 400, headers: cors },
    );
  }
  const startDate = new Date(startISO);
  const endDate = new Date(endISO);

  // Race check: re-verify the slot is still free at booking time.
  // Google Calendar lets you create overlapping events; nothing
  // prevents two prospects from picking the same slot 200ms apart.
  // freeBusy on this narrow window catches the conflict before we
  // commit.
  try {
    const fb = await freeBusy({
      calendarId,
      timeMin: new Date(startDate.getTime() - 60 * 1000),
      timeMax: new Date(endDate.getTime() + 60 * 1000),
      timeZone: TIMEZONE,
    });
    const conflict = fb.busy.some(
      (b) => startDate < b.end && endDate > b.start,
    );
    if (conflict) {
      return NextResponse.json(
        { error: 'Slot just booked. Please pick another.' },
        { status: 409, headers: cors },
      );
    }
  } catch (err) {
    console.error('[book/create] race-check freeBusy failed', err);
    return NextResponse.json(
      { error: 'Could not verify slot availability' },
      { status: 502, headers: cors },
    );
  }

  // Insert first to get the calEventId from Google; description will
  // be patched in a second call to include the per-event join URLs
  // (which depend on the id we just got back).
  const summary = 'Samwise Breakthrough Call';
  const initialDescription = [
    `Booked via samwise.life/book`,
    `Attendee: ${name} <${email}>`,
    `Language: ${language === 'es' ? 'Español' : 'English'}`,
  ].join('\n');

  let calEvent: { eventId: string; htmlLink: string };
  try {
    calEvent = await insertEvent({
      calendarId,
      summary,
      description: initialDescription,
      startISO,
      endISO,
      timeZone: TIMEZONE,
      attendee: { email, displayName: name },
    });
  } catch (err) {
    console.error('[book/create] insertEvent failed', err);
    return NextResponse.json(
      { error: 'Could not create the calendar event' },
      { status: 502, headers: cors },
    );
  }

  const joinUrl = `https://samwise.life/meet/${calEvent.eventId}`;
  const roomName = `book-${calEvent.eventId}`;
  const prospectKey = emailToProspectKey(email);

  // Patch the calendar event description with the ATTENDEE join URL
  // only. The therapist join URL (app.samwise.life/meet/{id}) is
  // deliberately NOT included — the route has no auth in v1, and
  // putting it in the calendar event (which the attendee receives a
  // copy of in their .ics) would let anyone with the link join the
  // call as Samuel. The attendee URL is safe to expose — that's the
  // URL the attendee is meant to click.
  try {
    await patchEventDescription({
      calendarId,
      eventId: calEvent.eventId,
      description: [
        initialDescription,
        '',
        `Attendee join: ${joinUrl}`,
      ].join('\n'),
    });
  } catch (err) {
    console.warn('[book/create] description patch failed (event still created)', err);
  }

  try {
    await createCalendarBooking({
      calEventId: calEvent.eventId,
      roomName,
      prospectKey,
      prospect: { name, email },
      language,
      scheduledFor: startISO,
    });
  } catch (err) {
    // Calendar event already created. Log loudly, but return success
    // — Samuel can recover by reading the event from the calendar.
    console.error('[book/create] Firestore write failed (event still created)', err);
  }

  // Samwise-branded confirmation email + iCalendar invite. The .ics
  // is what makes email clients render an "Add to calendar" button —
  // since Google won't let our service account send the calendar
  // invite for us (personal Gmail, no Domain-Wide Delegation), we
  // send the invite ourselves via .ics inside the same email.
  try {
    const ics = buildICS({
      uid: `${calEvent.eventId}@samwise.life`,
      startUTC: startDate,
      endUTC: endDate,
      summary: 'Samwise Breakthrough Call',
      description: `Join the call: ${joinUrl}`,
      location: joinUrl,
      organizerName: 'Samuel Giraldo',
      organizerEmail: 'samuelgiraldoconcha@gmail.com',
      attendeeName: name,
      attendeeEmail: email,
    });
    await getDb()
      .collection('mail')
      .add(
        buildBookingConfirmationEmail({
          to: email,
          language,
          firstName: name.split(/\s+/)[0] || name,
          startISO,
          joinUrl,
          ics,
        }),
      );
  } catch (err) {
    console.error('[book/create] mail dispatch failed (continuing)', err);
  }

  return NextResponse.json(
    {
      calEventId: calEvent.eventId,
      scheduledFor: startISO,
      joinUrl,
    },
    { headers: cors },
  );
}

// ─────────────────────────────────────────────────────────────────────
// Email body builder. Inline-styled table layout, same register as
// buildPostCallEmailDoc / buildDemoCallLinkEmailDoc on the cloud-
// functions side (Georgia-fallback Fraunces serif + Helvetica fallback
// Manrope sans, gold ✦ next to wordmark).
// ─────────────────────────────────────────────────────────────────────

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function formatBogotaHuman(startISO: string, language: 'en' | 'es'): string {
  const d = new Date(startISO);
  const fmt = new Intl.DateTimeFormat(
    language === 'es' ? 'es-CO' : 'en-US',
    {
      timeZone: TIMEZONE,
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: language === 'en',
    },
  );
  return fmt.format(d);
}

function buildBookingConfirmationEmail(params: {
  to: string;
  language: 'en' | 'es';
  firstName: string;
  startISO: string;
  joinUrl: string;
  ics: string;
}): {
  to: string;
  replyTo: string;
  message: {
    subject: string;
    text: string;
    html: string;
    // .ics travels as an explicit attachment with Content-Type
    // text/calendar; method=REQUEST. That mime-type is what Gmail
    // (web + mobile), Apple Mail, and Outlook all key off of to
    // render the "Add to calendar" widget inline. We previously
    // tried Nodemailer's `icalEvent` field but Firebase Trigger
    // Email's extension version doesn't reliably pass it through
    // to Nodemailer — attachments[] is documented and stable.
    attachments: Array<{
      filename: string;
      content: string;
      contentType: string;
    }>;
  };
} {
  const { to, language, firstName, startISO, joinUrl, ics } = params;
  const when = formatBogotaHuman(startISO, language);

  const subject =
    language === 'es'
      ? 'Tu llamada está reservada'
      : 'Your call is booked';
  const greeting = language === 'es' ? `Hola ${firstName},` : `Hi ${firstName},`;
  const intro =
    language === 'es'
      ? `Reservamos tu llamada para ${when} (hora de Bogotá). Cuando llegue el momento, entra con este link:`
      : `We've got you down for ${when} (Bogotá time). When the time comes, join here:`;
  const ctaLabel = language === 'es' ? 'Entrar a la llamada' : 'Join the call';
  const sign = language === 'es' ? 'Gracias,\nSamuel' : 'Thanks,\nSamuel';

  const text = `${greeting}\n\n${intro}\n\n${joinUrl}\n\n${sign}`;

  const html = `<!doctype html>
<html lang="${language}">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(subject)}</title>
</head>
<body style="margin: 0; padding: 0; background: #FFFFFF; color: #000000;">
  <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background: #FFFFFF;">
    <tr><td align="center" style="padding: 64px 24px 56px 24px;">
      <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="560" style="max-width: 560px; width: 100%;">
        <tr><td style="padding: 0 0 40px 0;">
          <span style="font-family: Georgia, 'Times New Roman', serif; font-style: italic; font-weight: 400; font-size: 22px; letter-spacing: -0.01em; color: #000000;">Samwise</span><span style="color: #D4A85A; font-size: 9px; vertical-align: 12px; padding-left: 3px;">&#x2726;</span>
        </td></tr>
        <tr><td style="font-family: Georgia, 'Times New Roman', serif; font-weight: 400; font-size: 17px; line-height: 1.5; color: #000000; padding: 0 0 18px 0;">
          ${escapeHtml(greeting)}
        </td></tr>
        <tr><td style="font-family: Georgia, 'Times New Roman', serif; font-style: italic; font-weight: 400; font-size: 16px; line-height: 1.55; color: #1A1A1A; padding: 0 0 36px 0;">
          ${escapeHtml(intro)}
        </td></tr>
        <tr><td style="padding: 0 0 14px 0;">
          <a href="${escapeHtml(joinUrl)}" style="font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; font-weight: 600; font-size: 13px; letter-spacing: 0.12em; text-transform: uppercase; color: #000000; text-decoration: none; border-bottom: 1px solid #D4A85A; padding-bottom: 2px;">
            ${escapeHtml(ctaLabel)}
          </a>
        </td></tr>
        <tr><td style="font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; font-weight: 400; font-size: 13px; line-height: 1.5; color: #555555; padding: 0 0 48px 0; word-break: break-all;">
          <a href="${escapeHtml(joinUrl)}" style="color: #555555; text-decoration: underline;">${escapeHtml(joinUrl)}</a>
        </td></tr>
        <tr><td style="font-family: Georgia, 'Times New Roman', serif; font-style: italic; font-weight: 400; font-size: 16px; line-height: 1.5; color: #000000; padding: 16px 0 0 0; white-space: pre-line;">
          ${escapeHtml(sign)}
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

  return {
    to,
    replyTo: 'samuelgiraldoconcha@gmail.com',
    message: {
      subject,
      text,
      html,
      attachments: [
        {
          filename: 'samwise-call.ics',
          content: ics,
          contentType: 'text/calendar; method=REQUEST; charset=UTF-8',
        },
      ],
    },
  };
}

// Silence unused-import warning if we want to delete duration later
void SLOT_DURATION_MIN;
