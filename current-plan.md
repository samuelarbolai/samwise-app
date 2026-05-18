# current-plan.md — Session-copilot platform (`/copilot`)

## Plan Summary

Build a new route in samwise-app (`/copilot`) that helps a rep run a **Demo Call** (formerly Compatibility & Welcome Call). Two panes, no video:

- **Variables pane (left):** ~32-row table of variables. Each row has a raw-note input and an LLM-cleaned form. The cleaned form is what the script substitutes; the raw note is the rep's messy in-the-moment capture.
- **Script pane (right):** all phases of the Demo Call script visible at once, scrollable. `{{variable}}` placeholders substitute live from the cleaned-form map. Empty placeholders render greyed-out so the rep can spot gaps inside the actual script flow.

### Three deliberate design decisions, encoded so future-me does not relitigate them

1. **No video iframe.** The cal.com room stays in another window or monitor. The copilot is a side-panel that collapses Script + Sheet into one tab. (We rejected embedding cal.com's meeting iframe because cal.com may block it via X-Frame-Options at any moment, and the rep onboarding already accepts a multi-window workflow.)
2. **The LLM denoises — it does not generate.** Per phase the script is a literal template the rep wrote. A per-field Gemini call cleans the rep's raw note into a substitutable phrase. The Demo script's rule #4 ("read the script literally, don't ad-lib") is preserved verbatim. Cleaning is debounced (1.5s after stop typing), per-field cached, falls back to the raw note on error.
3. **Persistence = funnel Google Sheet.** No Firestore collection. The funnel sheet (`1YS0ZVjB3rZK_AZKMeCbBbD__Mvz91lWXAqHcIBt0Cmw`) is already the source of truth for comp-call rows. One cloud function appends a row at end of call. localStorage covers in-call autosave so refresh/crash never loses work.

### Explicitly out of scope (one sentence each, do not plan)

- **AI rep agent.** The captured rows will feed a future agent, but the agent is its own planning round once we have real call data.
- **Cal.com webhook auto-create.** v1 starts sessions manually (rep_name + prospect_name are just the first two table rows).
- **Other sessions** (Onboarding, Call Design, Optimization). `loadCallScript` returns a `scriptType` so adding them later is frontend-only work.
- **Auth.** No rep auth; `rep_name` is a free-text dropdown of known reps in `demo-call-config.ts`.
- **Variable list as a dynamic schema.** Variables and their metadata live hardcoded in `demo-call-config.ts`. Script *text* is loaded from the canonical Demo script Google Doc.

### Three new cloud functions, all in existing `samwise-backend/cloud-functions/functions/src/index.ts`

| Function | Body in | Body out | Purpose |
|---|---|---|---|
| `loadCallScript` | `{ googleDocLink }` | `{ scriptType, phases: [{ number, title, text }] }` | Drive fetch + Gemini parse into structured phases. Mirrors `registerNewRitual`'s shape. |
| `cleanVariable` | `{ name, meaning, verbatim, rawValue }` | `{ cleaned }` | Per-field denoising. Falls back to `rawValue` on error. |
| `appendDemoCallRow` | `{ row }` | `{ ok, rowNumber }` | Sheets API `values.append` on the comp-call tab. Cleaned values only. |

All three reuse the existing Drive client / Gemini key (`GEMINI_KEY`) / service-account auth (`GOOGLE_APPLICATION_CREDENTIALS`) / CORS / `requireEnv` patterns.

## Plan Architecture (Flow)

1. Rep opens `/copilot`.
2. Doc URL input is pre-filled with the canonical Demo script URL from `demo-call-config.ts`. Rep can override (e.g. when iterating on the script in a fork).
3. Rep clicks **"Load script"**. `loadCallScript` fetches the Doc, Gemini parses it into `{ scriptType, phases }`. If `scriptType !== "demo"`, frontend shows a toast: *"Only Demo Call scripts are supported in v1."*
4. Two-pane UI renders. Variables table on the left, script on the right.
5. Variables table renders rows in phase order from `demo-call-config.ts`. `rep_name` and `prospect_name` are the first two rows (no gate screen).
6. Rep types raw notes per field. Every keystroke autosaves to localStorage under `copilot:session:v1`.
7. 1.5s after the rep stops typing in a field, `cleanVariable` fires. While in flight, that field shows a "↻ cleaning…" indicator. Result populates the cleaned form. New keystrokes cancel the in-flight call.
8. The script pane re-renders on every cleaned-form change, substituting `{{var}}` slots from the cleaned-form map. Empty placeholders render greyed-out and italic.
9. Rep can click any cleaned form to manually edit it (overrides the LLM's output). The script substitutes the manual edit thereafter.
10. End of call: rep clicks **"Save to funnel sheet"**. `appendDemoCallRow` writes a row with the cleaned values in the column order of the comp-call sheet header. On success: toast, clear localStorage for this session, redirect to fresh `/copilot`.

## Plan Structure (Directories and files)

```
samwise-app/
├── app/
│   ├── copilot/
│   │   ├── page.tsx                  # NEW: route entry, URL gate, two-pane shell
│   │   ├── variables-table.tsx       # NEW: capture pane
│   │   ├── script-pane.tsx           # NEW: phases + substitution
│   │   └── demo-call-config.ts       # NEW: variable metadata + default script URL
│   ├── page.tsx                      # MODIFIED: add /copilot to sidebar
│   └── layout.tsx                    # UNCHANGED
└── lib/
    └── copilot/                      # NEW directory
        ├── load-script.ts            # NEW: client wrapper for loadCallScript
        ├── clean-variable.ts         # NEW: client wrapper w/ debounce + cache + abort
        ├── append-row.ts             # NEW: client wrapper for appendDemoCallRow
        └── session-storage.ts        # NEW: localStorage autosave + restore

samwise-backend/cloud-functions/functions/src/
├── index.ts                          # MODIFIED: 3 new exports
├── load_call_script_prompt.txt       # NEW: Gemini prompt, read at module load
└── package.json                      # UNCHANGED (googleapis + @google/generative-ai already deps)
```

The cloud-functions side has its own sub-plan at `samwise-backend/cloud-functions/functions/src/current-plan.md`. This file specifies only the frontend phases plus the **contracts** of the three new endpoints. The implementer of either side reads both files.

---

## Modifications (in phases and steps)

### Phase 1 / Step 1 — `app/copilot/demo-call-config.ts`

- **In-file location:** new file at `samwise-app/app/copilot/demo-call-config.ts`.
- **Should not be modified:** nothing yet.
- **Code:**

```ts
// =====================================================================
// Demo Call config: variable list + per-variable metadata + default
// script Doc URL.
//
// Variable metadata is hardcoded here (not loaded from anywhere) for
// two reasons:
//   1. It rarely changes — script text iterates often, variables don't.
//   2. UI affordances (select options, verbatim flag, input kind) don't
//      exist in the script Doc or funnel sheet in a parseable form.
//
// Source of truth for the variable list and its phase column:
//   https://docs.google.com/spreadsheets/d/1YS0ZVjB3rZK_AZKMeCbBbD__Mvz91lWXAqHcIBt0Cmw
//   (the metadata table at the bottom).
// =====================================================================

export type DemoCallPhase =
  | "pre-call"
  | 2
  | 3
  | 5
  | 7
  | 8
  | 10
  | "post-call";

export type InputKind = "text" | "textarea" | "select" | "number" | "date";

export interface DemoCallVariable {
  name: string;
  label: string;
  phase: DemoCallPhase;
  meaning: string;          // from funnel sheet's `what_it_means`
  inputKind: InputKind;
  options?: string[];       // for select fields
  verbatim?: boolean;       // light-touch cleaning, preserve exact wording
  cleanable?: boolean;      // false for select / number / date — no LLM call
}

// Pre-filled default Doc URL — the canonical v0.3 Demo script.
// The rep can override this in the URL input at /copilot.
export const DEFAULT_DEMO_SCRIPT_DOC_URL =
  "https://docs.google.com/document/d/1hntQClh8TUUVYOw148sFGRhy33JqtleuvI5BC8rM4eg/edit";

// Funnel-sheet target for appendDemoCallRow.
export const FUNNEL_SHEET_ID =
  "1YS0ZVjB3rZK_AZKMeCbBbD__Mvz91lWXAqHcIBt0Cmw";
// Tab name (NOT gid) — confirm the actual tab name when wiring the
// Sheets API. The funnel sheet's "Comp call" tab (gid=794107148).
export const COMP_CALL_SHEET_TAB = "Comp call";

// Reps with login-like identity (no auth, just a dropdown).
export const KNOWN_REPS = ["Samuel Giraldo Concha", "Maria"];

export const DEMO_CALL_VARIABLES: DemoCallVariable[] = [
  // ---- Pre-call ----
  { name: "call_date",        label: "Call date",         phase: "pre-call", meaning: "Date of the call (YYYY-MM-DD).", inputKind: "date",   cleanable: false },
  { name: "rep_name",         label: "Rep",               phase: "pre-call", meaning: "Who ran the call.",               inputKind: "select", options: KNOWN_REPS, cleanable: false },
  { name: "prospect_name",    label: "Prospect name",     phase: "pre-call", meaning: "Lookup key; the prospect's name.",inputKind: "text",   cleanable: false },
  { name: "age_range",        label: "Age range",         phase: "pre-call", meaning: "Age bracket.",                    inputKind: "select", options: ["<20","20-29","30-39","40-49","50-59","60+"], cleanable: false },
  { name: "country",          label: "Country",           phase: "pre-call", meaning: "Country.",                        inputKind: "text",   cleanable: false },
  { name: "referral_source",  label: "Referral source",   phase: "pre-call", meaning: "How they got here (referral name / ad / organic).", inputKind: "text", cleanable: false },
  { name: "intake_behaviour", label: "Intake behaviour",  phase: "pre-call", meaning: "Behaviour flagged on intake.",    inputKind: "text",   cleanable: true },
  { name: "intake_notes",     label: "Intake notes",      phase: "pre-call", meaning: "Their own words from intake.",    inputKind: "textarea", cleanable: true, verbatim: true },
  { name: "prior_contact",    label: "Prior contact",     phase: "pre-call", meaning: "Past interactions or 'None'.",    inputKind: "text",   cleanable: true },

  // ---- Phase 2 ----
  { name: "behaviour_to_change", label: "Behaviour to change", phase: 2, meaning: "The specific behaviour (short label).", inputKind: "text", cleanable: true },

  // ---- Phase 3 ----
  { name: "referral",                  label: "Referral",                phase: 3, meaning: "Why they came / who recommended.",         inputKind: "textarea", cleanable: true },
  { name: "core_motivation",           label: "Core motivation",         phase: 3, meaning: "What they're really trying to unlock.",     inputKind: "textarea", cleanable: true, verbatim: true },
  { name: "expectation",               label: "Expectation",             phase: 3, meaning: "Their expectation in their own words.",     inputKind: "textarea", cleanable: true, verbatim: true },
  { name: "self_destructive_behaviour",label: "Self-destructive behaviour", phase: 3, meaning: "Their framing of the problem; often = behaviour_to_change.", inputKind: "textarea", cleanable: true },

  // ---- Phase 5 ----
  { name: "thoughts_during_relapse",   label: "Thoughts during relapse",  phase: 5, meaning: "Thoughts during relapse.",         inputKind: "textarea", cleanable: true, verbatim: true },
  { name: "feelings_during_relapse",   label: "Feelings during relapse",  phase: 5, meaning: "Feelings during relapse.",          inputKind: "textarea", cleanable: true, verbatim: true },
  { name: "actions_during_relapse",    label: "Actions during relapse",   phase: 5, meaning: "What they do during relapse.",      inputKind: "textarea", cleanable: true },
  { name: "intention_behind_action",   label: "Intention behind action",  phase: 5, meaning: "Intention behind the action.",      inputKind: "textarea", cleanable: true },
  { name: "self_talk_after_relapse",   label: "Self-talk after relapse",  phase: 5, meaning: "Self-talk after relapse — verbatim.", inputKind: "textarea", cleanable: true, verbatim: true },
  { name: "consequences_for_them",     label: "Consequences for them",    phase: 5, meaning: "Consequences for their life.",      inputKind: "textarea", cleanable: true },
  { name: "view_of_their_life_in_that_moment", label: "View of their life", phase: 5, meaning: "How they see life in that moment.", inputKind: "textarea", cleanable: true, verbatim: true },
  { name: "grado_de_identificacion",   label: "Identification level",     phase: 5, meaning: "Rep's read on identification level.", inputKind: "select", options: ["low","medium","high"], cleanable: false },

  // ---- Phase 7 ----
  { name: "biologic_symbolic_analogy", label: "Biologic/symbolic analogy", phase: 7, meaning: "Analogy chosen for them.", inputKind: "select", options: ["flu","cold","allergy","diabetes","cancer","other"], cleanable: false },

  // ---- Phase 8 ----
  { name: "clinical_picture_description", label: "Clinical picture description", phase: 8, meaning: "Short description used in the mantra.", inputKind: "textarea", cleanable: true },

  // ---- Phase 10 ----
  { name: "alternatives_tried",             label: "Alternatives tried",          phase: 10, meaning: "What else they've tried.",       inputKind: "textarea", cleanable: true },
  { name: "why_alternatives_failed",        label: "Why alternatives failed",     phase: 10, meaning: "Why those didn't work.",         inputKind: "textarea", cleanable: true, verbatim: true },
  { name: "time_spent_in_alternatives",     label: "Time spent in alternatives",  phase: 10, meaning: "How long they've been trying.",  inputKind: "text",     cleanable: true },
  { name: "total_money_spent_in_alternatives", label: "Total money spent (USD)", phase: 10, meaning: "Total spent on alternatives.",   inputKind: "number",   cleanable: false },
  { name: "monthly_budget_willingness",     label: "Monthly budget willingness (USD)", phase: 10, meaning: "Monthly budget they'd invest.", inputKind: "number", cleanable: false },

  // ---- Post-call ----
  { name: "outcome",   label: "Outcome",    phase: "post-call", meaning: "Call outcome.", inputKind: "select", options: ["closed","follow-up","disqualified","no"], cleanable: false },
  { name: "next_step", label: "Next step",  phase: "post-call", meaning: "Specific next action.", inputKind: "text", cleanable: true },
  { name: "rep_notes", label: "Rep notes",  phase: "post-call", meaning: "Notes for handoff.", inputKind: "textarea", cleanable: true },
];

// Column order in the funnel sheet's "Comp call" tab. Must match the
// sheet's header row exactly. If the sheet header changes, update this
// list — appendDemoCallRow writes in this order.
export const FUNNEL_SHEET_COLUMNS: string[] = DEMO_CALL_VARIABLES.map(
  (v) => v.name,
);
```

- **Explanation:** Single source of truth for what the variables pane renders. Phase order is implicit in array order, which simplifies the table render. Verbatim flag is set conservatively per the funnel sheet's tags + the rep onboarding doc's emphasis on "their voice".

---

### Phase 2 / Step 1 — backend prompt file

- **In-file location:** new file at `samwise-backend/cloud-functions/functions/src/load_call_script_prompt.txt`.
- **Should not be modified:** nothing yet.
- **Code:**

```
You are parsing a sales-call script into structured phases for a copilot UI.

The script is a Google Doc. It contains a sequence of phases (e.g. "Pre-call", "Phase 1", "Phase 2", … or named phases). Each phase has a title and a body of text that the rep reads aloud during the call.

Return ONLY a JSON object with this exact shape:

{
  "scriptType": "demo" | "onboarding" | "call_design" | "unknown",
  "phases": [
    {
      "number": "pre-call" | "post-call" | 1 | 2 | 3 | ...,
      "title": "...",
      "text": "..."
    },
    ...
  ]
}

RULES:
1. Identify scriptType from the Doc title AND content:
   - "demo" if the script is a Compatibility & Welcome / Demo call (rep persona, fit assessment, Phase 10 around pricing).
   - "onboarding" if it's the Dra. Ana María clinician onboarding (unsettling_reality, enemy_name, mantra).
   - "call_design" if it's the Call Design / Ritual design session (symbolic_invocation, gratitude_items, pact).
   - "unknown" otherwise.
2. Preserve all {{variable_name}} placeholders in the phase text EXACTLY. Never expand them.
3. Preserve newlines and basic formatting in the phase text (use \n).
4. Do NOT add explanatory text outside the JSON. The response must parse with JSON.parse().
5. If a "Pre-call" section exists, emit it as number="pre-call". If a "Post-call" or "After the call" section exists, emit it as number="post-call". Numbered phases use integers.
6. If you cannot find any phase markers, return scriptType="unknown" and phases=[].

DOC TITLE: {{DOC_TITLE}}

DOC CONTENT:
{{DOC_CONTENT}}

JSON OUTPUT:
```

- **Explanation:** Mirrors the `ritual_synthesis_prompt.txt` pattern: hardcoded prompt loaded from disk, with two placeholder slots that the cloud function fills via string replace. JSON-only output keeps parsing deterministic.

### Phase 2 / Step 2 — `loadCallScript` cloud function

- **In-file location:** add to the existing `samwise-backend/cloud-functions/functions/src/index.ts`, at the end, after `makeCallsBatchFunction`. Full code lives in the cloud-functions sub-plan.

The contract returned to the frontend is fixed at:

```ts
// Response shape for /loadCallScript
interface LoadCallScriptResponse {
  scriptType: "demo" | "onboarding" | "call_design" | "unknown";
  phases: Array<{
    number: "pre-call" | "post-call" | number;
    title: string;
    text: string;
  }>;
}
```

### Phase 2 / Step 3 — local test

- Deploy: `cd samwise-backend/cloud-functions/functions && pnpm run deploy` (or emulator: `pnpm run serve`).
- `curl -X POST` the function URL with `{ "googleDocLink": "<DEFAULT_DEMO_SCRIPT_DOC_URL>" }` and confirm the response parses as `LoadCallScriptResponse` with `scriptType: "demo"` and a non-empty `phases` array.

---

### Phase 3 / Step 1 — `lib/copilot/load-script.ts`

- **In-file location:** new file at `samwise-app/lib/copilot/load-script.ts`.
- **Should not be modified:** nothing yet.
- **Code:**

```ts
// Client wrapper for the loadCallScript cloud function.
// Cross-origin call — CORS must be enabled on the cloud function side.

export interface LoadedPhase {
  number: "pre-call" | "post-call" | number;
  title: string;
  text: string;
}

export interface LoadedScript {
  scriptType: "demo" | "onboarding" | "call_design" | "unknown";
  phases: LoadedPhase[];
}

// Update this constant after the first deploy if Firebase assigns a
// different hash. The other endpoints in app/page.tsx do the same.
export const LOAD_CALL_SCRIPT_URL =
  "https://loadcallscript-b6fhjlgejq-uc.a.run.app";

export async function loadCallScript(
  googleDocLink: string,
): Promise<LoadedScript> {
  const res = await fetch(LOAD_CALL_SCRIPT_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ googleDocLink }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `loadCallScript failed (${res.status})`);
  }
  return (await res.json()) as LoadedScript;
}
```

- **Explanation:** Same shape as the `REGISTER_RITUAL_URL` / `CREATE_DOC_URL` wrappers in `app/page.tsx`: const URL at top, single async function, JSON in/out, throws on non-2xx.

### Phase 3 / Step 2 — `app/copilot/page.tsx` scaffold (URL gate + two-pane shell)

- **In-file location:** new file at `samwise-app/app/copilot/page.tsx`.
- **Should not be modified:** existing `app/page.tsx`, `app/layout.tsx`.
- **Code:**

```tsx
"use client"

import { useEffect, useState } from "react"
import { toast } from "sonner"
import { FileText, Send } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Spinner } from "@/components/ui/spinner"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Field, FieldLabel, FieldGroup } from "@/components/ui/field"

import {
  DEFAULT_DEMO_SCRIPT_DOC_URL,
  DEMO_CALL_VARIABLES,
} from "./demo-call-config"
import { loadCallScript, type LoadedScript } from "@/lib/copilot/load-script"
import {
  loadSessionState,
  type SessionState,
  makeEmptyState,
} from "@/lib/copilot/session-storage"
import { VariablesTable } from "./variables-table"
import { ScriptPane } from "./script-pane"

export default function CopilotPage() {
  const [docUrl, setDocUrl] = useState(DEFAULT_DEMO_SCRIPT_DOC_URL)
  const [isLoading, setIsLoading] = useState(false)
  const [script, setScript] = useState<LoadedScript | null>(null)
  const [state, setState] = useState<SessionState | null>(null)

  // Restore last session on mount if one exists in localStorage.
  useEffect(() => {
    const restored = loadSessionState()
    if (restored) {
      setScript(restored.script)
      setState(restored.state)
      setDocUrl(restored.docUrl)
    }
  }, [])

  const handleLoad = async () => {
    if (!docUrl.trim()) return
    setIsLoading(true)
    try {
      const loaded = await loadCallScript(docUrl.trim())
      if (loaded.scriptType !== "demo") {
        toast.error("Only Demo Call scripts are supported in v1.", {
          description: `Got scriptType="${loaded.scriptType}". Pick a Demo script Doc and try again.`,
        })
        return
      }
      setScript(loaded)
      setState(makeEmptyState(DEMO_CALL_VARIABLES))
      toast.success("Script loaded", { description: `${loaded.phases.length} phases.` })
    } catch (err) {
      toast.error("Could not load script", {
        description: err instanceof Error ? err.message : "Unknown error.",
      })
    } finally {
      setIsLoading(false)
    }
  }

  if (!script || !state) {
    return (
      <main className="flex flex-1 flex-col items-center justify-start p-4 py-12">
        <Card className="w-full max-w-lg">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
              <FileText className="h-6 w-6 text-primary" />
            </div>
            <CardTitle className="text-2xl">Load Demo Call script</CardTitle>
            <CardDescription>
              The script Doc URL is pre-filled with the canonical v0.3 Demo script. Change it only if you're iterating on a fork.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="doc-url">
                  <FileText className="h-4 w-4" />
                  Script Google Doc URL
                </FieldLabel>
                <Input
                  id="doc-url"
                  type="url"
                  value={docUrl}
                  onChange={(e) => setDocUrl(e.target.value)}
                  disabled={isLoading}
                />
              </Field>
              <Button onClick={handleLoad} disabled={isLoading} className="w-full">
                {isLoading ? (
                  <>
                    <Spinner className="mr-2" />
                    Loading...
                  </>
                ) : (
                  <>
                    <Send className="mr-2 h-4 w-4" />
                    Load script
                  </>
                )}
              </Button>
            </FieldGroup>
          </CardContent>
        </Card>
      </main>
    )
  }

  return (
    <main className="grid h-screen grid-cols-[minmax(380px,1fr)_2fr]">
      <section className="border-r overflow-auto">
        <VariablesTable
          variables={DEMO_CALL_VARIABLES}
          state={state}
          setState={setState}
          docUrl={docUrl}
          script={script}
        />
      </section>
      <section className="overflow-auto">
        <ScriptPane phases={script.phases} cleaned={state.cleaned} />
      </section>
    </main>
  )
}
```

- **Explanation:** Two-state page: empty-state (URL gate) and loaded-state (two-pane). State restoration from localStorage on mount means a refresh mid-call returns the rep right where they were. Layout uses CSS grid for hard-coded column ratios.

### Phase 3 / Step 3 — local test

Run `pnpm dev` in `samwise-app/`, open `localhost:3000/copilot`, paste the default URL, click "Load script", confirm two-pane UI appears with empty variables table + phases visible on the right.

---

### Phase 4 / Step 1 — `app/copilot/variables-table.tsx`

- **In-file location:** new file at `samwise-app/app/copilot/variables-table.tsx`.
- **Should not be modified:** the variable list itself (lives in `demo-call-config.ts`).
- **Code:**

```tsx
"use client"

import { useEffect, useMemo } from "react"
import {
  DemoCallVariable,
  DemoCallPhase,
} from "./demo-call-config"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Button } from "@/components/ui/button"
import { Spinner } from "@/components/ui/spinner"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  type SessionState,
  saveSessionState,
  clearSessionState,
} from "@/lib/copilot/session-storage"
import { cleanVariableDebounced } from "@/lib/copilot/clean-variable"
import { appendDemoCallRow } from "@/lib/copilot/append-row"
import type { LoadedScript } from "@/lib/copilot/load-script"
import { toast } from "sonner"

interface VariablesTableProps {
  variables: DemoCallVariable[]
  state: SessionState
  setState: React.Dispatch<React.SetStateAction<SessionState | null>>
  docUrl: string
  script: LoadedScript
}

function groupByPhase(vars: DemoCallVariable[]) {
  const groups = new Map<DemoCallPhase, DemoCallVariable[]>()
  for (const v of vars) {
    if (!groups.has(v.phase)) groups.set(v.phase, [])
    groups.get(v.phase)!.push(v)
  }
  return Array.from(groups.entries())
}

export function VariablesTable({
  variables,
  state,
  setState,
  docUrl,
  script,
}: VariablesTableProps) {
  const groups = useMemo(() => groupByPhase(variables), [variables])

  // Autosave on every state change.
  useEffect(() => {
    saveSessionState({ docUrl, script, state })
  }, [state, docUrl, script])

  const setRaw = (name: string, raw: string) => {
    setState((prev) => prev && { ...prev, raw: { ...prev.raw, [name]: raw } })
    const v = variables.find((x) => x.name === name)!
    if (!v.cleanable) {
      // No LLM call — cleaned form == raw form.
      setState((prev) => prev && { ...prev, cleaned: { ...prev.cleaned, [name]: raw } })
      return
    }
    setState((prev) => prev && { ...prev, cleaning: { ...prev.cleaning, [name]: true } })
    cleanVariableDebounced(v, raw, (cleaned) => {
      setState((prev) => prev && {
        ...prev,
        cleaned: { ...prev.cleaned, [name]: cleaned },
        cleaning: { ...prev.cleaning, [name]: false },
      })
    })
  }

  const setCleanedManual = (name: string, value: string) => {
    setState((prev) => prev && { ...prev, cleaned: { ...prev.cleaned, [name]: value } })
  }

  const handleSave = async () => {
    if (!state.cleaned.prospect_name) {
      toast.error("Missing prospect_name", { description: "Cannot save without it." })
      return
    }
    try {
      const { rowNumber } = await appendDemoCallRow(state.cleaned)
      toast.success(`Saved to funnel sheet (row ${rowNumber}).`)
      clearSessionState()
      window.location.href = "/copilot"
    } catch (err) {
      toast.error("Save failed", {
        description: err instanceof Error ? err.message : "Unknown error.",
      })
    }
  }

  return (
    <div className="flex flex-col gap-6 p-4">
      {groups.map(([phase, vars]) => (
        <section key={String(phase)}>
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground mb-3">
            {typeof phase === "number" ? `Phase ${phase}` : phase}
          </h2>
          <div className="flex flex-col gap-4">
            {vars.map((v) => (
              <VariableRow
                key={v.name}
                variable={v}
                rawValue={state.raw[v.name] ?? ""}
                cleanedValue={state.cleaned[v.name] ?? ""}
                isCleaning={!!state.cleaning[v.name]}
                onRawChange={(val) => setRaw(v.name, val)}
                onCleanedChange={(val) => setCleanedManual(v.name, val)}
              />
            ))}
          </div>
        </section>
      ))}
      <Button onClick={handleSave} className="mt-4">
        Save to funnel sheet
      </Button>
    </div>
  )
}

interface VariableRowProps {
  variable: DemoCallVariable
  rawValue: string
  cleanedValue: string
  isCleaning: boolean
  onRawChange: (v: string) => void
  onCleanedChange: (v: string) => void
}

function VariableRow({
  variable,
  rawValue,
  cleanedValue,
  isCleaning,
  onRawChange,
  onCleanedChange,
}: VariableRowProps) {
  const v = variable
  return (
    <div className="rounded-md border p-3 bg-card">
      <div className="flex items-center justify-between mb-2">
        <label className="text-sm font-medium">{v.label}</label>
        {v.verbatim && (
          <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
            verbatim
          </span>
        )}
      </div>
      <p className="text-xs text-muted-foreground mb-2">{v.meaning}</p>

      {v.inputKind === "select" ? (
        <Select value={rawValue} onValueChange={onRawChange}>
          <SelectTrigger>
            <SelectValue placeholder="Select…" />
          </SelectTrigger>
          <SelectContent>
            {v.options!.map((opt) => (
              <SelectItem key={opt} value={opt}>
                {opt}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      ) : v.inputKind === "textarea" ? (
        <Textarea
          value={rawValue}
          onChange={(e) => onRawChange(e.target.value)}
          rows={3}
          placeholder="Raw note (type freely; will be cleaned)…"
        />
      ) : (
        <Input
          type={
            v.inputKind === "number"
              ? "number"
              : v.inputKind === "date"
                ? "date"
                : "text"
          }
          value={rawValue}
          onChange={(e) => onRawChange(e.target.value)}
          placeholder="Raw note…"
        />
      )}

      {v.cleanable && (
        <div className="mt-2 flex items-center gap-2 text-xs">
          <span className="text-muted-foreground min-w-[60px]">Cleaned:</span>
          {isCleaning ? (
            <span className="flex items-center gap-1 text-muted-foreground">
              <Spinner className="h-3 w-3" /> cleaning…
            </span>
          ) : (
            <input
              className="flex-1 bg-transparent border-b border-dashed border-muted-foreground/30 focus:outline-none focus:border-primary"
              value={cleanedValue}
              onChange={(e) => onCleanedChange(e.target.value)}
              placeholder={rawValue ? "(awaiting cleaning…)" : ""}
            />
          )}
        </div>
      )}
    </div>
  )
}
```

- **Explanation:** Rows are grouped by phase. Each row has raw input + (if cleanable) a click-to-edit cleaned field. Cleaning state is local to the row via a `cleaning: Record<varName, boolean>` slice of session state. `Textarea` is a shadcn primitive — confirm it exists in `components/ui/`; if not, scaffold via `pnpm dlx shadcn@latest add textarea`.

### Phase 4 / Step 2 — `lib/copilot/session-storage.ts`

- **In-file location:** new file at `samwise-app/lib/copilot/session-storage.ts`.
- **Code:**

```ts
import type { LoadedScript } from "./load-script"
import type { DemoCallVariable } from "@/app/copilot/demo-call-config"

const KEY = "copilot:session:v1"

export interface SessionState {
  raw: Record<string, string>
  cleaned: Record<string, string>
  cleaning: Record<string, boolean>
}

export interface PersistedSession {
  docUrl: string
  script: LoadedScript
  state: SessionState
}

export function makeEmptyState(vars: DemoCallVariable[]): SessionState {
  const raw: Record<string, string> = {}
  const cleaned: Record<string, string> = {}
  const cleaning: Record<string, boolean> = {}
  for (const v of vars) {
    raw[v.name] = ""
    cleaned[v.name] = ""
    cleaning[v.name] = false
  }
  // Auto-set call_date today.
  if (raw.call_date !== undefined) {
    const today = new Date().toISOString().slice(0, 10)
    raw.call_date = today
    cleaned.call_date = today
  }
  return { raw, cleaned, cleaning }
}

export function saveSessionState(session: PersistedSession) {
  try {
    localStorage.setItem(KEY, JSON.stringify(session))
  } catch {
    // Ignore quota / unavailable.
  }
}

export function loadSessionState(): PersistedSession | null {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return null
    return JSON.parse(raw) as PersistedSession
  } catch {
    return null
  }
}

export function clearSessionState() {
  try {
    localStorage.removeItem(KEY)
  } catch {}
}
```

### Phase 4 / Step 3 — local test

Type into a few variable fields, refresh, confirm the rep returns to the same loaded script + filled values. No backend involved in this phase.

---

### Phase 5 — Backend `cleanVariable`

Specified fully in `samwise-backend/cloud-functions/functions/src/current-plan.md`. Contract:

```ts
POST { name: string, meaning: string, verbatim: boolean, rawValue: string }
→  { cleaned: string }
```

After deploy, test with curl and confirm a noisy raw note becomes a clean one and a verbatim quote is preserved.

---

### Phase 6 / Step 1 — `lib/copilot/clean-variable.ts`

- **In-file location:** new file at `samwise-app/lib/copilot/clean-variable.ts`.
- **Should not be modified:** nothing yet.
- **Code:**

```ts
import type { DemoCallVariable } from "@/app/copilot/demo-call-config"

export const CLEAN_VARIABLE_URL =
  "https://cleanvariable-b6fhjlgejq-uc.a.run.app"

interface CleanRequest {
  name: string
  meaning: string
  verbatim: boolean
  rawValue: string
}

interface CleanResponse {
  cleaned: string
}

const DEBOUNCE_MS = 1500

// In-flight + result cache, both keyed by `${name}::${rawValue}`.
const inFlight = new Map<string, AbortController>()
const resultCache = new Map<string, string>()
const debouncers = new Map<string, ReturnType<typeof setTimeout>>()

export function cleanVariableDebounced(
  variable: DemoCallVariable,
  rawValue: string,
  onResult: (cleaned: string) => void,
) {
  const key = `${variable.name}::${rawValue}`

  const cached = resultCache.get(key)
  if (cached !== undefined) {
    onResult(cached)
    return
  }

  if (!rawValue.trim()) {
    resultCache.set(key, "")
    onResult("")
    return
  }

  const existingTimer = debouncers.get(variable.name)
  if (existingTimer) clearTimeout(existingTimer)

  const existingReq = inFlight.get(variable.name)
  if (existingReq) existingReq.abort()

  const timer = setTimeout(async () => {
    const controller = new AbortController()
    inFlight.set(variable.name, controller)
    try {
      const res = await fetch(CLEAN_VARIABLE_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: variable.name,
          meaning: variable.meaning,
          verbatim: !!variable.verbatim,
          rawValue,
        } satisfies CleanRequest),
        signal: controller.signal,
      })
      if (!res.ok) throw new Error(`cleanVariable ${res.status}`)
      const data = (await res.json()) as CleanResponse
      resultCache.set(key, data.cleaned)
      onResult(data.cleaned)
    } catch (err) {
      if ((err as Error).name !== "AbortError") {
        resultCache.set(key, rawValue)
        onResult(rawValue)
      }
    } finally {
      inFlight.delete(variable.name)
      debouncers.delete(variable.name)
    }
  }, DEBOUNCE_MS)

  debouncers.set(variable.name, timer)
}
```

- **Explanation:** Per-field debounce + abort + cache. The cache is keyed on `(name, rawValue)` so re-typing the same value is free. Failures silently fall back to the raw note (the rep can manually edit the cleaned field if they want better).

### Phase 6 / Step 2 — wire into variables-table

Already wired in the Phase 4 / Step 1 code via `cleanVariableDebounced`. No edit needed here, just verify behavior.

### Phase 6 / Step 3 — local test

Type a messy raw note into `self_talk_after_relapse`, wait 1.5s, confirm the cleaned form populates with a near-verbatim cleaned version. Type into `core_motivation` (verbatim=true), confirm minimal cleaning. Type into `outcome` (select), confirm no LLM call fires.

---

### Phase 7 / Step 1 — `app/copilot/script-pane.tsx`

- **In-file location:** new file at `samwise-app/app/copilot/script-pane.tsx`.
- **Should not be modified:** the script Doc itself (canonical).
- **Code:**

```tsx
"use client"

import type { LoadedPhase } from "@/lib/copilot/load-script"

interface ScriptPaneProps {
  phases: LoadedPhase[]
  cleaned: Record<string, string>
}

function renderText(
  text: string,
  cleaned: Record<string, string>,
): React.ReactNode[] {
  const parts: React.ReactNode[] = []
  const re = /\{\{(\w+)\}\}/g
  let lastIdx = 0
  let match: RegExpExecArray | null
  let key = 0
  while ((match = re.exec(text)) !== null) {
    if (match.index > lastIdx) parts.push(text.slice(lastIdx, match.index))
    const name = match[1]
    const value = cleaned[name]
    if (value) {
      parts.push(
        <span key={key++} className="font-medium text-foreground">
          {value}
        </span>,
      )
    } else {
      parts.push(
        <span key={key++} className="italic text-muted-foreground/60">{`{{${name}}}`}</span>,
      )
    }
    lastIdx = re.lastIndex
  }
  if (lastIdx < text.length) parts.push(text.slice(lastIdx))
  return parts
}

export function ScriptPane({ phases, cleaned }: ScriptPaneProps) {
  return (
    <div className="prose prose-sm max-w-none p-6">
      {phases.map((p) => (
        <section key={String(p.number)} className="mb-8">
          <h2 id={`phase-${p.number}`} className="text-base font-semibold mb-2">
            {typeof p.number === "number" ? `Phase ${p.number}` : p.number} — {p.title}
          </h2>
          <p className="whitespace-pre-wrap leading-relaxed">
            {renderText(p.text, cleaned)}
          </p>
        </section>
      ))}
    </div>
  )
}
```

- **Explanation:** Pure component. Re-renders on every change to `cleaned`. No state of its own, no LLM call, no phase advancement. The substitution logic is a small regex + map iteration; empty values stay as `{{var_name}}` greyed-out so they're visible inside the script.

### Phase 7 / Step 2 — empty-placeholder styling

Already handled in the substitution function above. Just confirm it visually in the browser.

### Phase 7 / Step 3 — local test

Fill `prospect_name` raw, wait for cleaning, confirm the script's `{{prospect_name}}` placeholders flip from greyed `{{prospect_name}}` to bold `Sarah` in real time.

---

### Phase 8 — Backend `appendDemoCallRow`

Specified fully in `samwise-backend/cloud-functions/functions/src/current-plan.md`. Contract:

```ts
POST { row: Record<string, string> }
→  { ok: true, rowNumber: number }
```

After deploy, test with curl using a sample row; confirm the funnel sheet's `Comp call` tab gains the row.

---

### Phase 9 / Step 1 — `lib/copilot/append-row.ts`

- **In-file location:** new file at `samwise-app/lib/copilot/append-row.ts`.
- **Code:**

```ts
export const APPEND_DEMO_CALL_ROW_URL =
  "https://appenddemocallrow-b6fhjlgejq-uc.a.run.app"

export async function appendDemoCallRow(
  row: Record<string, string>,
): Promise<{ ok: true; rowNumber: number }> {
  const res = await fetch(APPEND_DEMO_CALL_ROW_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ row }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error || `appendDemoCallRow failed (${res.status})`)
  }
  return await res.json()
}
```

### Phase 9 / Step 2 — "Save" button + clear localStorage

Already wired in the Phase 4 / Step 1 code via `handleSave` → `appendDemoCallRow` → `clearSessionState()` → redirect.

### Phase 9 / Step 3 — end-to-end integration test

1. `pnpm dev` in samwise-app.
2. Open `localhost:3000/copilot`.
3. Load default Demo script.
4. Fill `rep_name`, `prospect_name`, and 3-5 other fields including one verbatim field.
5. Watch cleaning happen + script substitute.
6. Click "Save to funnel sheet".
7. Confirm a new row appears in the comp-call tab with the cleaned values.
8. Confirm localStorage is cleared and `/copilot` returns to the URL gate.

---

### Phase 10 / Step 1 — sidebar entry in `app/page.tsx`

- **In-file location:** `samwise-app/app/page.tsx`, in the `User experience` `SidebarGroup` block (currently has the `Ritual call` link).
- **Should not be modified:** the rest of `app/page.tsx`.
- **Code (insertion within the existing SidebarMenu):**

```tsx
<SidebarMenuItem>
  <SidebarMenuButton asChild tooltip="Demo Call copilot">
    <Link href="/copilot">
      <Sparkles className="h-4 w-4" />
      <span>Demo Call copilot</span>
    </Link>
  </SidebarMenuButton>
</SidebarMenuItem>
```

### Phase 10 / Step 2 — polish

- Empty-state copy on the URL gate is already friendly.
- Loading state on "Load script" button uses the existing Spinner.
- Toasts already wired via `sonner` (per layout.tsx convention).
- No README to update — samwise-app does not have one.

### Phase 10 / Step 3 — note about Onboarding / Call Design

`loadCallScript` returns `scriptType: "demo" | "onboarding" | "call_design" | "unknown"`. v1 only handles `"demo"`. Adding Onboarding later is a frontend task: add an `onboarding-call-config.ts` mirroring `demo-call-config.ts`, branch on `scriptType` in `page.tsx`, render the appropriate variables and script. No backend change.

---

## Testing phase

### Local test (always)

- **Phase 3 (URL gate render):** open `/copilot`, see the URL input.
- **Phase 4 (table render + autosave):** load default script, see all 32 variables grouped by phase. Type, refresh, recover.
- **Phase 6 (cleaning):** type messy raw notes, watch cleaned form populate after 1.5s. Verbatim fields preserve quotes.
- **Phase 7 (substitution):** as cleaning completes, see `{{var}}` slots in the script switch from greyed placeholders to bold cleaned values.
- **Phase 9 (save):** click Save, see toast + row in the funnel sheet, see localStorage cleared.

### Integration test

End-to-end run with a sample real prospect. Capture all variables for the duration of a mock Demo call, then save. Confirm:
1. The funnel sheet gains the row with cleaned values in the correct columns.
2. Verbatim fields still read like the prospect (not paraphrased).
3. No phase variable is dropped.

### Update README

samwise-app has no README. Cloud-functions side: per its own sub-plan.

---

## After implementation

### Update `samwise-app/context-for-code-agent.md`

- **Module Overview:** append a sentence — *"`/copilot` is the rep-side copilot for the Demo Call: a two-pane page that captures variables (with LLM denoising) and renders the script with live substitution."*
- **Module Structure:** add the `app/copilot/` directory and `lib/copilot/` directory entries.
- **Conventions specific to this module:** add a new bullet — *"Cloud-function URL constants live at the top of each `lib/copilot/<wrapper>.ts` file, same pattern as `CREATE_DOC_URL` / `REGISTER_RITUAL_URL` in `app/page.tsx`."*
- **Out of scope / future modules** (new section): note that the AI rep agent is a planned future module under `samwise-backend/` that will consume rows captured by this copilot. Not in this repo, not in scope today.

### Update `samwise-backend/cloud-functions/functions/src/context-for-code-agent.md`

Per its own sub-plan: add the three new functions to the `Module Overview` section, add the `load_call_script_prompt.txt` file to `Module Structure`, add an entry to `Recent Changes`.

### Mark task DONE

User manually marks **"Session-copilot platform"** as **DONE** in the master Vibe doc Projects tab.
