import { NextResponse } from 'next/server';
import { z } from 'zod';
import {
  createAgentDispatch,
  getLiveKitWsUrl,
  hasAgentDispatch,
  mintRoomAccessToken,
} from '@/lib/livekit-dispatch';
import {
  claimJoinNotification,
  createWalkIn,
  emailToProspectKey,
  notifySamuelOfWalkIn,
  readWalkIn,
} from '@/lib/walk-in/walkin';
import { readCalendarBooking } from '@/lib/book/booking';

export const runtime = 'nodejs';

// Two shapes:
//  - { mode: "create", name, email, language }            ← from the lobby
//  - { mode: "join_existing", walkInId, side: "therapist" } ← Samuel's surface
//
// email is optional in the create path (per user 2026-05-27 — "make the
// room free to enter"). If supplied, must be valid format. If blank,
// prospectKey falls back to a guest identifier and notification email
// is skipped.
const RequestSchema = z.union([
  z.object({
    mode: z.literal('create'),
    name: z.string().min(1).max(120),
    email: z.union([z.string().email().max(200), z.literal('')]),
    language: z.enum(['en', 'es']),
    // When true, dispatch the autonomous demo-call agent into the new room
    // instead of waiting for a human therapist. Defaults to human-run.
    autonomous: z.boolean().optional(),
  }),
  z.object({
    mode: z.literal('join_existing'),
    // Despite the name, this id can resolve against EITHER walkIns
    // (for walk-in entries from /meet lobby) OR calendarBookings (for
    // scheduled bookings from /book). The route tries calendarBookings
    // first, falls back to walkIns. Format conventions differ enough
    // that collisions are impossible.
    walkInId: z.string().min(1),
    // Therapist = Samuel joining from the email/calendar invite link;
    // user = the prospect joining from their email link at call time.
    // Walk-ins only support side="therapist" historically (the user
    // goes straight into the room from the lobby) — but a user-side
    // call against a walk-in id still mints a guest token cleanly.
    side: z.enum(['therapist', 'user']),
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
    const ts = Date.now();
    // Blank email → guest identity. Used for testing + walk-ins where
    // the prospect didn't bother entering an email. prospectKey still
    // exists so the doc has a key + lookups don't crash, it just won't
    // match any existing qualification (no pre-fill on the copilot).
    const prospectKey = data.email
      ? emailToProspectKey(data.email)
      : `guest:${ts}`;
    const walkInId = `${prospectKey.replace(/[^a-zA-Z0-9]/g, '_')}-${ts}`;
    const roomName = `walk-in-${walkInId}`;

    await createWalkIn({
      walkInId,
      roomName,
      prospectKey,
      prospect: { name: data.name, email: data.email },
      language: data.language,
      autonomous: data.autonomous ?? false,
    });

    // Notification is best-effort — a delivery failure should NOT
    // block the prospect from joining the room. They'll just be
    // waiting; Samuel will see the walkIn doc in Firestore even if
    // the email never lands. Skip the notification entirely for
    // guest entries (no contact info to reply with — the email
    // wouldn't add useful context, just noise).
    if (data.email) {
      try {
        // Claim the one-time notification now so a later reload of this
        // walk-in (→ join_existing, side:user) doesn't re-notify.
        if (await claimJoinNotification('walkIns', walkInId)) {
          await notifySamuelOfWalkIn({
            walkInId,
            prospect: { name: data.name, email: data.email },
            language: data.language,
          });
        }
      } catch (err) {
        console.error('[walk-in init] notification mail failed', err);
      }
    } else {
      console.info('[walk-in init] guest entry — skipping notification mail', {
        walkInId,
      });
    }

    const token = await mintRoomAccessToken({
      identity: `${prospectKey}-${ts}`,
      roomName,
    });

    // Autonomous demo: put the demo-call agent in the room now (no human
    // therapist). The walk-in enters the call in-page off THIS token, so the
    // agent must be dispatched here. A reload re-enters via /meet/[walkInId] →
    // the join path, which is guarded by hasAgentDispatch, so this dispatch is
    // never duplicated. Gated on the flag so human walk-ins stay human-run.
    if (data.autonomous) {
      try {
        await createAgentDispatch({
          agentName: 'ritual-agent',
          roomName,
          metadata: {
            flow: 'demo-call',
            language: data.language,
            prospect_name: data.name,
            prospect_email: data.email,
            script_doc_url: '',
          },
        });
      } catch (err) {
        console.error('[walk-in init] demo-call agent dispatch failed', err);
      }
    } else {
      // Human walk-in (Samuel + prospect, no AI guide): dispatch the silent
      // scribe so the call is transcribed in the LiveKit dashboard. A reload
      // re-enters via the join path (guarded by hasAgentDispatch), so this
      // dispatch is never duplicated.
      try {
        await createAgentDispatch({
          agentName: 'ritual-agent',
          roomName,
          metadata: { flow: 'scribe', language: data.language },
        });
      } catch (err) {
        console.error('[walk-in init] scribe dispatch failed', err);
      }
    }

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
          autonomous: data.autonomous === true,
        },
      },
      { headers: cors },
    );
  }

  // ── Mode: join_existing ─────────────────────────────────────────
  // Resolve the id against calendarBookings first (scheduled flow),
  // then walkIns (lobby flow). Mint a token for whichever side asked.

  // Normalize: regardless of source collection, we end up with the
  // same shape used downstream by WalkInShell / CallRoom.
  interface NormalizedBooking {
    roomName: string;
    prospectKey: string;
    prospect: { name: string; email: string };
    language: 'en' | 'es';
    scheduledFor: string;
    autonomous: boolean;
    /** In-call kind. Drives which visuals the landing's call-room renders
     *  and which rep control WalkInShell mounts on this side. Defaults to
     *  the prospect demo when absent. */
    kind: 'demo' | 'therapist-demo';
  }
  let booking: NormalizedBooking | null = null;
  // Which collection the id resolved against — needed to claim the
  // one-time join notification on the correct doc.
  let source: 'walkIns' | 'calendarBookings' | null = null;

  const calendarBooking = await readCalendarBooking(data.walkInId);
  if (calendarBooking) {
    source = 'calendarBookings';
    booking = {
      roomName: calendarBooking.roomName,
      prospectKey: calendarBooking.prospectKey,
      prospect: calendarBooking.prospect,
      language: calendarBooking.language,
      scheduledFor: calendarBooking.scheduledFor,
      autonomous:
        (calendarBooking as { autonomous?: boolean }).autonomous === true,
      kind: calendarBooking.kind ?? 'demo',
    };
  } else {
    const walkIn = await readWalkIn(data.walkInId);
    if (walkIn) {
      source = 'walkIns';
      booking = {
        roomName: walkIn.roomName,
        prospectKey: walkIn.prospectKey,
        prospect: walkIn.prospect,
        language: walkIn.language,
        scheduledFor:
          walkIn.createdAt?.toDate?.().toISOString() ??
          new Date().toISOString(),
        autonomous: (walkIn as { autonomous?: boolean }).autonomous === true,
        // Walk-ins (the always-open lobby) are always the prospect demo;
        // therapist-demo bookings only land via calendarBookings.
        kind: 'demo',
      };
    }
  }

  if (!booking) {
    return NextResponse.json(
      { error: 'Booking not found' },
      { status: 404, headers: cors },
    );
  }

  // Identity differs per side. Therapist is constant; user gets a
  // per-join unique identity so re-joins after disconnect don't clash
  // with any still-GC'ing previous identity in the room.
  const identity =
    data.side === 'therapist'
      ? 'therapist-samuel'
      : `${booking.prospectKey}-${Date.now()}`;

  const token = await mintRoomAccessToken({
    identity,
    roomName: booking.roomName,
  });

  // On the prospect's join, ensure the room has its agent — the demo-call guide
  // for autonomous bookings, otherwise the silent scribe that transcribes the
  // human↔human call. Guarded by hasAgentDispatch so a rejoin/reload of a live
  // room (the norm after the reconnection work) re-enters the SAME agent rather
  // than spawning a duplicate. Covers both walk-in and scheduled.
  if (data.side === 'user' && !(await hasAgentDispatch(booking.roomName))) {
    const metadata = booking.autonomous
      ? {
          flow: 'demo-call' as const,
          language: booking.language,
          prospect_name: booking.prospect.name,
          prospect_email: booking.prospect.email,
          script_doc_url: '',
        }
      : { flow: 'scribe' as const, language: booking.language };
    try {
      await createAgentDispatch({
        agentName: 'ritual-agent',
        roomName: booking.roomName,
        metadata,
      });
    } catch (err) {
      console.error('[walk-in init] agent dispatch failed', err);
    }
  }

  // The prospect just entered via a pre-created link (scheduled booking or a
  // reloaded walk-in). Ping Samuel so he can connect. Best-effort, gated on a
  // contactable email, and claimed write-once so reloads/reconnects — which
  // re-hit this route — don't spam the inbox. Walk-ins already claimed at
  // create, so this only newly fires for scheduled bookings' first join.
  if (data.side === 'user' && source && booking.prospect.email) {
    try {
      if (await claimJoinNotification(source, data.walkInId)) {
        await notifySamuelOfWalkIn({
          walkInId: data.walkInId,
          prospect: booking.prospect,
          language: booking.language,
        });
      }
    } catch (err) {
      console.error('[walk-in init] join notification mail failed', err);
    }
  }

  // Trim the projection per side. Therapist gets everything (drives
  // copilot pre-fill); user gets only what the call-room needs to
  // greet them.
  const bookingProjection =
    data.side === 'therapist'
      ? {
          roomName: booking.roomName,
          prospectKey: booking.prospectKey,
          prospect: booking.prospect,
          language: booking.language,
          scheduledFor: booking.scheduledFor,
          kind: booking.kind,
        }
      : {
          roomName: booking.roomName,
          therapistName: 'Samuel',
          prospectFirstName: booking.prospect.name.split(' ')[0] ?? '',
          language: booking.language,
          scheduledFor: booking.scheduledFor,
          autonomous: booking.autonomous,
          kind: booking.kind,
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
