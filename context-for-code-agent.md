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

The current single page is `app/page.tsx`: a "Register New Ritual" form that takes a Google Doc URL and POSTs it to `registerNewRitual`. New features extend this page (or add sibling routes under `app/`) and add a new cloud function call.

## Module Structure (Directories and files)
```
samwise-app/
├── app/
│   ├── layout.tsx
│   ├── page.tsx               # current "Register New Ritual" page
│   └── globals.css
├── components/
│   ├── theme-provider.tsx
│   └── ui/                    # shadcn/ui primitives (Button, Input, Card, Field, Spinner, …)
├── hooks/
│   ├── use-mobile.ts
│   └── use-toast.ts
├── lib/
│   └── utils.ts               # cn() helper
├── public/
├── styles/
├── components.json            # shadcn config
├── next.config.mjs
├── package.json               # next, react, sonner, lucide-react, shadcn deps
├── tsconfig.json
├── context-for-code-agent.md  # this file
└── current-plan.md            # active task plan
```

## Conventions specific to this module
- **Cross-origin cloud-function calls.** Endpoints are absolute URLs to deployed Firebase functions (`https://<region>-<project>.cloudfunctions.net/<fn>` or the run URL like `https://registernewritual-b6fhjlgejq-uc.a.run.app`). The cloud function must enable CORS. Don't proxy through a Next.js API route unless a feature genuinely needs server-side secrets — samwise-app has none.
- **Endpoint URL constants live at the top of the consuming page.** `app/page.tsx` declares `CREATE_DOC_URL` and `REGISTER_RITUAL_URL` as `const` at module scope so they're easy to find when a function is redeployed under a different hash. When adding a new cloud-function call, add a new constant in the same place; do NOT inline URLs in `fetch()` calls.
- **shadcn/ui components only.** Use the primitives in `components/ui/` (Button, Input, Card, Field, Spinner, FieldGroup, FieldLabel, FieldError). Don't pull in alternative component libraries; the design language is already set.
- **Toasts via `sonner`.** `toast.success`, `toast.error`, `toast.info`. Already wired in `app/layout.tsx`.
- **Icons via `lucide-react`.** Pick from the existing icon set; don't add custom SVGs unless absolutely needed.
- **Client components by default for interactive forms.** Pages with state, handlers, and toasts use `"use client"` at the top — same pattern as `app/page.tsx`.
- **No auth in v1.** The app is for the internal team. If multi-tenant ever becomes a concern, NextAuth is the obvious next step; not in scope today.
- **No Firestore SDK.** Even though samwise-app could in principle hit Firestore directly with a Firebase web client, we don't — keeps the cloud-function layer as the only writer and avoids client-side credential management.
