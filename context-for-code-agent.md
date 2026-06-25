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
- `/for-experts` — rep-side in-call surface for the Demo Call. Two-pane: variables capture (left), script with live `{{variable}}` substitution (right). Variables are denoised by a Gemini-backed cleaner that produces script-context-aware substitutions (not canonical-generic forms). End-of-call writes one row to the funnel sheet. See the `samwise-session-copilot` skill for the architecture, the `[SAY]/[/SAY]` marker convention in script Docs, the `frameworkSemantics` per-variable pattern, and the deferred items. The script-pane also parses `[CONDITION: var=value]` markers (added 2026-05; extended 2026-06-18) for conditional visibility. As of 2026-06-18 conditions are **block-level + value-list**: `[CONDITION: var=v1,v2]` (comma = OR) opens a region and `[/CONDITION]` closes it; a region runs from the opening marker to the next marker or the end of the phase. A single marker at the top of a phase with no close gates the whole phase — backward-compatible with the original whole-phase behaviour. `filterBlocksByCondition` in `script-pane.tsx` does one stateful pass per phase (note blocks line-by-line, say blocks as a unit). The **Demo Call branch driver is now `grado_de_identificacion`** (low | medium | high, judged at end of Phase 5b), which REPLACED `fit_state`: high = full desidentificación arc (Phases 6 full → 7 → 8); low/medium = short Phase 6 + skip 7-8 + Phase 9 from Paso 2; low also appends the referral path (Phases 16-17). `fit_state` is now vestigial (kept as a passive field; no phase gated on it). `grado_de_identificacion` defaults to `"high"` (safe full-arc default before the rep classifies at end of 5b). `DemoCallVariable` has a `defaultValue?: string` field so `makeEmptyState` seeds initial branch values. The post-load surface is exported as `<CopilotSurface>` (`app/for-experts/copilot-surface.tsx`) so it can be reused from in-call shells (`WalkInShell`) without duplicating the qualification-prefill logic; the manual qualification-prefill UI in `/for-experts` is passed as the `topSlot` prop. The shared prefill helper lives at `lib/copilot/prefill-from-qualification.ts` — both `/for-experts` (manual rep-typed identifier) and the in-call shells (auto from booking.prospectKey) call it. `DemoCallVariable` also has a `userVisible?: boolean` field; when true the cleaned value is broadcast over LiveKit DataChannel as `demo-call:variable_update` events to the user-side `<VariablesPanel>` on samwise-landing. (The event-name namespace stayed `demo-call:*` after the demo-call routes were retired — see `/meet/[id]` below.)

- `/meet/[id]` — therapist-side surface for human-to-human video calls. Renders `<WalkInShell>` (`components/walk-in/WalkInShell.tsx`): 3-column layout with `<VideoCallExperience>` (left) + `<VariablesTable>` (middle) + `<ScriptPane>` (right). On mount: POSTs `/api/walk-in/init { mode: "join_existing", walkInId: id, side: "therapist" }` which **looks up the id in `calendarBookings` first** (Google-Calendar-driven flow from samwise-landing `/book`), then **falls back to `walkIns`** (the always-open lobby from samwise-landing `/meet`). Either way it returns a unified `{ token, wsUrl, roomName, booking }` shape and `WalkInShell` doesn't care which source it came from. Loads the canonical demo script, attempts qualification pre-fill from `booking.prospectKey`. `setState` is wrapped in a DataChannel broadcaster (`lib/demo-call/broadcast.ts`) so any change to a `userVisible: true` variable's cleaned value lands on the user side in real time. The same broadcaster also exposes `publishVisual(stage)` and `publishSnapshot(cleaned, vars)`; the middle column mounts a **sticky** `<StoryControl>` (`app/for-experts/story-control.tsx`, buttons in Phase-9 order: Doc / Promise / Daily Loop / Mechanism / Six-Step Loop / Clear, gated on a `roomReady` flag set in `handleRoomReady`) that publishes `demo-call:show_visual` events to drive the prospect's Ritual Story (rendered on samwise-landing `/meet`). **Notes-sync fix (2026-05-30):** the on-mount qualification prefill writes via `setStateRaw` (which bypasses the broadcaster), so `handleRoomReady` now wires `RoomEvent.ParticipantConnected → publishSnapshot` (re-emits the current `userVisible` cleaned values as `variable_update`s) plus an immediate fire if a participant is already present — without it a joining prospect saw an empty notes panel until the rep edited something live. No agent dispatch — two-human room. Hard wall-clock cap (75 min, both sides enforce client-side) + LiveKit `emptyTimeout` (~30s) closes the room when both leave. **Auth deferred** — id-as-credential, no auth in v1; per memory `reference_google_calendar_service_account.md` note 7, do NOT advertise this URL anywhere the prospect can see it (the calendar event description we patch in `/api/book/create` deliberately excludes the therapist URL). Add Clerk before non-test users.

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
│   │   ├── prefill-from-qualification.ts  # shared helper used by /for-experts + WalkInShell
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

- **AI rep agent.** A future LiveKit voice agent that will run a Demo-style call as a substitute for the human rep. Will consume rows captured via `/for-experts`. Lives in `samwise-backend/` when built — not in this repo. Currently undefined.
- **Fit Assessment Call.** Upstream session that captures `behaviour_to_change`, `core_motivation`, `life_stage_context`, `problem_duration_self_reported` and feeds them forward into the Demo Call. `symbolic_anchor_description`, `alternatives_tried`, `why_alternatives_failed` were moved OUT of the Fit Assessment and are now captured live in the Demo Call's Phase 1.5.
- **Call Design copilot.** The `loadCallScript` cloud function returns `scriptType: "call_design"` for forward-compat. Onboarding mode shipped 2026-06-24 (see Recent Changes below); call_design follows the same pattern when needed: add `call-design-call-config.ts`, extend `configForScriptType()` in `page.tsx`, decide on prefill/save UI.

## Conventions specific to this module
- **Cross-origin cloud-function calls.** Endpoints are absolute URLs to deployed Firebase functions (`https://<region>-<project>.cloudfunctions.net/<fn>` or the run URL like `https://registernewritual-b6fhjlgejq-uc.a.run.app`). The cloud function must enable CORS. Don't proxy through a Next.js API route unless a feature genuinely needs server-side secrets — samwise-app has none.
- **Endpoint URL constants live at the top of the consuming module.** `app/page.tsx` declares `REGISTER_RITUAL_URL` and `components/ritual-call/RitualCallExperience.tsx` declares its own `REGISTER_RITUAL_URL` (same value) at module scope so they're easy to find when a function is redeployed under a different hash. When adding a new cloud-function call, add a new constant in the same place; do NOT inline URLs in `fetch()` calls.
- **shadcn/ui components only.** Use the primitives in `components/ui/` (Button, Input, Card, Field, Spinner, FieldGroup, FieldLabel, FieldError). Don't pull in alternative component libraries; the design language is already set.
- **Editorial brand skin (`.brand-editorial`).** Product surfaces opt into the landing's design language via a single wrapper class in `globals.css`, applied per-segment: the home shell (`app/page.tsx` wraps itself), and `/for-experts` · `/meet` · `/ritual-call` each via their own `layout.tsx`. The wrapper (a) overrides the shadcn theme tokens for its subtree (gallery white · ink · gold `--ring`/selection · warm hairline `--border` · Fraunces+Manrope via next/font `--app-fraunces`/`--app-manrope` on `<body>` · force-light) AND (b) flattens component SHAPES — cards drop their shadow and go hairline + calmer radius, inputs/selects/textareas/buttons lose the inner shadow (all via `[data-slot="…"]` rules scoped to `.brand-editorial`, so every surface inherits at once). The brand mark is the gold ✦ Fraunces wordmark (`.brand-wordmark` + `.brand-wordmark__star`, used in the sidebar header). Non-shadcn dark UIs were hand-recolored to the same gallery-white register: `RitualCallExperience` (`/ritual-call` — full voice UI, gold "Listening…" state) and `WalkInShell`'s error/loading fallbacks. **`/trip` + `/outreach` keep their dBase/Lotus `.paper-module` aesthetic — NEVER globally remap the shadcn tokens; always scope via the `.brand-editorial` wrapper.** (See the `samwise-landing-page` skill for the source aesthetic.)
- **Toasts via `sonner`.** `toast.success`, `toast.error`, `toast.info`. Already wired in `app/layout.tsx`.
- **Icons via `lucide-react`.** Pick from the existing icon set; don't add custom SVGs unless absolutely needed.
- **Client components by default for interactive forms.** Pages with state, handlers, and toasts use `"use client"` at the top — same pattern as `app/page.tsx`.
- **No auth in v1.** The app is for the internal team. If multi-tenant ever becomes a concern, NextAuth is the obvious next step; not in scope today. Especially load-bearing for `/meet/[id]` — see `reference_google_calendar_service_account.md` note 7 on why the therapist URL must never be advertised in the calendar event.
- **`firebase-admin` for server-side Firestore writes.** Originally we routed everything through cloud functions, but the `/book` + `/meet` flows write `calendarBookings` / `walkIns` / `mail` collections directly from samwise-app via the lazy-singleton in `lib/firebase-admin.ts`. The `FIREBASE_SERVICE_ACCOUNT` env var is reused for both Firestore writes AND Google Calendar API auth (see `lib/google-calendar.ts` and memory `reference_google_calendar_service_account.md`). Client-side Firebase SDK is still avoided — server routes only.
- **Calendar API helpers in `lib/google-calendar.ts`.** Minimal JWT-bearer-token + raw fetch against Calendar v3 REST. Deliberately skips the `googleapis` SDK (~100MB) — for the two endpoints we use (`freeBusy.query` + `events.insert` + `patch`), `google-auth-library` (~1MB) is enough. See memory `reference_google_calendar_service_account.md` for the personal-Gmail `forbiddenForServiceAccounts` constraint and the .ics workaround.

## Recent Changes

### 2026-06-25 — /copilot renamed to /for-experts; sidebar shell + shared `<RegisterRitualCard>`

Route + folder renamed (`app/copilot/` → `app/for-experts/`, URL `/copilot` → `/for-experts`). `lib/copilot/` stays — internal organization, not URL-facing. All 13 `@/app/copilot/*` imports across `components/walk-in/WalkInShell.tsx`, the 8 `lib/copilot/*` files, and `lib/demo-call/broadcast.ts` were rewritten to `@/app/for-experts/*`. Three hardcoded `window.location.href = "/copilot"` redirects (`variables-table.tsx` × 2, `onboarding-save-row.tsx` × 1) became `/for-experts`. `git mv` preserved file history. The session-storage key (`copilot:session:v5`) was NOT renamed.

URL gate restructured to mirror the operator index's sidebar shell:
- `<SidebarProvider>` wraps the gate (the loaded `CopilotSurface` stays full-screen, no sidebar — it'd starve the 2-col grid of horizontal space).
- Sidebar = brand wordmark header + `Tools` group (renamed from `Operator tools` to match the audience this surface is for: behavioural experts onboarded onto Samwise) with two view-state-driven items: `Copilot` (default active) and `Register Ritual`. NO link to `/`, NO `Ritual call` (that's a user surface, not a therapist tool).
- View-state machine in `app/for-experts/page.tsx`: `type ExpertView = "copilot" | "register"`. Pathname stays `/for-experts` regardless. Header h1 swaps between `Copilot for behavioural experts` (Copilot in bold, "for behavioural experts" in muted regular) and `Register Ritual`.
- URL gate dropped `<Card>` chrome, icon-in-circle, and `<CardDescription>` — mirrors `<RegisterRitualCard>`'s flat `FieldGroup → Field → Input → button` shape. Two ghost buttons under the input quick-fill `Demo default` / `Onboarding default`.

`<RegisterRitualCard>` extracted to `components/register-ritual-card.tsx` (was inline in `app/page.tsx`). Both `/` and `/for-experts` mount it without forking. Self-contained — owns its own state (`googleDocLink`, `isLoading`, `linkError`, `userInputs`), POSTs to `REGISTER_RITUAL_URL`. No props.

Why "for-experts": therapists/clinicians onboarded onto Samwise are the audience for this surface — the copilot is no longer just an internal-rep tool. The route name + the `for behavioural experts` tagline make that explicit.

### 2026-06-24 — /for-experts gains onboarding mode (alongside demo)

`/for-experts` now handles `scriptType: "onboarding"` in addition to demo. The branching point is `configForScriptType()` in `app/for-experts/page.tsx` — it maps scriptType → variable set + which prefill/save UI to mount. Loading the onboarding script Doc (`1FrglmnZGDlFS7S89LgaKjKpDiRLEPGxkAYtOomjT08E`, carries `[TYPE: onboarding]`) routes to `ONBOARDING_VARIABLES` (`app/for-experts/onboarding-call-config.ts`), `<OnboardingPrefillRow>` (three-mode: Firestore-by-email | Google-Doc-URL | Manual), and `<OnboardingSaveRow>` (three-destination checkboxes: Firestore | Google Doc | Clipboard, fan-out parallel writes). The URL gate gained "Demo default" + "Onboarding default" quick-fill buttons. Backend additions (cloud-functions): `loadDemoCall` (Firestore-by-email prefill), `extractOnboardingFromDoc` (Gemini extracts onboarding variables from any Doc the clinician points at), `extractOnboarding` (Firestore save to `onboardingSessions`), `writeOnboardingToDoc` (Docs API insertText appending markdown notes block). `DemoCallVariable.phase` widened from a literal union to `string | number` (variables-table just groups by key — no behaviour change for demo). Session-storage key bumped v4 → v5 (PersistedSession's `script.scriptType` is what drives restore-time routing). `VariablesTable` + `CopilotSurface` gained an optional `saveOverride?: ReactNode` prop that replaces the default "Save call" button — onboarding mode mounts `<OnboardingSaveRow>` there. Demo path unchanged: same DEMO_CALL_VARIABLES, same `<QualifyPrefillRow>`, same `extractDemoCall` save. The autonomous demo-call agent and its persistence are untouched.

### 2026-06-23 — /ritual-call becomes user-facing; Create Ritual Doc + Demo Call copilot removed from home

- `/ritual-call` is now a self-contained user-facing surface. The pasted Doc link is persisted in `localStorage["ritual-call:docLink"]` and hydrated on mount, so a returning user does not have to paste it again ("if there is a session, pre-load"); cold visits stay blank. An **"Update ritual"** button inside `ActiveControls` POSTs the cached link to `registerNewRitual` without disconnecting the room. The persistent "Back to Samwise" header link was removed so users have no nav into the operator UI.
- `app/page.tsx` lost two surfaces:
  - The **Create Ritual Doc** feature: `CreateRitualDocCard`, `CREATE_DOC_URL`, the `MetadataForm`/`MetadataField`/`INITIAL_METADATA` types, the `"create"` NAV entry, and the `view === "create"` branch are all gone. Operators who still need to mint a Doc from scratch hit the `createRitualDoc` cloud function directly — the function itself is unchanged.
  - The **Demo Call copilot** sidebar entry. The `/for-experts` route stays reachable by direct URL.
- Sonner toaster (already mounted in `app/layout.tsx`) is now consumed by `RitualCallExperience` for the Update ritual success/failure toasts.
- Backend frozen this round: `registerNewRitual`, `createRitualDoc`, `ritual_synthesis_prompt.txt`, the ritual-agent onboarding prompt, and the dispatch-metadata contract are all untouched. A separate task will rebuild the synthesis prompt + agent prompt around the new ritual framework (Enemy, Mantras de desidentificación, Generación de protección, Construcción de nueva fe, Name in Metadata) once the user is ready.
