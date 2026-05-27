import { NextResponse } from 'next/server';
import { z } from 'zod';
import {
  getLiveKitWsUrl,
  mintRoomAccessToken,
} from '@/lib/livekit-dispatch';
import {
  createWalkIn,
  emailToProspectKey,
  notifySamuelOfWalkIn,
  readWalkIn,
} from '@/lib/walk-in/walkin';

export const runtime = 'nodejs';

// Two shapes:
//  - { mode: "create", name, email, language }            ← from the lobby
//  - { mode: "join_existing", walkInId, side: "therapist" } ← Samuel's surface
const RequestSchema = z.union([
  z.object({
    mode: z.literal('create'),
    name: z.string().min(1).max(120),
    email: z.string().email().max(200),
    language: z.enum(['en', 'es']),
  }),
  z.object({
    mode: z.literal('join_existing'),
    walkInId: z.string().min(1),
    side: z.enum(['therapist']),
  }),
]);

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
  const data = parsed.data;

  // ── Mode: create ────────────────────────────────────────────────
  // Prospect just submitted the lobby form. Build the walkIn, mint
  // a token, notify Samuel, return everything the lobby needs to
  // immediately transition into the call.
  if (data.mode === 'create') {
    const prospectKey = emailToProspectKey(data.email);
    const ts = Date.now();
    const walkInId = `${prospectKey.replace(/[^a-zA-Z0-9]/g, '_')}-${ts}`;
    const roomName = `walk-in-${walkInId}`;

    await createWalkIn({
      walkInId,
      roomName,
      prospectKey,
      prospect: { name: data.name, email: data.email },
      language: data.language,
    });

    // Notification is best-effort — a delivery failure should NOT
    // block the prospect from joining the room. They'll just be
    // waiting; Samuel will see the walkIn doc in Firestore even if
    // the email never lands.
    try {
      await notifySamuelOfWalkIn({
        walkInId,
        prospect: { name: data.name, email: data.email },
        language: data.language,
      });
    } catch (err) {
      console.error('[walk-in init] notification mail failed', err);
    }

    const token = await mintRoomAccessToken({
      identity: `${prospectKey}-${ts}`,
      roomName,
    });

    return NextResponse.json(
      {
        token,
        wsUrl: getLiveKitWsUrl(),
        roomName,
        walkInId,
        booking: {
          roomName,
          therapistName: 'Samuel',
          prospectFirstName: data.name.split(' ')[0] ?? '',
          language: data.language,
          scheduledFor: new Date().toISOString(),
        },
      },
      { headers: cors },
    );
  }

  // ── Mode: join_existing ─────────────────────────────────────────
  // Samuel clicked the notification email link. Look up the walkIn,
  // mint his token, return everything WalkInShell needs.
  const walkIn = await readWalkIn(data.walkInId);
  if (!walkIn) {
    return NextResponse.json(
      { error: 'Walk-in not found' },
      { status: 404, headers: cors },
    );
  }

  const token = await mintRoomAccessToken({
    identity: 'therapist-samuel',
    roomName: walkIn.roomName,
  });

  return NextResponse.json(
    {
      token,
      wsUrl: getLiveKitWsUrl(),
      roomName: walkIn.roomName,
      booking: {
        roomName: walkIn.roomName,
        prospectKey: walkIn.prospectKey,
        prospect: walkIn.prospect,
        language: walkIn.language,
        scheduledFor: walkIn.createdAt?.toDate?.().toISOString() ??
          new Date().toISOString(),
      },
    },
    { headers: cors },
  );
}
