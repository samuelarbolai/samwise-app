import { NextResponse } from 'next/server';
import { freeBusy } from '@/lib/google-calendar';
import {
  computeAvailability,
  TIMEZONE,
  type DaySlots,
} from '@/lib/book/availability';

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

// GET /api/book/slots — returns the next 14 days of available slots
// for the Samwise Breakthrough Call on the BOOKING_CALENDAR_ID
// calendar. No query params; the window is fixed (24h from now → 14d
// out).
export async function GET(req: Request) {
  const cors = corsHeaders(req.headers.get('origin'));

  const calendarId = process.env.BOOKING_CALENDAR_ID;
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

  const days: DaySlots[] = computeAvailability({ now, busy });

  return NextResponse.json(
    {
      days,
      timeZone: TIMEZONE,
    },
    { headers: cors },
  );
}
