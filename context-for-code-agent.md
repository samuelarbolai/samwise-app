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
- `/copilot` — rep-side in-call surface for the Demo Call. Two-pane: variables capture (left), script with live `{{variable}}` substitution (right). Variables are denoised by a Gemini-backed cleaner that produces script-context-aware substitutions (not canonical-generic forms). End-of-call writes one row to the funnel sheet. See the `samwise-session-copilot` skill for the architecture, the `[SAY]/[/SAY]` marker convention in script Docs, the `frameworkSemantics` per-variable pattern, and the deferred items. The script-pane also parses a `[CONDITION: var=value]` marker (added 2026-05) for conditional phase visibility — phases tagged with that marker render only when `cleaned[var] === value`. First driver: `fit_state` (qualified | still_disqualified), flipped by the rep after the desidentification demo to swap between the close path and the disqualified-rebound flow. `DemoCallVariable` has a `defaultValue?: string` field so `makeEmptyState` seeds initial branch values. As of 2026-05 the post-load surface is also exported as `<CopilotSurface>` (`app/copilot/copilot-surface.tsx`) so it can be reused from `/demo-call/[bookingId]`'s therapist shell without duplicating the qualification-prefill logic; the manual qualification-prefill UI in `/copilot` is passed as the `topSlot` prop. The shared prefill helper lives at `lib/copilot/prefill-from-qualification.ts` — both `/copilot` (manual rep-typed identifier) and `/demo-call/[bookingId]` (auto from booking.prospectKey) call it. `DemoCallVariable` also has a `userVisible?: boolean` field; when true the cleaned value is broadcast over LiveKit DataChannel as `demo-call:variable_update` events to the user-side `<VariablesPanel>` on samwise-landing.

- `/demo-call/[bookingId]` — therapist-side surface for the human-to-human Demo Call. 3-column layout: `<VideoCallExperience>` (left) + `<VariablesTable>` (middle) + `<ScriptPane>` (right). On mount: POSTs `/api/demo-call/init` (which mints a LiveKit token AND starts a Composite Egress recording server-side AND marks the booking `in_progress`), loads the canonical demo script, attempts qualification pre-fill from the booking's `prospectKey`. Pre-fills route through the shared `prefillFromQualification` helper. `setState` is wrapped in a DataChannel broadcaster (`lib/demo-call/broadcast.ts`) so any change to a `userVisible: true` variable's cleaned value lands on the user side in real time. No agent dispatch — this is a two-human room. The user side lives in samwise-landing at the same `/demo-call/[bookingId]` path. Booking docs live in Firestore under `demoBookings/{calBookingUid}`, written by the `calDemoBookingWebhook` cloud function on Cal.com's `BOOKING_CREATED` event. **Auth deferred** — `bookingId`-as-credential works for v1 internal testing only; add Clerk before any non-test user touches the URL. **No multi-therapist routing** — `therapistId` is hardcoded `therapist-samuel` for v1. Hard wall-clock cap (75 min, both sides enforce client-side) + LiveKit `emptyTimeout` (~30s) closes the room when everyone leaves.

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
│   │   └── demo-call-config.ts   # variable metadata + frameworkSemantics + default Doc URL
│   └── api/                      # API routes (LiveKit token minting, etc.)
├── components/
│   ├── theme-provider.tsx
│   └── ui/                    # shadcn/ui primitives (Button, Input, Card, Field, Spinner, Textarea, …)
├── hooks/
│   ├── use-mobile.ts
│   └── use-toast.ts
├── lib/
│   ├── utils.ts               # cn() helper
│   └── copilot/               # Session Copilot client wrappers
│       ├── load-script.ts     # loadCallScript wrapper + legacy-shape normalizer
│       ├── clean-variable.ts  # cleanVariable wrapper + debounce + script-context extractor
│       ├── append-row.ts      # appendDemoCallRow wrapper
│       └── session-storage.ts # localStorage autosave + restore (v2 key)
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
- **Fit Assessment Call.** Upstream session that captures `behaviour_to_change`, `core_motivation`, `alternatives_tried`, `why_alternatives_failed`, `symbolic_anchor_description` and feeds them forward into the Demo Call via VLOOKUP per the framework. Doesn't exist yet — the copilot currently has the rep type these live during the Demo as a workaround.
- **Onboarding / Call Design copilot.** The `loadCallScript` cloud function already returns `scriptType: "onboarding" | "call_design"` for forward-compat, but `/copilot` only handles `scriptType: "demo"` in v1. Adding these is frontend-only work (a new `*-call-config.ts`, branch on `scriptType` in `page.tsx`) + a sibling `append<Type>Row` cloud function. See the `samwise-session-copilot` skill.

## Conventions specific to this module
- **Cross-origin cloud-function calls.** Endpoints are absolute URLs to deployed Firebase functions (`https://<region>-<project>.cloudfunctions.net/<fn>` or the run URL like `https://registernewritual-b6fhjlgejq-uc.a.run.app`). The cloud function must enable CORS. Don't proxy through a Next.js API route unless a feature genuinely needs server-side secrets — samwise-app has none.
- **Endpoint URL constants live at the top of the consuming page.** `app/page.tsx` declares `CREATE_DOC_URL` and `REGISTER_RITUAL_URL` as `const` at module scope so they're easy to find when a function is redeployed under a different hash. When adding a new cloud-function call, add a new constant in the same place; do NOT inline URLs in `fetch()` calls.
- **shadcn/ui components only.** Use the primitives in `components/ui/` (Button, Input, Card, Field, Spinner, FieldGroup, FieldLabel, FieldError). Don't pull in alternative component libraries; the design language is already set.
- **Toasts via `sonner`.** `toast.success`, `toast.error`, `toast.info`. Already wired in `app/layout.tsx`.
- **Icons via `lucide-react`.** Pick from the existing icon set; don't add custom SVGs unless absolutely needed.
- **Client components by default for interactive forms.** Pages with state, handlers, and toasts use `"use client"` at the top — same pattern as `app/page.tsx`.
- **No auth in v1.** The app is for the internal team. If multi-tenant ever becomes a concern, NextAuth is the obvious next step; not in scope today.
- **No Firestore SDK.** Even though samwise-app could in principle hit Firestore directly with a Firebase web client, we don't — keeps the cloud-function layer as the only writer and avoids client-side credential management.
