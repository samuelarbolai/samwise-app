# current-plan-outreach-trip.md — /outreach and /trip subdirectory apps

> Parallel plan file. Does NOT replace `current-plan.md` (native demo-call video room).
> Status: **DONE — shipped 2026-05-28.**

## Plan Summary

Two new subdirectory apps inside `samwise-app`, both at `app.samwise.life`:

1. **`/outreach`** — Tracks LinkedIn + phone outreach for NYC trip. Mirrors the existing call funnel (Prospecting → Fit Assessment → Disqualified | Optimization → Recommendation). The goal of every contact is the Recommendation step; a dedicated pipeline view surfaces who's closest to that ask.
2. **`/trip`** — North-star planner for the Jun 9–17 NYC trip. Daily plan, master calendar, transit routes, budget ledger, contingencies, packing, pre-trip todos.

Both apps share visual language: **paper-module** (warm-grey paper, Geist Mono body, Fraunces serif for page title, Manrope tracked-uppercase eyebrows, landing-gold `#D4A85A` accent used sparely on stars / pickers / Recommendation chip). Aesthetic: Lotus 1-2-3 / dBase III paper.

Persistence: Firestore single-doc per workspace. Token generated client-side on first visit, stored in localStorage, embedded in URL. No auth — unguessable URL is the credential.

## Plan Architecture (Flow)

```
Browser → /outreach (or /trip)
       → ClientBootstrap reads localStorage; if no token, generates one + saves
       → router.replace(/outreach/<token>)
       → /outreach/<token>/page.tsx server-redirects to /today
       → Today (server component) → actions.ensureWorkspace (seeds Firestore once)
                                  → actions.listContacts + getDailySession
                                  → TodayClient (renders, mutates via server actions)
```

`ensureWorkspace` is single-flight per-process via Promise memo. Seed docs use deterministic IDs (slug-based) so a re-seed is idempotent.

## Plan Structure (Directories and files)

```
samwise-app/
├── app/
│   ├── layout.tsx                              # +Fraunces/Manrope/Caveat fonts
│   ├── globals.css                             # +paper tokens, +dBase utilities
│   ├── outreach/
│   │   ├── page.tsx                            # token bootstrap (client)
│   │   ├── actions.ts                          # server actions (firebase-admin)
│   │   ├── _types.ts                           # Step / Tier / Source enums + types
│   │   ├── _seed.ts                            # 32 contacts + 4 templates
│   │   ├── _components/
│   │   │   ├── page-shell.tsx                  # nav + brand
│   │   │   ├── db-box.tsx                      # eyebrow-titled fielded box
│   │   │   ├── db-table.tsx                    # monospace table
│   │   │   ├── db-form.tsx                     # input / select / button / checkbox
│   │   │   ├── status-chip.tsx                 # step-colored chip
│   │   │   ├── edit-panel.tsx                  # right-rail dialog
│   │   │   └── f-key-footer.tsx                # sticky F-key footer
│   │   └── [workspace]/
│   │       ├── layout.tsx                      # passthrough
│   │       ├── page.tsx                        # redirect → /today
│   │       ├── today/                          # Today panel + recommendation bin
│   │       ├── contacts/                       # CRUD table + edit panel
│   │       ├── templates/                      # versioned, locked-on-use
│   │       ├── recommendations/                # filtered pipeline
│   │       └── mistakes/                       # append-only log
│   └── trip/
│       ├── page.tsx                            # token bootstrap (client)
│       ├── actions.ts                          # server actions
│       ├── _types.ts                           # Event / Route / Budget / etc.
│       ├── _seed.ts                            # full calendar, routes, budget,
│       │                                       #   contingencies, packing, todos,
│       │                                       #   daily plans Jun 9–17
│       ├── _components/page-shell.tsx
│       └── [workspace]/
│           ├── today/                          # daily plan + budget + prompts
│           ├── calendar/                       # filterable master table
│           ├── routes/                         # transit blueprints
│           ├── budget/                         # planned + spend ledger
│           ├── contingencies/                  # situation→action cards
│           ├── packing/                        # checklist
│           └── pre-trip/                       # todos w/ Cal.com + Luma URLs
└── lib/
    └── workspace-token.ts                      # 8-char alpha+num generator
```

Shared paper primitives currently live under `app/outreach/_components/`. Trip imports cross-feature. **Tech debt:** consolidate to `app/_paper/` when adding the third paper module.

## Firestore data model

### `outreachWorkspaces/{token}/`
- `(meta doc)` — `{ createdAt, seeded, lastSeededAt }`
- `contacts/{id}` — funnel-stage tracking; id = slug-of-name + idx
- `templates/{id}` — versioned; id = audience + slug-of-name
- `mistakes/{id}` — append-only
- `sessions/{yyyy-mm-dd}` — daily targets + counters

### `tripWorkspaces/{token}/`
- `events/{id}` — id includes date + slug + idx
- `routes/{id}` — transit blueprints
- `budgetLines/{id}` — planned line items
- `spend/{id}` — log entries
- `contingencies/{id}` — situation→action
- `packing/{id}` — checklist items
- `preTripTodos/{id}` — Cal.com + Luma URLs
- `dailyPlans/{yyyy-mm-dd}` — daily north star

## Modifications (in phases and steps) — already shipped

### Phase 0 · Establish design tokens
- `app/layout.tsx`: register Fraunces / Manrope / Caveat via `next/font/google`.
- `app/globals.css`: add `--paper`, `--paper-deep`, `--ink`, `--ink-muted`, `--rule`, `--rule-soft`, `--accent-gold`, `--moss`, `--amber-deep`, `--ash` in `:root`. Expose to Tailwind via `@theme inline`. Add `.paper-module`, `.label-eyebrow`, `.page-title`, `.editorial-wrap` utilities.
- `public/star.svg`: four-point gold star.

### Phase 1 · Outreach app
- Scaffold (route, page-shell, primitives, edit panel, F-key footer).
- Firestore wiring with single-flight memo + slug-based seed IDs.
- Contacts CRUD with funnel filter + recommendation status edit.
- Templates with auto-retire-on-new-version + lock.
- Today panel: push-for-rec bin + replies waiting + follow-ups due + daily targets.
- Recommendation pipeline view: priority-sorted by `recommendationStatus * 10 + stepBoost`.
- Mistakes log: append-only with optional template-version-fix link.

### Phase 2 · Trip app
- Same workspace pattern as outreach.
- Pre-seeded with EVERYTHING from the 2026-05-28 conversation: full master calendar (36 events incl. outside-window markers), 5 transit blueprints, 7 budget lines, 12 contingencies, 22 packing items, 13 pre-trip todos, 9 daily plans Jun 9–17.
- Calendar: filter pills, pick toggle, grouped by date.
- Budget: planned + spend ledger + category running totals.
- Routes / Contingencies / Packing: read + toggle.
- Pre-trip todos: link out + due dates.

## Testing phase

- **Local test:** `pnpm dev` → visit `/` (existing route renders unchanged) → visit `/outreach` (auto-generates token, redirects to `/outreach/<token>/today`, seeded contacts visible, recommendation bin shows 5 unique targets) → visit `/trip` (auto-generates token, seeded calendar shows 14 picked / 36 total, routes/budget/contingencies all populate). **PASSED 2026-05-28.**
- **Integration:** N/A (no external services beyond Firestore).
- **README update:** N/A.

## Known issues + tech debt

1. Right-slot wrap in `.db-box__chrome` on narrow viewports — patched 2026-05-28.
2. Cross-feature import of paper primitives from `app/outreach/_components/` into `app/trip/*`. Consolidate to `app/_paper/` if a third paper module is added.
3. Outreach seed is one-shot. Adding new seed contacts later requires manual Firestore inserts (intentional — preserves user edits).
4. `revalidatePath(`/outreach/${token}`, "layout")` after every mutation. Possible to tighten to specific page paths if SSR cost ever matters.

## After implementation

- Update `context-for-code-agent.md` with: new `/outreach` and `/trip` routes under "Module Overview"; new `outreachWorkspaces` / `tripWorkspaces` Firestore collections; the paper-module pattern documented as a sibling to the existing shadcn convention. **TODO — left for the user to do, or pick up in a future session.**
- Mark task DONE in master Vibe doc Projects tab (manual user step).

## How to reset a workspace during dev

```js
// in browser console at /outreach
localStorage.removeItem("samwise.outreach.workspaceToken");
// then reload — a new workspace with fresh seed is created.

// for trip:
localStorage.removeItem("samwise.trip.workspaceToken");
```
