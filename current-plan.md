# current-plan.md — Native demo-call video room (therapist ↔ user) on LiveKit

> Overwrites the previous plan (Demo Call language neutralization + disqualified-rebound flow — finished, separate task in the master Vibe doc).

## Plan Summary

Build a two-sided video-call surface for the Demo Call, replacing the current "rep uses copilot in one window + Cal.com link in another window" arrangement with a single integrated experience powered by LiveKit.

**Therapist surface** (`samwise-app`, `app.samwise.life/demo-call/[bookingId]`): the existing `/copilot` two-pane shell (variables-table left, script-pane right), plus a third column with the user's video tile and self-view PiP. Copilot pre-fills from the booking's qualification doc automatically (no manual identifier typing). On variable cleaning commit, the copilot broadcasts the cleaned value over LiveKit DataChannel.

**User surface** (`samwise-landing`, `samwise.life/demo-call/[bookingId]`): a video tile of the therapist plus a `<VariablesPanel>` that hydrates from those DataChannel events — same "watch the cards fill in as you talk" pattern that already works on `/qualify`. No language picker, no welcome card (booking-driven). Self-view PiP. Mute / camera-off controls.

**Booking source of truth**: a new Cal.com event type `demo`. A Cal webhook (`calDemoBookingWebhook` cloud function) writes `demoBookings/{calBookingUid}` to Firestore with everything both pages need. The Cal confirmation email links the user directly to their join URL with `{{uid}}` substituted in.

**Recording**: always-on for v1 via LiveKit Cloud Composite Egress, triggered server-side when the therapist's init route fires. Egress target is LiveKit Cloud's managed storage (we'll verify at test time whether this exists at the project's tier; fallback is a GCS bucket). The egress ID is written to the booking doc for later playback.

**Auth**: explicitly deferred. The `bookingId`-as-credential model is fine for internal test users; see the Open decisions section.

### Scope

In:
- New Cal.com event type `demo` (manual setup by user, in Cal's admin).
- New cloud function `calDemoBookingWebhook` + Firestore `demoBookings` collection.
- New Next.js API route in samwise-app: `/api/demo-call/init`.
- New samwise-app page: `/demo-call/[bookingId]` (therapist).
- New `<VideoCallExperience>` component in samwise-app (the canonical video-call client wiring; mirrors the patterns in `RitualCallExperience` but for two-human + video).
- Reuses the existing `/copilot` pieces wholesale; only the page that hosts them is new.
- DataChannel bridge from copilot → user view (`demo-call:variable_update` events).
- New `userVisible?: boolean` field on `DemoCallVariable` (per-field opt-in to user-side display).
- New samwise-landing route: `/demo-call/[bookingId]` (user).
- Server-side egress start on session start.
- New env vars on Vercel for both projects + a Cal webhook signing secret.

Out:
- Scribe agent / auto-extraction of variables (deferred — see "Open decisions").
- Real auth (deferred — see "Open decisions").
- Multi-therapist routing (deferred — hardcoded `therapist-samuel` for v1).
- Recording consent UX (test users acknowledge externally).
- Per-recording playback UI inside samwise-app (recordings live in LiveKit storage; signed URLs retrieved manually for now).
- The "Reschedule" / "Cancel" hooks from Cal — webhook handler only handles `BOOKING_CREATED` in v1.

## Plan Architecture (Flow)

```
1) Prospect books via Cal.com (event type "demo")
   ↓
   Cal sends BOOKING_CREATED webhook → calDemoBookingWebhook (cloud function)
   ↓
   Firestore: demoBookings/{calBookingUid} = {
     roomName, therapistId: "therapist-samuel",
     prospectKey, prospect: {name, email, phone},
     scheduledFor, status: "scheduled"
   }
   ↓
   Cal sends confirmation email to prospect with link:
     samwise.life/demo-call/{{uid}}

2) Therapist opens app.samwise.life/demo-call/{bookingId} at call time
   ↓
   Page fetches /api/demo-call/init { bookingId, side: "therapist" }
   ↓
   Route looks up demoBookings/{bookingId} → mints token (identity = "therapist-samuel")
     + starts RoomCompositeEgress
     + updates booking doc: status="in_progress", egressId
   ↓
   Returns { token, wsUrl, roomName, booking, prospectKey }
   ↓
   Therapist page: VideoCallExperience joins room (publishes camera+mic)
                   + Copilot pre-fills from qualification by prospectKey
                   + Copilot broadcasts cleaned variables as DataChannel events

3) User clicks link in Cal email → samwise.life/demo-call/{bookingId}
   ↓
   Pre-join lobby: name confirm + mic/camera permission grant + "Join" button
   ↓
   POST /api/demo-call/init (also on samwise-app, called cross-origin from landing)
        { bookingId, side: "user" }
   ↓
   Route: same booking lookup → mints token (identity = prospectKey-{ts})
   ↓
   Returns { token, wsUrl, roomName, booking: {prospect.name, scheduledFor} }
   ↓
   Landing page: VideoCallExperience joins same room
                 + VariablesPanel subscribes to DataChannel
                 + cards render as therapist's copilot commits cleanings

4) Either side clicks "End call"
   ↓
   Disconnects locally
   ↓
   LiveKit closes room when last participant leaves (emptyTimeout 30s)
   ↓
   Egress stops automatically (RoomComposite ends with the room)
   ↓
   Background: a follow-up step in v2 will mark booking status="completed"
   (For v1: status field stays at "in_progress" until manually updated.
    Acceptable because we have no UI consuming the field yet.)
```

## Plan Structure (Directories and files)

```
samwise-backend/cloud-functions/functions/src/
└── index.ts                                     # MODIFIED: append calDemoBookingWebhook

samwise-app/
├── app/
│   ├── api/
│   │   ├── ritual-call/init/route.ts            # (unchanged — reference only)
│   │   └── demo-call/init/route.ts              # NEW
│   ├── demo-call/
│   │   └── [bookingId]/
│   │       └── page.tsx                         # NEW (therapist)
│   └── copilot/
│       ├── page.tsx                             # (unchanged — re-used as a child component)
│       └── demo-call-config.ts                  # MODIFIED: + userVisible?: boolean field
├── components/
│   ├── ritual-call/RitualCallExperience.tsx     # (unchanged — reference only)
│   └── demo-call/
│       ├── VideoCallExperience.tsx              # NEW
│       └── DemoCallShell.tsx                    # NEW (3-column layout therapist-side)
├── lib/
│   ├── livekit-dispatch.ts                      # MODIFIED: + startRoomCompositeEgress helper
│   ├── firebase-admin.ts                        # (unchanged)
│   └── demo-call/
│       ├── broadcast.ts                         # NEW (publishVariableUpdate helper)
│       └── booking.ts                           # NEW (Firestore reader/writer for demoBookings)

samwise-landing/
├── app/
│   └── demo-call/
│       └── [bookingId]/
│           ├── page.tsx                         # NEW (user)
│           ├── pre-join.tsx                     # NEW (name confirm + lobby)
│           ├── call-room.tsx                    # NEW (video + variables panel)
│           └── demo-call.css                    # NEW
└── app/qualify/components/variables-panel.tsx   # (unchanged — re-imported)

External (user does in browser, by hand):
- Cal.com: create event type "demo" + custom fields + confirmation-email template
- LiveKit Cloud project secrets: add egress credentials (see Phase 0)
- Vercel: add new env vars on samwise-app AND samwise-landing
```

## Conventions adopted by this plan

- **DataChannel event names** namespaced under `demo-call:` (mirrors the existing `qualification:` namespace from `/qualify`).
- **Room name** = `demo-call-{calBookingUid}`. Stable across rejoins (LiveKit reuses an existing room if both join the same name). Re-deriving from `bookingId` on the client is safe because both sides resolve the same booking.
- **Therapist identity** = `therapist-samuel` (hardcoded constant, see Open decisions).
- **User identity** = `{prospectKey}-{Date.now()}`. Per-join unique so rejoins don't clash if a previous instance hasn't been GC'd; the prefix preserves the rep's "this is prospect X" recognition in the LiveKit dashboard.

---

## Modifications (in phases and steps)

### Phase 0 — Manual setup (user does in browser, before any code work)

#### Step 0.1 — Cal.com: create the "demo" event type

In Cal.com admin (the team the Breakthrough Call already lives under):

1. Create a new event type, slug `demo`, length 45 minutes (Samuel's stated Demo Call length — confirm).
2. Add custom booking fields the webhook will rely on:
   - `Full name` (built-in, required)
   - `Email` (built-in, required)
   - `Phone number` (built-in or custom, required — used to derive `prospectKey` if email-derived key isn't available)
   - `Preferred language` (custom, select `en | es`, required) — drives the user-side UI language
3. In the confirmation-email template, add the join URL on its own line. Cal exposes `{{uid}}` as a template variable:
   ```
   Your demo call link:
   https://samwise.life/demo-call/{{uid}}
   ```
   (Verify the exact variable name in Cal's docs — may be `{BOOKING_UID}` or similar depending on Cal version.)
4. Under the event type's "Webhooks" tab, add a webhook for the `BOOKING_CREATED` trigger pointing at the cloud function URL (will be filled in after Step 1.1 deploys). Optionally set a signing secret (recommended) — call it `CAL_WEBHOOK_SECRET` and copy the value for Step 0.3.

#### Step 0.2 — LiveKit Cloud: enable Composite Egress + storage

In LiveKit Cloud dashboard for the existing `arbor-a93j2951` project:

1. Navigate to Egress (or "Recordings") settings.
2. Confirm Composite Egress is enabled for the project. If the project tier offers managed storage, enable it and note the access path. If it does NOT and requires a bring-your-own bucket, fall back to creating a GCS bucket `samwise-demo-call-recordings` in `arbor-2026` and providing S3-compatible credentials. **Decision deferred to test time** — write the egress code path-agnostic (Phase 1.2 below).

#### Step 0.3 — Vercel env vars

Add to BOTH samwise-app AND samwise-landing on Production + Preview:

| Key | Where | Value |
|---|---|---|
| `LIVEKIT_URL` | samwise-app, samwise-landing | existing (mirror from samwise-app's ritual-call config) |
| `LIVEKIT_API_KEY` | samwise-app, samwise-landing | existing |
| `LIVEKIT_API_SECRET` | samwise-app, samwise-landing | existing |
| `FIREBASE_SERVICE_ACCOUNT` | samwise-app, samwise-landing | existing (samwise-app already has this) |
| `CAL_WEBHOOK_SECRET` | cloud-functions runtime env | new (from Step 0.1.4) |
| `EGRESS_STORAGE_*` (if BYO bucket) | samwise-app only | new — see Step 1.2 |

Re-verify the FIREBASE_SERVICE_ACCOUNT paste trap on samwise-landing per the `samwise-app-livekit-integration` skill: pull back down with `vercel env pull` and confirm `JSON.parse` succeeds.

### Phase 1 — Shared infrastructure (samwise-app)

#### Step 1.1 — Extend `lib/livekit-dispatch.ts` with an egress helper

- **In-file location:** `samwise-app/lib/livekit-dispatch.ts`, append below `getLiveKitWsUrl`.
- **Should not be modified:** `mintRoomAccessToken`, `createAgentDispatch` (still used by `/api/ritual-call/init`), `getLiveKitWsUrl`, `requireEnv`.
- **Code (append):**
  ```ts
  import { EgressClient, EncodedFileType, EncodedFileOutput } from 'livekit-server-sdk';

  // Starts a Composite Egress recording for the room. Returns the egress ID
  // so callers can persist it on the booking doc for later playback.
  // RoomComposite renders one MP4 with both participants' video + audio
  // composited into a single track. Auto-stops when the room is empty.
  export async function startRoomCompositeEgress(args: {
    roomName: string;
    fileName: string;
  }): Promise<string> {
    const client = new EgressClient(
      requireEnv('LIVEKIT_URL'),
      requireEnv('LIVEKIT_API_KEY'),
      requireEnv('LIVEKIT_API_SECRET'),
    );
    const output: EncodedFileOutput = new EncodedFileOutput({
      fileType: EncodedFileType.MP4,
      filepath: args.fileName,
      // If BYO storage was chosen in Step 0.2, populate output.output here
      // with the S3Upload / GCPUpload struct holding bucket + creds. If
      // LiveKit Cloud's managed storage was chosen, leave output.output
      // unset — LiveKit writes to project-default storage.
    });
    const info = await client.startRoomCompositeEgress(args.roomName, {
      audioOnly: false,
      videoOnly: false,
      file: output,
    });
    return info.egressId;
  }
  ```
- **Explanation:** thin server-side helper that mirrors the existing `createAgentDispatch` style — assert env, construct client, return the value the route needs. Storage configuration is a single-line edit when we confirm the right path at test time.

#### Step 1.2 — Booking reader/writer

- **In-file location:** new file `samwise-app/lib/demo-call/booking.ts`.
- **Code:**
  ```ts
  import 'server-only';
  import { FieldValue } from 'firebase-admin/firestore';
  import { getDb } from '@/lib/firebase-admin';

  export interface DemoBookingDoc {
    roomName: string;
    therapistId: string;
    prospectKey: string;
    prospect: { name: string; email: string; phone: string };
    language: 'en' | 'es';
    scheduledFor: string;   // ISO 8601
    status: 'scheduled' | 'in_progress' | 'completed' | 'cancelled';
    egressId?: string;
    createdAt: FirebaseFirestore.Timestamp;
  }

  export async function readDemoBooking(bookingId: string): Promise<DemoBookingDoc | null> {
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
  ```

### Phase 2 — Cal webhook (samwise-backend/cloud-functions)

#### Step 2.1 — Append `calDemoBookingWebhook` to `functions/src/index.ts`

- **In-file location:** `samwise-backend/cloud-functions/functions/src/index.ts`, append at the end of the file (after the last exported function — keep it grouped near related onRequest exports).
- **Should not be modified:** any existing function, the initialization block, helpers like `requireEnv`.
- **Code (append; full function with HMAC verification + idempotent write):**
  ```ts
  // =============================================================================
  // calDemoBookingWebhook
  // =============================================================================
  // Receives Cal.com BOOKING_CREATED webhooks for the "demo" event type and
  // writes a demoBookings/{calBookingUid} doc that both the therapist
  // (samwise-app /demo-call/[bookingId]) and the user (samwise-landing
  // /demo-call/[bookingId]) read at join time.
  //
  // Idempotent on Cal's booking UID — Cal retries on non-2xx for up to 3
  // attempts, and re-firing during a hot deploy is a normal occurrence.
  // We write with .set({merge: true}) so a re-fire is a no-op rather than
  // a corruption.
  //
  // HMAC signature verification: Cal sends X-Cal-Signature-256 = hex(HMAC-SHA256(
  // body, CAL_WEBHOOK_SECRET)). We reject mismatches with 401 BEFORE parsing
  // the body to avoid using attacker-controlled input.
  // =============================================================================

  import {createHmac, timingSafeEqual} from "crypto";

  function normalizePhoneOrEmailOrName(args: {
    phone?: string;
    email?: string;
    name?: string;
  }): string {
    // Mirrors the prospectKey chain from extractQualification + submitQualification.
    // phone > email > name. Phone normalized to digits-only; email lowercased.
    if (args.phone) {
      const digits = args.phone.replace(/\D/g, "");
      if (digits.length >= 7) return `phone:${digits}`;
    }
    if (args.email) return `email:${args.email.trim().toLowerCase()}`;
    if (args.name) {
      const slug = args.name.trim().toLowerCase().replace(/\s+/g, "-");
      if (slug) return `name:${slug}`;
    }
    return `unknown:${Date.now()}`;
  }

  export const calDemoBookingWebhook = onRequest(
    {region: "us-central1", cors: false},
    async (req, res) => {
      if (req.method !== "POST") {
        res.status(405).send("Method not allowed");
        return;
      }

      // HMAC verify before touching the parsed body.
      const secret = process.env.CAL_WEBHOOK_SECRET;
      if (!secret) {
        logger.error("[calDemoBookingWebhook] CAL_WEBHOOK_SECRET not set");
        res.status(500).send("Server misconfigured");
        return;
      }
      const sig = req.header("X-Cal-Signature-256") ?? "";
      const rawBody = (req as unknown as {rawBody: Buffer}).rawBody;
      if (!rawBody) {
        res.status(400).send("Missing raw body");
        return;
      }
      const expected = createHmac("sha256", secret).update(rawBody).digest("hex");
      const sigBuf = Buffer.from(sig, "hex");
      const expBuf = Buffer.from(expected, "hex");
      if (sigBuf.length !== expBuf.length || !timingSafeEqual(sigBuf, expBuf)) {
        logger.warn("[calDemoBookingWebhook] HMAC mismatch", {
          received: sig.slice(0, 12),
        });
        res.status(401).send("Invalid signature");
        return;
      }

      const body = req.body as {
        triggerEvent?: string;
        payload?: {
          uid?: string;
          eventTypeId?: number;
          eventType?: {slug?: string};
          startTime?: string;
          attendees?: Array<{
            name?: string;
            email?: string;
            timeZone?: string;
            language?: {locale?: string};
          }>;
          responses?: Record<string, unknown>;
        };
      };

      if (body.triggerEvent !== "BOOKING_CREATED") {
        // We only handle creates in v1. Acknowledge other events with 200 so
        // Cal doesn't retry, but don't write anything.
        res.status(200).send("ignored");
        return;
      }

      const payload = body.payload ?? {};
      const bookingUid = payload.uid;
      if (!bookingUid) {
        logger.error("[calDemoBookingWebhook] payload missing uid", {body});
        res.status(400).send("Missing booking uid");
        return;
      }

      // Defensive scope: only process bookings for the "demo" event type.
      if (payload.eventType?.slug !== "demo") {
        logger.info("[calDemoBookingWebhook] non-demo event, ignoring", {
          slug: payload.eventType?.slug,
        });
        res.status(200).send("ignored");
        return;
      }

      const attendee = payload.attendees?.[0] ?? {};
      const phone = (payload.responses?.phone as string | undefined) ?? "";
      const email = attendee.email ?? "";
      const name = attendee.name ?? "";
      const language: "en" | "es" =
        attendee.language?.locale?.startsWith("es") ? "es" : "en";

      const prospectKey = normalizePhoneOrEmailOrName({phone, email, name});

      const docData = {
        roomName: `demo-call-${bookingUid}`,
        therapistId: "therapist-samuel",
        prospectKey,
        prospect: {name, email, phone},
        language,
        scheduledFor: payload.startTime ?? new Date().toISOString(),
        status: "scheduled",
        createdAt: FieldValue.serverTimestamp(),
      };

      await getFirestore()
        .collection("demoBookings")
        .doc(bookingUid)
        .set(docData, {merge: true});

      logger.info("[calDemoBookingWebhook] booking written", {
        bookingUid,
        prospectKey,
      });
      res.status(200).send("ok");
    },
  );
  ```
- **Explanation:** classic Cal webhook handler. HMAC verify first (timingSafeEqual to avoid timing oracle), then validate triggerEvent and event-type slug, normalize the prospectKey from the same phone > email > name chain used by `extractQualification` (so the rep's `loadQualification` lookup from `/copilot` still works), and write idempotently. Region `us-central1` to match existing functions.

#### Step 2.2 — Deploy + record the URL

- **Action:** `firebase deploy --only functions:calDemoBookingWebhook` (from `samwise-backend/cloud-functions/`).
- Note the deployed URL (`https://caldemobookingwebhook-<hash>-uc.a.run.app`).
- Paste into Cal.com webhook config (Step 0.1.4).

### Phase 3 — Init route (samwise-app)

#### Step 3.1 — Add `/api/demo-call/init`

- **In-file location:** new file `samwise-app/app/api/demo-call/init/route.ts`.
- **Code:**
  ```ts
  import {NextResponse} from 'next/server';
  import {z} from 'zod';
  import {
    getLiveKitWsUrl,
    mintRoomAccessToken,
    startRoomCompositeEgress,
  } from '@/lib/livekit-dispatch';
  import {readDemoBooking, markBookingInProgress} from '@/lib/demo-call/booking';

  export const runtime = 'nodejs';

  const RequestSchema = z.object({
    bookingId: z.string().min(1),
    side: z.enum(['therapist', 'user']),
  });

  const ALLOWED_ORIGINS = [
    'https://samwise.life',
    'https://www.samwise.life',
    // dev origins for samwise-landing
    'http://localhost:3000',
    'http://localhost:3001',
  ];

  function corsHeaders(origin: string | null): Record<string, string> {
    const allowed = origin && ALLOWED_ORIGINS.includes(origin) ? origin : '';
    return {
      'Access-Control-Allow-Origin': allowed,
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Vary': 'Origin',
    };
  }

  export async function OPTIONS(req: Request) {
    return new NextResponse(null, {status: 204, headers: corsHeaders(req.headers.get('origin'))});
  }

  export async function POST(req: Request) {
    const cors = corsHeaders(req.headers.get('origin'));
    let body: unknown;
    try { body = await req.json(); } catch {
      return NextResponse.json({error: 'Invalid JSON body'}, {status: 400, headers: cors});
    }
    const parsed = RequestSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({error: 'Invalid request'}, {status: 400, headers: cors});
    }
    const {bookingId, side} = parsed.data;

    const booking = await readDemoBooking(bookingId);
    if (!booking) {
      return NextResponse.json({error: 'Booking not found'}, {status: 404, headers: cors});
    }
    if (booking.status === 'cancelled') {
      return NextResponse.json({error: 'Booking is cancelled'}, {status: 410, headers: cors});
    }

    const identity =
      side === 'therapist'
        ? booking.therapistId
        : `${booking.prospectKey}-${Date.now()}`;

    // Therapist-side init also starts egress (idempotency: if the booking
    // already has an egressId, don't restart — recording is per-room and
    // the existing one is still going).
    if (side === 'therapist' && !booking.egressId) {
      try {
        const egressId = await startRoomCompositeEgress({
          roomName: booking.roomName,
          fileName: `demo-call/${bookingId}-{time}.mp4`,
        });
        await markBookingInProgress({bookingId, egressId});
      } catch (err) {
        // Recording failure should NOT block the call. Log and continue.
        console.error('[demo-call init] egress start failed', err);
      }
    }

    const token = await mintRoomAccessToken({
      identity,
      roomName: booking.roomName,
    });

    // Trim the booking projection per side — therapist gets everything
    // (drives copilot pre-fill), user gets only what they need to see.
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
            therapistName: 'Samuel',          // hardcoded — see Open decisions
            prospectFirstName: booking.prospect.name.split(' ')[0] ?? '',
            language: booking.language,
            scheduledFor: booking.scheduledFor,
          };

    return NextResponse.json(
      {token, wsUrl: getLiveKitWsUrl(), roomName: booking.roomName, booking: bookingProjection},
      {headers: cors},
    );
  }
  ```
- **Explanation:**
  - CORS opens only for `samwise.life` so the landing's join page can POST cross-origin without exposing the route to arbitrary origins.
  - Side-conditional identity, projection, and egress kickoff.
  - Egress failure is non-fatal — a missing recording is bad, a failed call is worse.

### Phase 4 — VideoCallExperience component (samwise-app, reused by both surfaces in spirit)

#### Step 4.1 — New `components/demo-call/VideoCallExperience.tsx`

- **In-file location:** new file.
- **What it is:** the canonical client wiring for a two-human LiveKit video room. Mirrors `RitualCallExperience` but: (a) publishes camera + mic, not just mic; (b) attaches remote video tracks to `<video>` elements; (c) mic is open by default with a mute toggle (NOT push-to-talk); (d) renders a self-view PiP; (e) takes an `initResponse` instead of fetching itself (the parent page does the booking-aware fetch).
- **Code (full file — long but no surprises if you've read RitualCallExperience):**
  ```tsx
  'use client';

  import {useCallback, useEffect, useRef, useState} from 'react';
  import {
    Room,
    RoomEvent,
    Track,
    createLocalTracks,
    type LocalTrack,
    type RemoteParticipant,
    type RemoteTrack,
    type RemoteTrackPublication,
  } from 'livekit-client';

  type Phase = 'connecting' | 'active' | 'peer-waiting' | 'ended' | 'error';

  export interface VideoCallInit {
    token: string;
    wsUrl: string;
    roomName: string;
  }

  export interface VideoCallExperienceProps {
    init: VideoCallInit;
    /** Optional data-event listener — used by the user-side variables panel. */
    onDataMessage?: (msg: unknown) => void;
    /** Optional ref-out so the parent can publish data events from elsewhere. */
    onRoomReady?: (room: Room) => void;
    /** Wall-clock hard cap in ms after which the client force-disconnects. */
    hardCapMs?: number; // default 75 * 60 * 1000 (75 min — 30 over the 45-min slot)
    /** Called when the user clicks "End call" or the cap fires. */
    onEnded?: () => void;
  }

  export function VideoCallExperience(props: VideoCallExperienceProps) {
    const {init, onDataMessage, onRoomReady, onEnded} = props;
    const hardCapMs = props.hardCapMs ?? 75 * 60 * 1000;

    const [phase, setPhase] = useState<Phase>('connecting');
    const [micOn, setMicOn] = useState(true);
    const [camOn, setCamOn] = useState(true);
    const [errorMsg, setErrorMsg] = useState<string | null>(null);

    const roomRef = useRef<Room | null>(null);
    const localVideoRef = useRef<HTMLVideoElement | null>(null);
    const remoteContainerRef = useRef<HTMLDivElement | null>(null);
    const startingRef = useRef(false);
    const hardCapTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const onDataMessageRef = useRef(onDataMessage);
    useEffect(() => { onDataMessageRef.current = onDataMessage; }, [onDataMessage]);

    // Tear down on unmount.
    useEffect(() => () => {
      const r = roomRef.current;
      if (r) { r.removeAllListeners(); void r.disconnect(); }
      roomRef.current = null;
      if (hardCapTimerRef.current) clearTimeout(hardCapTimerRef.current);
    }, []);

    // Auto-mute when tab hidden (privacy contract — same as RitualCallExperience).
    useEffect(() => {
      if (phase !== 'active' && phase !== 'peer-waiting') return;
      const onVis = () => {
        if (document.visibilityState === 'hidden') {
          void roomRef.current?.localParticipant.setMicrophoneEnabled(false);
          setMicOn(false);
        }
      };
      document.addEventListener('visibilitychange', onVis);
      return () => document.removeEventListener('visibilitychange', onVis);
    }, [phase]);

    const start = useCallback(async () => {
      if (startingRef.current) return;
      startingRef.current = true;

      const room = new Room({adaptiveStream: true, dynacast: true});
      roomRef.current = room;

      const onTrackSubscribed = (
        track: RemoteTrack,
        _pub: RemoteTrackPublication,
        participant: RemoteParticipant,
      ) => {
        const el = track.attach() as HTMLMediaElement;
        el.autoplay = true;
        if (track.kind === Track.Kind.Video) {
          (el as HTMLVideoElement).playsInline = true;
          el.dataset.role = 'remote-video';
        } else if (track.kind === Track.Kind.Audio) {
          el.dataset.role = 'remote-audio';
        }
        el.dataset.participant = participant.identity;
        remoteContainerRef.current?.appendChild(el);
      };
      const onTrackUnsubscribed = (track: RemoteTrack) => {
        track.detach().forEach((el) => el.remove());
      };
      const onParticipantConnected = () => setPhase('active');
      const onParticipantDisconnected = () => {
        // Peer left. Stay connected so a rejoin works without re-init.
        if (room.remoteParticipants.size === 0) setPhase('peer-waiting');
      };
      const onDisconnect = () => setPhase('ended');
      const onData = (payload: Uint8Array) => {
        try {
          const text = new TextDecoder().decode(payload);
          const parsed = JSON.parse(text);
          onDataMessageRef.current?.(parsed);
        } catch {
          // Bad payload — ignore.
        }
      };

      room.on(RoomEvent.TrackSubscribed, onTrackSubscribed);
      room.on(RoomEvent.TrackUnsubscribed, onTrackUnsubscribed);
      room.on(RoomEvent.ParticipantConnected, onParticipantConnected);
      room.on(RoomEvent.ParticipantDisconnected, onParticipantDisconnected);
      room.on(RoomEvent.Disconnected, onDisconnect);
      room.on(RoomEvent.DataReceived, onData);

      try {
        await room.connect(init.wsUrl, init.token);
        const localTracks: LocalTrack[] = await createLocalTracks({audio: true, video: true});
        await Promise.all(localTracks.map((t) => room.localParticipant.publishTrack(t)));
        // Self-view: attach local video to local <video>.
        const localVideo = localTracks.find((t) => t.kind === Track.Kind.Video);
        if (localVideo && localVideoRef.current) {
          localVideo.attach(localVideoRef.current);
        }
        try { await room.startAudio(); } catch { /* user can re-trigger */ }

        // Wall-clock hard cap.
        hardCapTimerRef.current = setTimeout(() => {
          console.warn('[demo-call] wall-clock cap reached, ending call');
          endCall();
        }, hardCapMs);

        if (room.remoteParticipants.size > 0) setPhase('active');
        else setPhase('peer-waiting');

        onRoomReady?.(room);
      } catch (err) {
        console.error('connect failed', err);
        setErrorMsg(err instanceof Error ? err.message : 'Could not connect.');
        setPhase('error');
        void room.disconnect();
        roomRef.current = null;
      } finally {
        startingRef.current = false;
      }
    }, [init, hardCapMs, onRoomReady]);

    useEffect(() => { void start(); }, [start]);

    const toggleMic = useCallback(async () => {
      const room = roomRef.current;
      if (!room) return;
      const next = !micOn;
      await room.localParticipant.setMicrophoneEnabled(next);
      setMicOn(next);
    }, [micOn]);

    const toggleCam = useCallback(async () => {
      const room = roomRef.current;
      if (!room) return;
      const next = !camOn;
      await room.localParticipant.setCameraEnabled(next);
      setCamOn(next);
    }, [camOn]);

    const endCall = useCallback(() => {
      const room = roomRef.current;
      if (room) {
        room.removeAllListeners();
        void room.disconnect();
      }
      roomRef.current = null;
      if (hardCapTimerRef.current) {
        clearTimeout(hardCapTimerRef.current);
        hardCapTimerRef.current = null;
      }
      setPhase('ended');
      onEnded?.();
    }, [onEnded]);

    return (
      <div className="flex h-full w-full flex-col bg-neutral-950 text-neutral-100">
        <div ref={remoteContainerRef} className="relative flex-1 [&_video]:absolute [&_video]:inset-0 [&_video]:h-full [&_video]:w-full [&_video]:object-cover [&_audio]:sr-only" />
        {/* Self-view PiP */}
        <div className="pointer-events-none absolute right-4 top-4 h-32 w-44 overflow-hidden rounded-md border border-neutral-800 bg-black shadow-lg">
          <video ref={localVideoRef} autoPlay muted playsInline className="h-full w-full object-cover" />
        </div>
        {/* Status overlay */}
        {phase !== 'active' && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/60">
            <p className="text-sm text-neutral-300">
              {phase === 'connecting' && 'Connecting…'}
              {phase === 'peer-waiting' && 'Waiting for the other side to join…'}
              {phase === 'ended' && 'Call ended.'}
              {phase === 'error' && (errorMsg ?? 'Something went wrong.')}
            </p>
          </div>
        )}
        {/* Controls */}
        <div className="flex items-center justify-center gap-3 bg-neutral-900 px-4 py-3">
          <button type="button" onClick={() => void toggleMic()} className="rounded-full bg-neutral-800 px-4 py-2 text-sm hover:bg-neutral-700">
            {micOn ? 'Mute' : 'Unmute'}
          </button>
          <button type="button" onClick={() => void toggleCam()} className="rounded-full bg-neutral-800 px-4 py-2 text-sm hover:bg-neutral-700">
            {camOn ? 'Camera off' : 'Camera on'}
          </button>
          <button type="button" onClick={endCall} className="rounded-full bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-500">
            End call
          </button>
        </div>
      </div>
    );
  }
  ```
- **Explanation:**
  - State machine matches `RitualCallExperience` shape but adds `peer-waiting` (other person hasn't joined yet) and an `ended` phase.
  - `createLocalTracks` then `publishTrack` so we can grab the video reference and attach to self-view in one place.
  - Remote tracks: same attach pattern as RitualCallExperience, but the container's CSS spans the parent so video fills the tile.
  - `onDataMessage` is the door the user-side variables panel listens on; `onRoomReady` is the door the therapist-side copilot publishes through.
  - Hard cap defaulted to 75 min (45-min slot + 30-min buffer for overruns). Client-side enforcement is sufficient because BOTH sides have the cap and either side timing out drops the room when both are gone (LiveKit `emptyTimeout`).
  - All the deliberate-disconnect / re-entrancy / visibility-hidden lessons from `RitualCallExperience` ported over.

### Phase 5 — Therapist page wrapper (samwise-app)

#### Step 5.1 — New `app/demo-call/[bookingId]/page.tsx`

- **In-file location:** new file.
- **What it does:** server component that just renders the client shell with the `bookingId` from URL. The client shell does the init fetch and renders the 3-column layout.
- **Code (page.tsx, server):**
  ```tsx
  import {DemoCallShell} from '@/components/demo-call/DemoCallShell';

  export const runtime = 'nodejs';

  export default async function DemoCallTherapistPage({
    params,
  }: {
    params: Promise<{bookingId: string}>;
  }) {
    const {bookingId} = await params;
    return <DemoCallShell bookingId={bookingId} />;
  }
  ```

#### Step 5.2 — New `components/demo-call/DemoCallShell.tsx`

- **In-file location:** new file.
- **What it does:** the 3-column layout (video left, variables-table middle, script-pane right). Fetches `/api/demo-call/init`, renders `<VideoCallExperience>` in the left column, renders the existing `<CopilotPage>` machinery wrapped to skip its own URL gate and auto-prefill from `booking.prospectKey`.
- **Note:** the existing `app/copilot/page.tsx` does both URL gating AND the working surface. To reuse it cleanly inside DemoCallShell, refactor: extract the post-load surface (the `grid h-screen grid-cols-[...]` block at the bottom) into a new exported component `<CopilotSurface>` with props for `script`, `state`, `setState`, `docUrl`. The original `page.tsx` continues to render `<CopilotSurface>` after its load. DemoCallShell renders `<CopilotSurface>` directly, having loaded the script via `loadCallScript(DEFAULT_DEMO_SCRIPT_DOC_URL)` on mount and pre-filled from `booking.prospectKey`.
- **Code (DemoCallShell.tsx, abbreviated — refactor + reuse):**
  ```tsx
  'use client';

  import {useEffect, useRef, useState} from 'react';
  import {Room} from 'livekit-client';
  import {VideoCallExperience, type VideoCallInit} from './VideoCallExperience';
  import {CopilotSurface} from '@/app/copilot/copilot-surface'; // extracted in Step 5.3
  import {
    DEFAULT_DEMO_SCRIPT_DOC_URL,
    DEMO_CALL_VARIABLES,
  } from '@/app/copilot/demo-call-config';
  import {loadCallScript, type LoadedScript} from '@/lib/copilot/load-script';
  import {loadQualification} from '@/lib/copilot/load-qualification';
  import {makeEmptyState, type SessionState} from '@/lib/copilot/session-storage';
  import {createVariableBroadcaster, type VariableBroadcaster} from '@/lib/demo-call/broadcast';

  interface InitResponse {
    token: string;
    wsUrl: string;
    roomName: string;
    booking: {
      roomName: string;
      prospectKey: string;
      prospect: {name: string; email: string; phone: string};
      language: 'en' | 'es';
      scheduledFor: string;
    };
  }

  export function DemoCallShell({bookingId}: {bookingId: string}) {
    const [init, setInit] = useState<InitResponse | null>(null);
    const [script, setScript] = useState<LoadedScript | null>(null);
    const [state, setState] = useState<SessionState | null>(null);
    const [error, setError] = useState<string | null>(null);
    const broadcasterRef = useRef<VariableBroadcaster | null>(null);

    // Single mount-time effect: init + load script + pre-fill from qualification.
    useEffect(() => {
      let cancelled = false;
      (async () => {
        try {
          const res = await fetch('/api/demo-call/init', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({bookingId, side: 'therapist'}),
          });
          if (!res.ok) throw new Error((await res.json()).error ?? 'Init failed');
          const initData: InitResponse = await res.json();
          if (cancelled) return;
          setInit(initData);

          const loaded = await loadCallScript(DEFAULT_DEMO_SCRIPT_DOC_URL);
          if (loaded.scriptType !== 'demo') throw new Error('Loaded non-demo script');
          if (cancelled) return;
          setScript(loaded);

          const fresh = makeEmptyState(DEMO_CALL_VARIABLES);
          // Pre-fill from qualification by prospectKey.
          const q = await loadQualification(initData.booking.prospectKey);
          if (q.ok && !cancelled) {
            // Inline the same fill loops as copilot/page.tsx handleLoadQualification.
            // (Extract into a shared helper if duplication grows uncomfortable.)
            fresh.qualificationProspectKey = q.qualification.prospectKey;
            // ... (mirror QUALIFICATION_TO_DEMO_FIELDS + DERIVED_PREFILLS) ...
          }
          setState(fresh);
        } catch (err) {
          setError(err instanceof Error ? err.message : 'Could not start the call');
        }
      })();
      return () => { cancelled = true; };
    }, [bookingId]);

    const handleRoomReady = (room: Room) => {
      broadcasterRef.current = createVariableBroadcaster(room);
    };

    // When state.cleaned changes for a userVisible variable, broadcast.
    // (Implementation detail: subscribe to setState wrapper inside CopilotSurface
    // via a callback prop, OR poll cleaned via useEffect on its value. Choose
    // callback-prop pattern to avoid stale closures.)

    if (error) {
      return <main className="flex h-screen items-center justify-center text-red-600">{error}</main>;
    }
    if (!init || !script || !state) {
      return <main className="flex h-screen items-center justify-center">Loading…</main>;
    }

    const initForVideo: VideoCallInit = {
      token: init.token,
      wsUrl: init.wsUrl,
      roomName: init.roomName,
    };

    return (
      <main className="grid h-screen grid-cols-[minmax(360px,1fr)_minmax(360px,1fr)_2fr]">
        <section className="relative border-r border-neutral-800">
          <VideoCallExperience init={initForVideo} onRoomReady={handleRoomReady} />
        </section>
        <CopilotSurface
          script={script}
          state={state}
          setState={(updater) => {
            setState((prev) => {
              const next = typeof updater === 'function' ? updater(prev!) : updater;
              if (next && broadcasterRef.current) {
                broadcasterRef.current.diffAndPublish(prev?.cleaned ?? {}, next.cleaned, DEMO_CALL_VARIABLES);
              }
              return next;
            });
          }}
          docUrl={DEFAULT_DEMO_SCRIPT_DOC_URL}
        />
      </main>
    );
  }
  ```
- **Note:** the broadcaster wraps `setState` with a diff-and-publish wrapper so any cleaned-value change for a `userVisible` variable goes out over DataChannel. See Phase 6.

#### Step 5.3 — Extract `CopilotSurface` from `app/copilot/page.tsx`

- **In-file location:** create `samwise-app/app/copilot/copilot-surface.tsx`. Move the post-load JSX (the `grid h-screen grid-cols-[minmax(380px,1fr)_2fr]` block — lines 322–378 of `page.tsx`) into an exported `<CopilotSurface>` component, plus the `qualifyIdentifier` / `handleLoadQualification` UI block (lines 322–360). Original `page.tsx` becomes a thin wrapper that renders the URL gate, loads the script, and on success renders `<CopilotSurface>`.
- **Should not be modified:** any of the cleaning / DERIVED_PREFILLS / suggestion logic. This is a pure JSX extraction with prop drilling.
- **Why:** so `DemoCallShell` can reuse the same surface without duplicating the cleaning + pre-fill logic. Single source of truth.

### Phase 6 — DataChannel broadcaster (samwise-app)

#### Step 6.1 — New `lib/demo-call/broadcast.ts`

- **In-file location:** new file.
- **Code:**
  ```ts
  import type {Room} from 'livekit-client';
  import type {DemoCallVariable} from '@/app/copilot/demo-call-config';

  export interface VariableBroadcaster {
    diffAndPublish: (
      prevCleaned: Record<string, string>,
      nextCleaned: Record<string, string>,
      variables: DemoCallVariable[],
    ) => void;
  }

  export function createVariableBroadcaster(room: Room): VariableBroadcaster {
    const encoder = new TextEncoder();
    return {
      diffAndPublish(prev, next, variables) {
        for (const v of variables) {
          if (!v.userVisible) continue;
          const before = prev[v.name] ?? '';
          const after = next[v.name] ?? '';
          if (before === after) continue;
          const payload = encoder.encode(
            JSON.stringify({
              type: 'demo-call:variable_update',
              name: v.name,
              value: after,
            }),
          );
          void room.localParticipant.publishData(payload, {reliable: true});
        }
      },
    };
  }
  ```

### Phase 7 — `userVisible` flag (samwise-app)

#### Step 7.1 — Extend `DemoCallVariable` + mark fields

- **In-file location:** `samwise-app/app/copilot/demo-call-config.ts`.
- **Should not be modified:** any existing variable's other fields.
- **Add to the `DemoCallVariable` interface:**
  ```ts
  /** When true, cleaned value is broadcast to the user-side variables panel
   * in /demo-call/[id]. Default false — most variables are rep-only. */
  userVisible?: boolean;
  ```
- **Mark these variables `userVisible: true`** (the ones that mirror what the user already saw on `/qualify` — extending the "they watch their notes get rewritten" UX into the demo call):
  - `prospect_name`
  - `behaviour_to_change`
  - `core_motivation`
  - `life_stage_context`
  - `problem_duration_self_reported`
  - `symbolic_anchor_description`
  - `alternatives_tried`
  - `why_alternatives_failed`
- **Explicitly NOT user-visible** (sensitive / judgemental / rep-only): `fit_state`, `rep_notes`, `outcome`, `clinical_picture_description`, `grado_de_identificacion`, any future inference fields.

### Phase 8 — User page (samwise-landing)

#### Step 8.1 — New `app/demo-call/[bookingId]/page.tsx`

- **In-file location:** new file.
- **Code (server):**
  ```tsx
  import {CallRoot} from './call-root';

  export const dynamic = 'force-dynamic';

  export default async function DemoCallUserPage({
    params,
  }: {
    params: Promise<{bookingId: string}>;
  }) {
    const {bookingId} = await params;
    return <CallRoot bookingId={bookingId} />;
  }
  ```

#### Step 8.2 — `call-root.tsx` (client, pre-join lobby OR call-room based on state)

- **In-file location:** `samwise-landing/app/demo-call/[bookingId]/call-root.tsx`.
- **Code:**
  ```tsx
  'use client';
  import {useState} from 'react';
  import {PreJoin} from './pre-join';
  import {CallRoom} from './call-room';
  import type {InitResponse} from './types';
  import './demo-call.css';

  export function CallRoot({bookingId}: {bookingId: string}) {
    const [init, setInit] = useState<InitResponse | null>(null);

    if (!init) return <PreJoin bookingId={bookingId} onJoined={setInit} />;
    return <CallRoom init={init} />;
  }
  ```

#### Step 8.3 — `pre-join.tsx` — name confirm + mic/camera grant + Join button

- **In-file location:** `samwise-landing/app/demo-call/[bookingId]/pre-join.tsx`.
- **Behavior:**
  - On mount, POST `/api/demo-call/init` (cross-origin to `app.samwise.life`) with `{bookingId, side: 'user'}`.
  - On 200: show "Hi {prospectFirstName}, your call with Samuel is at {scheduledFor}." plus a "Test mic and camera" link that triggers `navigator.mediaDevices.getUserMedia({audio:true, video:true})` to surface the browser permission prompt early.
  - On click "Join call", invoke `onJoined(initResponse)`.
  - On 404/410: warm copy explaining the link is no longer valid + "Back to Samwise" link to `/`.
- **Visual register:** consistent with `/qualify`'s aesthetic (Fraunces for headings, gentle ink color). See `samwise-landing-page` skill for the visual language. Keep it ONE column, narrow, no chrome.

#### Step 8.4 — `call-room.tsx` — video + variables panel

- **In-file location:** `samwise-landing/app/demo-call/[bookingId]/call-room.tsx`.
- **Behavior:**
  - Renders a two-pane layout: video tile on the main area (full bleed on mobile, 70% on desktop), `<VariablesPanel>` from `samwise-landing/app/qualify/components/variables-panel.tsx` in a side rail (right on desktop, collapsible drawer on mobile).
  - Uses the same `VideoCallExperience` from samwise-app — but since the two projects don't share code, we copy the component into `samwise-landing/app/demo-call/[bookingId]/video-call-experience.tsx` for v1. **Trade-off:** code duplication. Justified because the two projects have independent build systems and `livekit-client` versions can drift. Mark as a "extract into a shared package" candidate if maintenance friction surfaces.
  - Hydrates `<VariablesPanel>` from the DataChannel:
    ```tsx
    const [variables, setVariables] = useState<VariablesState>({});
    const onDataMessage = useCallback((msg: any) => {
      if (msg?.type === 'demo-call:variable_update' && typeof msg.name === 'string') {
        setVariables((prev) => ({...prev, [msg.name]: String(msg.value ?? '')}));
      }
    }, []);
    <VideoCallExperience init={init} onDataMessage={onDataMessage} ... />
    <VariablesPanel lang={init.booking.language} variables={variables} />
    ```

#### Step 8.5 — `demo-call.css`

- Mirror `qualify.css` register. Variables panel uses the existing `.qualify-notes-*` classes (or copy-and-rename to `.demo-notes-*` if we want visual divergence — start with reuse).

### Phase 9 — Sidebar entry in samwise-app

#### Step 9.1 — Add a `/demo-call` discovery entry to `app/page.tsx`

- The sidebar today has Ritual call. The therapist needs a way to land on `/demo-call/[bookingId]` without typing the URL — for v1, the simplest path is a "Demo calls" sidebar entry that shows `demoBookings` with status `scheduled` or `in_progress` from today, each clickable.
- **Deferred to v1.5 if the list view adds scope pressure.** For v1, the therapist gets the booking URL from the same Cal email the prospect gets (Samuel will receive the Cal confirmation as the event organizer). No sidebar entry needed for v1.
- Document as a TODO in the after-implementation step.

---

## Testing phase

### Local test (foreground)

1. Implement Phases 1, 3–7. Run `pnpm dev` in `samwise-app`. Manually insert a `demoBookings/test-1` doc in Firestore via the Firebase console with all fields populated.
2. Open `localhost:3000/demo-call/test-1` in one browser. Verify the therapist surface loads, video tile shows local camera, copilot pre-fills from a known prospect's qualification.
3. Run `pnpm dev` in `samwise-landing`. Open `localhost:3001/demo-call/test-1` in a second browser (or incognito).
4. Verify cross-origin init POST succeeds (CORS configured). Verify pre-join shows the prospect's name + scheduledFor.
5. Click Join. Verify both browsers connect to the same room, both see each other's video, audio is bidirectional.
6. In the therapist browser, type a value into a `userVisible: true` variable. Wait for the 1.5s debounce-and-clean cycle. Verify the value lands in the user browser's `<VariablesPanel>` as a card.
7. In the therapist browser, type into a NON-userVisible variable (e.g. `rep_notes`). Verify it does NOT appear on the user side.
8. Test mute/camera-off toggles. Test tab-hidden auto-mute (switch tab → check the LiveKit dashboard for mic publish state).
9. Click "End call" on either side. Verify the room closes within `emptyTimeout` (default 30s).
10. Re-join from the user side: verify a fresh egress does NOT start (egressId already on the booking).

### Integration test

1. Deploy `calDemoBookingWebhook` to Firebase. Use `curl` with a valid HMAC to POST a fake `BOOKING_CREATED` payload. Verify the doc appears in `demoBookings`.
2. Configure the Cal webhook to point at the deployed URL.
3. Book a real test slot via Cal (use a personal email). Verify the doc appears.
4. Open the email's `samwise.life/demo-call/{uid}` link. Verify pre-join + join works against the real deployed app.
5. Locate the egress recording in LiveKit's storage UI (or LiveKit Cloud dashboard's Egress tab). Verify the MP4 plays with both video and audio.

### Update README

- Add a one-line note to `samwise-app/context-for-code-agent.md` describing the new `/demo-call/[bookingId]` route and what it depends on.
- Add a sibling note in `samwise-landing/context-for-code-agent.md`.

---

## After implementation

### Update `samwise-app/context-for-code-agent.md`

Append under "Module Overview":
- `/demo-call/[bookingId]` — therapist-side video call surface. 3-column: video (left), copilot variables + script (middle/right). Pre-fills from qualification by `booking.prospectKey`. Broadcasts cleaned variables marked `userVisible: true` over LiveKit DataChannel to the user-side page on samwise-landing. Recording is server-started by `/api/demo-call/init` on therapist join.

### Update `samwise-landing/context-for-code-agent.md`

Append under "Module Overview":
- `/demo-call/[bookingId]` — user-side video call surface. Pre-join lobby → video tile + live `<VariablesPanel>` hydrated from DataChannel events sent by the therapist's copilot. Bookings live in samwise-backend's `demoBookings` collection, created by the `calDemoBookingWebhook` cloud function.

### Update the `samwise-app-livekit-integration` skill

Add a new section "Native video flows (demo-call)" capturing:
- The two-human-room pattern (no agent dispatch).
- The `VideoCallExperience` component as the canonical reference for human-to-human video.
- The DataChannel `demo-call:variable_update` event shape.
- The `userVisible` flag on `DemoCallVariable`.
- The server-side egress kickoff at therapist init.
- The fact that the same component is duplicated in samwise-landing — this is the v1 trade-off; extract to a shared package if duplication friction grows.

### Update the `samwise-session-copilot` skill

Add a short section: when /copilot is rendered inside `<DemoCallShell>`, the state updates are wrapped with a DataChannel broadcaster — see Phase 6. Note the extracted `<CopilotSurface>` component.

### Mark task DONE in master Vibe doc

Manual user step.

---

## Open decisions (revisit at v1.5 or before going live with real prospects)

1. **Therapist auth.** `bookingId`-as-credential works because Cal generates unguessable UIDs and the only person with the URL is the prospect. But anyone who scrapes a prospect's email gets the URL too. Before non-test users, add Clerk session check on the therapist route (samwise-app gets auth; samwise-landing's user route stays anonymous because the user has no account).
2. **Multi-therapist routing.** Today: hardcoded `therapist-samuel`. Future: a `therapists` Firestore collection + a per-therapist Cal event type, with the webhook routing to `therapistId` based on event slug or organizer email.
3. **`/demo-call` sidebar list view in samwise-app.** Currently the therapist navigates via the Cal email's organizer link. Add a sidebar list of today's bookings once Samuel says it's annoying.
4. **Status field maintenance.** `status: 'completed'` is never written in v1 (no agent or job watching for room close). Either add a LiveKit webhook ("room_finished") or a scheduled GC. Defer until a UI consumes the field.
5. **Reschedule / cancel webhook handling.** Cal also sends `BOOKING_RESCHEDULED` and `BOOKING_CANCELLED`. Currently ignored (200, no-op). Add when needed — likely once a "today's bookings" list exists and shows stale entries.
6. **Recording storage path.** Step 0.2 deferred the choice (LiveKit managed vs BYO bucket) to test time. Lock in once Phase 2 testing surfaces what actually works at the project's LiveKit tier.
7. **Per-recording playback UI.** Today: the egressId is stored, and Samuel pulls signed URLs by hand. Build a "View recording" affordance on the booking once Samuel asks.
8. **Co-watching / silent observer.** A second therapist as a silent observer (for training) would be a new participant type: token with `canSubscribe: true, canPublish: false`. Currently out of scope.

---

## Risk register

| Risk | Mitigation |
|---|---|
| Cal webhook variable name `{{uid}}` may differ across Cal versions | Verify in Step 0.1 before going live. If different, only the email template needs to change — webhook handler uses the parsed `payload.uid`. |
| LiveKit Composite Egress may not be available on the project's tier | Step 0.2 verifies. Fallback: disable recording in v1; deploy without the egress call. |
| CORS misconfig between samwise-landing and samwise-app on `/api/demo-call/init` | Test in Step 5 of local test. ALLOWED_ORIGINS list is explicit; preview deployments use a different host and will need their preview URL added. |
| Recording-without-consent legal risk | User explicitly accepted for test users. Add consent UX before public launch. |
| Hard cap of 75 min still leaks if a client crashes and the room stays open | LiveKit `emptyTimeout` (default 30s) handles this — when both clients are gone (including via crash), LiveKit closes the room. Worst-case orphan recording cost is ~1 min of accidental tracks. |
| `RoomComposite` egress with one missing participant produces a half-black frame | Acceptable for v1; LiveKit's composer handles single-participant gracefully (renders one tile fullscreen). |
| Duplicate `VideoCallExperience` code between samwise-app and samwise-landing drifts | Document as "extract to shared package" candidate. v1 ships duplicate. |

---

## Phase 10 — Samwise-branded booking page with Cal embed (added mid-implementation)

Samuel sends qualified prospects (post-Breakthrough Call) a Samwise-branded URL to book the demo, instead of a raw cal.com link. `/book` opens the Cal element-click modal in place. Aesthetic matches `/qualify` (Fraunces italic lead, Manrope small-caps sub, hairline gold-dash CTA).

### Files

```
samwise-landing/app/book/
├── page.tsx          # NEW server, thin
├── book-client.tsx   # NEW client — Cal embed init + CTA button
└── book.css          # NEW aesthetic (local brand tokens; mirrors /qualify)
```

### Steps

- **10.1** `page.tsx` — thin server component, renders `<BookClient />`.
- **10.2** `book-client.tsx` — client component. Injects Cal `embed.js` on mount, calls `Cal("init", "demo", { origin })`, configures via `Cal.ns.demo("ui", { ... })`. Renders centered editorial layout with a `data-cal-link="samuel-giraldo-concha-yqvtot/demo"` + `data-cal-namespace="demo"` CTA button so embed.js attaches its click handler. Bilingual via `?lang=es` query param (default `en` — no picker, Samuel sends the right URL).
- **10.3** `book.css` — local brand tokens + literal `'Fraunces' / 'Manrope'` stacks (same convention as `demo-call.css`).

### Email follow-up — defensive Samwise-branded send (conditional)

- **10.4** (deferred — execute only if test booking confirms Cal doesn't substitute `{{uid}}` in the location field): extend `calDemoBookingWebhook` to write a `mail/{auto-id}` doc with subject *"Your call link"* and body containing `https://samwise.life/demo-call/{calBookingUid}`. Firebase Trigger Email picks it up automatically (per memory `reference_firebase_trigger_email_setup.md`). Mirrors the post-call confirmation email shape from `extractQualification`.

---

## Phase 11 — Walk-in `/meet` flow (replaces Cal as the entry point)

Cal kept fighting us (no `{{uid}}` templating; default-email-disable + our webhook-email path didn't deliver in test). Pivot: drop the booking abstraction entirely. One permanent URL `samwise.life/meet`, lobby asks for name + email + language, on submit the prospect joins a freshly-minted LiveKit room and Samuel gets an email notification with a link to join that room.

### Architecture

```
samwise.life/meet
  └─ lobby (collect name/email/language)
     └─ submit → POST app.samwise.life/api/walk-in/init
                   ├─ mints LiveKit token
                   ├─ writes walkIns/{prospectKey}-{ts} to Firestore
                   ├─ writes mail/{auto-id} → Firebase Trigger Email
                   │     → "Someone's waiting for you" email to Samuel
                   │       with link app.samwise.life/meet/{walkInId}
                   └─ returns { token, wsUrl, roomName, walkInId }
     └─ in-page transition → call-room (video + variables panel)
                              user sees "Samuel will be with you shortly"
                              until you join

app.samwise.life/meet/{walkInId}
  └─ Samuel clicks the email link
     └─ WalkInShell (mirrors DemoCallShell but reads walkIns/{id})
        ├─ VideoCallExperience joins same roomName
        ├─ Copilot pre-fills from qualification by prospectKey (if exists)
        └─ DataChannel broadcaster wired as before
```

### Files

```
samwise-app/
├── lib/walk-in/walkin.ts                  # NEW — Firestore reader/writer
├── app/api/walk-in/init/route.ts          # NEW — mints, writes walkIn, writes mail/, returns
├── components/walk-in/WalkInShell.tsx     # NEW — mirrors DemoCallShell
└── app/meet/[walkInId]/page.tsx           # NEW — Samuel's surface

samwise-landing/
├── components/call/
│   ├── VideoCallExperience.tsx            # NEW (extracted from demo-call/[bookingId]/)
│   └── CallRoomLayout.tsx                 # NEW (extracted — video tile + variables panel)
├── app/meet/
│   ├── page.tsx                           # NEW (server)
│   ├── meet-root.tsx                      # NEW (client orchestrator: lobby OR call-room)
│   ├── lobby.tsx                          # NEW (name + email + language form)
│   └── meet.css                           # NEW (mirrors qualify register)
└── app/demo-call/[bookingId]/
    ├── video-call-experience.tsx          # DELETED — replaced by import
    └── call-room.tsx                      # MODIFIED — imports shared CallRoomLayout
```

### Cal-related code disposition

Stays in place but goes dormant — `calDemoBookingWebhook`, `/api/demo-call/init`, `/demo-call/[bookingId]`, `/book` Cal embed all keep working IF a Cal booking ever fires the webhook. Easy to revive later. Easy to delete if you commit to walk-in-only.

### Notification email shape

Helper lives in samwise-app's API route (not in cloud-functions — samwise-app already writes to Firestore via firebase-admin; no new CF deploy needed). Subject *"Someone's waiting for you on Samwise"*, body: prospect name + email + language + a hairline-gold-dash link to `app.samwise.life/meet/{walkInId}`.

### Testing

- Open `localhost:3001/meet` → lobby form. Submit with a real email.
- Check `firebase functions:log` and Firestore — `walkIns/{key}-{ts}` doc appears; `mail/{auto-id}` doc appears.
- Email arrives at `samuelgiraldoconcha@gmail.com` within ~30s.
- Click the email link → `localhost:3000/meet/<id>` opens, copilot loads, video joins same room as the lobby tab.

---

## Phase 12 — Custom booking picker against Google Calendar (replaces Cal entirely)

Cal kept fighting us. Pivot: drop Cal entirely. `/book` becomes a Samwise-styled picker that reads Samuel's calendar availability from Google Calendar API and writes bookings back to it. Prospect never sees cal.com again.

### Architecture

```
samwise.life/book
  └─ month grid (clickable days, only available days highlighted)
     └─ click day → time-slots list (50-min slots, 30-min granularity)
        └─ click slot → name + email form
           └─ submit → POST app.samwise.life/api/book/create
                        ├─ Google Calendar events.insert (Samuel's calendar)
                        ├─ writes calendarBookings/{calEventId} to Firestore
                        ├─ writes mail/{auto-id} → Samwise-branded confirmation
                        │   with link app.samwise.life/meet/{calEventId}
                        └─ returns { calEventId, scheduledFor }
           └─ confirmation view ("You're set. We sent the link to your inbox.")
```

Booking discovery on day click:
```
samwise.life/book mount
  └─ GET app.samwise.life/api/book/slots?from=...&to=...
        └─ Google Calendar freebusy.query (Samuel's calendar)
        └─ subtract busy times from working-hours window
        └─ returns array of { day: "2026-05-28", slots: ["10:00","10:30",...] }
```

### Defaults (per user 2026-05-27)

| | |
|---|---|
| Calendar | `samuelgiraldoconcha@gmail.com` (personal) |
| Slot duration | 50 min |
| Working hours | Mon–Fri 6:00 am – 6:30 pm America/Bogota |
| Slot granularity | every 30 min |
| Min notice | 24 hours from now |
| Max days out | 14 |
| Meeting name | "Samwise Breakthrough Call" |

### Files

```
samwise-app/
├── lib/google-calendar.ts          # NEW — JWT→access-token + freebusy + events.insert
├── lib/book/availability.ts        # NEW — slot computation: window − busy = available
├── lib/book/booking.ts             # NEW — calendarBookings/{id} reader/writer
├── app/api/book/slots/route.ts     # NEW — GET, returns 14-day availability map
└── app/api/book/create/route.ts    # NEW — POST, books slot + writes Firestore + mail

samwise-landing/
└── app/book/
    ├── page.tsx                    # MODIFIED — drops Cal embed, renders BookRoot
    ├── book-root.tsx               # NEW — state machine: month → slots → confirm → done
    ├── month-grid.tsx              # NEW — 6×7 CSS grid, hairline gold ring on selected
    ├── time-slots.tsx              # NEW — vertical list of Fraunces-italic time buttons
    ├── confirm.tsx                 # NEW — name + email + hairline-gold-dash CTA
    ├── done.tsx                    # NEW — "You're set." confirmation
    ├── book-client.tsx             # DELETED — Cal embed removed
    └── book.css                    # REWRITTEN for picker, drops Cal modal CTA
```

### Step 12.0 — Manual setup (Samuel does)

1. **Enable Calendar API** in GCP: console.cloud.google.com → arbor-2026 → APIs & Services → Library → Google Calendar API → Enable.
2. **Find service account email** from FIREBASE_SERVICE_ACCOUNT JSON (the `client_email` field — typically `firebase-adminsdk-XXXX@arbor-2026.iam.gserviceaccount.com`).
3. **Share personal calendar** with that email: calendar.google.com → settings cog → Settings → Settings for my calendars → samuelgiraldoconcha@gmail.com → Share with specific people → Add the service account email → permission: **"Make changes to events"**.
4. **Add Vercel env var on samwise-app** (Production + Preview): `BOOKING_CALENDAR_ID=samuelgiraldoconcha@gmail.com`. Already-present `FIREBASE_SERVICE_ACCOUNT` is reused — no new credential.

### Step 12.1 — `lib/google-calendar.ts`

Minimal helpers using service-account JWT bearer-token flow (no `googleapis` SDK — saves ~100MB). Lazy-singleton access token (cached for ~50min, refreshed on expiry). Two exposed functions: `freebusy({calendarId, timeMin, timeMax, timeZone})` and `insertEvent({calendarId, summary, description, start, end, attendees, timeZone})`. Add `google-auth-library` as a direct dep (~1MB) for JWT signing.

### Step 12.2 — `lib/book/availability.ts`

Pure function. Given a window and busy-intervals, returns `[{day, slots}]` where each slot is `"HH:mm"` start time. Honors:
- Working hours 6:00–18:30 America/Bogota
- Mon–Fri only
- 24h minimum notice from now
- 50-min duration → a slot at HH:mm only fits if [HH:mm, HH:mm+50min] has no busy overlap
- 30-min granularity

### Step 12.3 — `app/api/book/slots/route.ts`

`GET /api/book/slots?from=ISO&to=ISO` (defaults: now+24h → now+14d). Returns `{ days: [{day: "YYYY-MM-DD", slots: ["06:00","06:30",...]}] }`. CORS-open to samwise.life. `runtime = 'nodejs'`.

### Step 12.4 — `app/api/book/create/route.ts`

`POST /api/book/create` body `{ slotISO, name, email, language }`. Returns `{ calEventId, scheduledFor, joinUrl }`. Server-side:
1. Re-verify slot is still free (freebusy query → reject 409 if booked)
2. `events.insert` on Samuel's calendar — summary="Samwise Breakthrough Call", description includes meet URL, attendee={name,email}, sendUpdates="all" (Google sends invite email automatically — Samwise email is in addition for branding)
3. Write `calendarBookings/{calEventId}` to Firestore (same shape as demoBookings/walkIns: roomName, prospectKey, prospect, language, scheduledFor)
4. Write `mail/{auto-id}` → Samwise-branded confirmation with `https://samwise.life/meet/{calEventId}`
5. Return

### Step 12.5 — `samwise-landing/app/book/*` from-scratch picker

Per the samwise-landing-page skill register. Specs:
- **Month grid**: 6×7 CSS grid. Day cells are 56px buttons. Cells with `slots.length > 0` get full opacity + cursor pointer; cells without get 0.25 opacity + no pointer. Selected cell gets a hairline gold ring (`box-shadow: inset 0 0 0 1px #D4A85A`). Month label is Fraunces italic 24px. Weekday headers are Manrope small-caps 11px / 0.22em.
- **Time slots**: vertical stack of buttons. Each button is `[—] HH:mm [—]` in the qualify CTA register (hairline gold dashes flanking Fraunces italic time). Click → transition to confirm.
- **Confirm form**: name (Fraunces italic input, centered hairline underline) + email (Manrope, smaller, same underline) + gold-dash CTA "Confirm" / "Confirmar".
- **Done view**: Fraunces italic lead *"You're set."* / *"Estás dentro."* + sub *"We sent the link to your inbox."* / *"Te enviamos el link por correo."* + a small "Back to Samwise" link.
- **Bilingual** via `?lang=es` query param (same convention as `/book` Cal version).

### Step 12.6 — Cleanup

Once Phase 12 ships and works, delete:
- `samwise-backend/cloud-functions/functions/src/index.ts` → `calDemoBookingWebhook` function (deploy `firebase deploy --only functions` after removing)
- `samwise-app/app/api/demo-call/init/route.ts`, `samwise-app/components/demo-call/`, `samwise-app/app/demo-call/`
- `samwise-app/lib/demo-call/booking.ts`
- `samwise-landing/app/demo-call/`

Reuses kept: `samwise-app/lib/demo-call/broadcast.ts` (still used by walk-in side via the broadcaster pattern); `samwise-app/components/demo-call/VideoCallExperience.tsx` (still imported by WalkInShell). Or rename `demo-call` → `call` since "demo" is the dead naming now.

---

## Phase 13 — `/meet` quick fixes (free-to-enter + editorial redesign)

Two coupled changes the user surfaced after first test. Small, independent of Phase 12.

### Step 13.1 — Free-to-enter `/meet` lobby

`samwise-landing/app/meet/lobby.tsx`:
- Name and email both optional (no validation gate)
- Single "Enter" CTA always enabled (was: disabled until name+email valid)
- On submit with blank fields: pass `name = "Guest"`, `email = ""` to the init route
- samwise-app `/api/walk-in/init`: tolerate blank email — fall back to prospectKey `guest-{Date.now()}`, skip email collection from the prospectKey chain

### Step 13.2 — `/meet` in-call layout — editorial redesign

Replace the "two halves with a divider" layout with the Samwise editorial register.

Current: 2-column grid `1.8fr 1fr`, hard `border-l` between, video edge-to-edge in its column, dark `.demo-call-controls` bar at bottom.

New (`call-room.tsx` + `meet.css` reuse + override):
- **Background**: gallery white the whole way around (not the dark video filling the page).
- **Video tile**: contained, max-width 720px, ~16/9 ratio, ~32px margin from page edges, rounded 6px corners, soft shadow `0 24px 64px -16px rgba(0,0,0,0.18)`. Centered-left on desktop.
- **Self-view PiP**: smaller (120×90px), bottom-right INSIDE the video tile, 6px border-radius, 1px ink-mute border.
- **Notes column**: right of the video tile, no border, no panel background. Vertical stack of `.qualify-notes-card`s in their existing register (Manrope small-caps label + Fraunces italic quote on white). Wider air between cards (~36px gap). Max-width 28em.
- **Controls**: small Manrope-small-caps text buttons in a row below the video tile (`[Mute] [Camera off] [End call]`). No black bar. Hover: ink underline expands from center. End-call gets a hairline red tint instead of red fill.
- **Mobile**: video tile stacks above notes; same air, same containment, no border. Controls below video.

Files touched:
- `samwise-landing/app/demo-call/[bookingId]/demo-call.css` — rewrite `.demo-call-room`, `.demo-call-room-video`, `.demo-call-room-notes`, `.demo-call-video`, `.demo-call-video-self`, `.demo-call-controls`, `.demo-call-control-btn`
- `samwise-landing/app/demo-call/[bookingId]/video-call-experience.tsx` — minor: move self-view from `position: absolute right:16 top:16` (page-corner) to inside the video tile

### Testing

- Open `localhost:3001/meet` → lobby allows direct "Enter" with empty fields.
- After joining, layout is editorial: white background, contained video tile, no border between video and notes, soft shadow on the tile, controls as text buttons below.
- Resize to 600px wide → video stacks above notes, no horizontal scroll, controls still readable.

### Testing

- Open `localhost:3001/book` → CTA visible, click → Cal modal opens with the `demo` event type.
- Book a test slot. Confirm `demoBookings/{uid}` appears in Firestore (Phase 2 webhook fires).
- Read the confirmation email. If `{{uid}}` substituted in the location → done. If literal → execute Step 10.4.
