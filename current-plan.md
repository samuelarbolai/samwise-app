# current-plan.md — Language neutralization + disqualified-rebound flow in the Demo Call script

> Replaces the previous plan (`appendDemoCallRow` Firestore migration — DONE 2026-05-21).

## Plan Summary

Two coupled changes, both shipping in the same task:

1. **Language neutralization.** Sweep the canonical Demo Call script Doc to remove prospect-rejected clinical-coded terms (`paciente`/`patient`, `comportamiento autodestructivo`/`self-destructive behaviour`, `recaída`/`relapse`) from spoken text. Sourced from a real prospect's call feedback (May 2026, see `samwise-script-work` skill Rule 7).
2. **Disqualified-rebound flow.** Add a re-classification beat immediately after the desidentification demo. If the rep marks the prospect as `still_disqualified`, the script swaps from the close path to a rebound path: Reflect → Track → Align → Guide, then a referral ask + per-name follow-up loop.

To support (2) without forking the Doc, introduce a new in-Doc marker convention `[CONDITION: var=value]` that the `script-pane.tsx` renderer reads to conditionally show/hide phases. Single new variable: `fit_state` with values `qualified | still_disqualified`, defaulting to `qualified`.

### Explicitly out of scope
- **Per-register script variants** (war / symbolic / clinical). Captured signals are deferred; the rep adapts voice live for now.
- **Structured referrals data.** Referrals go into the existing `rep_notes` field freeform; the rep has a separate tracking system.
- **Re-classify dropdown UI affordance.** The rep sets `fit_state` like any other variable in the variables-table (`select` input). No bespoke prompt.
- **Per-register variables on the qualification side** (Nova prompts, schema). Hold for a separate task.
- **Persona Brief generator cloud function.** Hold for a separate task.
- **Fixing the structural Doc bug** where Phases 13/14 (rebound handlers) sit AFTER the close path (Phase 12). Pre-existing — out of scope.

## Plan Architecture (Flow)

```
Demo Doc loaded ─→ loadCallScript Gemini parser
                    │
                    ├─→ phases[]: { number, title, blocks: [{ kind, text }] }
                    │   ([CONDITION: …] lines outside [SAY] become kind:"note" blocks)
                    │
                    ▼
              script-pane.tsx
                    │
                    ├─ parsePhaseCondition(phase) → { var, value } | null
                    ├─ filter visible phases:
                    │     keep if no condition, OR cleaned[var] === value
                    ├─ filter [CONDITION: …] note out of each phase's rendered blocks
                    └─ render
```

`fit_state` starts at `"qualified"` (seeded by `makeEmptyState` via the new `defaultValue` field on `DemoCallVariable`). The rep flips it to `"still_disqualified"` via the existing variables-table select input after Phase 5c. From that point forward, the qualified-path phases (currently 6–15) hide and the rebound phases (16–17) appear in their place.

## Plan Structure (Directories and files)

```
samwise-app/
├── app/copilot/
│   ├── demo-call-config.ts          # MODIFIED: + defaultValue?: string field on type;
│   │                                #           + fit_state variable in phase 5
│   └── script-pane.tsx              # MODIFIED: + parsePhaseCondition()
│                                    #           + filter phases by condition
│                                    #           + filter [CONDITION] note out of rendered blocks
└── lib/copilot/
    └── session-storage.ts           # MODIFIED: makeEmptyState seeds defaultValue

# External (Google Docs — user applies in browser):
Demo Call (canonical, post-v0.3)     # EDIT IN PLACE: substitutions + new phases + condition markers
   Doc ID: 1sBHuGaXCFaP8cmQdUgNpoQYwCq3L4-OfDMDoPR73a5g
   (v0.3 — ID 1hntQClh8TUUVYOw148sFGRhy33JqtleuvI5BC8rM4eg — was deprecated by the user 2026-05)
```

Three files in code (small diffs each). One Google Doc edited in place by the user with the find-and-replace + paste-in list below.

---

## Modifications (in phases and steps)

### Phase A — Google Doc edits (user applies)

The user does this in the browser; I produce the exact list.

#### Step A.1 — Substitution sweep for clinical-coded terms

Apply each substitution in the Doc. Surrounding context is given so the user can verify each hit before replacing.

**1. Phase 1 — "el paciente" → "la persona"**
- Find: `Lo creamos porque los psicólogos han tenido la experiencia de que si el paciente hiciera las tareas`
- Replace with: `Lo creamos porque los psicólogos han tenido la experiencia de que si la persona hiciera las tareas`

**2. Phase 5b — heading "Functional analysis of a relapse"**
- Find: `### 5b. Functional analysis of a relapse`
- Replace with: `### 5b. Functional analysis of a setback`
- (Heading is rep-only, English. Cleaning for consistency.)

**3. Phase 5b — spoken "Cuando tenés una recaída"**
- Find: `Cuando tenés una recaída, ¿qué pensás de vos mismo?`
- Replace with: `Cuando tenés un retroceso, ¿qué pensás de vos mismo?`

**4. Phase 6 — spoken "comportamiento autodestructivo" (3 occurrences)**
- Find (1): `Casi todo el mundo se trata mal a sí mismo cada vez que tiene un comportamiento autodestructivo. Por eso en cada recaída cae más y más.`
- Replace with: `Casi todo el mundo se trata mal a sí mismo cada vez que pasa lo que está intentando cambiar. Por eso en cada retroceso cae más y más.`

- Find (2): `Imaginá que el comportamiento autodestructivo es como un enemigo externo que ataca la confianza en vos mismo en cada recaída que tenés, porque eso le conviene para ganar espacio en tu mente y tus emociones.`
- Replace with: `Imaginá que esto que querés cambiar es como un enemigo externo que ataca la confianza en vos mismo en cada retroceso, porque eso le conviene para ganar espacio en tu mente y tus emociones.`

- Find (3): `Esto se puede conceptualizar como identificarse con el problema autodestructivo. Y es casi imposible cambiar el comportamiento cuando uno cree que ese comportamiento es uno mismo.`
- Replace with: `Esto se puede ver como identificarse con el problema. Y es casi imposible cambiar el comportamiento cuando uno cree que ese comportamiento es uno mismo.`

**5. Phase 6 — closing line of Phase 6**
- Find: `Entonces eso es lo primero que vamos a hacer: ayudarte a desidentificarte para que puedas declararle la guerra a este enemigo, declararle la guerra a tu comportamiento autodestructivo.`
- Replace with: `Entonces eso es lo primero que vamos a hacer: ayudarte a desidentificarte para que puedas declararle la guerra a este enemigo, declararle la guerra a lo que querés cambiar.`

**6. Phase 7 — spoken "una recaída"**
- Find: `Cuando te das cuenta de eso, una recaída ya no es un completo fracaso personal, sino un episodio de mala salud que se debe y se puede tratar`
- Replace with: `Cuando te das cuenta de eso, un retroceso ya no es un completo fracaso personal, sino un episodio de mala salud que se debe y se puede tratar`

**7. Phase 7 — spoken "comportamiento autodestructivo"**
- Find: `Necesitamos hacer un mantra de desidentificación. Vamos a hacerlo viendo a tu comportamiento autodestructivo como un enemigo concreto y externo`
- Replace with: `Necesitamos hacer un mantra de desidentificación. Vamos a hacerlo viendo lo que querés cambiar como un enemigo concreto y externo`

**8. Phase 9 — spoken "una recaída" (new substitution, surfaced when audit moved to canonical Doc)**
- Find: `Definimos qué es exactamente una recaída para vos.`
- Replace with: `Definimos qué es exactamente un retroceso para vos.`

**9. Phase 15 — spoken "los pacientes"**
- Find: `Cuando los pacientes completan las tareas entre sesiones, alrededor del 65% avanza`
- Replace with: `Cuando las personas completan las tareas entre sesiones, alrededor del 65% avanza`

**Not changed (deliberate):**
- `enfermo` / `enfermedad` in Phases 7 and 8 — load-bearing in the desidentification mantra ("Estoy enfermo con… porque esto es externo a mí"). The framework deliberately uses "sick with a condition" as the externalization device. Different semantic from "patient." Leave alone.
- Internal variable names containing `_relapse` (`thoughts_during_relapse` etc.) — rep-facing only, never spoken. Leave alone.
- "self-destructive habits" in rep-only Phase 2 instruction (`(doomscrolling, addictions, productivity, self-destructive habits)`) — rep-only guidance, not spoken. Leave alone for now; can revisit if it bleeds into rep voice during calls.

#### Step A.2 — Append a re-classify beat at the end of Phase 8

After Phase 8's mantra commitment (the [SAY] mantra block and the `Capture: {{clinical_picture_description}}` line), append this new sub-section. Relocated from "Phase 5c" in late 2026-05 — classification must happen after the FULL desidentification arc (Phases 5–8), not after Phase 5 alone, because Phases 6–8 are where the disqualified prospect actually sees the framework's value (and that recognition is what makes them a high-quality referrer).

```markdown
## Phase 8.5 — Re-classify fit after the desidentification work

[SAY]Acabamos de hacer un ejercicio importante. Voy a tomarme un momento para evaluar si lo que hicimos hoy nos permite continuar el proceso con vos.[/SAY]

⚠️ **Mandatory beat. Always run this** — after the full Phase 5 → Phase 8 desidentification arc. The framework demo runs for EVERY prospect, qualified or not. Classification happens here, AFTER they've seen the framework, named the enemy, and said the mantra aloud.

Some prospects who looked qualified going into the demo engage with the reframe and clearly SEE the framework's value — but they receive it as valid for *someone else*, not for themselves right now. In Samuel's businessman demos (May 2026), this is the dominant pattern: the prospect recognizes the territory because they've had this kind of problem in their own past or in someone close to them. They're high-recognition prospects but their current identification with the behaviour is shallower than the fit assessment suggested. They're not buyers; they're high-quality potential referrers.

☞ **Ask yourself silently — do not say this aloud:** Did the desidentification work make the prospect see THEMSELVES in the problem right now? Or did they see the framework clearly but receive it as something valid for someone else?

**Set `fit_state` in the variables table:**

- `qualified` — the prospect saw themselves in it. They need this now. Continue to Phase 9 (Roadmap).
- `still_disqualified` — the prospect saw the framework clearly but received it as something for someone else (often because they've had similar problems in their past or close to them). Their current identification doesn't justify acting now. The script skips Phases 9–15 (close path) and swaps to Phase 16 (rebound + referrals).

The next phase you see depends on which value you pick.
```

This sub-section opens with one [SAY] block (visible to the prospect — makes the rep's evaluation moment explicit) followed by rep-only guidance.

#### Step A.3 — (Obsolete — Doc is already correctly numbered)

This step was based on the deprecated v0.3 Doc which had a "Phase 1" mislabel at the bottom. The current canonical Doc is already numbered correctly through Phase 15. Skip this step.

#### Step A.4 — Tag the qualified-path phases with `[CONDITION: fit_state=qualified]`

For each of these phases, add the marker as a STANDALONE LINE between the phase heading (`## Phase N — Title`) and the Goal line. Place it OUTSIDE any `[SAY]` block — it must be a plain line so Gemini's parser tags it as a note block.

Phases to tag (7 total — only the close path; Phases 6–8 always show because they're the value-demo arc that runs for every prospect, qualified or not):
- Phase 9 — Roadmap
- Phase 10 — Eliminate perception of risk
- Phase 11 — Price
- Phase 12 — Close and next steps
- Phase 13 — Handling the economic rebound
- Phase 14 — Handling the alternatives rebound
- Phase 15 — Handling the scientific evidence rebound

The line to add to each phase, immediately under its `##` heading:

```
[CONDITION: fit_state=qualified]
```

(The `After the call (fill within 10 minutes)` section sits between Phase 12 and Phase 13 in the current Doc. Leave it as-is; it's rep-only checklist text without a `Phase N` heading, so it's not parsed as a phase and doesn't need a condition tag.)

#### Step A.5 — Append the rebound phases

At the very end of the Doc, after the now-renumbered Phase 15, append the two new phases below verbatim.

```markdown
## Phase 16 — Rebound: confirm value, surface why, bridge to referral

[CONDITION: fit_state=still_disqualified]

**Goal:** A four-beat conversation (Reflect → Track → Align → Guide) that lands on the prospect naming the people in their life who actually have the problem. Each beat serves a specific purpose tied to the actual prospect-state filtered for in Phase 5c: confirm they saw the framework's value, identify *why* they saw it (typically: their own past experience or someone close to them), use that as the bridge from "you've seen this" to "you know others who have this," and ask for the names.

☞ **Architecture map** (each beat = specific purpose; not generic listening):
- **Reflect** = confirm they saw value. Open question.
- **Track** = surface WHY they saw value. Listen for / elicit the second thread (past experience, close-person experience).
- **Align** = bridge "you've seen this" → "you know others who have this." Samuel's canonical line below.
- **Guide** = ask for the names explicitly. Capture into {{rep_notes}}.

⚠️ **If at Reflect the prospect did NOT actually see the framework's value,** the Phase 5c classification was wrong. Flag in rep_notes, thank them dignifiedly, end the call without the referral ask.

### Reflect

[SAY]¿Cómo te cayó lo que acabamos de hacer?[/SAY]

⚠️ **Spoken line TENTATIVE** — adapt to your register. Goal: open invitation. Listen for the value-recognition. Capture their words into {{rep_notes}}.

### Track

The prospect will often surface their second thread unprompted (they've had this kind of problem, or someone close has). If they don't, elicit:

[SAY]¿Por qué te resuena? ¿De dónde lo conocés?[/SAY]

⚠️ **Spoken line TENTATIVE** — this is the listening-and-eliciting beat. The rep adapts to whatever the prospect said in Reflect. Capture the *why* verbatim into {{rep_notes}} — it's what makes the next beats land honestly.

### Align (Samuel's exemplar — preserve close to verbatim)

[SAY]¿Has visto esto en otras personas que conocés?[/SAY]

This is the canonical bridge line from Samuel's call experience. Use it close to verbatim. Wait for the answer.

### Guide

If they confirm they know people who fit:

[SAY]¿Quiénes son?[/SAY]

⚠️ **Spoken line TENTATIVE** — goal is to elicit explicit names. Capture into {{rep_notes}}: list of names, one per line, with the prospect's connection to each (relationship + the specific behaviour they recognized for that person).

**If they don't surface anyone in Align** (e.g. *"no, en realidad no"*): they either didn't actually see the value (you misclassified at Phase 5c) OR they're not willing to refer. Either way — thank them dignifiedly, mark `outcome = disqualified`, end the call without forcing the per-name loop.

## Phase 17 — Rebound: per-name follow-up

[CONDITION: fit_state=still_disqualified]

**Goal:** For each name surfaced in Phase 16's Guide beat, run the 4-question loop. One name at a time — do not batch.

### Per-name loop

☞ For each name in the list captured in Phase 16, ask all four questions in order. Capture each answer into {{rep_notes}}.

**Why they could benefit:**

[SAY]Vamos uno por uno. [Nombre]: ¿por qué creés que él/ella podría aprovechar este servicio?[/SAY]

⚠️ **Spoken phrasing TENTATIVE.** Capture: the prospect's reasoning — what behaviour they see in this person, what motivation, what would resonate.

**Willingness:**

[SAY]¿Qué tan dispuesto estás a empujarlo a conectarse con nosotros?[/SAY]

Wait. Capture.

**Blocker:**

[SAY]¿Qué te bloquea para hacerlo hoy?[/SAY]

Wait. Capture.

**How we can help:**

[SAY]¿Cómo podemos ayudarte a hacer ese puente?[/SAY]

Wait. Capture.

☞ **The fourth question opens a help-offer space.** No canonical menu of forms-of-help has been established yet — improvise based on what the prospect surfaces as their blocker. (Open item: as patterns emerge across real rebounds, document the canonical help-options here.)

### Close

⚠️ **No evidence yet on the right closing language.** Rep improvises a warm thank-you, marks `outcome = disqualified`, sets `next_step` from the per-referral follow-up dates captured in rep_notes, ends the call.
```

---

#### Step A.6 — Add admission-test scarcity inserts (3 spoken-text edits)

The dynamic: the rep is silently evaluating the prospect throughout the call; the rep's verdicts are made *visible* at three checkpoints. The prospect spends the call earning continuation rather than opting in. Register is clinician-authority but the spoken language stays neutral (no `clínico/clínicamente/paciente/diagnóstico`) — the authority comes from the act of evaluating and from "vi lo que necesitaba ver," not from medical vocabulary.

Three changes, each in a different phase. Each is a single SAY block.

**(a) Phase 1 — replace the closing sentence**

In the existing Phase 1 spoken text, replace this sentence:

> *Estamos en el primer paso, que es el espacio de compatibilidad y bienvenida. Aquí vamos a ver si nuestro servicio es compatible con tu caso y definir claramente qué es lo que querés.*

With this:

> *[SAY]Estamos en el primer paso, que es el espacio de compatibilidad y bienvenida. En estos 30 minutos voy a evaluar con vos si tu caso es uno con el que podemos trabajar bien — y también para que vos tengas claridad sobre qué es lo que querés. No todas las personas que llegan a este paso pasan al siguiente. Eso es parte del proceso.[/SAY]*

Why: sets the evaluation-direction from minute one. "Evaluar con vos" claims the rep's authority without medicalizing. "Tu caso" frames the prospect's situation as something we either take on or don't. "No todas las personas pasan al siguiente paso" lands the test without bragging or threatening. "Eso es parte del proceso" normalizes scarcity as routine.

**(b) (Merged into Step A.2 — the scarcity SAY block at the top of the re-classify beat is now baked into the Phase 8.5 paste-in itself.)**

**(c) Phase 11 — insert a SAY block at the very top (above the body-language warning)**

At the top of `## Phase 11 — Price`, BEFORE the existing ⚠️ Body language at price warning, insert this SAY block:

> *[SAY]Antes de hablar de inversión, te confirmo algo: vi lo que necesitaba ver. Tu caso es uno con el que podemos trabajar bien. Por eso seguimos.[/SAY]*

Why: the verdict-delivered moment. "Vi lo que necesitaba ver" makes the silent evaluation explicit *after* it's been passed — the prospect feels the test was real. "Por eso seguimos" makes it implicit that absence of this confirmation would have ended the call. The price discussion then lands on top of "you got in" rather than "they want my money."

**Language audit for Step A.6:** verified — none of the three inserts contains `paciente / patient`, `comportamiento autodestructivo / self-destructive behaviour`, `recaída / relapse`, or `clínico/clínicamente/diagnóstico/diagnose`. Authority is carried by the verb `evaluar`, the noun `criterio` (implicit), and the framing "tu caso es uno con el que podemos trabajar bien."

---

### Phase B — Frontend code changes

#### Step B.1 — Add `defaultValue` field + `fit_state` variable to `demo-call-config.ts`

- **In-file location:** `samwise-app/app/copilot/demo-call-config.ts`
- **Should not be modified:** any existing variable's metadata, the `DEMO_CALL_PHASE` type values (`5` is reused — see below), the URL constants, `KNOWN_REPS`, `FUNNEL_SHEET_COLUMNS`.

Two edits:

(a) Extend the `DemoCallVariable` interface (around line 42):

```ts
export interface DemoCallVariable {
  name: string
  label: string
  phase: DemoCallPhase
  meaning: string
  inputKind: InputKind
  options?: string[]
  /** UI-only tag shown next to the field. Doesn't drive cleaning behaviour
   * (cleaning is driven by frameworkSemantics + script contexts). */
  verbatim?: boolean
  cleanable?: boolean
  /** Per-field cleaning instructions sent to Gemini. Tells the cleaner
   * what to extract vs ignore, what shape the cleaned output should take,
   * and any verbatim/voice rules specific to this variable. */
  frameworkSemantics?: string
  /** Initial value seeded into both raw and cleaned when a fresh session is
   * created. Used by phase-condition variables (e.g. fit_state) so the
   * default branch of the script is visible before the rep touches anything. */
  defaultValue?: string
}
```

(b) Add the new variable at the END of the Phase 5 block (around line 292, immediately after `grado_de_identificacion`):

```ts
  {
    name: "fit_state",
    label: "Fit state (post-demo)",
    phase: 5,
    meaning: "Re-classification after the desidentification demo. Drives [CONDITION] phase visibility in the script-pane.",
    inputKind: "select",
    options: ["qualified", "still_disqualified"],
    cleanable: false,
    defaultValue: "qualified",
  },
```

- **Explanation:** `fit_state` is a `select`, not cleanable (no LLM denoising — it's a rep-set toggle). `defaultValue: "qualified"` means a fresh session shows the canonical close path; the rep flips it after Phase 5c.

#### Step B.2 — Seed `defaultValue` in `makeEmptyState`

- **In-file location:** `samwise-app/lib/copilot/session-storage.ts`, `makeEmptyState` (lines 27–43).
- **Should not be modified:** the `KEY` constant (`copilot:session:v3` — the shape doesn't change incompatibly; old sessions seeded with `""` for fit_state still render correctly because the filter logic in script-pane.tsx falls back to defaultValue), the `call_date` autopopulate.

Modify the loop to honour `defaultValue`:

```ts
export function makeEmptyState(vars: DemoCallVariable[]): SessionState {
  const raw: Record<string, string> = {}
  const cleaned: Record<string, string> = {}
  const cleaning: Record<string, boolean> = {}
  for (const v of vars) {
    const initial = v.defaultValue ?? ""
    raw[v.name] = initial
    cleaned[v.name] = initial
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
```

- **Explanation:** Variables with `defaultValue` start at that value in both raw and cleaned. `fit_state` therefore starts at `"qualified"`. Existing variables without `defaultValue` continue to start at `""`. The `call_date` special case stays.

#### Step B.3 — Parse `[CONDITION: var=value]` and filter phases in `script-pane.tsx`

- **In-file location:** `samwise-app/app/copilot/script-pane.tsx`.
- **Should not be modified:** `renderText`, `Block`, `resolveBlocks`, `scrollVarsToPhase`, `scrollVarsToFirstSubstitutedVar`, the IntersectionObserver setup.

Two additions:

(a) A helper that extracts a condition from a phase's note blocks AND a helper that filters the condition note out of the visible blocks (add above `ScriptPane`, after `resolveBlocks`):

```ts
// A phase may opt into conditional visibility by including a single
// `[CONDITION: var=value]` line outside any [SAY] block. The Gemini parser
// renders that line as a note block; this helper extracts the pair from
// the first matching note in the phase.
const CONDITION_RE = /^\s*\[CONDITION:\s*(\w+)\s*=\s*([\w-]+)\s*\]\s*$/

function parsePhaseCondition(
  phase: LoadedPhase,
): { var: string; value: string } | null {
  for (const block of phase.blocks) {
    if (block.kind !== "note") continue
    const m = CONDITION_RE.exec(block.text)
    if (m) return { var: m[1], value: m[2] }
  }
  return null
}

// Removes the [CONDITION: …] note from the rendered output so the rep
// doesn't see the marker line itself in the script pane.
function blocksWithoutConditionMarker(blocks: ScriptBlock[]): ScriptBlock[] {
  return blocks.filter(
    (b) => !(b.kind === "note" && CONDITION_RE.test(b.text)),
  )
}
```

(b) Apply the filter in the `ScriptPane` component's render. Replace the `phases.map(...)` body with:

```tsx
return (
  <div className="mx-auto max-w-3xl p-6">
    {phases.map((p) => {
      const condition = parsePhaseCondition(p)
      if (condition && cleaned[condition.var] !== condition.value) {
        return null
      }
      const visibleBlocks = blocksWithoutConditionMarker(resolveBlocks(p))
      return (
        <section key={String(p.number)} className="mb-10">
          <h2
            id={`script-phase-${String(p.number)}`}
            data-script-phase={String(p.number)}
            className="mb-4 scroll-mt-4"
          >
            <button
              type="button"
              onClick={() => scrollVarsToFirstSubstitutedVar(p)}
              className="text-xs font-semibold text-muted-foreground uppercase tracking-widest hover:text-foreground transition cursor-pointer text-left w-full"
              title="Jump variables pane to the first variable substituted here"
            >
              {typeof p.number === "number" ? `Phase ${p.number}` : p.number} —{" "}
              {p.title}
            </button>
          </h2>
          <div className="flex flex-col gap-3">
            {visibleBlocks.map((b, i) => (
              <Block key={i} block={b} cleaned={cleaned} />
            ))}
          </div>
        </section>
      )
    })}
  </div>
)
```

- **Explanation:**
  - `parsePhaseCondition` looks at each note block in the phase for a matching `[CONDITION: var=value]` line. Returns `{ var, value }` or `null`.
  - The render skips the entire section when the phase has a condition that doesn't match `cleaned[var]`.
  - `blocksWithoutConditionMarker` filters the marker note out of the visible blocks so the rep doesn't see `[CONDITION: …]` in the rendered script.
  - The IntersectionObserver `useEffect` is unchanged. Phases skipped by the filter aren't in the DOM, so the scroll observer naturally ignores them — no extra logic needed.

---

## Testing phase

### Local test (foreground, by me after approval)
1. Apply Phase B code changes.
2. Start dev server.
3. Load `/copilot`.
4. Without loading any qualification or typing anything: confirm `fit_state` shows `qualified` in the variables-table select. Phases 1–14 visible, scientific-evidence (now Phase 15) visible. Rebound phases (16, 17) HIDDEN.
5. Flip `fit_state` to `still_disqualified` in the variables-table. Phases 6–15 hide. Phases 16, 17 appear. Phase 5 (with new 5c sub-section) stays visible. Phases 1–5 stay visible.
6. Visually confirm no `[CONDITION: ...]` marker line is rendered in the script pane.

### Integration test
- After Step A is applied to the live Doc, reload the script in /copilot (clear localStorage, paste the Doc URL again). Confirm the same filter behaviour against the real parsed script.

### Update README
None — internal copilot changes, no public surface.

---

## After implementation

### Update `samwise-app/context-for-code-agent.md`
Append one line under `/copilot` describing the new condition-marker convention and `fit_state` variable. Brief — the deep detail lives in the `samwise-session-copilot` skill.

### Update `samwise-session-copilot` skill
Add a short section documenting:
- The `[CONDITION: var=value]` marker convention (placement, parser semantics, filtering of the marker from visible output).
- The `defaultValue` field on `DemoCallVariable` and `makeEmptyState`'s honouring of it.
- The `fit_state` variable as the v1 condition driver, and the qualified/still_disqualified branches.
- Note that variable-driven phase-branching is now part of the script-pane's responsibility — future per-register branches would compose with this same mechanism.

### Update `samwise-script-work` skill
Append to Rule 7's table that the canonical Demo Doc now uses neutralized phrasing for the three rejected terms, with `{{behaviour_to_change}}`-style slots where applicable. Note that the rule's status is no longer "interim" for the Demo script.

### Mark task DONE
User marks the task DONE in the master Vibe doc Projects tab once Step A is applied in Google Docs and Step B is deployed.

---

## Open decisions (flag if user wants to revisit before implementation)

1. **Variable naming.** `fit_state` with values `qualified | still_disqualified`. Alternatives: `post_demo_fit`, `fit_tag`. Sticking with `fit_state` because it's short and the values are self-explanatory.
2. **Numbering scheme for rebound phases.** Using 16 and 17 after renumbering the misnumbered "Phase 1 → Phase 15" at the end of the Doc. Alternative: don't fix the typo, use 15 and 16 for rebound (leaves the scientific-evidence misnumber in place). Sticking with the fix because we're already editing the Doc heavily.
3. **`align` beat in Phase 16.** Currently a SAY block with a placeholder for the worldview reference. Could be a note-block instruction instead ("Reference their worldview verbatim if it came up earlier; otherwise skip"). Sticking with SAY because the rep adapts the phrasing live anyway, and rendering it as a SAY box visually marks that something IS said here when applicable.
4. **Phase 5c uses no `[SAY]` block.** It's pure rep guidance. The condition marker convention is on the next phase, not this one. Phase 5c always shows, regardless of fit_state.
