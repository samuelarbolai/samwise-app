# current-plan.md — Samuel notification emails: qualify-session start + booking

> Overwrites the previous plan (Native demo-call video room — finished, separate task in the master Vibe doc).
> Neurotic-implementer rules in force: ask before deducing; never commit unless asked. Two repos: samwise-app (primary) + samwise-landing (one edit).

## Plan Summary

Samuel wants an email **every time** a user (1) **starts a /qualify voice session** and (2) **books a call** — so he can push qualify-starters toward scheduling.

Decisions locked with the user:
- **Scope of "qualifying session" = /qualify voice (Nova) only.** Not the autonomous demo, not the (disabled) text path.
- **Recipient = `samuelgiraldoconcha@gmail.com`** — same inbox as the existing walk-in "joined your meeting" notifications.

Both emails reuse the existing infra: a doc written to the Firestore `mail/` collection, picked up by the Firebase Trigger Email extension. The exact precedent already in the repo is `notifySamuelOfWalkIn` in `samwise-app/lib/walk-in/walkin.ts`.

Key constraint discovered: **samwise-landing has NO firebase-admin / Firestore access.** The `mail/` collection only exists from samwise-app (and cloud-functions). So:
- **Booking** notification is trivial — `book/create` already writes to `mail/`; add a second doc to Samuel.
- **Qualify-start** notification must cross from landing → samwise-app, exactly like /book and /walk-in already do (`${NEXT_PUBLIC_SAMWISE_APP_URL}/api/...`). New thin endpoint on samwise-app; landing's `voice-init` fire-and-forgets a server-to-server POST to it.

## Plan Architecture (Flow)

```
QUALIFY START
  browser /qualify (Talk) ──POST──▶ samwise-landing /api/qualify/voice-init
                                       │  (mints token, dispatches ritual-agent)
                                       │  └─ concurrently, server→server:
                                       └──POST──▶ samwise-app /api/notify/qualify-start
                                                    └─ notifySamuelOfQualifyStart()
                                                         └─ mail/{auto} → Trigger Email → Samuel

BOOKING
  browser /book (Confirm) ──POST──▶ samwise-app /api/book/create
                                       ├─ (existing) prospect confirmation + .ics → mail/
                                       └─ (NEW) notifySamuelOfBooking() → mail/ → Samuel
```

## Plan Structure (Directories and files)

```
samwise-app/
├── lib/notify/samuel.ts                      NEW — notifySamuelOfQualifyStart + notifySamuelOfBooking
│                                                   + shared editorial email shell (mirrors walkin.ts)
├── app/api/notify/qualify-start/route.ts      NEW — CORS + OPTIONS + POST; validates {name,email,language},
│                                                   calls notifySamuelOfQualifyStart, best-effort 200
└── app/api/book/create/route.ts               EDIT — import + one best-effort notifySamuelOfBooking() call

samwise-landing/
└── app/api/qualify/voice-init/route.ts        EDIT — fire-and-forget server→server POST to
                                                       ${NEXT_PUBLIC_SAMWISE_APP_URL}/api/notify/qualify-start
```

No new dependencies. No new env vars (reuses `NEXT_PUBLIC_SAMWISE_APP_URL`, already used by /book + /meet on landing).

## Modifications (in phases and steps)

### Phase 1 / Step 1 — NEW `samwise-app/lib/notify/samuel.ts`

- **In-file location:** new file.
- **Should not be modified:** nothing existing; this is additive. Mirrors the email-shell convention in `lib/walk-in/walkin.ts` (inline-styled, table-based, Georgia/Helvetica fallbacks, gold ✦).
- **Code:**
  ```ts
  import 'server-only';
  import { getDb } from '@/lib/firebase-admin';
  import { TIMEZONE } from '@/lib/book/availability';

  // Best-effort admin notifications to Samuel. Each writes a doc to the
  // `mail/{auto-id}` collection; the Firebase Trigger Email extension
  // watches that collection and sends via the configured SMTP (per memory
  // `reference_firebase_trigger_email_setup.md`). Same editorial email
  // shell as notifySamuelOfWalkIn in lib/walk-in/walkin.ts.

  const SAMUEL = 'samuelgiraldoconcha@gmail.com';

  function langLabel(language: 'en' | 'es'): string {
    return language === 'es' ? 'Español' : 'English';
  }

  function formatBogotaHuman(startISO: string, language: 'en' | 'es'): string {
    const d = new Date(startISO);
    return new Intl.DateTimeFormat(language === 'es' ? 'es-CO' : 'en-US', {
      timeZone: TIMEZONE,
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: language === 'en',
    }).format(d);
  }

  // Notify: a prospect just STARTED a /qualify voice session. The point is
  // to let Samuel nudge them toward booking, so name + email lead.
  export async function notifySamuelOfQualifyStart(args: {
    name: string;
    email: string;
    language: 'en' | 'es';
  }): Promise<void> {
    const { name, email, language } = args;
    const subject = `${name} started a qualifying session`;
    const text = `${name} (${email}) just started a qualifying session on /qualify.

  Language: ${langLabel(language)}

  Reach out and push them toward booking the call.
  `;
    const html = adminEmailShell({
      subject,
      lead: `${name} just started a qualifying session.`,
      rows: [
        { label: 'Email', value: email },
        { label: 'Language', value: langLabel(language) },
      ],
    });
    await getDb().collection('mail').add({
      to: SAMUEL,
      replyTo: email,
      message: { subject, text, html },
    });
  }

  // Notify: a prospect just BOOKED a call via /book.
  export async function notifySamuelOfBooking(args: {
    name: string;
    email: string;
    language: 'en' | 'es';
    startISO: string;
  }): Promise<void> {
    const { name, email, language, startISO } = args;
    const when = formatBogotaHuman(startISO, language);
    const subject = `${name} booked a call`;
    const text = `${name} (${email}) booked a call.

  When: ${when} (Bogotá time)
  Language: ${langLabel(language)}
  `;
    const html = adminEmailShell({
      subject,
      lead: `${name} booked a call.`,
      rows: [
        { label: 'When', value: `${when} (Bogotá)` },
        { label: 'Email', value: email },
        { label: 'Language', value: langLabel(language) },
      ],
    });
    await getDb().collection('mail').add({
      to: SAMUEL,
      replyTo: email,
      message: { subject, text, html },
    });
  }

  // ── Shared editorial email shell ─────────────────────────────────────
  // Inline-styled table layout, same register as notifySamuelOfWalkIn /
  // buildBookingConfirmationEmail (Georgia-fallback serif + Helvetica-
  // fallback sans, gold ✦ wordmark).
  function adminEmailShell(params: {
    subject: string;
    lead: string;
    rows: Array<{ label: string; value: string }>;
  }): string {
    const { subject, lead, rows } = params;
    const rowsHtml = rows
      .map(
        (r) => `
          <tr><td style="font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; font-weight: 500; font-size: 11px; letter-spacing: 0.22em; text-transform: uppercase; color: #555555; padding: 0 0 6px 0;">
            ${escapeHtml(r.label)}
          </td></tr>
          <tr><td style="font-family: Georgia, 'Times New Roman', serif; font-size: 16px; color: #000000; padding: 0 0 20px 0;">
            ${escapeHtml(r.value)}
          </td></tr>`,
      )
      .join('');
    return `<!doctype html>
  <html lang="en">
  <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${escapeHtml(subject)}</title>
  </head>
  <body style="margin: 0; padding: 0; background: #FFFFFF; color: #000000;">
    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background: #FFFFFF;">
      <tr><td align="center" style="padding: 56px 24px 48px 24px;">
        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="560" style="max-width: 560px; width: 100%;">
          <tr><td style="padding: 0 0 40px 0;">
            <span style="font-family: Georgia, 'Times New Roman', serif; font-style: italic; font-weight: 400; font-size: 22px; letter-spacing: -0.01em; color: #000000;">Samwise</span><span style="color: #D4A85A; font-size: 9px; vertical-align: 12px; padding-left: 3px;">&#x2726;</span>
          </td></tr>
          <tr><td style="font-family: Georgia, 'Times New Roman', serif; font-style: italic; font-weight: 400; font-size: 20px; line-height: 1.45; color: #000000; padding: 0 0 28px 0;">
            ${escapeHtml(lead)}
          </td></tr>
          ${rowsHtml}
        </table>
      </td></tr>
    </table>
  </body>
  </html>`;
  }

  function escapeHtml(s: string): string {
    return s
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }
  ```
- **Explanation:** One file, two exported notifiers + a shared shell. Reuses `getDb()` and `TIMEZONE`, no new infra. `replyTo: email` lets Samuel reply straight to the prospect from his inbox (supports the "push to schedule" goal).

### Phase 1 / Step 2 — NEW `samwise-app/app/api/notify/qualify-start/route.ts`

- **In-file location:** new file. CORS list + handler shape copied from `app/api/book/create/route.ts`.
- **Should not be modified:** nothing existing.
- **Code:**
  ```ts
  import { NextResponse } from 'next/server';
  import { z } from 'zod';
  import { notifySamuelOfQualifyStart } from '@/lib/notify/samuel';

  export const runtime = 'nodejs';

  const RequestSchema = z.object({
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

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400, headers: cors });
    }
    const parsed = RequestSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid request' }, { status: 400, headers: cors });
    }

    // Best-effort: a failed notification must never surface to the
    // prospect's session. Log and still return ok.
    try {
      await notifySamuelOfQualifyStart(parsed.data);
    } catch (err) {
      console.error('[notify/qualify-start] mail dispatch failed', err);
    }
    return NextResponse.json({ ok: true }, { headers: cors });
  }
  ```
- **Explanation:** Thin best-effort endpoint. Server-to-server calls from landing carry no Origin (CORS only matters for browsers), but the CORS block is kept for parity with the sibling routes and any future browser caller.

### Phase 2 / Step 1 — EDIT `samwise-app/app/api/book/create/route.ts`

- **In-file location:** (a) import near the other `@/lib/book/*` imports at the top; (b) one call inserted **after** the prospect confirmation-email try/catch (the `console.error('[book/create] mail dispatch failed (continuing)', err);` block, ~line 228) and **before** the final `return NextResponse.json({ calEventId, ... })` (~line 231).
- **Should not be modified:** the calendar insert, freeBusy race-check, Firestore mirror, the prospect confirmation email, or the response shape. This is purely additive.
- **Code (import):**
  ```ts
  import { notifySamuelOfBooking } from '@/lib/notify/samuel';
  ```
- **Code (insert before the final return):**
  ```ts
  // Notify Samuel that a call was booked (best-effort, never blocks the
  // prospect — the booking already succeeded above).
  try {
    await notifySamuelOfBooking({ name, email, language, startISO });
  } catch (err) {
    console.error('[book/create] Samuel booking notify failed (continuing)', err);
  }
  ```
- **Explanation:** `name`, `email`, `language`, `startISO` are all already in scope at that point. Reuses the same `mail/` path.

### Phase 3 / Step 1 — EDIT `samwise-landing/app/api/qualify/voice-init/route.ts`

- **In-file location:** (a) a small base-URL helper near the top (mirrors `app/meet/lobby.tsx`); (b) kick off the notify POST **concurrently with** the dispatch, then await it (already error-swallowed) just before the final `return Response.json({ token, ... })`.
- **Should not be modified:** token minting, the dispatch metadata/payload, the response shape.
- **Code (helper, top of file):**
  ```ts
  function samwiseAppBase(): string {
    const base = process.env.NEXT_PUBLIC_SAMWISE_APP_URL
    return base ? base.replace(/\/$/, "") : "http://localhost:3000"
  }
  ```
- **Code (inside POST — wraps the current `await dispatch.createDispatch(...)`):**
  ```ts
  // Fire the "qualifying session started" notification to Samuel in
  // parallel with the agent dispatch. Server-to-server; best-effort —
  // a notify failure must never block the prospect's session.
  const notifyPromise = fetch(`${samwiseAppBase()}/api/notify/qualify-start`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: prospect_name, email: prospect_email, language }),
  }).catch((err) => {
    console.error("[voice-init] qualify-start notify failed", err)
  })

  // Dispatch the agent into this room with our metadata payload.
  await dispatch.createDispatch(roomName, AGENT_NAME, {
    metadata: JSON.stringify({
      flow: "qualification",
      language,
      persona: "nova",
      prospect_name,
      prospect_email,
    }),
  })

  // Ensure the notify request is flushed before the serverless function
  // returns (un-awaited fetches can be dropped on Vercel). Already caught.
  await notifyPromise
  ```
- **Explanation:** The notify starts before we await the dispatch, so it overlaps and adds ~no latency. `await notifyPromise` before returning guarantees the request actually flushes in the serverless runtime. Errors are swallowed — the prospect's token always returns.

## Testing phase

- **Local test (samwise-app):** typecheck (`pnpm tsc --noEmit` or repo equivalent) to confirm the new files compile and imports resolve. Hit `POST /api/notify/qualify-start` with a sample body via `curl` against `pnpm dev`; confirm 200 and a new `mail/` doc addressed to Samuel.
- **Local test (samwise-landing):** typecheck. With both apps on localhost, run `/qualify` → Talk and confirm voice-init logs no notify error and a `mail/` doc appears.
- **Integration test:** real /qualify start → Samuel receives "started a qualifying session"; real /book confirm → prospect still gets their confirmation + .ics AND Samuel receives "booked a call".
- **Update README:** none required (no new env vars).

## After implementation

- Update `samwise-app/context-for-code-agent.md`: note `lib/notify/samuel.ts` + `/api/notify/qualify-start`, and that `/book/create` now also notifies Samuel.
- Note in `samwise-landing/context-for-code-agent.md`: `voice-init` now fires a best-effort qualify-start notification to samwise-app.
- Commit messages (one per repo) handed over after sign-off.
- Mark task DONE in master Vibe doc Projects tab (manual user step).

## Open / deferred (out of scope unless you say otherwise)

- **No de-duplication.** If `voice-init` is ever called twice for one session (e.g. a remount), Samuel could get two start emails. v1 accepts this; add a short-window dedup key later if it's noisy.
- **Autonomous demo on /meet** is explicitly out of scope (you chose /qualify voice only).
