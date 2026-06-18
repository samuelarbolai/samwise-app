import { NextResponse } from 'next/server';
import { freeBusy } from '@/lib/google-calendar';
import {
  computeAvailability,
  TIMEZONE,
  type DaySlots,
} from '@/lib/book/availability';
import { resolveMeetingType, calendarIdFor } from '@/lib/book/meeting-types';

export const runtime = 'nodejs';

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
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
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

// GET /api/book/slots?type=breakthrough|therapist — returns the next 14 days
// of available slots for the given meeting type. The type drives slot
// duration/granularity and which calendar is queried (therapist can use a
// dedicated calendar via THERAPIST_BOOKING_CALENDAR_ID). Defaults to the
// Breakthrough Call when type is absent/unknown.
export async function GET(req: Request) {
  const cors = corsHeaders(req.headers.get('origin'));

  const meeting = resolveMeetingType(
    new URL(req.url).searchParams.get('type'),
  );
  const calendarId = calendarIdFor(meeting);
  if (!calendarId) {
    return NextResponse.json(
      { error: 'BOOKING_CALENDAR_ID not set on the server' },
      { status: 500, headers: cors },
    );
  }

  const now = new Date();
  // freeBusy window: a bit wider than the slot window to catch
  // events spanning the boundary.
  const timeMin = new Date(now.getTime() - 60 * 60 * 1000); // -1h
  const timeMax = new Date(now.getTime() + 16 * 24 * 60 * 60 * 1000); // +16d

  let busy: Array<{ start: Date; end: Date }>;
  try {
    const fb = await freeBusy({
      calendarId,
      timeMin,
      timeMax,
      timeZone: TIMEZONE,
    });
    busy = fb.busy;
  } catch (err) {
    console.error('[book/slots] freeBusy failed', err);
    return NextResponse.json(
      { error: 'Could not load availability' },
      { status: 502, headers: cors },
    );
  }

  const days: DaySlots[] = computeAvailability({
    now,
    busy,
    durationMin: meeting.durationMin,
    granularityMin: meeting.granularityMin,
  });

  return NextResponse.json(
    {
      days,
      timeZone: TIMEZONE,
    },
    { headers: cors },
  );
}
