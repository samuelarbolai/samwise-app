import { NextResponse } from 'next/server';
import { z } from 'zod';
import {
  getLiveKitWsUrl,
  mintRoomAccessToken,
  startRoomCompositeEgress,
} from '@/lib/livekit-dispatch';
import {
  readDemoBooking,
  markBookingInProgress,
} from '@/lib/demo-call/booking';

export const runtime = 'nodejs';

const RequestSchema = z.object({
  bookingId: z.string().min(1),
  side: z.enum(['therapist', 'user']),
});

// CORS allowlist. The therapist side (this app) calls same-origin so
// CORS is a no-op for it; the user side lives on samwise.life and POSTs
// here cross-origin. Add preview deployment URLs as needed.
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
  const { bookingId, side } = parsed.data;

  const booking = await readDemoBooking(bookingId);
  if (!booking) {
    return NextResponse.json(
      { error: 'Booking not found' },
      { status: 404, headers: cors },
    );
  }
  if (booking.status === 'cancelled') {
    return NextResponse.json(
      { error: 'Booking is cancelled' },
      { status: 410, headers: cors },
    );
  }

  const identity =
    side === 'therapist'
      ? booking.therapistId
      : `${booking.prospectKey}-${Date.now()}`;

  // Therapist-side init also starts egress (idempotency: if the booking
  // already has an egressId, don't restart — recording is per-room and
  // the existing one is still going). Recording failure is non-fatal:
  // we'd rather have a working call without a recording than refuse to
  // start the call because the egress couldn't begin.
  if (side === 'therapist' && !booking.egressId) {
    try {
      const egressId = await startRoomCompositeEgress({
        roomName: booking.roomName,
        fileName: `demo-call/${bookingId}-{time}.mp4`,
      });
      await markBookingInProgress({ bookingId, egressId });
    } catch (err) {
      console.error('[demo-call init] egress start failed', err);
    }
  }

  const token = await mintRoomAccessToken({
    identity,
    roomName: booking.roomName,
  });

  // Trim the booking projection per side. Therapist gets everything (drives
  // copilot pre-fill); user gets only what the join lobby + call UI need.
  const bookingProjection =
    side === 'therapist'
      ? {
          roomName: booking.roomName,
          prospectKey: booking.prospectKey,
          prospect: booking.prospect,
          language: booking.language,
          scheduledFor: booking.scheduledFor,
        }
      : {
          roomName: booking.roomName,
          therapistName: 'Samuel', // hardcoded for v1 — see current-plan.md
          prospectFirstName: booking.prospect.name.split(' ')[0] ?? '',
          language: booking.language,
          scheduledFor: booking.scheduledFor,
        };

  return NextResponse.json(
    {
      token,
      wsUrl: getLiveKitWsUrl(),
      roomName: booking.roomName,
      booking: bookingProjection,
    },
    { headers: cors },
  );
}
