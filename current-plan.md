# current-plan.md — Onboarding mode in /copilot (frontend)

> Overwrites the previous plan ("/ritual-call + Update ritual button" — shipped, separate task in the master Vibe doc).
> Neurotic-implementer rules in force. Minimal-changes-only mandate: nothing in the demo-mode path moves unless it is strictly necessary to make onboarding mode coexist.
> Backend half lives in `samwise-backend/cloud-functions/current-plan.md`. The two plans are siblings — both must ship for /copilot to work in onboarding mode.

## Plan Summary

Extend /copilot to render the **onboarding** script as a first-class second mode, sitting beside the existing demo mode. The script Doc is the new onboarding script (`1FrglmnZGDlFS7S89LgaKjKpDiRLEPGxkAYtOomjT08E`) carrying `[TYPE: onboarding]`.

Three load modes — clinician picks one per session:
1. **Firestore by email** → look up most recent `demoCalls` doc for that prospectKey via a new `loadDemoCall` CF; hydrate matching onboarding variables.
2. **Google Doc URL** → CF + Gemini reads any doc the clinician points at (demo transcript, intake notes, anything) and extracts the onboarding variable set.
3. **Manual** → clinician types into the variables panel directly. (No prefill click; the default state.)

Three save modes — clinician picks any subset at end of session:
1. **Firestore** → writes to `onboardingSessions/${prospectKey}-${Date.now()}` via new `extractOnboarding` CF. Mirrors `extractDemoCall` rep_state mode.
2. **Google Doc URL** → clinician pastes a Doc URL at save time, CF appends the cleaned notes block to that doc.
3. **Clipboard** → pure-client formatter dumps the cleaned values as markdown for paste-anywhere.

The branching driver is `scriptType: "onboarding"` returned by the existing `loadCallScript` CF (it already detects this from `[TYPE: onboarding]` — no backend change to script load). The frontend rejection in `app/copilot/page.tsx` is lifted in favor of a config-router.

## Plan Architecture (Flow)

```
                    ┌─────────────────────────────────────────────┐
                    │ /copilot page.tsx — scriptType router       │
                    └───┬─────────────────────────┬───────────────┘
                        │                         │
              scriptType=demo              scriptType=onboarding
                        │                         │
                ┌───────▼──────┐         ┌────────▼─────────────┐
                │ demo-call-   │         │ onboarding-call-     │
                │ config.ts    │         │ config.ts (NEW)      │
                │ (unchanged)  │         │                      │
                └──────────────┘         └──────────────────────┘
                                                  │
                ┌─────────────────────────────────┴──────────────┐
                │                                                │
        ┌───────▼──────────┐                          ┌──────────▼──────────┐
        │ Prefill row      │                          │ Save row            │
        │ (NEW component)  │                          │ (NEW component)     │
        ├──────────────────┤                          ├─────────────────────┤
        │ Firestore email→ │                          │ Firestore           │
        │   loadDemoCall   │                          │   extractOnboarding │
        │ Doc URL →        │                          │ Doc URL →           │
        │   extractOnboar- │                          │   writeOnboarding-  │
        │   dingFromDoc    │                          │   ToDoc             │
        │ Manual (no-op)   │                          │ Clipboard (client)  │
        └──────────────────┘                          └─────────────────────┘
```

All three NEW cloud functions live in cloud-functions; the frontend speaks to them via thin `lib/copilot/*.ts` wrappers (mirrors existing demo path).

## Plan Structure (Directories and files)

**NEW:**
- `app/copilot/onboarding-call-config.ts` — variable set, `frameworkSemantics`, phase metadata for onboarding.
- `app/copilot/onboarding-prefill-row.tsx` — three-mode prefill UI (Firestore email | Doc URL | Manual).
- `app/copilot/onboarding-save-row.tsx` — three-mode save UI with checkboxes (Firestore | Doc URL | Clipboard).
- `lib/copilot/load-demo-call.ts` — wrapper for new `loadDemoCall` CF (Firestore-by-email).
- `lib/copilot/load-from-doc.ts` — wrapper for new `extractOnboardingFromDoc` CF.
- `lib/copilot/save-onboarding.ts` — wrapper for new `extractOnboarding` CF.
- `lib/copilot/save-to-doc.ts` — wrapper for new `writeOnboardingToDoc` CF.
- `lib/copilot/copy-to-clipboard.ts` — pure-client markdown formatter + `navigator.clipboard.writeText`.
- `lib/copilot/prefill-from-demo-call.ts` — pure helper that takes a `DemoCallDoc` and writes into `SessionState` (mirrors `prefill-from-qualification.ts`).
- `lib/copilot/prefill-from-doc-extraction.ts` — pure helper that takes the doc-extracted payload and writes into `SessionState`.

**EDITED:**
- `app/copilot/page.tsx`:
  - Lift the `scriptType !== "demo"` rejection.
  - Branch on `loaded.scriptType`: render `<QualifyPrefillRow>` + demo config when `demo`; render `<OnboardingPrefillRow>` + onboarding config when `onboarding`.
  - Swap Save button: render `<OnboardingSaveRow>` (the multi-target one) when in onboarding mode.
- `lib/copilot/session-storage.ts`:
  - Bump key from `copilot:session:v4` → `v5` and namespace by `scriptType` (`copilot:session:v5:demo` / `copilot:session:v5:onboarding`) so loading two different docs in the same browser doesn't bleed state.
- `lib/copilot/append-row.ts`: NO CHANGE. Demo Save path stays as-is.
- `app/copilot/copilot-surface.tsx`: NO CHANGE if it already accepts the variables-config as a prop. If it hardcodes `DEMO_CALL_VARIABLES`, add a `variables` prop and thread through (one-line change site each).

**UNCHANGED (load-bearing):**
- `app/copilot/variables-table.tsx` — accepts `variables` via prop already.
- `app/copilot/script-pane.tsx` — type-agnostic.
- `app/copilot/demo-call-config.ts`.
- `lib/copilot/clean-variable.ts`, `lib/copilot/suggest-rep-line.ts`, `lib/copilot/load-script.ts`.

## Modifications (in phases and steps)

### Phase 0 — Pre-flight (manual)

The user must:
1. Confirm backend plan (`samwise-backend/cloud-functions/current-plan.md`) before any frontend lib wrappers can compile (they import URL constants).
2. After backend deploy, paste the deployed CF URLs into the wrapper files (same convention as `loadqualification-b6fhjlgejq-uc.a.run.app`).

### Phase 1 — `onboarding-call-config.ts` (NEW)

- **In-file location:** `app/copilot/onboarding-call-config.ts`.
- **Should not be modified:** `demo-call-config.ts`, `DemoCallVariable` interface — REUSE the interface; do not fork.
- **Code (sketch):**
  ```ts
  import type { DemoCallVariable } from "./demo-call-config";

  export const DEFAULT_ONBOARDING_DOC_URL =
    "https://docs.google.com/document/d/1FrglmnZGDlFS7S89LgaKjKpDiRLEPGxkAYtOomjT08E/edit";

  export const ONBOARDING_VARIABLES: DemoCallVariable[] = [
    // pre-session (from demo) — phase: "pre-call"
    { name: "behaviour_to_change", phase: "pre-call", inputKind: "textarea", cleanable: true, frameworkSemantics: "..." },
    { name: "behaviour_example", phase: "pre-call", inputKind: "textarea", cleanable: true, frameworkSemantics: "..." },
    { name: "core_motivation", phase: "pre-call", inputKind: "textarea", cleanable: true },
    // ... (full set per the rewritten script's variable reference section)
    // phase 2-4
    { name: "problem_start_timeline", phase: "2", inputKind: "textarea", cleanable: true },
    // ...
    { name: "framework_metaphor", phase: "3", inputKind: "select", options: ["gripa", "enemy", "other"], cleanable: false },
    // ...
    { name: "enemy_name", phase: "4a", inputKind: "text", cleanable: true },
    // ...
    // phase 9 — `[CONDITION:]` driver
    { name: "unsettling_reality", phase: "9", inputKind: "textarea", cleanable: true },
    // ...
    { name: "daily_activity_time_slot", phase: "12b", inputKind: "text", cleanable: false, defaultValue: "" },
    // ...
  ];

  export const ONBOARDING_FUNNEL_COLUMNS = [...]; // for parity with FUNNEL_SHEET_COLUMNS pattern (used by writeOnboardingToDoc for column order)
  ```
- **Explanation:** Mirror exactly what `demo-call-config.ts` does — reuse `DemoCallVariable` (DO NOT introduce an `OnboardingCallVariable` interface; the demo skill calls out reuse). Each variable gets `frameworkSemantics` per the synthesis-prompt skill Rule 7. Variables list = the Quick-variable-reference section at the bottom of the rewritten script.

### Phase 2 — `lib/copilot/load-demo-call.ts` (NEW)

- **In-file location:** `samwise-app/lib/copilot/load-demo-call.ts`.
- **Code (sketch):**
  ```ts
  const LOAD_DEMO_CALL_URL = "https://loaddemocall-XXXX-uc.a.run.app"; // FILL after backend deploy

  export interface DemoCallDoc { prospectKey: string; cleaned: Record<string, string>; raw: Record<string, string>; createdAt: number; }

  export async function loadDemoCall(identifier: string): Promise<DemoCallDoc | null> {
    const res = await fetch(LOAD_DEMO_CALL_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ identifier }),
      cache: "no-store",
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data?.demoCall ?? null;
  }
  ```
- **Explanation:** Thin wrapper. Same shape as `lib/copilot/load-qualification.ts`. Returns `null` on miss/error so the caller can toast cleanly.

### Phase 3 — `lib/copilot/prefill-from-demo-call.ts` (NEW)

- **In-file location:** `samwise-app/lib/copilot/prefill-from-demo-call.ts`.
- **Code (sketch):**
  ```ts
  import type { DemoCallVariable } from "../../app/copilot/onboarding-call-config";
  import type { DemoCallDoc } from "./load-demo-call";
  import type { SessionState } from "./session-storage";

  // Name-for-name mapping demo→onboarding. Mirrors QUALIFICATION_TO_DEMO_FIELDS in page.tsx.
  export const DEMO_TO_ONBOARDING_FIELDS = [
    "behaviour_to_change", "behaviour_example", "core_motivation", "life_stage_context",
    "problem_duration_self_reported", "symbolic_anchor_description", "alternatives_tried",
    "why_alternatives_failed", "feelings_during_relapse", "intention_behind_action",
    "thoughts_during_relapse", "self_talk_after_relapse", "view_of_their_life_in_that_moment",
    "consequences_for_them", "grado_de_identificacion", "clinical_picture_description",
    "biologic_symbolic_analogy", "self_destructive_behaviour",
  ];

  export function prefillFromDemoCall(args: {
    demoCall: DemoCallDoc;
    variables: DemoCallVariable[];
    setState: (s: SessionState) => void;
    state: SessionState;
    cleanCallback: (name: string, raw: string, otherVars: Record<string, string>) => void;
  }) {
    // 1. Build fresh state (mirrors handleLoadQualification reset-before-fill, page.tsx).
    // 2. Write matching fields.
    // 3. Commit, then fire cleaning per cleanable var.
  }
  ```
- **Explanation:** Mirrors `prefill-from-qualification.ts` exactly. Reset-before-fill (per session-copilot skill section 0).

### Phase 4 — `lib/copilot/load-from-doc.ts` + `lib/copilot/prefill-from-doc-extraction.ts` (NEW)

- **Code (sketch — load-from-doc.ts):**
  ```ts
  const EXTRACT_ONBOARDING_FROM_DOC_URL = "https://extractonboardingfromdoc-XXXX-uc.a.run.app";

  export interface DocExtractionPayload { extracted: Record<string, string>; sourceDocId: string; }

  export async function extractOnboardingFromDoc(docLink: string): Promise<DocExtractionPayload | null> {
    const res = await fetch(EXTRACT_ONBOARDING_FROM_DOC_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ googleDocLink: docLink }),
      cache: "no-store",
    });
    if (!res.ok) return null;
    return res.json();
  }
  ```
- **`prefill-from-doc-extraction.ts`** — pure helper, mirrors `prefill-from-demo-call.ts` but takes the extraction payload shape.

### Phase 5 — `app/copilot/onboarding-prefill-row.tsx` (NEW)

- **Code (sketch):**
  ```tsx
  type Mode = "firestore" | "doc" | "manual";

  export function OnboardingPrefillRow({ script, state, setState, variables, cleanCallback }: Props) {
    const [mode, setMode] = useState<Mode>("firestore");
    const [identifier, setIdentifier] = useState("");      // email/phone/name
    const [docLink, setDocLink] = useState("");
    const [loading, setLoading] = useState(false);

    async function handleLoad() {
      setLoading(true);
      if (mode === "firestore") {
        const demoCall = await loadDemoCall(identifier);
        if (demoCall) prefillFromDemoCall({ demoCall, variables, setState, state, cleanCallback });
        else toast.error("No demo call on file for this prospect");
      } else if (mode === "doc") {
        const payload = await extractOnboardingFromDoc(docLink);
        if (payload) prefillFromDocExtraction({ payload, variables, setState, state, cleanCallback });
        else toast.error("Could not extract from doc");
      }
      // mode === "manual" → no-op
      setLoading(false);
    }

    return (
      <div className="space-y-2 rounded-md border p-3">
        <div className="text-sm font-medium">Pre-fill onboarding session</div>
        <RadioGroup value={mode} onValueChange={setMode}>
          <RadioGroupItem value="firestore" label="From Firestore (email)" />
          <RadioGroupItem value="doc" label="From Google Doc URL" />
          <RadioGroupItem value="manual" label="Manual" />
        </RadioGroup>
        {mode === "firestore" && <Input value={identifier} onChange={e => setIdentifier(e.target.value)} placeholder="prospect@email.com" />}
        {mode === "doc" && <Input value={docLink} onChange={e => setDocLink(e.target.value)} placeholder="https://docs.google.com/document/d/..." />}
        {mode !== "manual" && <Button onClick={handleLoad} disabled={loading}>Load</Button>}
      </div>
    );
  }
  ```
- **Explanation:** Three radio options. "manual" hides the input + button entirely. UI primitives reuse shadcn `RadioGroup`/`Input`/`Button` already present in the app.

### Phase 6 — `lib/copilot/save-onboarding.ts` + `save-to-doc.ts` + `copy-to-clipboard.ts` (NEW)

- **`save-onboarding.ts`** — POST to new `extractOnboarding` CF, body `{ raw, cleaned, prospectKey }`. Mirrors `append-row.ts`.
- **`save-to-doc.ts`** — POST to new `writeOnboardingToDoc` CF, body `{ googleDocLink, cleaned, scriptPhases }`.
- **`copy-to-clipboard.ts`** — pure client:
  ```ts
  export function copyOnboardingNotes(args: { cleaned: Record<string, string>; variables: DemoCallVariable[]; }) {
    const md = renderAsMarkdown(args.cleaned, args.variables); // group by phase, "- {name}: {value}"
    return navigator.clipboard.writeText(md);
  }
  ```

### Phase 7 — `app/copilot/onboarding-save-row.tsx` (NEW)

- **Code (sketch):** three checkboxes (Firestore | Doc URL | Clipboard), optional Doc URL input if the Doc checkbox is checked, one "Save" button that fires all selected destinations in parallel and toasts per-destination success.
- **Explanation:** Checkbox semantics (not radio) — the clinician can save to all three at once.

### Phase 8 — `app/copilot/page.tsx` edits

- **In-file location:** `app/copilot/page.tsx`.
- **Should not be modified:** The qualification-load path. The localStorage restore. The scroll sync.
- **Edits:**
  1. Remove the `scriptType !== "demo"` rejection block.
  2. Compute `const variables = loaded.scriptType === "onboarding" ? ONBOARDING_VARIABLES : DEMO_CALL_VARIABLES;` once after script load.
  3. Branch the top-of-pane render:
     ```tsx
     {loaded.scriptType === "demo"
       ? <QualifyPrefillRow script={loaded} state={state} setState={setState} />
       : <OnboardingPrefillRow script={loaded} state={state} setState={setState} variables={variables} cleanCallback={cleanCallback} />}
     ```
  4. Branch the save button at the bottom:
     ```tsx
     {loaded.scriptType === "demo"
       ? <DemoSaveButton ... />
       : <OnboardingSaveRow cleaned={state.cleaned} raw={state.raw} variables={variables} />}
     ```
  5. Thread `variables` into `<CopilotSurface>` (or `<VariablesTable>` directly if that's the prop site).

### Phase 9 — `lib/copilot/session-storage.ts` edits

- Bump v4 → v5.
- Key is now `copilot:session:v5:${scriptType}` so demo + onboarding sessions persist independently.
- Mount-restore reads the key matching the just-loaded `scriptType`.

### Testing phase

- **Local test (manual, no e2e):**
  1. `npm run dev` in samwise-app.
  2. Open /copilot, paste the onboarding Doc URL, click load.
  3. Verify: scriptType returns `"onboarding"`, phases render, `[CONDITION: grado_de_identificacion=high]` block in Phase 9 toggles correctly when the variable is set.
  4. Prefill mode A: enter a real prospect's email → variables panel hydrates from demoCall. Spot-check 3 fields.
  5. Prefill mode B: paste a Google Doc URL with onboarding-relevant notes → variables hydrate from LLM extraction. Spot-check.
  6. Prefill mode C: refresh page, choose "Manual" → no auto-fill, panel stays empty.
  7. Save mode A: click Save with Firestore checked → `onboardingSessions/${prospectKey}-${ts}` written. Verify via Firebase console.
  8. Save mode B: paste a Doc URL → append notes to that doc. Verify in Drive.
  9. Save mode C: click Save with Clipboard checked → paste into a text editor, verify markdown.
- **Integration test:** N/A — exercised via the local test against deployed CFs.
- **Update README:** N/A.

### After implementation

- Update `samwise-app/context-for-code-agent.md` "Module Structure" section to list the new files.
- Update `samwise-session-copilot` skill (in `Documents/samwise/.claude/skills/`) — section 8 "Demo Call only in v1" → flip to "Demo + Onboarding"; add the new prefill/save pattern.
- Mark task DONE in master Vibe doc Projects tab (manual user step).
