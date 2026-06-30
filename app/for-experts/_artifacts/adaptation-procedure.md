# Samwise Adaptation Procedure

*Working scaffold — draft 0.2, 2026-06-26. To be reviewed and iterated by Samuel. Read by humans AND by the `synthesizeCustomScript` cloud function. Edit live — no redeploy required (served via `/api/build-custom/artifact?name=adaptation-procedure`).*

## 0. What this document is

A repeatable procedure for adapting Samwise to a therapist's existing framework — CPT, Brief Strategic Therapy, ITAA 12-steps, Internal Family Systems, anything else the therapist brings.

The output of running this procedure on a framework is a **per-therapist Samwise script Doc**: a custom Samwise script written in the therapist's framework's language, ready to be loaded by `/for-experts` as a copilot and ready to be reviewed by the therapist before they take it to patients.

This procedure is intentionally split into two layers:

- **CANON** — what Samwise IS. Never swapped out, regardless of the therapist's framework. If a framework rule conflicts with canon, canon wins.
- **SWAPPABLE** — what we let the therapist's framework drive. Mapped via the placement rubric in §2.

The synthesis is one LLM pass over (this procedure + the framework material + the empty **Samwise Custom Script Template** — a funnel-wide manifest). The LLM produces a JSON map `{ "[PLACEHOLDER]": "filled text" }` that the cloud function writes into a freshly-copied Doc via the Google Docs API.

## 1. What is canonical Samwise — never swap out

> **Major reframe 2026-06-26.** Canon used to include the whole Samwise funnel (qualification → demo → onboarding → ritual → daily → optimization). It doesn't. **Therapist interviews surfaced that requiring the whole funnel as adoption from day one is too heavy.** The only fixed constraint is the **DESTINATION: the Ritual**, derived from the program-wide mission. The arrival path is the therapist's. If they like working with us, they gradually adopt more of the Samwise script over time.
>
> Canon shrinks to: the program-wide mission (§1.1), the Ritual it requires (§1.2), the Daily AI Call that reinforces it (§1.3), the canonical variables the ritual + daily call need (§1.4), and the vocabulary blacklist (§1.5). Everything else (per-call subsidiary missions, Phase 5b 9-step, mandatory beats, branching structure) is EXAMPLE — Samwise's own arrival path, useful as reference, NOT mandatory in a therapist-customized script.

### 1.1 The mission (canon)

**Program-wide mission:** help users achieve the behavioural change they desire. We believe this is primarily achieved through **rituals** with a specific three-part structure:

1. **Oratory** — the said parts (mantras) that anchor the new belief system and disidentify the user from the unhelpful identification with their problem.
2. **Immediate elimination of enablers** — concrete actions and environmental changes that remove the conditions allowing the unwanted behaviour to fire right now.
3. **Progressive disarming of triggers** — over time, the user builds capacity to encounter the conditions that previously fired the behaviour without firing it.

This three-part theory is the foundational canon. Every downstream canon (the Ritual structure in §1.2, the Daily AI Call in §1.3, the variable set in §1.4) is derived from it. A framework adaptation MUST preserve the mission verbatim. It MAY phrase the three-part structure in framework-specific vocabulary as long as oratory / enabler-elimination / trigger-disarming all appear.

**Per-call subsidiary missions are NOT canon.** Samwise's own funnel assigns per-call missions (Fit Assessment qualifies + captures; Demo helps the user decide whether to help themselves; etc. — see §1.6) but those are EXAMPLES, not mandates. Therapists structuring their own arrival path may assign whatever per-call missions their existing practice already uses.

### 1.2 The Ritual — the destination (canon, derived from §1.1)

Every Samwise-adapted script MUST end at a Ritual the user performs daily. The Ritual instantiates §1.1's three-part theory as four mandatory components.

#### Why four components (and not three, or five)

The mission (§1.1) names three structural parts (oratory / enabler-elimination / trigger-disarming). The Ritual instantiates this as **four** components because each part has internal structure that one component can't carry:

- **Oratory splits into two mantras.** Combat energy (declare war on the old) and surrender energy (open to the new) are tonally opposed and chronologically sequenced. One mantra can't carry both — combat-only exhausts the user; surrender-only stagnates them. Contemplative traditions across history encode this (renunciation + supplication). We build on that.
- **Action splits into two time horizons.** Behaviour happens on two scales: *right now* (the impulse just fired — need defense) and *over time* (the trigger keeps firing because the belief sees the world that way — need offense). One action can't serve both. Defense is reactive and pre-designed; offense is proactive and gradual. They have different cadences, different shapes, different success criteria.

Result: 2 mantras + 2 actions = 4 components. Each non-redundant. Removing any one breaks the structure.

No fifth "community" component because community is the DELIVERY MECHANISM, not a Ritual element — the Daily AI Call is a form of accompaniment; helpers appear inside Immediate Protection; the clinician is the relationship over time. Community supports all four components simultaneously rather than being its own action.

#### The four components and their internal requirements

##### 1. Desidentification Mantra *(Oratory — declare war)*

- **Role:** Separates the user from the identification with the problem. Breaks "I am X" before any action attempt.
- **Internal shape (the mantra MUST contain):**
  - An *externalization phrase* — "I have X" / "X is in me" / "X is my enemy" — NEVER "I am X".
  - The `behaviour_to_change` and/or `enemy_name`, named concretely (no abstractions).
  - A *combat verb* — fight, defeat, dismantle, crush, hold down, refuse, expel — in active voice.
  - A *persistence assertion* — "I will not rest until…" / "every day until…" — committing to repetition.
- **Form:** First-person voice, addressing the antagonist in second-person. Short enough to memorize (2–4 sentences). Said aloud.
- **Deployment:** Daily, during the Entry-into-the-work beat (§1.3). Also re-deployed in the moment as part of Immediate Protection.
- **Why this shape:** Action attempts fail when the user believes they ARE the unwanted pattern. The externalization is what makes the action attempt *possible* in the first place. Without it, every attempt becomes "I'm trying to stop being me" — psychologically impossible.

##### 2. Hope Mantra *(Oratory — surrender to a higher force)*

- **Role:** Provides the energy that combat alone can't sustain. Anchors the change in something larger than the user's own willpower.
- **Internal shape (the mantra MUST contain):**
  - The `symbolic_anchor_description` named SPECIFICALLY — by tradition / philosophy / deity / principle the user actually lives in. NEVER generic "higher power" if the user has a specific anchor.
  - An *acknowledgment of finitude* — "I can't do this alone" / "this is bigger than me" — in the user's own idiom.
  - A *request for help* in the anchor's idiom — prayer / contemplation / invocation / pledge / scientific commitment / ancestral promise.
  - A *surrender of outcome* — give over the result, hold only the effort.
- **Form:** First-person, addressing the anchor by its specific name. Brief.
- **Deployment:** Daily, Entry-into-the-work beat, AFTER the Desidentification Mantra — war declared first, then ask for help.
- **Why this shape:** Combat alone exhausts. Sustainable change needs a relationship with something larger than willpower. The user's existing anchor IS that larger thing — we never invent one for them. Asking for help is the leap of faith. (Materialists, atheists, and rationalists DO have anchors — philosophical commitments, scientific principles, ancestral lineages. The clinician's job is to surface theirs, not impose Samwise's.)

##### 3. Immediate Protection against Enablers *(Concrete action — defense, right now)*

- **Role:** Removes the conditions that allow the impulse to succeed, BEFORE willpower has to win the moment.
- **Internal shape (the protection MUST contain):**
  - **One concrete physical action per identified enabler** in `enablers_list`.
  - Each action must be *doable in under 60 seconds* from when the impulse fires.
  - Each action must be *physical / observable* — close the app, put the phone in another room, leave the location, call a helper from `helpers_list`. NOT a feeling, NOT a state, NOT a resolution.
  - Each action must *remove the enabler*, not resist its pull. Resisting is willpower; removing is environment.
  - Designed IN ADVANCE, deployed IN THE MOMENT. The user does not decide what to do when the impulse fires — they execute the pre-designed action.
- **Form:** A list — one row per enabler. Each row: `{when this enabler is present} → {do this concrete action}`.
- **Deployment:** In the moment, not scheduled. Triggered by the user noticing the impulse. May involve a helper from `helpers_list`.
- **Why this shape:** Willpower fails. Environment wins. If the enabler is present when the impulse fires, the impulse wins regardless of intent. Pre-designing the action removes the in-the-moment decision (which is what fails under the load of the impulse). "Strong" people aren't winning by being strong; they're winning by removing the conditions in which they'd have to be strong.

##### 4. Gradual Development of a New Belief *(Daily practice — offense, over time)*

- **Role:** Builds, day by day, the capacity for triggers to lose their power. Creates the evidence that changes the underlying belief.
- **Internal shape (the practice MUST contain):**
  - **One daily practice** tied to `new_belief_target` (the belief the user is building toward).
  - Each practice must *target a specific item* from `triggers_list`.
  - Each practice must be *calibrated to the user's tolerance window*: bigger than yesterday's practice, smaller than overwhelming.
  - Each practice must produce *observable evidence* — something happened, the user can point to it, it can be reported on the daily call.
  - Each practice must be *repeated DAILY*. Occasional doesn't count.
- **Form:** A daily action with a clear evidence-producing output. Recorded in the daily call's Pact beat.
- **Deployment:** Scheduled daily, during the Intentions beat (§1.3). Output reported the next day at Exit-from-the-day.
- **Why this shape:** Beliefs don't change through declaration; they change through evidence. The mantras (1 + 2) prepare the ground; the practice (4) is what actually moves the belief. Trigger disarming is slow because rebuilding evidence is slow. Daily-ness is non-negotiable because the old triggers fire frequently — the new evidence has to compete with that frequency, which means it must arrive at least as often.

#### What an adaptation MUST and MAY do

A framework adaptation **MUST** produce all four ritual components with their internal requirements satisfied. It **MAY** name them in framework-specific language (CPT might call the Desidentification Mantra a "modified-belief statement"; IFS might call the Hope Mantra a "Self-led intention") as long as the role each plays AND the internal requirements are preserved.

If the framework's typical clinical material doesn't surface enough for one component (e.g. it has no anchor-surfacing move and the Hope Mantra is left thin), the synthesizer must EXTEND the inferred arrival path (§2) with a brief beat that surfaces the missing input — rather than producing an under-specified Ritual component.

#### Per-component composition agency — what the synthesizer can pre-fill vs. what ships as a live-customized template

Not every component can be fully composed by the synthesizer. The split:

| Component | Synthesizer can pre-fill | Ships as live-customized template |
|---|---|---|
| 1. Desidentification Mantra | Yes — uses `{{behaviour_to_change}}` + `{{enemy_name}}` from arrival path | The framework-specific phrasing is the synthesizer's; the variable values come from arrival-path captures. |
| 2. Hope Mantra | Yes — uses `{{symbolic_anchor_description}}` from arrival path | Verb choice depends on the anchor's idiom — *prayer* for religious / *commitment* for philosophical / *discipline* for scientific / *pledge* for ancestral. Synthesizer picks based on the anchor's tradition; the user can rephrase. |
| 3. Immediate Protection | **Structure only** — the table shape, the &le;60s constraint, the &ldquo;remove the enabler&rdquo; rule | YES — each enabler-action row is filled live with the clinician + user in the Ritual hand-off session. Synthesizer ships rows with `[CLINICIAN: customize per enabler]` markers. |
| 4. Gradual New Belief | **Structure only** — the daily-practice format, the tolerance-window calibration, the evidence-producing requirement | YES — the first week's specific practices are co-designed live in the Ritual hand-off session. Synthesizer ships with `[CLINICIAN: co-design first week]` markers and an example. |

The synthesizer should NEVER fabricate Component 3 enabler-actions or Component 4 practices that the framework material can't justify — leave the cells marked for live fill rather than inventing specifics the clinician will have to discard.

### 1.3 The Daily AI Call — how the Ritual is reinforced (canon)

The Ritual is reinforced through a daily call from the Samwise AI agent, structured in four beats:

1. **Exit from the day** (formerly "The Stop")
2. **Entry into the work** (formerly "The Consciousness")
3. **Intentions** (formerly "The Intention")
4. **The pact** (formerly "The Commitment")

These four beats are non-negotiable — they are HOW the Ritual gets reinforced daily. A framework that wants a 3-beat or 5-beat daily call must be adapted to fit into these 4 beats.

### 1.4 Canonical variables (canon — minimal set the Ritual + Daily Call require)

- `symbolic_anchor_description` — the user's tradition / philosophy / higher force the Hope Mantra surrenders to.
- `behaviour_to_change` — the unwanted behaviour the Desidentification Mantra declares war on (verb-phrase form).
- `enemy_name` — the user's name for the antagonist (referenced in both mantras).
- `helpers_list` — people / practices / objects used in the Immediate Protection.
- `enablers_list` — the conditions Immediate Protection neutralizes.
- `triggers_list` — the conditions Gradual New Belief progressively disarms.
- `new_belief_target` — the belief Gradual New Belief practices toward.

Framework adaptations MAY add framework-specific variables. The canonical names above must be preserved with their canonical meanings. Slot syntax is `{{double_curly_braces}}`; names stay snake_case verbatim.

> **Note:** the earlier Samwise scripts used a longer variable list (`feelings_during_relapse`, `thoughts_during_relapse`, `view_of_their_life_in_that_moment`, etc.). Those belong to Samwise's own arrival path (the demo's Phase 5b 9-step capture); they are NOT canon for therapist-customized scripts. A therapist using their own arrival path will produce different variables — what matters is that the canonical Ritual variables above end up populated by the time the user reaches the Ritual.

### 1.5 Spoken-text composition — questions over explanations (canon)

SAY blocks default to **asking, not telling**. The user does the work of changing; the therapist's job is to invite, listen, validate, and redirect — not to explain.

**Rules for SAY blocks:**

- **Default shape: one short question** (1–2 sentences) that invites the user to speak. The user should be the one elaborating, not the therapist.
- **A long SAY block (more than ~3 sentences) requires explicit justification.** Long blocks are almost always a sign the script is doing the user's work for them. Common-but-wrong instinct: "let me explain the framework first, then ask." Right instinct: "ask the question; if the user gets stuck, then a NOTE block tells me when to optionally explain."
- **Explanations go in NOTE blocks, not SAY blocks**, and they are flagged as **optional** — the therapist decides in the moment whether to deploy them. Format: `☞ If the user gets stuck on X, you can optionally explain: "…"`. The therapist reads the optional explanation only when the user needs it; otherwise, they skip it and keep asking questions.
- **The user speaks more than the therapist. Always.** This is the test for whether the script is structured correctly. If a therapist reading the script would talk more than the user, the script is wrong.

**Why this matters:** a therapist who explains too much produces compliant agreement, not real change. The user nods, the therapist feels heard, nothing shifts. The script's bias toward questions enforces this discipline at the prompt level so the therapist doesn't have to fight it in the moment.

**Example — the same beat, wrong vs. right:**

✗ **Wrong (overlong SAY, therapist doing the work):**
> `[SAY]` La creencia que tienes — "no merezco protección" — es lo que en CPT llamamos un *stuck point*. Es una creencia que se formó después del evento original como un atajo predictivo: tu mente armó una regla rápida para protegerte de algo similar en el futuro. El problema es que esta regla se ha quedado congelada y ahora interfiere con tu vida actual porque te lleva a evitar situaciones que en realidad son seguras. Lo que vamos a hacer juntos es desafiar esta creencia con la evidencia real de tu vida actual para construir una versión más precisa. `[/SAY]`

✓ **Right (short SAY question + optional NOTE explanation):**
> `[SAY]` Esta creencia que tienes — "no merezco protección" — ¿desde cuándo te acuerdas tenerla? `[/SAY]`
>
> `☞ If the user asks why you're asking, you can optionally explain:` *"Porque las creencias que vienen de un evento difícil suelen ser más rígidas que las que ya teníamos. Saber cuándo empezó nos ayuda a desafiarla mejor."*

The right version is shorter, hands the floor to the user, and only deploys the explanation if asked. The therapist always has the option but never the obligation.

### 1.6 Vocabulary blacklist — forbidden in spoken text under any framework (canon)

- **paciente** → use "persona", the user's name, or drop the noun
- **comportamiento autodestructivo** → use `{{behaviour_to_change}}` or a soft frame ("lo que estás cambiando")
- **recaída** → use "retroceso", "vuelta atrás", "un tropezón", or rephrase
- **terapia** → use "acompañamiento", "el proceso", or rephrase

These apply even in teaching phases, even when the framework's source material uses them. The LLM must NEVER let a framework's own term reintroduce them into spoken text.

Internal reasoning / clinician notes / cleaning prompts / chain-of-thought may use any term. The constraint is on OUTPUT the prospect hears or reads.

### 1.7 Samwise's own arrival path — EXAMPLE, not canon

The following are Samwise's specific arrival path components. They are documented here as reference for therapists who want to see one fully-worked example of how an arrival path can lead to the Ritual. A therapist's framework MAY adopt these wholesale, partially, or not at all.

- **Funnel surfaces:** Fit Assessment Call → Demo Call → Onboarding Session → Call Design Session → Optimization Sessions.
- **Per-call subsidiary missions** (for Samwise's own funnel): Fit Assessment qualifies + captures; Demo helps the user decide whether to help themselves; Onboarding builds the first Ritual; Call Design personalizes the daily call content; Optimization refines the Ritual when it stops working.
- **Mandatory beats in Samwise's Demo Call:** Phase 1.5 reflection / Phase 5b 9-step functional analysis / Phase 11 verdict line. Reflect → Track → Align → Guide listening pattern.
- **Phase 5b 9-step structure:** anchor / sensory / action re-anchor / feelings / intention (IFS) / thoughts / self-talk / view-of-life synthesis / consequences. IFS reframe at Step 5 is the load-bearing move (creates desidentification distance early).
- **Branching driver:** `grado_de_identificacion` (low / medium / high) judged at end of Phase 5b.

A therapist who wants to adopt Samwise's arrival path wholesale gets all of the above. A therapist who wants to keep their own arrival path and only adopt the Ritual gets §1.1 + §1.2 + §1.3 + §1.4 + §1.5 — that's the minimum viable adoption.

## 2. What is swappable per framework

**Everything in the arrival path.** The therapist's existing way of working — intake, sessions, assessments, exercises, vocabulary, register — stays intact. Our job is to **infer it from the framework material and propose**, NOT to ask the therapist to think through and describe it themselves. The therapist's input is just the framework material (PDF / URL / text); we do the cognitive work.

### What the synthesizer infers from framework material

From whatever framework material the therapist drops, the synthesizer infers and proposes the **arrival path** — the sequence of conversational moves that takes a user from "first contact" to "ready to start performing the Ritual daily". Specifically:

- **The framework's typical session structure** (one session? multi-week? two intakes?) — inferred from how the material describes the framework's clinical use.
- **The framework's vocabulary** for the problem, the antagonist, the desired change — adopted verbatim where it doesn't violate §1.5's blacklist.
- **The framework's signature exercises and interventions** — adapted as the mechanism by which the arrival path surfaces the Ritual inputs (see below).
- **The framework's primary metaphor for the antagonist** — used consistently across the arrival path. Do NOT mix metaphors.
- **The framework's clinician engagement register** (Socratic / motivational / directive / paradoxical / parts-dialogic) — used as the rep/clinician voice throughout the arrival path.

### The constraint on the arrival path: surface the Ritual inputs

The arrival path is free-form except for one rule: **by the time the user is ready to perform the Ritual daily, the path must have surfaced the inputs each Ritual component needs.** The Ritual + Daily Call are canon; their inputs are canon (§1.4). The path's only structural constraint is producing those inputs.

| Ritual component (§1.2) | Inputs the arrival path must surface |
|---|---|
| Desidentification Mantra | `behaviour_to_change`, `enemy_name` |
| Hope Mantra | `symbolic_anchor_description`, `enemy_name` |
| Immediate protection against enablers | `enablers_list`, `helpers_list` |
| Gradual development of a new belief | `triggers_list`, `new_belief_target` |

A proposed arrival path that does not surface these inputs is incomplete; the synthesizer must extend it (with framework-flavored sessions / phases / exercises) until it does.

### Examples — what the inference looks like per framework

- **CPT (Cognitive Processing Therapy).** Inferred arrival path: psychoeducation about cognitive avoidance → Impact Statement (surfaces `behaviour_to_change` + initial stuck-point beliefs) → Trauma Account (surfaces context for `enablers_list` and `triggers_list`) → Challenging Questions Worksheet pass on the stuck point (produces `new_belief_target`) → Ritual hand-off. Primary metaphor: *stuck point*. Register: Socratic questioning.
- **ITAA 12-steps.** Inferred arrival path: Step 1 admission of powerlessness (surfaces `behaviour_to_change` + `enemy_name` = "the disease") → Step 2/3 turning over to higher power (surfaces `symbolic_anchor_description`) → Step 4 inventory (surfaces `enablers_list` + `triggers_list`) → Ritual hand-off. Primary metaphor: *the disease* / *the addict voice*. Register: peer-fellowship, less clinician-directed.
- **Brief Strategic Therapy.** Inferred arrival path: identify the attempted solution that became the problem (surfaces `behaviour_to_change`) → paradoxical injunction prescription → behavioural homework producing the inputs for `enablers_list` + `triggers_list` + `new_belief_target` → Ritual hand-off. Primary metaphor: *the attempted solution that became the problem*. Register: directive, paradoxical.
- **IFS (Internal Family Systems).** Inferred arrival path: unblending dialogue with parts (surfaces `behaviour_to_change` via parts' protective intentions, `enemy_name` = the protector / the exile) → finding Self-energy (surfaces `symbolic_anchor_description`) → mapping protector triggers (surfaces `triggers_list`) → Ritual hand-off. Primary metaphor: *protector / exile*. Register: parts-dialogic, compassionate.

### The output shape

The synthesizer produces ONE per-therapist Samwise script Doc with two parts:

1. **Arrival path** (inferred, framework-flavored). Phases / sessions / exercises that surface the Ritual inputs.
2. **The canonical Ritual + Daily Call** (verbatim from §1.2 + §1.3, with the inputs from part 1 substituted into `{{variable}}` slots).

The therapist reviews, edits the arrival path freely (it's THEIR practice), and tests by loading the Doc into the copilot.

## 3. The synthesis procedure — what the LLM does, step by step

**Step 1 — Read the framework material in full.** Identify:

a. The framework's primary name for the problem ("addiction", "stuck pattern", "the symptom", "the protector").
b. The framework's primary metaphor or model for HOW the loop works.
c. The framework's signature exercises / interventions (there may be more than one — list them).
d. The framework's typical session structure (single-session / multi-week / phased — inferred from how the material describes clinical use).
e. The framework's clinician engagement register (Socratic / motivational / directive / paradoxical / parts-dialogic).
f. Any vocabulary the framework uses that would violate §1.5 (paciente / recaída / terapia / comportamiento autodestructivo). These must be neutralized in OUTPUT.

**Step 2 — Infer the arrival path.** From Step 1's reading, propose a sequence of phases / sessions / exercises that:

a. Uses the framework's own vocabulary, metaphor, register, and signature exercises (Step 1a–e).
b. Surfaces each of the Ritual inputs listed in §2's table (`behaviour_to_change`, `enemy_name`, `symbolic_anchor_description`, `enablers_list`, `helpers_list`, `triggers_list`, `new_belief_target`) by the time the user reaches the Ritual.
c. Reads naturally to a therapist working in this framework — they should recognize their own practice in the arrival path, not feel like Samwise has been imposed on top of it.
d. **Tags each session/exercise with an authoring-agency marker** so downstream tooling knows who writes what:
   - `[AUTHOR: clinician]` — clinician-driven session (e.g. CPT Session 1 psychoeducation, IFS Self-energy invocation).
   - `[AUTHOR: patient]` — patient writes / dictates verbatim; agent or clinician only prompts and captures (e.g. CPT Trauma Account, IFS parts dialogue).
   - `[AUTHOR: co-authored]` — clinician and patient produce together (e.g. CPT Challenging Beliefs Worksheet, Ritual hand-off).
   - `[AUTHOR: agent]` — Samwise's daily AI agent or behavioural-design agent produces verbatim (default for the Daily AI Call beats).

This matters because Samwise's existing tooling has different paths for each: `writeToDocTab` is agent-authored; behavioural-design's "Possible Origins" tab currently has no patient-authored variant. When the inferred arrival path requires patient-authored content (CPT Trauma Account being the canonical case), the synthesizer must surface this so the infra gap is visible.

Do NOT ask the therapist what their arrival path should be. Propose. They edit if they want.

**Step 3 — Compose the per-therapist script as ONE Doc with two parts:**

a. The inferred arrival path (Step 2). Use `[SAY] / [/SAY]` markers for spoken text and `{{variable}}` slots for the Ritual inputs as they get captured along the path. **Every phase boundary MUST be a `Phase N — Title` line** (em-dash with whitespace on both sides, N is an integer or N.M decimal). The framework's own session/step naming is preserved INSIDE the title — e.g. `Phase 1 — Session 1: Psychoeducation`, not `Session 1 — Psychoeducation`. Markdown `##` / `###` headings are silently dropped by the copilot's parser; only `Phase N — Title` registers.
b. The canonical Ritual (§1.2) + Daily AI Call (§1.3) appended verbatim, with `{{variable}}` slots populated by what the arrival path surfaced. The Ritual's four components and the Daily Call's four beats are each their own `Phase N — Title` section.

**Step 4 — Sweep your output against §1.5's blacklist.** Any spoken-text occurrence of *paciente / recaída / terapia / comportamiento autodestructivo* must be rewritten, even when the framework's source material uses these terms.

**Step 5 — Self-check against §5's hard constraints.** Output.

## 4. Worked examples

- **4.1 — CPT (Cognitive Processing Therapy).** See `cpt-worked-example.md`. *(In progress — Phase B.)*
- **4.2 — ITAA 12-steps.** *(Not yet produced.)*
- **4.3 — Brief Strategic Therapy.** *(Not yet produced.)*

## 5. Hard constraints — the LLM must answer YES to each before returning

- Did I keep the 4-beat call structure intact? (Y/N)
- Did I keep every mandatory beat from §1.4 (Phase 1.5, Phase 5b 9-step, Phase 11 verdict)? (Y/N)
- Did I keep Phase 5b's 9-step ordering and the IFS reframe at Step 5? (Y/N)
- Did I sweep the spoken text for *paciente* / *recaída* / *terapia* / *comportamiento autodestructivo*? (Y/N)
- Did I preserve every `{{variable}}` slot exactly as written? (Y/N)
- Did I preserve every `[SAY]` / `[/SAY]` marker exactly? (Y/N)
- Did I only modify `[ROLE_*]` placeholders? (Y/N)
- Did I avoid mixing metaphors across phases (one framework, one primary metaphor)? (Y/N)
- Did the framework's stance on user agency get respected in the closing reframe? (Y/N)
- For multi-slot framework components: did I format the SAME mechanism differently per slot? (Y/N)

If any answer is N, regenerate before returning.

---

*End of draft 0.2.*

*Next move (Samuel): read in the web viewer (Phase D-bis below), push back in chat, I edit via the Edit tool, no Doc round-trip. Once §1, §2 and §5 are tight, we move to Phase B — produce `cpt-worked-example.md` and from it derive `custom-script-template.md`.*
