# current-plan.md — Inverted onboarding (Start Now → /start → minimal ritual → seal)

> **Overwrites the previous plan** (the Tiptap ritual editor — SHIPPED 2026-06-29). The editor is the foundation this plan builds on.
> **Status: PROPOSAL. No code on disk yet.** Awaiting explicit "go" before any file is created or edited.
> **Touches three repos:** `samwise-landing` (rewire Start Now CTAs only — no visual change), `samwise-app` (new `/start` route + onboarding-mode in `/ritual-doc/[id]` + workspace-token), `samwise-backend/cloud-functions` (new `registerRitualFromTiptap` CF).
> **NO agent integration in v1** — Samuel is the human guide on a parallel channel. No new LiveKit work.
> **Mirror discipline applies** (memory `feedback_mirror_dont_reimagine`):
>   - workspace-token pattern → mirror `samwise-app/app/trip/page.tsx` + `lib/workspace-token.ts` verbatim (per `samwise-app-trip` skill)
>   - `registerRitualFromTiptap` cloud function → mirror `registerNewRitual`'s shape verbatim, just swap Google Doc reading for Firestore `ritualDocs/{id}` reading (per `ritual-synthesis-prompt` skill — same synthesis prompt, same RitualData output)
>   - `/start` route shape → mirror `app/trip/page.tsx` (bootstrap → ensure workspace → redirect) verbatim
>   - landing Start-Now rewire → keep canonical untouched VISUALLY; modify only `handleStartClick` destination + the two `<a href>` attributes (per `samwise-landing-page` skill: variant rule is about visual experiments, not funnel rewires)
> **Vocabulary blacklist (script-work Rule 7) is enforced** in all `/start` copy: never `paciente / comportamiento autodestructivo / recaída / terapia`.

## Plan Summary

A new user clicks **Start Now** on the landing → the gold-star transition fires as today → cross-origin navigation to `app.samwise.life/start?from=transition` → app mints a `samwise.ritual.workspaceToken` in localStorage and creates a fresh `ritualDocs/{id}` → redirects to `/ritual-doc/{id}?mode=onboarding`.

**NO FORMS.** Every captured field is a Tiptap subsection — H2 heading + empty paragraph the user types into. Samuel (or a future agent) verbally guides the user through what to type where. The ONE exception is a tiny inline **Voice pill toggle** (Male | Female) above the Voice H2 inside the Metadata tab; click writes "male" or "female" as the paragraph below the heading via editor commands. Aesthetically continuous with the editor, not a wizard.

The editor in onboarding mode shows ONLY the minimum-viable-ritual surface:

- **Metadata tab** — Tiptap, EXTENDED subsection list visible in onboarding mode:
  - Name · Language · **Voice** (with the inline pill toggle above the H2) · Phone number · Timezone · Behaviour I'd like to change · Core motivation · Call schedule
  - Hidden in onboarding mode (visible in full mode for review/edit): userID, voiceID (both auto-set; technical)
- **Ritual Call tab** — the 4 canonical beats as Tiptap H2 headings (Exit from the day / Entry into the work / Intentions / The pact), user fills underneath. Unchanged from full mode.
- **Ritual tab** — ONLY two H2 subsections visible: **Mantras de desidentificación** and **Generación de bloqueador**. The other 7 (Mantras de esperanza / Helpers / Procedure / Construcción de nueva fe / Surrender / second Procedure / Schedules) are HIDDEN visually but PRESERVED in the saved doc as empty scaffolding for later optimization moments.
- **Lapse Map / Possible origins / Behavioural picture tabs** are HIDDEN in onboarding mode (also preserved in the doc, visible in full mode).

A persistent **step-progress strip** at the top (Metadata 1/3 → Ritual Call 2/3 → Ritual 3/3) + a final **Seal ritual** button at the bottom of the Ritual tab.

**Seal click** → POST to a new cloud function `registerRitualFromTiptap(ritualDocId)` which:

1. Reads `ritualDocs/{ritualDocId}` from Firestore (NOT a Google Doc — that's the whole point of this round).
2. Serializes the Metadata tab from Tiptap JSON → plain text. **Regex-extracts the structured Metadata fields** (Name, Language, Voice, Phone, Timezone) from the paragraphs under each H2 — same pattern `registerNewRitual` uses today on the Google Doc's Metadata tab. Voice ("male" | "female") combined with Language (en | es) derives `voiceID` via the same table that lives in samwise-backend/ritual-agent/src/config/voiceIds.ts.
3. Serializes the 3 synthesis-relevant tabs (Ritual Call, Ritual, Behavioural picture) from Tiptap JSON → plain-text Markdown sections (preserving H2/H3 hierarchy as `##` / `###`).
4. ALSO serializes the "Behaviour I'd like to change" + "Core motivation" + "Call schedule" subsections from the Metadata tab — they become part of the raw material fed to the synthesis prompt.
5. **Feeds the assembled raw material to the SAME existing `ritual_synthesis_prompt.txt`** (single source of truth — do NOT fork the prompt) to get back `{ userInputs, schedules, fallbackSchedules, behaviorLabel }`. Schedule times typed in the Call Schedule subsection are extracted via the synthesis prompt's existing Rule 10 (`DAY_HH:MM` format).
6. Writes `rituals/{newRitualId}` with the SAME `RitualData` shape `registerNewRitual` produces today (`agentConfig`, `schedules`, `timeZone`, `googleDocId` left empty + new `ritualDocId` field, `label`, `behaviorLabel`, `fallbackActive: false`).
7. Upserts `users/{userID}` (where `userID` = the workspace token — derived once, persistent).
8. Returns `{ ritualId }`.

After seal: app navigates the user to a **success screen** showing first call time + a soft invitation to return ("Come back to refine the rest of your ritual. There's more we can shape together.").

**Future visits** to `/ritual-doc/{id}` WITHOUT `?mode=onboarding` → the full editor (all 6 tabs, all subsections) — for ongoing optimization moments. The workspace token persists in localStorage so the user can return from any device that has it.

**NOT in scope for v1** (deferred — pick one per follow-up):
- Recovery flow ("email me my link" if localStorage cleared)
- The "real" agent guide (LiveKit-based) embedded in the editor — Samuel is the guide via parallel call
- Multi-device sync (workspace token is per-browser; user shares it manually for now)
- Cron-firing verification harness for the new sealed rituals (existing cron consumes the same `rituals/{id}` shape, so it should "just work" — but a sanity-check harness is a worthy follow-up)
- The /qualify route's deprecation (keeping it alive for external/TikTok funnels)

## Plan Architecture (Flow)

```
┌──────────────────────────────────────────────────────────────────────────┐
│  samwise-landing — canonical /                                          │
│                                                                          │
│  <a href="/qualify" onClick={handleStartClick}>Start now</a>  ──┐       │
│         (nav AND hero, both wired to handleStartClick)          │       │
│                                                                  ▼       │
│  handleStartClick:                                                       │
│   1. setIsLeaving(true)                                                  │
│   2. append gold-star overlay to body                                    │
│   3. at t=525ms: window.location.href = `${APP_URL}/start?from=transition`│
│      (CHANGED from `router.push("/qualify")`)                            │
└──────────────────────────────────────────────────────────────────────────┘
                                  │
                                  │ cross-origin navigation
                                  │ (~200-500ms unavoidable white flash;
                                  │  app's /start fades in to mask it)
                                  ▼
┌──────────────────────────────────────────────────────────────────────────┐
│  samwise-app — /start                                                    │
│                                                                          │
│  app/start/page.tsx (client):                                            │
│   1. Read or mint `samwise.ritual.workspaceToken` (localStorage)         │
│   2. POST /api/ritual-doc/create-for-workspace { token }                 │
│      → returns { id } (creates ritualDocs/{id} with workspaceToken set)  │
│   3. router.replace(`/ritual-doc/${id}?mode=onboarding&from=transition`) │
│                                                                          │
│  Read `?from=transition` → render brief fade-in (opacity 0 → 1, 400ms)   │
│  to mask the cross-origin white flash.                                   │
└──────────────────────────────────────────────────────────────────────────┘
                                  │
                                  ▼
┌──────────────────────────────────────────────────────────────────────────┐
│  /ritual-doc/[id]?mode=onboarding                                        │
│                                                                          │
│  Existing editor + new "onboarding mode" layer:                          │
│   - SidebarNav items filtered to: Metadata · Ritual Call · Ritual        │
│   - Metadata tab renders OnboardingMetadataForm (form fields, not tiptap)│
│   - Ritual tab tiptap shows ONLY Mantras de desid. + Generación de bloq. │
│     (other H2s hidden via runtime ProseMirror node filter OR by seeding  │
│      a minimal template — see Phase 3 decision in Step 3.3)              │
│   - Top of page: step-progress strip (1/3 / 2/3 / 3/3)                   │
│   - Bottom of Ritual tab: <SealRitualButton />                           │
│                                                                          │
│  Seal click → POST /api/ritual-doc/[id]/seal                             │
└──────────────────────────────────────────────────────────────────────────┘
                                  │
                                  ▼
┌──────────────────────────────────────────────────────────────────────────┐
│  /api/ritual-doc/[id]/seal (samwise-app)                                 │
│                                                                          │
│  Server: POST → forward to cloud function:                               │
│   fetch(REGISTER_RITUAL_FROM_TIPTAP_URL, {                               │
│     body: { ritualDocId: id }                                            │
│   })                                                                     │
│  Returns { ritualId, firstCallAt }                                       │
└──────────────────────────────────────────────────────────────────────────┘
                                  │
                                  ▼
┌──────────────────────────────────────────────────────────────────────────┐
│  samwise-backend/cloud-functions: registerRitualFromTiptap (NEW)         │
│                                                                          │
│  1. db.collection("ritualDocs").doc(ritualDocId).get()                   │
│  2. Pluck metadata fields (typed) + qualification fields                 │
│  3. Serialize 3 tabs (ritualCall, ritual, behaviouralPicture)            │
│     from Tiptap JSON → Markdown sections                                 │
│  4. Build raw material: Metadata block + qualification block +           │
│     3 Markdown sections + the schedule times the user picked             │
│  5. Call Gemini with EXISTING ritual_synthesis_prompt.txt                │
│     → { userInputs, schedules, fallbackSchedules, behaviorLabel }        │
│  6. Override schedules with the user-picked times (dedupe with extracted)│
│  7. Build RitualData; write to rituals/{newId}                           │
│  8. Upsert users/{userID} (userID = workspaceToken from ritualDoc)       │
│  9. Return { ritualId, firstCallAt }                                     │
└──────────────────────────────────────────────────────────────────────────┘
                                  │
                                  ▼
┌──────────────────────────────────────────────────────────────────────────┐
│  /ritual-doc/[id]?mode=onboarding&sealed=1                               │
│                                                                          │
│  Success screen:                                                          │
│   "Your first call is at [firstCallAt]. Come back to refine the rest."   │
│   [ Open my ritual doc → ] (drops ?mode=onboarding for the full editor)  │
└──────────────────────────────────────────────────────────────────────────┘
```

## Plan Structure (Directories and files)

```
samwise-landing/
└── app/page.tsx                                  # MOD: handleStartClick destination only; 2x <a href> attrs

samwise-app/
├── app/
│   ├── start/                                    # NEW
│   │   └── page.tsx                              # mint token → create ritualDoc → redirect
│   ├── ritual-doc/[id]/                          # MOD: onboarding-mode layer
│   │   ├── page.tsx                              # MOD: read ?mode=onboarding searchParam, pass down
│   │   ├── RitualDocEditor.tsx                   # MOD: filter NAV in onboarding mode; render OnboardingMetadataForm in Metadata tab; render success screen on ?sealed=1
│   │   ├── OnboardingMetadataForm.tsx            # NEW: form fields for Metadata + trimmed qualification + schedule pickers
│   │   ├── OnboardingProgressStrip.tsx           # NEW: 1/3 - 2/3 - 3/3 indicator
│   │   ├── OnboardingSealButton.tsx              # NEW: bottom-of-Ritual-tab CTA, calls /api/ritual-doc/[id]/seal
│   │   ├── OnboardingSuccessScreen.tsx           # NEW: "Your first call is at..." + "Open my ritual doc" CTA
│   │   └── (existing EditorPane.tsx, SaveStatus.tsx, ImmerseToggle.tsx unchanged)
│   └── api/ritual-doc/
│       ├── create-for-workspace/route.ts         # NEW: POST { token } → creates ritualDocs with workspaceToken field
│       └── [id]/seal/route.ts                    # NEW: POST → forwards to registerRitualFromTiptap CF
├── lib/
│   ├── ritual-doc/
│   │   ├── schema.ts                             # MOD: add Metadata structured fields + qualification fields + schedule + workspaceToken to RitualDoc type
│   │   ├── storage.ts                            # MOD: createRitualDocForWorkspace(token) + setMetadata(id, fields) + setQualification(id, fields) + setSchedule(id, times)
│   │   └── tiptap-to-markdown.ts                 # NEW: serializes Tiptap JSON → Markdown (H2 → ##, H3 → ###, paragraph → text+blank line)
│   ├── workspace-token.ts                        # NEW: mirrors lib/workspace-token.ts from /trip (mint, read, validate)
│   └── ritual-doc/onboarding-mode.ts             # NEW: VISIBLE_TAB_KEYS_ONBOARDING + VISIBLE_SUBSECTIONS_ONBOARDING; isOnboardingMode(searchParams) helper

samwise-backend/cloud-functions/
└── functions/src/
    ├── index.ts                                  # MOD: export registerRitualFromTiptap; add SYNTHESIS_TAB_TITLES_FOR_TIPTAP (mirror existing)
    └── registerRitualFromTiptap.ts               # NEW: the function body (kept in its own file so registerNewRitual stays untouched)
```

## Modifications (in phases and steps)

### Phase A — Schema + workspace-token in samwise-app

#### Step A.1 — `lib/workspace-token.ts`

- **In-file location:** new file at `samwise-app/lib/workspace-token.ts`
- **Should not be modified:** N/A
- **Code (verbatim mirror of `/trip`'s pattern; the trip skill confirms `localStorage` key per app):**
  ```ts
  // Mirrors lib/workspace-token.ts from /trip — same shape, distinct
  // localStorage key. Per samwise-app-trip skill: 8-char token, the token
  // IS the Firestore doc id, no auth, no recovery in v1.
  const STORAGE_KEY = 'samwise.ritual.workspaceToken';

  const ALPHABET = '23456789abcdefghjkmnpqrstuvwxyz'; // base31, no ambiguous chars

  function mintToken(): string {
    const out: string[] = [];
    const buf = new Uint8Array(8);
    crypto.getRandomValues(buf);
    for (const b of buf) out.push(ALPHABET[b % ALPHABET.length]);
    return out.join('');
  }

  export function readOrMintWorkspaceToken(): string {
    try {
      const existing = window.localStorage.getItem(STORAGE_KEY);
      if (existing && existing.length >= 6) return existing;
      const fresh = mintToken();
      window.localStorage.setItem(STORAGE_KEY, fresh);
      return fresh;
    } catch {
      // Private mode / blocked storage: fall through to ephemeral token.
      return mintToken();
    }
  }
  ```
- **Explanation:** mirrors `/trip`'s pattern verbatim per the skill. The token doubles as the user identifier for `users/{userID}` once the ritual is sealed (no separate auth).

#### Step A.2 — extend `lib/ritual-doc/schema.ts`

- **In-file location:** `samwise-app/lib/ritual-doc/schema.ts`
- **Should not be modified:** existing `TAB_KEYS`, `TAB_LABELS`, `SUBSECTIONS`, `TAB_TEMPLATES`, `emptyTabs`, `isTabKey`, `RitualDoc.tabs`, `Tab` — those drive the existing editor.
- **Code (append new exports):**
  ```ts
  // ── Onboarding extensions (added 2026-06-29 for inverted onboarding) ──
  //
  // NO structured Metadata/Qualification/Schedule types — all captured
  // content lives as Tiptap text under H2 subsections of the existing
  // tabs (per the no-forms direction). The only new persistent fields
  // on a ritualDoc are workspace ownership + the sealed marker. The
  // voice ID table also lives here because both the inline pill toggle
  // (samwise-app) AND the cloud function need to derive voiceID from
  // (language, gender).

  export type Gender = 'male' | 'female';

  // Voice ID per (language, gender) — sourced from
  // samwise-backend/ritual-agent/src/config/voiceIds.ts (English Male
  // = qualification flow's en voice; Spanish Male = qualification flow's
  // es voice; Spanish Female = Adriana; English Female = Calypso).
  // Hand-synced — when voiceIds.ts changes, mirror here AND in the
  // cloud function (registerRitualFromTiptap.ts).
  export const VOICE_ID_BY_LANG_GENDER: Record<'en' | 'es', Record<Gender, string>> = {
    en: {
      male:   '5ee9feff-1265-424a-9d7f-8e4d431a12c7',
      female: '03496517-369a-4db1-8236-3d3ae459ddf7',
    },
    es: {
      male:   '13ff5deb-2591-42ad-a356-63a04e524411',
      female: 'f4d6bb07-f876-4464-ba70-cd48d8701890',
    },
  };

  // The extended Metadata subsection list (used by both modes via
  // SUBSECTIONS['metadata']). Onboarding mode hides userID + voiceID;
  // full mode shows all. Subsections are seeded as empty H2+paragraph
  // pairs in TAB_TEMPLATES.
  export const METADATA_SUBSECTIONS_EXTENDED = [
    'Name',
    'Language',
    'Voice',
    'Phone number',
    'Timezone',
    "Behaviour I'd like to change",
    'Core motivation',
    'Call schedule',
    'userID',     // hidden in onboarding mode
    'voiceID',    // hidden in onboarding mode
  ] as const;

  // Extends the existing RitualDoc with workspace ownership + seal state.
  // Backwards-compatible: existing docs simply don't have these fields.
  export type RitualDocExtended = RitualDoc & {
    workspaceToken?: string;
    sealedAt?: Date;
    sealedRitualId?: string;   // points at rituals/{id} once sealed
  };
  ```
- **Also modify the existing `SUBSECTIONS.metadata` constant** (in the same file) to use `METADATA_SUBSECTIONS_EXTENDED` so the seeded template carries the new subsections from day one. This is a backwards-incompatible change to the seeded shape, but:
  - existing test ritualDocs from this session are not user data, can be discarded
  - `getRitualDoc`'s defensive fill-missing-keys logic ensures any older docs that don't have the new subsections won't crash the editor — the seed just adds them on next save
- **Explanation:** no structured separate-field state. Everything is Tiptap. The two non-Tiptap touchpoints (workspaceToken, sealedAt) are persistence concerns the user never sees, set programmatically.

#### Step A.3 — extend `lib/ritual-doc/storage.ts`

- **In-file location:** `samwise-app/lib/ritual-doc/storage.ts`
- **Should not be modified:** `COLLECTION`, `createRitualDoc`, `getRitualDoc`, `saveTab` — preserved verbatim.
- **Code (append):**
  ```ts
  // Creates a ritualDoc tied to a workspace token. Idempotent: if the
  // workspace already has an UNSEALED ritualDoc, returns its id instead
  // of minting a new one. (Sealed docs do NOT count — a returning user
  // with a sealed ritual mints a fresh doc for their second ritual.)
  export async function createRitualDocForWorkspace(
    workspaceToken: string,
    language: 'en' | 'es' = 'en',
  ): Promise<{ id: string; created: boolean }> {
    const db = getDb();

    // Look for an unsealed doc owned by this token. Requires composite
    // index (workspaceToken ASC, sealedAt ASC) — accept the requirement
    // per user direction 2026-06-29.
    const existing = await db
      .collection(COLLECTION)
      .where('workspaceToken', '==', workspaceToken)
      .where('sealedAt', '==', null)
      .limit(1)
      .get();
    if (!existing.empty) {
      return { id: existing.docs[0].id, created: false };
    }

    const now = Timestamp.now();
    const ref = await db.collection(COLLECTION).add({
      createdAt: now,
      updatedAt: now,
      language,
      workspaceToken,
      sealedAt: null,
      tabs: Object.fromEntries(
        TAB_KEYS.map((k) => [k, { tiptap: TAB_TEMPLATES[k], updatedAt: now }]),
      ),
    });
    return { id: ref.id, created: true };
  }

  // Called by registerRitualFromTiptap CF after a successful seal.
  // Not invoked from samwise-app directly.
  export async function markSealed(id: string, sealedRitualId: string): Promise<void> {
    const now = Timestamp.now();
    await getDb().collection(COLLECTION).doc(id).update({
      sealedAt: now,
      sealedRitualId,
      updatedAt: now,
    });
  }
  ```
- **Explanation:** content saves still flow through the existing `saveTab` helper — the user's typing in any Tiptap subsection goes through autosave like today. No new per-field setters needed (no structured fields exist). `createRitualDocForWorkspace` is idempotent so refreshing `/start` doesn't mint duplicate docs.
- **Firestore composite index:** `(workspaceToken ASC, sealedAt ASC)` on `ritualDocs`. Add to `firestore.indexes.json` (or equivalent deploy artifact) — Firebase will print a one-click create-link in logs the first time the query runs if missing.

### Phase B — `/start` route

#### Step B.1 — `app/start/page.tsx`

- **In-file location:** new file at `samwise-app/app/start/page.tsx`
- **Should not be modified:** N/A
- **Code:**
  ```tsx
  'use client';

  import { useEffect, useRef, useState } from 'react';
  import { useRouter, useSearchParams } from 'next/navigation';
  import { readOrMintWorkspaceToken } from '@/lib/workspace-token';

  // Bootstrap route — the destination of landing's "Start Now" CTA.
  // Mints (or reads) a workspace token, ensures a ritualDoc exists for
  // it, then replaces the URL with the editor's onboarding mode. ?from=
  // transition is passed through so the editor's first paint can fade
  // in (masks the cross-origin white flash from samwise.life).
  export default function StartPage() {
    const router = useRouter();
    const params = useSearchParams();
    const fromTransition = params.get('from') === 'transition';
    const inFlightRef = useRef(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
      if (inFlightRef.current) return;
      inFlightRef.current = true;

      (async () => {
        try {
          const token = readOrMintWorkspaceToken();
          const res = await fetch('/api/ritual-doc/create-for-workspace', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ token }),
          });
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          const { id } = (await res.json()) as { id: string };
          const url = `/ritual-doc/${id}?mode=onboarding${fromTransition ? '&from=transition' : ''}`;
          router.replace(url);
        } catch (err) {
          console.error('start bootstrap failed:', err);
          setError(err instanceof Error ? err.message : 'Unknown error.');
        }
      })();
    }, [router, fromTransition]);

    return (
      <div className="brand-editorial flex min-h-screen items-center justify-center bg-background text-foreground">
        {error ? (
          <div className="max-w-md text-center">
            <p className="mb-2 text-sm text-destructive">Could not start your ritual.</p>
            <p className="text-xs text-muted-foreground">{error}</p>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">Preparing your ritual…</p>
        )}
      </div>
    );
  }
  ```
- **Explanation:** mirrors `/trip/page.tsx` shape. `inFlightRef` is the per-component equivalent of the single-flight Promise memo the trip skill specifies — prevents double-create if React StrictMode runs the effect twice.

#### Step B.2 — `app/api/ritual-doc/create-for-workspace/route.ts`

- **In-file location:** new file at `samwise-app/app/api/ritual-doc/create-for-workspace/route.ts`
- **Code:**
  ```ts
  import { NextResponse } from 'next/server';
  import { z } from 'zod';
  import { createRitualDocForWorkspace } from '@/lib/ritual-doc/storage';

  export const runtime = 'nodejs';

  const Body = z.object({
    token: z.string().min(6).max(64),
    language: z.enum(['en', 'es']).optional(),
  });

  export async function POST(req: Request) {
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }
    const parsed = Body.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid body' }, { status: 400 });
    }
    try {
      const { id, created } = await createRitualDocForWorkspace(parsed.data.token, parsed.data.language ?? 'en');
      // Best-effort Samuel notification on a NEW doc creation only —
      // don't spam on idempotent returns. Mirrors notifySamuelOfQualifyStart
      // / notifySamuelOfBooking pattern. Awaited before route returns
      // because un-awaited fetches get dropped in Vercel's serverless
      // runtime (per memory `reference_landing_no_firestore_admin_notify`).
      if (created) {
        try {
          const { notifySamuelOfOnboardingStart } = await import('@/lib/notify/samuel');
          await notifySamuelOfOnboardingStart({ ritualDocId: id, workspaceToken: parsed.data.token });
        } catch (err) {
          console.warn('notifySamuelOfOnboardingStart failed (non-blocking):', err);
        }
      }
      return NextResponse.json({ id });
    } catch (err) {
      console.error('createRitualDocForWorkspace failed:', err);
      return NextResponse.json({ error: 'Create failed' }, { status: 500 });
    }
  }
  ```
- **Sibling work** in `samwise-app/lib/notify/samuel.ts`: add `notifySamuelOfOnboardingStart({ ritualDocId, workspaceToken })` — same shape as the existing `notifySamuelOfQualifyStart` / `notifySamuelOfBooking`. Subject: "A new ritual is being designed." Body: a link to `/ritual-doc/{ritualDocId}` so Samuel can open it in admin/full-mode and parallel-guide the user on a call.

### Phase C — Onboarding mode in the editor

#### Step C.1 — `lib/ritual-doc/onboarding-mode.ts`

- **In-file location:** new file at `samwise-app/lib/ritual-doc/onboarding-mode.ts`
- **Code:**
  ```ts
  import type { TabKey } from './schema';

  // Subset of tabs visible during onboarding mode. Order matters — it's
  // the order of the step-progress strip. Metadata first (the user fills
  // identity + the trimmed qualification subsections + schedule), then
  // the two content tabs.
  export const ONBOARDING_TAB_KEYS: readonly TabKey[] = [
    'metadata',
    'ritualCall',
    'ritual',
  ];

  // Per tab, the H2 subsection titles visible in onboarding mode. Any
  // H2 NOT in the list (within that tab) is hidden from the editor's
  // view. Hidden subsections are preserved in the saved doc — they
  // sit as empty scaffolding for the user's later optimization moments
  // (per user direction 2026-06-29: "keep them in the doc").
  export const ONBOARDING_VISIBLE_SUBSECTIONS: Partial<Record<TabKey, readonly string[]>> = {
    metadata: [
      'Name',
      'Language',
      'Voice',
      'Phone number',
      'Timezone',
      "Behaviour I'd like to change",
      'Core motivation',
      'Call schedule',
      // userID + voiceID are hidden in onboarding mode (technical)
    ],
    ritualCall: [
      // Full set — all 4 beats visible in onboarding
      'Exit from the day',
      'Entry into the work',
      'Intentions',
      'The pact',
    ],
    ritual: [
      'Mantras de desidentificación',
      'Generación de bloqueador — ¿Siento que se viene un ataque?',
      // hidden: Mantras de esperanza, Helpers, Procedure, Construcción
      // de nueva fe — actividad diaria, Surrender, second Procedure,
      // Schedules
    ],
  };

  // Strict typed format the Call schedule subsection's paragraphs are
  // SEEDED with — the user OVERWRITES the times. The CF parses these
  // with a strict regex (24h HH:MM). Per user direction 2026-06-29 (no
  // forms): teach the convention via the placeholder template rather
  // than via a time-picker widget.
  export const CALL_SCHEDULE_TEMPLATE = [
    'Morning — 06:30',
    'Evening — 20:00',
  ] as const;

  export function isOnboardingMode(searchParams: URLSearchParams | null | undefined): boolean {
    return searchParams?.get('mode') === 'onboarding';
  }
  ```

#### Step C.2 — `app/ritual-doc/[id]/page.tsx`

- **In-file location:** `samwise-app/app/ritual-doc/[id]/page.tsx`
- **Should not be modified:** the existing `getRitualDoc` call + `notFound()` + `metadata` export.
- **Code (extend the props passed to RitualDocEditor):**
  ```tsx
  // pass searchParams.mode through so the client component branches
  export default async function Page({
    params,
    searchParams,
  }: {
    params: Promise<{ id: string }>;
    searchParams: Promise<{ mode?: string; sealed?: string; from?: string }>;
  }) {
    const { id } = await params;
    const sp = await searchParams;
    const doc = await getRitualDoc(id);
    if (!doc) notFound();
    const serializable = { /* …existing serialization… */ };
    return (
      <RitualDocEditor
        id={id}
        initial={serializable as never}
        mode={sp.mode === 'onboarding' ? 'onboarding' : 'normal'}
        sealed={sp.sealed === '1'}
        fromTransition={sp.from === 'transition'}
      />
    );
  }
  ```

#### Step C.3 — `app/ritual-doc/[id]/RitualDocEditor.tsx`

- **In-file location:** `samwise-app/app/ritual-doc/[id]/RitualDocEditor.tsx`
- **Should not be modified:** the existing nav extraction, ImmerseToggle, beat-in animation wrapper, fullscreen state machine.
- **Action:** extend with three branches:
  1. When `mode === 'onboarding'`:
     - Replace `NAV` with the 3-item subset (Metadata · Ritual Call · Ritual).
     - Render `<OnboardingProgressStrip>` above the editor.
     - For EVERY tab in onboarding mode, pass `visibleH2s={ONBOARDING_VISIBLE_SUBSECTIONS[active]}` to `<EditorPane>` — the existing EditorPane filters its initial content to only the visible H2s (see Step C.4). The Metadata tab uses this mechanism too — it's still an `<EditorPane>`, just one with a filtered set of visible subsections.
     - On the Metadata tab specifically, render the inline `<VoicePillToggle>` above the editor (positioned right after the tab heading) — see Step C.5.
     - Render `<OnboardingSealButton>` below the editor when the active tab is Ritual.
  2. When `mode === 'onboarding' && sealed`, render `<OnboardingSuccessScreen>` full-bleed instead of the editor.
  3. When `fromTransition`, wrap the whole shell in a brief opacity fade-in (`useState` initially 0 → 1 on mount with 400ms transition).
- The existing full-editor path (no `?mode=`) is unchanged.

#### Step C.4 — `app/ritual-doc/[id]/EditorPane.tsx`

- **In-file location:** `samwise-app/app/ritual-doc/[id]/EditorPane.tsx`
- **Should not be modified:** the existing autosave, AbortController LIFO, prose classes, key={active} remount.
- **Action:** add an optional prop `visibleH2s?: readonly string[]`. Behaviour when provided:
  1. **On mount:** split the `initialContent` tiptap doc into two parts:
     - `visibleContent` — the H2 nodes whose text matches one of `visibleH2s`, plus their following nodes up to the next H2. This is what mounts in the editor.
     - `hiddenContent` — a Map<h2-text, JSONContent[]> of the OTHER H2s and their runs. Held in a ref; NOT shown to the user. Sourced from `initialContent` at mount time only.
  2. **On every `onUpdate` / autosave:** before calling `saveTab`, merge the editor's current JSON BACK INTO the original full document by rebuilding it in the original H2 order: walk the original H2 sequence, for each visible H2 take the edited content from the editor's current state, for each hidden H2 take the stashed content from `hiddenContent`. Save the merged result.
- **Why:** preserves the user's explicit instruction "keep them in the doc as empty scaffolding". If the hidden subsections were stripped on save, the full editor's later view would show only the visible 2 H2s — breaking the user's "more to shape later" promise. The merge ensures the saved doc always carries the full structure.
- **Edge case (accepted):** if a future agent or admin tool writes content into a hidden subsection WHILE the user is in onboarding mode, that content gets overwritten by the empty stash on the next save. Acceptable for v1 since no such writer exists today.
- **Implementation note:** pure JSONContent transforms, no ProseMirror plugin needed. The split-and-merge happens in JavaScript outside the editor's state. Tiptap's editor sees only the filtered visible content.

#### Step C.5 — `VoicePillToggle.tsx`

- **In-file location:** new file at `samwise-app/app/ritual-doc/[id]/VoicePillToggle.tsx`
- **Purpose:** the ONE non-Tiptap UI element in onboarding mode. A tiny two-pill toggle (Male | Female) rendered above the editor on the Metadata tab. Click sets the paragraph immediately after the "Voice" H2 to "male" or "female" via Tiptap editor commands. The cloud function regex-reads this paragraph at seal time.
- **Code:**
  ```tsx
  'use client';

  import type { Editor } from '@tiptap/react';

  // Inline pill toggle for the Voice subsection. The current value is
  // read from the Tiptap doc (the paragraph after the "Voice" H2), so
  // there's no separate state — the editor IS the source of truth.
  //
  // On click, sets that paragraph's content to 'male' or 'female' via
  // editor.commands. Autosave picks it up like any other edit.
  export function VoicePillToggle({ editor }: { editor: Editor | null }) {
    if (!editor) return null;

    const currentValue = readVoiceValue(editor);
    const setValue = (value: 'male' | 'female') => writeVoiceValue(editor, value);

    return (
      <div className="mb-4 flex items-center gap-2 text-xs text-muted-foreground">
        <span>Voice:</span>
        <Pill active={currentValue === 'male'} onClick={() => setValue('male')}>Male</Pill>
        <Pill active={currentValue === 'female'} onClick={() => setValue('female')}>Female</Pill>
      </div>
    );
  }

  function Pill({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
    return (
      <button
        type="button"
        onClick={onClick}
        className={`rounded-full border px-3 py-1 text-xs transition-colors ${
          active
            ? 'border-[var(--accent-gold)] bg-[var(--accent-gold)]/15 text-foreground'
            : 'border-border text-muted-foreground hover:border-foreground hover:text-foreground'
        }`}
      >
        {children}
      </button>
    );
  }

  // Walks the editor's JSON looking for the H2 "Voice" + the paragraph
  // immediately after; returns the paragraph's text trimmed-lowercased.
  function readVoiceValue(editor: Editor): 'male' | 'female' | null {
    const json = editor.getJSON();
    const content = json.content ?? [];
    for (let i = 0; i < content.length - 1; i++) {
      const node = content[i];
      if (node.type === 'heading' && node.attrs?.level === 2) {
        const text = (node.content ?? []).map((c) => c.text ?? '').join('').trim();
        if (text === 'Voice') {
          const next = content[i + 1];
          if (next?.type === 'paragraph') {
            const v = (next.content ?? []).map((c) => c.text ?? '').join('').trim().toLowerCase();
            if (v === 'male' || v === 'female') return v;
          }
          return null;
        }
      }
    }
    return null;
  }

  // Finds the paragraph after the Voice H2 and replaces its content with
  // the chosen value. Uses editor.commands.insertContentAt with a ranged
  // delete-replace; falls back to a no-op if the structure is unexpected
  // (defensive — the H2+paragraph should always be there from the seed).
  function writeVoiceValue(editor: Editor, value: 'male' | 'female') {
    // Implementation detail: walk doc positions, find the paragraph
    // after the Voice H2, replace its text content with the value.
    // Full code in implementation.
  }
  ```
- **Explanation:** stays inside the editor's state — no separate React state to sync. The click triggers an editor command, the editor's `onUpdate` fires, autosave kicks in. Aesthetic continuity: looks like a small label adornment, not a form widget.

#### Step C.6 — `OnboardingProgressStrip.tsx`

- **In-file location:** new file at `samwise-app/app/ritual-doc/[id]/OnboardingProgressStrip.tsx`
- **Action:** a slim horizontal bar at the top of the editor (above the tab heading) showing "1 of 3 · Metadata", "2 of 3 · Ritual Call", "3 of 3 · Ritual" depending on the active tab. Hairline gold underline marks active step. Click a step to jump to that tab.

#### Step C.7 — `OnboardingSealButton.tsx`

- **In-file location:** new file at `samwise-app/app/ritual-doc/[id]/OnboardingSealButton.tsx`
- **Action:** primary CTA "Seal my ritual" at the bottom of the Ritual tab. **Always enabled** — validation is the cloud function's job (returns a structured 400 with the missing field name, button shows the message inline). Rationale: with everything as Tiptap text, client-side "is this filled" detection requires parsing the doc, which the CF will do anyway. Simpler to let the CF be the validator.
- On click → POST `/api/ritual-doc/[id]/seal` → on success, `router.replace(`/ritual-doc/${id}?mode=onboarding&sealed=1`)` → success screen. On 400, surface the CF's error message ("Missing Phone number in Metadata", etc.) below the button.

#### Step C.8 — `OnboardingSuccessScreen.tsx`

- **In-file location:** new file at `samwise-app/app/ritual-doc/[id]/OnboardingSuccessScreen.tsx`
- **Action:** centered editorial layout. Fraunces-italic display headline **"Your ritual is alive."** + body line "Your first call is at [firstCallAt]." + a soft "Open it whenever you want to keep shaping." + a CTA "Open my ritual doc" that navigates to `/ritual-doc/[id]` (no query string → full editor).

### Phase D — Sealing API + backend cloud function

#### Step D.1 — `app/api/ritual-doc/[id]/seal/route.ts`

- **In-file location:** new file at `samwise-app/app/api/ritual-doc/[id]/seal/route.ts`
- **Code:**
  ```ts
  import { NextResponse } from 'next/server';

  export const runtime = 'nodejs';

  const REGISTER_RITUAL_FROM_TIPTAP_URL =
    process.env.REGISTER_RITUAL_FROM_TIPTAP_URL ??
    'https://registerritualfromtiptap-…-uc.a.run.app'; // fill in post-deploy

  export async function POST(
    _req: Request,
    { params }: { params: Promise<{ id: string }> },
  ) {
    const { id } = await params;
    try {
      const res = await fetch(REGISTER_RITUAL_FROM_TIPTAP_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ritualDocId: id }),
      });
      if (!res.ok) {
        const text = await res.text().catch(() => '');
        throw new Error(`Seal failed (${res.status}): ${text.slice(0, 200)}`);
      }
      const data = (await res.json()) as { ritualId: string; firstCallAt: string };
      return NextResponse.json(data);
    } catch (err) {
      console.error('seal forward failed:', err);
      return NextResponse.json({ error: err instanceof Error ? err.message : 'Seal failed' }, { status: 500 });
    }
  }
  ```

#### Step D.2 — `lib/ritual-doc/tiptap-to-markdown.ts`

- **In-file location:** new file at `samwise-app/lib/ritual-doc/tiptap-to-markdown.ts`
- **Action:** small pure function — takes a Tiptap JSONContent doc + the tab's display label → emits Markdown with `# {label}`, `## {h2 text}`, `### {h3 text}`, paragraph text + blank lines. Used both by the seal route (when serializing to send to the cloud function — but the CF re-reads from Firestore, so actually the CF owns the serialization) AND as a utility for debugging.
- **Decision:** the CF should own the serialization (since it has the source-of-truth Firestore read). This helper can live in samwise-app too for testing, OR live exclusively in the CF. **Recommendation:** put it ONLY in the CF (`samwise-backend/cloud-functions/functions/src/tiptap-to-markdown.ts`). The samwise-app version is removed from this step.

#### Step D.3 — `functions/src/registerRitualFromTiptap.ts` (NEW)

- **In-file location:** new file at `samwise-backend/cloud-functions/functions/src/registerRitualFromTiptap.ts`
- **Should not be modified:** `index.ts`'s existing `registerNewRitual` — parallel function, no edits to the existing path.
- **Action:** mirrors `registerNewRitual` closely but reads from Firestore instead of Google Docs. Key sub-pieces:
  ```ts
  // Pseudocode shape; full code in implementation
  export const registerRitualFromTiptap = onRequest((req, res) => {
    corsHandler(req, res, async () => {
      const { ritualDocId } = req.body as { ritualDocId: string };

      // 1. Read the source ritualDoc
      const docRef = db.collection('ritualDocs').doc(ritualDocId);
      const snap = await docRef.get();
      if (!snap.exists) return res.status(404).send({ error: 'ritualDoc not found' });
      const ritualDoc = snap.data()!;

      // 2. Serialize ALL 6 tabs from Tiptap → plain text (Markdown).
      //    Metadata tab is parsed for structured fields below; the 3
      //    synthesis tabs become the raw material for the prompt.
      const tabs = ritualDoc.tabs ?? {};
      const metadataMd     = serializeTiptapToMarkdown(tabs.metadata?.tiptap, 'Metadata');
      const ritualCallMd   = serializeTiptapToMarkdown(tabs.ritualCall?.tiptap, 'Ritual Call');
      const ritualMd       = serializeTiptapToMarkdown(tabs.ritual?.tiptap, 'Ritual');
      const behaviouralMd  = serializeTiptapToMarkdown(tabs.behaviouralPicture?.tiptap, 'Behavioural picture');

      // 3. Regex-extract structured Metadata fields from the Metadata
      //    tab's Markdown — same approach `registerNewRitual` uses on
      //    the Google Doc's Metadata tab today. Looks for the paragraph
      //    immediately after each H2 subsection.
      const extract = (h2: string) => extractH2Paragraph(metadataMd, h2);

      const name       = extract('Name');
      const language   = (extract('Language') ?? '').toLowerCase().startsWith('es') ? 'es' : 'en';
      const voiceWord  = (extract('Voice') ?? '').toLowerCase().trim() as 'male' | 'female';
      const phone      = extract('Phone number');
      const timeZone   = extract('Timezone') || 'UTC';

      // Per-field validation — surface specific missing fields so the
      // Seal button can show a useful error.
      const missing: string[] = [];
      if (!name)  missing.push('Name');
      if (!phone) missing.push('Phone number');
      if (voiceWord !== 'male' && voiceWord !== 'female') missing.push('Voice');
      if (missing.length) {
        return res.status(400).send({ error: `Please fill in: ${missing.join(', ')}` });
      }

      // Derive voiceID from (language, voice). Table mirrors
      // samwise-backend/ritual-agent/src/config/voiceIds.ts — hand-synced.
      const VOICE_ID_BY_LANG_GENDER: Record<'en' | 'es', Record<'male' | 'female', string>> = {
        en: { male: '5ee9feff-1265-424a-9d7f-8e4d431a12c7', female: '03496517-369a-4db1-8236-3d3ae459ddf7' },
        es: { male: '13ff5deb-2591-42ad-a356-63a04e524411', female: 'f4d6bb07-f876-4464-ba70-cd48d8701890' },
      };
      const voiceID = VOICE_ID_BY_LANG_GENDER[language][voiceWord];

      // userID = workspaceToken (the user's persistent identifier)
      const userID = ritualDoc.workspaceToken;
      if (!userID) return res.status(400).send({ error: 'ritualDoc missing workspaceToken' });

      // 4. Build the raw material for the synthesis prompt. Includes
      //    the trimmed-qualification subsections + schedule subsection
      //    inline as part of the Metadata Markdown — the synthesis
      //    prompt's Rule 10 will extract DAY_HH:MM schedules from
      //    whatever times the user wrote under "Call schedule".
      const rawMaterial = [
        metadataMd,
        '',
        ritualCallMd,
        '',
        ritualMd,
        '',
        behaviouralMd,
        '',
        `[NOTE: The user wants the call conducted in ${language === 'es' ? 'Spanish' : 'English'}.]`,
      ].join('\n');

      // 5. Call Gemini with the EXISTING synthesis prompt
      const prompt = SYNTHESIS_PROMPT.replace('[INSERT RAW USER INPUT HERE]', rawMaterial);
      const geminiOut = await callGeminiSynthesis(prompt); // same call site as registerNewRitual uses

      // 6. Schedules: parsed by STRICT REGEX from the Call schedule
      //    subsection's paragraphs (per user direction 2026-06-29 — no
      //    forms but strict typed convention, more reliable than
      //    Gemini Rule 10 over prose). The subsection was seeded with
      //    "Morning — 06:30" / "Evening — 20:00"; the user overwrote
      //    the times. We pull every paragraph under "Call schedule"
      //    that matches /(?:Morning|Afternoon|Evening|Night)\s+[—-]\s+(\d{1,2}):(\d{2})/,
      //    then expand to a weekly schedule (DAY_HH:MM for every day
      //    of the week). Synthesis's Rule-10-extracted schedules are
      //    ignored — this path is the source of truth.
      const scheduleParagraphs = extractH2ParagraphList(metadataMd, 'Call schedule');
      const parsedTimes = scheduleParagraphs
        .map((line) => /\b(\d{1,2}):(\d{2})\b/.exec(line))
        .filter((m): m is RegExpExecArray => m !== null)
        .map((m) => `${m[1].padStart(2, '0')}:${m[2]}`);
      if (parsedTimes.length === 0) {
        return res.status(400).send({
          error: 'Could not find any call times under "Call schedule". Please write times like "Morning — 06:30" and "Evening — 20:00".',
        });
      }
      const DAYS = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'];
      const schedules: string[] = [];
      for (const day of DAYS) {
        for (const time of parsedTimes) schedules.push(`${day}_${time}`);
      }

      // 7. Build RitualData (same shape as registerNewRitual produces)
      const ritualData = {
        agentConfig: {
          language,
          phoneNumber: phone,
          userInputs: geminiOut.userInputs,
          voiceID,
          userID,
        },
        fallbackSchedules: geminiOut.fallbackSchedules ?? [],
        fallbackActive: false,
        schedules, // regex-parsed from Call schedule subsection
        timeZone,
        userID,
        // tracking-workflow uses googleDocId as a map key in
        // user.ritualLabels (per-user.ts:142). For Tiptap-backed rituals
        // we reuse the field with the ritualDocId — same identifier
        // role, different upstream source. Avoids editing tracking-
        // workflow at all. Also keep a distinct ritualDocId field for
        // future "is this Tiptap-backed?" introspection.
        googleDocId: ritualDocId,
        googleDocsLink: '',
        ritualDocId,
        label: geminiOut.label ?? `${name}'s ritual`,
        behaviorLabel: geminiOut.behaviorLabel ?? 'this',
      };

      // 8. Write rituals/{newRitualId}
      const ritualRef = await db.collection('rituals').add(ritualData);

      // 9. Upsert users/{userID}
      await upsertUserDoc(ritualData, ritualRef.id);

      // 10. Mark the ritualDoc sealed (samwise-app side will read this
      //     to render the success screen)
      await docRef.update({
        sealedAt: FieldValue.serverTimestamp(),
        sealedRitualId: ritualRef.id,
      });

      // 11. Compute firstCallAt
      const firstCallAt = nextScheduledOccurrence(mergedSchedules, metadata.timeZone);

      res.status(200).send({ ritualId: ritualRef.id, firstCallAt: firstCallAt.toISOString() });
    });
  });
  ```
- **Explanation:** mirrors `registerNewRitual` step-by-step. Critical: the synthesis prompt is REUSED (not forked) — per the synthesis-prompt skill, the prompt's three load-bearing parts (rules / template / worked example) MUST stay in sync, and forking it for Tiptap input would create exactly the drift the skill warns against. We just feed differently-sourced raw material to the same prompt.
- **Open question for review:** the `googleDocId` field is mandated by the existing schema (and `registerNewRitual` uses it for the existing dedup mechanism). We're writing `''` for Tiptap-backed rituals + a new `ritualDocId` field. Need to verify the cron consumer (tracking-workflow) doesn't break on empty `googleDocId`. Quick grep of tracking-workflow before implementation.

#### Step D.4 — register the new function

- **In-file location:** `samwise-backend/cloud-functions/functions/src/index.ts`
- **Should not be modified:** existing exports, especially `registerNewRitual`.
- **Action:** add `export { registerRitualFromTiptap } from './registerRitualFromTiptap';` at the appropriate spot.

### Phase E — Landing rewire

#### Step E.1 — `app/page.tsx` — `handleStartClick` destination

- **In-file location:** `samwise-landing/app/page.tsx`
- **Should not be modified:**
  - The gold-star overlay code (lines ~355–392 — `overlay.animate(...)`, the gradient, the blur)
  - `setIsLeaving(true)`
  - The reduced-motion early-return shape
  - Anything visual on the page (per user direction "don't change the displayed front")
  - `handleDiscoverClick` (the second hero CTA)
  - `/qualify` route itself — kept alive for external/TikTok funnels
- **Action:** modify ONLY the three places that contain a navigation destination string:
  1. Line ~325 (reduced-motion early return): `router.push("/qualify")` → `window.location.href = startUrl()`
  2. Line ~331 (no .nav-star fallback): same swap
  3. Line ~388 (the timed navigation at t=525ms inside the overlay path): `router.push("/qualify")` → `window.location.href = startUrl()`
- And modify the two `<a href="/qualify"` attributes (nav at line ~455, hero at line ~480):
  - `<a href="/qualify"` → `<a href={startUrl()}`
- Add a helper at module scope:
  ```ts
  // Cross-origin destination for the inverted onboarding flow. Reads
  // NEXT_PUBLIC_SAMWISE_APP_URL (falls back to localhost in dev).
  // `?from=transition` is the signal flag — the receiving app reads it
  // and runs its own opacity fade-in to mask the cross-origin white
  // flash (the gold-star transition's overlay is in this document and
  // cannot survive cross-origin navigation).
  const APP_URL = process.env.NEXT_PUBLIC_SAMWISE_APP_URL ?? 'http://localhost:3000';
  const startUrl = () => `${APP_URL}/start?from=transition`;
  ```
- **CRITICAL:** for the `window.location.href` swap on the overlay path, keep the same `setTimeout(..., GLOW_DURATION_MS * 0.35)` timing so the navigation fires at the gold's peak — same UX as today. The only difference is `router.push` (SPA) → `window.location.href` (cross-origin) — the latter doesn't return a Promise but the visual sequencing is identical.
- **Drop the sessionStorage flag** (lines ~341–346): it was for `/qualify`'s `useEffect` to read on mount. Cross-origin navigation makes sessionStorage unavailable to the receiving app. Replaced by the `?from=transition` URL param. Comment the lines with `// removed 2026-06-29 — cross-origin nav can't share sessionStorage; signal moved to URL param`.

#### Step E.2 — Optimization: preconnect to app.samwise.life

- **In-file location:** `samwise-landing/app/layout.tsx` (the root layout)
- **Action:** add `<link rel="preconnect" href={APP_URL} />` and `<link rel="dns-prefetch" href={APP_URL} />` to the `<head>` so the cross-origin handshake is warm by the time the user clicks Start Now. Reduces the white flash by ~50-150ms on cold loads.

### Testing phase

#### Local test (samwise-app + samwise-landing)

1. `cd samwise-app && pnpm dev` (port 3000); separate terminal `cd samwise-landing && pnpm dev` (port 3001).
2. Set `NEXT_PUBLIC_SAMWISE_APP_URL=http://localhost:3000` in `samwise-landing/.env.local`.
3. Visit `localhost:3001`. Click Start Now in nav OR in hero. Observe: gold-star animation fires; at t=525ms cross-origin nav to `localhost:3000/start?from=transition`.
4. Assert: `/start` renders "Preparing your ritual…" briefly, then redirects to `/ritual-doc/<id>?mode=onboarding&from=transition`.
5. Editor opens in onboarding mode: only Metadata · Ritual Call · Ritual visible in nav rail; step-progress strip shows "1 of 3 · Metadata"; Metadata tab is the form (not Tiptap).
6. Fill Name, pick language en, gender male, fake phone, accept default timezone, behaviour_to_change, core_motivation, schedules.
7. Switch to Ritual Call tab. Editor shows the 4 beats H2. Type a line under each.
8. Switch to Ritual tab. Editor shows ONLY Mantras de desidentificación + Generación de bloqueador. Type under each. Seal button is visible at the bottom.
9. Click Seal. POST hits cloud function. Success screen shows "Your first call is at <time>." Click "Open my ritual doc" → full editor with all 6 tabs visible.
10. Open Firestore console (arbor-2026): assert `ritualDocs/<id>` has `sealedAt` set, `sealedRitualId` populated; `rituals/<newId>` has agentConfig + schedules + userInputs; `users/<workspaceToken>` has ritualLabels entry.
11. Reset: in browser console `localStorage.removeItem('samwise.ritual.workspaceToken')` + reload `/start` → fresh ritualDoc minted.

#### Integration test (cloud function locally)

1. `cd samwise-backend/cloud-functions/functions && pnpm serve` (firebase emulator).
2. Override `REGISTER_RITUAL_FROM_TIPTAP_URL` env in samwise-app to the emulator's URL.
3. Walk through the seal flow above. Verify the synthesis prompt actually runs against Gemini (check function logs for `userInputs` length, schedules array, behaviorLabel).
4. Read the resulting `rituals/{id}.agentConfig.userInputs` — it should be a filled `<user-inputs>` XML matching the existing format (per `ritual-synthesis-prompt` skill, audit against the 10-rules checklist).

#### Update READMEs / context files

- `samwise-app/context-for-code-agent.md`: add the new routes (`/start`, `/api/ritual-doc/create-for-workspace`, `/api/ritual-doc/[id]/seal`) + the new lib files; new Recent Changes entry dated 2026-06-29 describing inverted onboarding.
- `samwise-backend/cloud-functions/functions/README.md` (if exists): document the new `registerRitualFromTiptap` function + its env vars + its parallel relationship to `registerNewRitual`.
- `samwise-landing/context-for-code-agent.md`: note Start Now CTAs cross-origin to app.samwise.life/start as of 2026-06-29; sessionStorage flag retired in favor of `?from=transition` URL param.

### After implementation

- Update the three context files above.
- Mark the task DONE in master Vibe doc (manual user step).
- **Commit messages, one per repo:**
  - `samwise-app`: `feat: inverted onboarding — /start route, onboarding-mode editor (3 tabs, form metadata, seal button, success screen)`
  - `samwise-backend`: `feat: registerRitualFromTiptap cloud function — seals Tiptap-backed rituals via same synthesis prompt`
  - `samwise-landing`: `chore: re-point Start Now CTAs to app.samwise.life/start (cross-origin, preserves gold-star transition)`

## Decisions locked (was "Open questions" before 2026-06-29 review)

- **No forms anywhere.** Every captured value is Tiptap text under a labeled H2 subsection. Samuel (or a future agent) verbally guides what to type where. ONE exception: a tiny inline Male | Female pill toggle above the Voice H2 in the Metadata tab.
- **Hidden subsections / hidden tabs:** preserved in the saved Tiptap doc as empty scaffolding (per user: "keep them in the doc"). EditorPane split-and-merge mechanism (Step C.4) preserves hidden content across saves.
- **Success screen copy:** "Your ritual is alive. / Your first call is at [time]. / Open it whenever you want to keep shaping."
- **Firestore composite index** `(workspaceToken ASC, sealedAt ASC)`: accept and document. Add to `firestore.indexes.json`.
- **Landing preconnect:** add 2 `<link>` tags (preconnect + dns-prefetch) to `samwise-landing/app/layout.tsx`. Non-visual, canonical edit accepted.
- **Call schedule:** strict typed convention rather than free prose. The Call schedule subsection is seeded with placeholder paragraphs ("Morning — 06:30" / "Evening — 20:00") that the user OVERWRITES. The CF regex-parses 24h HH:MM with a strict pattern. No time pickers. (Per Step D.3 and `CALL_SCHEDULE_TEMPLATE` in schema.ts.)
- **Samuel-notification on /start:** mirror /qualify's existing pattern. When `/api/ritual-doc/create-for-workspace` mints a NEW (not idempotent-returned) ritualDoc, fire a best-effort `notifySamuelOfOnboardingStart` via `samwise-app/lib/notify/samuel.ts` (adds a new method alongside `notifySamuelOfQualifyStart` / `notifySamuelOfBooking`). Writes to `mail/` collection; uses Firebase Trigger Email extension as today. Best-effort: never blocks the route.
- **Returning user (token has prior sealed doc) clicks Start Now:** mint a NEW unsealed ritualDoc. `createRitualDocForWorkspace`'s idempotency is per-(token, UNSEALED-only) — sealed docs do NOT block a fresh start. Existing sealed rituals remain accessible at their direct `/ritual-doc/[id]` URL (the user keeps that link or re-discovers via their workspace token's user doc).

## Pre-implementation verification (I'll do these before writing code)

- **Grep tracking-workflow** for `googleDocId` to confirm it doesn't break when empty. If it does, add a thin coalesce (`googleDocId || ritualDocId`) in the cron's resolver rather than special-casing in the new CF.
- **Confirm `firestore.indexes.json`** location in the arbor-2026 project (or the equivalent for our deploy pipeline). Add the composite index there.
- **Confirm `NEXT_PUBLIC_SAMWISE_APP_URL`** is set on samwise-landing's Vercel project (it should be — used by /qualify's `/api/notify/qualify-start` proxy per memory `reference_landing_no_firestore_admin_notify`).
- **Confirm the synthesis prompt's Rule 10** accepts schedules from prose text like "Morning: 6:30am". The skill's worked example uses similar language so this should work, but worth a one-shot Gemini test before committing to the design.
