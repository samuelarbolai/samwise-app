# context-for-code-agent.md — `samwise-app`

## Parent Project Overview
`samwise-app` is the operator-facing web app for Samwise — a small Next.js (App Router) project hosted on Vercel. Its current scope is "the team's internal control panel" rather than a customer-facing product: lightweight forms that POST to the same Firebase cloud functions used by the rest of the stack, no auth in v1. The customer-facing surfaces are the voice agents (`narya-agent`, `tracking-agent`) and the SMS chat (driven by `tracking-workflow`); samwise-app exists to set up rituals and (planned) inspect their state.

## Parent Project Architecture (Flow)
1. Operator opens samwise-app.
2. UI POSTs to a Firebase cloud function (`registerNewRitual` today; `createRitualDoc` planned).
3. Cloud function reads/writes Firestore (`rituals`, `users`) and/or Google Drive.
4. Once a ritual exists, the rest of the system (cron schedules → tracking-workflow → tracking-agent → SMS) handles the daily loop.

samwise-app has no Firestore or Drive access of its own — it's a thin client that calls cloud functions and renders results. This keeps secrets (service account, API keys) inside the cloud-functions module.

## Parent Project Modules
- `samwise-backend/cloud-functions/` — owns Firestore writes and the Google Drive API client. samwise-app calls into here.
- `samwise-backend/tracking-workflow/` — the daily orchestration on Vercel. Unrelated to samwise-app's UI but consumes the data registered through it.
- `samwise-backend/tracking-agent/` and `narya-agent/` — voice agents on LiveKit Cloud. Unrelated to samwise-app.
- `samwise-landing/` — public marketing page; sibling Next.js project.

## Module Overview
A minimal Next.js 16 (App Router) project scaffolded with shadcn/ui. Everything lives under `app/` (App Router pages) and `components/ui/` (shadcn primitives). No backend code lives here — every action POSTs cross-origin to a deployed Firebase cloud function URL.

Existing routes:
- `/` — operator tools sidebar shell + "Register New Ritual" / "Create Ritual Doc" forms (`app/page.tsx`).
- `/ritual-call` — LiveKit-based ritual call experience (see `samwise-app-livekit-integration` skill).
- `/copilot` — rep-side in-call surface for the Demo Call. Two-pane: variables capture (left), script with live `{{variable}}` substitution (right). Variables are denoised by a Gemini-backed cleaner that produces script-context-aware substitutions (not canonical-generic forms). End-of-call writes one row to the funnel sheet. See the `samwise-session-copilot` skill for the architecture, the `[SAY]/[/SAY]` marker convention in script Docs, the `frameworkSemantics` per-variable pattern, and the deferred items. The script-pane also parses a `[CONDITION: var=value]` marker (added 2026-05) for conditional phase visibility — phases tagged with that marker render only when `cleaned[var] === value`. First driver: `fit_state` (qualified | still_disqualified), flipped by the rep after the desidentification demo to swap between the close path and the disqualified-rebound flow. `DemoCallVariable` has a `defaultValue?: string` field so `makeEmptyState` seeds initial branch values. The post-load surface is exported as `<CopilotSurface>` (`app/copilot/copilot-surface.tsx`) so it can be reused from in-call shells (`WalkInShell`) without duplicating the qualification-prefill logic; the manual qualification-prefill UI in `/copilot` is passed as the `topSlot` prop. The shared prefill helper lives at `lib/copilot/prefill-from-qualification.ts` — both `/copilot` (manual rep-typed identifier) and the in-call shells (auto from booking.prospectKey) call it. `DemoCallVariable` also has a `userVisible?: boolean` field; when true the cleaned value is broadcast over LiveKit DataChannel as `demo-call:variable_update` events to the user-side `<VariablesPanel>` on samwise-landing. (The event-name namespace stayed `demo-call:*` after the demo-call routes were retired — see `/meet/[id]` below.)

- `/meet/[id]` — therapist-side surface for human-to-human video calls. Renders `<WalkInShell>` (`components/walk-in/WalkInShell.tsx`): 3-column layout with `<VideoCallExperience>` (left) + `<VariablesTable>` (middle) + `<ScriptPane>` (right). On mount: POSTs `/api/walk-in/init { mode: "join_existing", walkInId: id, side: "therapist" }` which **looks up the id in `calendarBookings` first** (Google-Calendar-driven flow from samwise-landing `/book`), then **falls back to `walkIns`** (the always-open lobby from samwise-landing `/meet`). Either way it returns a unified `{ token, wsUrl, roomName, booking }` shape and `WalkInShell` doesn't care which source it came from. Loads the canonical demo script, attempts qualification pre-fill from `booking.prospectKey`. `setState` is wrapped in a DataChannel broadcaster (`lib/demo-call/broadcast.ts`) so any change to a `userVisible: true` variable's cleaned value lands on the user side in real time. The same broadcaster also exposes `publishVisual(stage)` and `publishSnapshot(cleaned, vars)`; the middle column mounts a **sticky** `<StoryControl>` (`app/copilot/story-control.tsx`, buttons in Phase-9 order: Doc / Promise / Daily Loop / Mechanism / Six-Step Loop / Clear, gated on a `roomReady` flag set in `handleRoomReady`) that publishes `demo-call:show_visual` events to drive the prospect's Ritual Story (rendered on samwise-landing `/meet`). **Notes-sync fix (2026-05-30):** the on-mount qualification prefill writes via `setStateRaw` (which bypasses the broadcaster), so `handleRoomReady` now wires `RoomEvent.ParticipantConnected → publishSnapshot` (re-emits the current `userVisible` cleaned values as `variable_update`s) plus an immediate fire if a participant is already present — without it a joining prospect saw an empty notes panel until the rep edited something live. No agent dispatch — two-human room. Hard wall-clock cap (75 min, both sides enforce client-side) + LiveKit `emptyTimeout` (~30s) closes the room when both leave. **Auth deferred** — id-as-credential, no auth in v1; per memory `reference_google_calendar_service_account.md` note 7, do NOT advertise this URL anywhere the prospect can see it (the calendar event description we patch in `/api/book/create` deliberately excludes the therapist URL). Add Clerk before non-test users.

- `/api/walk-in/init` — single polymorphic init endpoint. Two modes:
  - `mode: "create"` (from samwise-landing `/meet` lobby) — creates a `walkIns/{prospectKey-or-guest}_ts` doc, mints user token, emails Samuel. Name + email optional (free-to-enter per user 2026-05-27); blank email → guest prospectKey, notification email skipped.
  - `mode: "join_existing"` (Samuel from email link OR prospect from email link) — `side: "therapist" | "user"`. Looks up id in `calendarBookings` first, `walkIns` second. Returns `{ token, wsUrl, roomName, booking }`.

- `/api/book/slots` — GET `?type=breakthrough|therapist`, returns `[{day, slots: [HH:mm]}]` for the next 14 days. Calls Google Calendar `freeBusy.query` against the meeting type's calendar, subtracts busy intervals from the working-hours window (Mon–Fri 6:00–18:30 America/Bogota, 24h notice). **Meeting-type-aware (2026-06-16):** `lib/book/meeting-types.ts` (`MEETING_TYPES`) drives slot duration + granularity + calendar per type — `breakthrough` = 50-min @ 30-min on `BOOKING_CALENDAR_ID`; `therapist` (the /therapists 15-min adoption test) = 15-min @ 15-min on `THERAPIST_BOOKING_CALENDAR_ID` (falls back to `BOOKING_CALENDAR_ID` if unset). Unknown/absent type → `breakthrough`. `computeAvailability` + `slotToISORange` now take `durationMin`/`granularityMin`. CORS-open to samwise.life.

- `/api/book/create` — POST, the booking commit. Body now carries an optional `type` (`breakthrough` default | `therapist`) — resolved via `resolveMeetingType`/`calendarIdFor`, which set the calendar, slot duration, calendar event title (`meeting.summary`), and the confirmation-email subject + intro (`meeting.email`). Race-checks the slot with a narrow freeBusy query, calls `events.insert` (NO `attendees` field — personal Gmail rejects it per `reference_google_calendar_service_account.md`), patches event description with the ATTENDEE URL only (NO therapist URL — security), writes `calendarBookings/{calEventId}` to Firestore, writes `mail/` doc with Samwise-branded confirmation + `.ics` attachment (`attachments[]` with `text/calendar; method=REQUEST` — see `reference_firebase_trigger_email_setup.md` note 8). Returns `{ calEventId, scheduledFor, joinUrl }`. **Also notifies Samuel** (2026-06-11): after the confirmation email it writes a second `mail/` doc via `notifySamuelOfBooking` (`lib/notify/samuel.ts`) — best-effort, never blocks the booking.
- `/api/notify/qualify-start` — POST `{ name, email, language }`, called server-to-server by samwise-landing's `/api/qualify/voice-init` when a prospect starts a /qualify voice session (2026-06-11). Writes a `mail/` doc to Samuel via `notifySamuelOfQualifyStart` (`lib/notify/samuel.ts`) so he can push the prospect toward booking. Best-effort: always returns `{ ok: true }`, swallows mail errors. CORS list mirrors `/api/book/create`.

New features extend the relevant route (or add sibling routes under `app/`) and add a new cloud function call. Pattern for cross-origin calls: a wrapper module under `lib/<feature>/` with the function URL as a top-level `const`, mirroring the constants in `app/page.tsx`.

## Module Structure (Directories and files)
```
samwise-app/
├── app/
│   ├── layout.tsx
│   ├── page.tsx                  # Register Ritual / Create Doc operator tools
│   ├── globals.css
│   ├── ritual-call/              # LiveKit ritual call experience
│   │   └── page.tsx
│   ├── copilot/                  # Session Copilot (Demo Call v1)
│   │   ├── page.tsx              # URL gate + two-pane shell, localStorage restore
│   │   ├── variables-table.tsx   # capture pane, per-row raw + cleaned
│   │   ├── script-pane.tsx       # blocks renderer, click + IntersectionObserver scroll-sync
│   │   ├── story-control.tsx     # Ritual Story control — sticky panel (Doc/Promise/Daily Loop/Mechanism/Six-Step Loop/Clear)
│   │   └── demo-call-config.ts   # variable metadata + frameworkSemantics + default Doc URL
│   └── api/                      # API routes (LiveKit token minting, etc.)
├── components/
│   ├── theme-provider.tsx
│   └── ui/                    # shadcn/ui primitives (Button, Input, Card, Field, Spinner, Textarea, …)
├── hooks/
│   ├── use-mobile.ts
│   └── use-toast.ts
├── lib/
│   ├── utils.ts                  # cn() helper
│   ├── firebase-admin.ts         # lazy-singleton Firestore admin client
│   ├── livekit-dispatch.ts       # mintRoomAccessToken + createAgentDispatch + getLiveKitWsUrl
│   ├── google-calendar.ts        # JWT auth + freeBusy + insertEvent + patchEventDescription
│   ├── copilot/                  # Session Copilot client wrappers
│   │   ├── load-script.ts
│   │   ├── clean-variable.ts
│   │   ├── append-row.ts
│   │   ├── load-qualification.ts
│   │   ├── suggest-rep-line.ts
│   │   ├── prefill-from-qualification.ts  # shared helper used by /copilot + WalkInShell
│   │   └── session-storage.ts
│   ├── book/                     # /book flow against Google Calendar
│   │   ├── availability.ts       # pure slot computation (Bogotá-fixed UTC-5); duration/granularity params
│   │   ├── meeting-types.ts      # MEETING_TYPES (breakthrough 50m | therapist 15m | therapist-demo 50m) — duration/calendar/summary/email per type. therapist-demo = the 50-min demo booked from the /qualify therapist audience (THERAPIST_DEMO_CALENDAR_ID, falls back to BOOKING_CALENDAR_ID)
│   │   ├── booking.ts            # calendarBookings/{calEventId} reader/writer
│   │   └── ics.ts                # RFC-5545 iCalendar generator for confirmation email
│   ├── walk-in/walkin.ts         # walkIns/{id} reader/writer + Samuel-notification email
│   ├── notify/samuel.ts          # admin emails to Samuel: notifySamuelOfQualifyStart + notifySamuelOfBooking → mail/
│   └── demo-call/broadcast.ts    # DataChannel broadcaster: userVisible vars (demo-call:variable_update)
│                                 # + Ritual Story stage (demo-call:show_visual via publishVisual)
│                                 # + publishSnapshot (re-emits notes on prospect-join). StoryStage:
│                                 #   "hidden"|"doc"|"promise"|"loop"|"mechanism"|"experience"
│                                 #   (Phase-9 order; doc spine + "yet to be answered" list are NOT stages)
├── public/
├── styles/
├── components.json            # shadcn config
├── next.config.mjs
├── package.json               # next, react, sonner, lucide-react, shadcn, livekit-client deps
├── tsconfig.json
├── context-for-code-agent.md  # this file
└── current-plan.md            # active task plan
```

## Out of scope / future modules

- **AI rep agent.** A future LiveKit voice agent that will run a Demo-style call as a substitute for the human rep. Will consume rows captured via `/copilot`. Lives in `samwise-backend/` when built — not in this repo. Currently undefined.
- **Fit Assessment Call.** Upstream session that captures `behaviour_to_change`, `core_motivation`, `life_stage_context`, `problem_duration_self_reported` and feeds them forward into the Demo Call. `symbolic_anchor_description`, `alternatives_tried`, `why_alternatives_failed` were moved OUT of the Fit Assessment and are now captured live in the Demo Call's Phase 1.5.
- **Onboarding / Call Design copilot.** The `loadCallScript` cloud function already returns `scriptType: "onboarding" | "call_design"` for forward-compat, but `/copilot` only handles `scriptType: "demo"` in v1. Adding these is frontend-only work (a new `*-call-config.ts`, branch on `scriptType` in `page.tsx`) + a sibling `append<Type>Row` cloud function. See the `samwise-session-copilot` skill.

## Conventions specific to this module
- **Cross-origin cloud-function calls.** Endpoints are absolute URLs to deployed Firebase functions (`https://<region>-<project>.cloudfunctions.net/<fn>` or the run URL like `https://registernewritual-b6fhjlgejq-uc.a.run.app`). The cloud function must enable CORS. Don't proxy through a Next.js API route unless a feature genuinely needs server-side secrets — samwise-app has none.
- **Endpoint URL constants live at the top of the consuming page.** `app/page.tsx` declares `CREATE_DOC_URL` and `REGISTER_RITUAL_URL` as `const` at module scope so they're easy to find when a function is redeployed under a different hash. When adding a new cloud-function call, add a new constant in the same place; do NOT inline URLs in `fetch()` calls.
- **shadcn/ui components only.** Use the primitives in `components/ui/` (Button, Input, Card, Field, Spinner, FieldGroup, FieldLabel, FieldError). Don't pull in alternative component libraries; the design language is already set.
- **Editorial brand skin (`.brand-editorial`).** Product surfaces opt into the landing's design language via a single wrapper class in `globals.css`, applied per-segment: the home shell (`app/page.tsx` wraps itself), and `/copilot` · `/meet` · `/ritual-call` each via their own `layout.tsx`. The wrapper (a) overrides the shadcn theme tokens for its subtree (gallery white · ink · gold `--ring`/selection · warm hairline `--border` · Fraunces+Manrope via next/font `--app-fraunces`/`--app-manrope` on `<body>` · force-light) AND (b) flattens component SHAPES — cards drop their shadow and go hairline + calmer radius, inputs/selects/textareas/buttons lose the inner shadow (all via `[data-slot="…"]` rules scoped to `.brand-editorial`, so every surface inherits at once). The brand mark is the gold ✦ Fraunces wordmark (`.brand-wordmark` + `.brand-wordmark__star`, used in the sidebar header). Non-shadcn dark UIs were hand-recolored to the same gallery-white register: `RitualCallExperience` (`/ritual-call` — full voice UI, gold "Listening…" state) and `WalkInShell`'s error/loading fallbacks. **`/trip` + `/outreach` keep their dBase/Lotus `.paper-module` aesthetic — NEVER globally remap the shadcn tokens; always scope via the `.brand-editorial` wrapper.** (See the `samwise-landing-page` skill for the source aesthetic.)
- **Toasts via `sonner`.** `toast.success`, `toast.error`, `toast.info`. Already wired in `app/layout.tsx`.
- **Icons via `lucide-react`.** Pick from the existing icon set; don't add custom SVGs unless absolutely needed.
- **Client components by default for interactive forms.** Pages with state, handlers, and toasts use `"use client"` at the top — same pattern as `app/page.tsx`.
- **No auth in v1.** The app is for the internal team. If multi-tenant ever becomes a concern, NextAuth is the obvious next step; not in scope today. Especially load-bearing for `/meet/[id]` — see `reference_google_calendar_service_account.md` note 7 on why the therapist URL must never be advertised in the calendar event.
- **`firebase-admin` for server-side Firestore writes.** Originally we routed everything through cloud functions, but the `/book` + `/meet` flows write `calendarBookings` / `walkIns` / `mail` collections directly from samwise-app via the lazy-singleton in `lib/firebase-admin.ts`. The `FIREBASE_SERVICE_ACCOUNT` env var is reused for both Firestore writes AND Google Calendar API auth (see `lib/google-calendar.ts` and memory `reference_google_calendar_service_account.md`). Client-side Firebase SDK is still avoided — server routes only.
- **Calendar API helpers in `lib/google-calendar.ts`.** Minimal JWT-bearer-token + raw fetch against Calendar v3 REST. Deliberately skips the `googleapis` SDK (~100MB) — for the two endpoints we use (`freeBusy.query` + `events.insert` + `patch`), `google-auth-library` (~1MB) is enough. See memory `reference_google_calendar_service_account.md` for the personal-Gmail `forbiddenForServiceAccounts` constraint and the .ics workaround.
