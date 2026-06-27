# Samwise × CPT — Worked Example (v2)

*Draft 2026-06-26, under the post-reframe procedure. Produced by walking `adaptation-procedure.md` §3 against the APA description of Cognitive Processing Therapy (Resick / Monson / Chard, 2016). To be reviewed and pushed back on by Samuel.*

*Replaces the v1 stale draft (`cpt-worked-example-stale-v1.md`). The v1 tried to adapt every Samwise script section to CPT; this v2 only infers the arrival path from CPT material and appends the canonical Samwise Ritual + Daily Call at the end.*

---

## Step 1 — What we extracted from CPT material

| | |
|---|---|
| **Framework name** | Cognitive Processing Therapy (CPT) |
| **Problem name** | PTSD symptoms maintained by unhelpful beliefs ("stuck points") about why the trauma happened and what it means about self / others / world |
| **Primary metaphor / model** | The cognitive avoidance loop: trauma → stuck point → avoidance → maintenance. The mind forms a belief to predict future danger; the belief drives avoidance; avoidance blocks the evidence that would update it. |
| **Signature exercises** | Impact Statement (written) · Trauma Account (written, read aloud) · Challenging Questions Worksheet · Patterns of Problematic Thinking Worksheet · Challenging Beliefs Worksheet |
| **Typical session structure** | 12 sessions, weekly. Phased: psychoeducation → Impact Statement → Trauma Account → cognitive work across six belief domains (safety / trust / power / control / esteem / intimacy). |
| **Clinician engagement register** | Socratic questioning — the clinician asks rather than tells; the patient does the cognitive work. |
| **Vocabulary that hits §1.5 blacklist** | *paciente* (CPT calls them "patient"), *recaída* (used clinically), *terapia* (the framework names itself "therapy"). All neutralized in the output's spoken text. |

## Step 2 — Inferred arrival path

CPT's twelve-session structure inferred into a Samwise-shaped arrival path. Each session surfaces specific Ritual inputs; by the end of Session 12, all four canonical Ritual components can be built from the captured material. Phase numbering uses CPT's own session convention (Session N) so the therapist recognizes their practice.

The arrival path's only structural constraint (per procedure §2): by the time the user reaches the Ritual, the following inputs MUST have been surfaced:

| Required input | Captured in… |
|---|---|
| `behaviour_to_change` | Session 2 (Impact Statement) + refined Session 3 |
| `enemy_name` | Session 3 (stuck point named in the user's own words) |
| `symbolic_anchor_description` | Session 1 (added beat — CPT typically does not surface this; we capture it briefly) |
| `enablers_list` | Session 6 (Trauma Account context) |
| `helpers_list` | Session 1 (added beat — alongside the anchor) |
| `triggers_list` | Session 7 (when cognitive work reveals the recurring trigger contexts) |
| `new_belief_target` | Session 10 (output of Challenging Beliefs Worksheet) |

## Step 3 — Composed per-therapist script

```
[TYPE: custom]
[VERSION: 0.1-cpt-v2]
[FRAMEWORK: Cognitive Processing Therapy (Resick, Monson, Chard)]
[CLINICIAN_REGISTER: Socratic questioning — ask, don't tell]
[METAPHOR_FOR_ANTAGONIST: the stuck point (italicize as a fixed clinical term)]
```

# Part A — Arrival path (CPT-inferred)

## Session 1 — Psychoeducation + anchor surfacing (50 min)

**Goal:** Frame the cognitive avoidance loop. Explain CPT's stance on stuck points. Briefly surface the user's symbolic anchor and helpers (Samwise-required; not standard in CPT but added because the Ritual needs them).

```
[SAY] Hoy quiero contarte cómo entendemos lo que te tiene atascado. Después
de un evento difícil, la mente arma una creencia para predecir peligro
futuro — algo así como un atajo: "esto pasó porque…" o "esto significa
que yo…" o "esto significa que la gente…". A esa creencia la llamamos un
*stuck point*. El problema es que el atajo te lleva a evitar situaciones
que la podrían contradecir. Y la evitación impide que tu mente reciba
información nueva. Entonces la creencia se vuelve más rígida con el
tiempo. [/SAY]
```

```
[SAY] La salida no es resistir el impulso de evitar. La salida es
desafiar la creencia con evidencia real, paso a paso. Eso es lo que vamos
a hacer juntos en las próximas semanas. [/SAY]
```

☞ Brief anchor surfacing (NOT in standard CPT — required by Samwise for the Hope Mantra):

```
[SAY] Antes de empezar, te quiero hacer dos preguntas que nos van a
servir más adelante. Primera: ¿hay alguna tradición, filosofía, principio
o creencia en la que te apoyás para sacar fuerza? Puede ser religioso,
filosófico, científico, ancestral, lo que sea. [/SAY]
```
**Capture:** `{{symbolic_anchor_description}}`

```
[SAY] Y segunda: ¿quiénes son las personas (o cosas, o lugares) a las que
podrías recurrir si las necesitás como apoyo durante este proceso? [/SAY]
```
**Capture:** `{{helpers_list}}`

## Session 2 — Impact Statement (50 min)

**Goal:** Surface the user's current beliefs about why the originating event happened and what it means. Capture `behaviour_to_change`.

**Between-session assignment (week 1):**

```
[SAY] Esta semana quiero que escribas, en una página máximo, tu
Declaración de Impacto. Tres preguntas: ¿qué pasó? ¿Por qué creés que
pasó? ¿Y qué empezaste a creer sobre vos mismo, sobre los demás, o sobre
el mundo a partir de eso? Lo importante es escribirlo, no que esté bien
escrito. [/SAY]
```

**Session 2 itself** — the user has brought their Impact Statement. The clinician reads it with them.

```
[SAY] Vamos a leer lo que escribiste, despacio. No vamos a desafiar nada
todavía. Solo quiero entender cómo lo ves vos ahora. [/SAY]
```

After reading, capture the avoidance behaviour:

```
[SAY] Mirando lo que escribiste — ¿qué cosas notás que ESTÁS EVITANDO en
tu vida cotidiana? Lugares, personas, conversaciones, sensaciones,
situaciones que antes hacías normal y ahora rodeás. Contame un momento
concreto reciente: ¿cuándo fue la última vez que evitaste algo? ¿Dónde
estabas? ¿Qué hora era? ¿Qué fue exactamente lo que NO hiciste, y qué
hiciste en su lugar? [/SAY]
```

**Capture:** `{{behaviour_to_change}}` (verb-phrase, grounded in one specific recent moment)

## Session 3 — Identifying the stuck points (50 min)

**Goal:** Name the user's stuck points specifically. Capture `enemy_name`.

Socratic walk through the Impact Statement, surfacing the load-bearing beliefs:

```
[SAY] Cuando leemos esto, escucho varias creencias que parecen sostener
el patrón. Te las voy a leer en tus propias palabras y vos me decís cuál
sentís que es la MÁS pesada — la que más te aplasta. [/SAY]
```

(Clinician reads back 2–3 candidate stuck points in the user's own words.)

```
[SAY] ¿Cuál de esas pesa más? Y si tuvieras que ponerle un nombre — no
una explicación, un nombre corto — ¿cómo le llamarías? [/SAY]
```

**Capture:** `{{enemy_name}}` (the stuck point named in the user's own words — e.g. *"la voz que dice que es mi culpa"*, *"el atajo de 'la gente es peligrosa'"*, *"la idea de que no merezco protección"*)

⚠️ **CPT-specific note:** *the stuck point* is the framework's primary metaphor and stays a fixed clinical term throughout the script. The `{{enemy_name}}` captured here is the user's PERSONAL stuck point in their own words — both can coexist (the rep refers to "tu stuck point" generically and `{{enemy_name}}` specifically).

## Sessions 4–5 — Trauma Account writing + reading (50 min each)

**Goal:** Break the avoidance pattern of not writing about it. Surface context for the eventual `enablers_list`.

**Between-session 3 → 4 assignment:**

```
[SAY] Para la próxima vez quiero que escribas el relato detallado del peor
momento. Sensorial: dónde estabas, qué viste, qué oíste, qué olías, qué
sentías en el cuerpo. Y los pensamientos que tuviste en ese momento. No
hace falta que esté bien escrito — solo que esté completo. [/SAY]
```

⚠️ **Important architectural note** (a real hole in our current infra, surfaced by this rewrite): CPT's Trauma Account requires the PATIENT to write it — the writing itself is therapeutic. Samwise's existing behavioural-design agent (`writeToDocTab`) is agent-authored. For a CPT-using therapist, the user must type / dictate the account themselves; the agent only captures their verbatim words and asks one-line follow-up prompts ("¿y después?", "¿qué sentías ahí?"). This needs a tool variant `writeToDocTab(mode: 'verbatim-only')` in ritual-agent — out of scope for this worked example; flagged for Samuel.

**Session 4** — user reads their account aloud. Clinician notes (privately) the contexts where the stuck point fires.

**Session 5** — Socratic challenge of the stuck point against the account:

```
[SAY] En el relato decís [eco breve de un fragmento]. Eso es información
real. Vamos a comparar tu stuck point con esto: ¿lo que escribiste apoya
la creencia, o la contradice — o un poco las dos? [/SAY]
```

## Session 6 — Identifying enablers (50 min)

**Goal:** Surface `enablers_list` — the conditions present when `behaviour_to_change` fires.

Working from the Trauma Account context + the user's recent week:

```
[SAY] Volvamos al momento que me contaste en la sesión 2 — cuando
{{behaviour_to_change}}. Quiero hacer una lista concreta: ¿qué cosas
estaban PRESENTES en ese momento que, si no hubieran estado, no habrías
podido evitar? Pensá en lo físico, lo logístico, lo social. [/SAY]
```

(Examples to draw out: a specific person's absence; a specific time of day; the phone in hand; a specific medication or substance; an alternative route available; the partner being asleep; etc.)

**Capture:** `{{enablers_list}}` — concrete conditions, one per line.

```
[SAY] Y cuando esos elementos están — ¿quién o qué de tu lista de
helpers podría sostenerte para no entrar en evitación? [/SAY]
```

(Refines `{{helpers_list}}` from Session 1.)

## Sessions 7–9 — Challenging Questions across belief domains (50 min each)

**Goal:** Walk the user through the Challenging Questions Worksheet on the stuck point, organized by which of CPT's six belief domains (safety / trust / power / control / esteem / intimacy) the stuck point lives in. Surface `triggers_list`.

The five Socratic questions, per session, per stuck point:

1. **Evidence.** *"¿Qué evidencia REAL apoya la creencia '{{enemy_name}}'? ¿Y qué evidencia real la contradice?"*
2. **Habit vs. fact.** *"¿Esta creencia la armaste a partir del evento, o ya la tenías de antes? Si es nueva — ¿qué creías antes?"*
3. **Double standard.** *"Si un amigo cercano te contara exactamente esto, ¿le dirías '{{enemy_name}}'? ¿O le dirías otra cosa?"*
4. **Context.** *"¿La creencia es CIERTA en todas las áreas de tu vida — todas, sin excepción — o hay áreas donde claramente NO es cierta? Nombrame una."*
5. **Constructing the modified version.** *"Mirando todo lo que dijiste — ¿cuál sería una versión MÁS PRECISA de esta creencia?"*

During these sessions, the trigger contexts become visible (the user notices when the stuck point fires).

**Capture:** `{{triggers_list}}` — the situations / contexts / cues that activate the stuck point.

## Session 10 — Constructing the modified belief (50 min)

**Goal:** Land on `{{new_belief_target}}` — the belief the daily ritual will practice toward.

```
[SAY] Después de las últimas semanas, ¿cuál es la versión más precisa de
{{enemy_name}}? No el opuesto, no algo positivo a la fuerza. Una versión
que recoja lo que pasó Y lo que sabés ahora. [/SAY]
```

**Capture:** `{{new_belief_target}}`

## Session 11 — Synthesis (50 min)

**Goal:** Review the full path. Confirm the user is ready for the Ritual hand-off in Session 12. Confirm all canonical Ritual inputs are captured.

Inventory:

- ☐ `behaviour_to_change` — Session 2
- ☐ `enemy_name` — Session 3
- ☐ `symbolic_anchor_description` — Session 1
- ☐ `enablers_list` — Session 6
- ☐ `helpers_list` — Session 1 (refined Session 6)
- ☐ `triggers_list` — Sessions 7–9
- ☐ `new_belief_target` — Session 10

If any input is thin, extend with a brief Socratic prompt in this session before moving on.

## Session 12 — Ritual hand-off (50 min)

The clinician walks the user through the canonical Samwise Ritual (Part B). The user writes each component in their own words, in the user's Ritual Doc, with the clinician's guidance. From Session 13 onward, the daily AI call (Part C) reinforces the Ritual.

```
[SAY] Hoy vamos a construir tu ritual diario. Vas a tener cuatro
componentes: dos cosas que decís en voz alta cada día, y dos cosas que
hacés. Vamos uno por uno. [/SAY]
```

---

# Part B — The canonical Ritual (verbatim, populated from arrival-path inputs)

## Component 1 — Desidentification Mantra *(oratory — declare war)*

```
[SAY] Yo no soy {{enemy_name}}. {{enemy_name}} es un atajo que mi mente
armó después del evento original, y lo tengo, pero no me define. Cada
vez que aparezca, lo voy a nombrar y lo voy a desafiar con la evidencia
real de mi vida. No voy a descansar hasta que pierda el peso que tiene
hoy. [/SAY]
```

## Component 2 — Hope Mantra *(oratory — surrender to the higher force)*

```
[SAY] Me apoyo en {{symbolic_anchor_description}} para sostener este
trabajo. No lo puedo hacer solo. Pido la fuerza para seguir desafiando
{{enemy_name}}, día tras día. Te entrego el resultado — yo sostengo el
esfuerzo. [/SAY]
```

(If `{{symbolic_anchor_description}}` is religious: phrase the request as prayer. If philosophical: as commitment. If scientific: as discipline. If ancestral: as pledge. The clinician chooses the verb in Session 12 based on the anchor's idiom.)

## Component 3 — Immediate Protection against Enablers *(concrete action — defense, right now)*

One row per enabler. Each row: trigger condition → action ≤60s → involves helper (Y/N).

```
| Enabler context             | Immediate action (≤60s)                       | Helper |
|-----------------------------|-----------------------------------------------|--------|
| {{enablers_list[1]}}        | [user-specific concrete action]               | …      |
| {{enablers_list[2]}}        | [user-specific concrete action]               | …      |
| {{enablers_list[3]}}        | [user-specific concrete action]               | …      |
```

(Built collaboratively in Session 12. The actions REMOVE the enabler — not resist it. Examples for an avoidance-of-driving case: enabler = "alternative route is faster" → action = "use the GPS preset that forces the avoided route"; enabler = "no one is with me" → action = "call helper from list before turning the key"; enabler = "the avoided intersection is on the way home" → action = "stop at the named café 100m before the intersection, breathe, then continue".)

## Component 4 — Gradual Development of the New Belief *(daily practice — offense, over time)*

```
Daily practice toward {{new_belief_target}}:

  ▸ Practice for today: [calibrated to the user's tolerance window
    — bigger than yesterday, smaller than overwhelming]
  ▸ Targets trigger: [one item from {{triggers_list}}]
  ▸ Observable evidence to report tomorrow: [what the user will be able
    to point to]
```

Example for an avoidance-of-driving case where `{{new_belief_target}}` = *"puedo encontrarme con cosas incómodas sin que pase nada catastrófico"* and `{{triggers_list}}` includes "pasar por la intersección":

```
Día 1: parar el auto 100m antes de la intersección durante 30 segundos
       con el motor encendido. Evidencia: "estuve ahí, no pasó nada."
Día 2: pasar por la intersección sin parar. Evidencia: "lo hice una vez."
Día 3: pasar por la intersección a una hora diferente. Evidencia: "lo
       puedo hacer en otras condiciones."
…
```

The clinician + user co-design the first week's practice in Session 12. The daily AI call (Part C) then schedules and reports on it.

---

# Part C — The Daily AI Call (canonical 4-beat reinforcement)

```
[TYPE: daily-call]
```

## Beat 1 — Exit from the day

```
[SAY] [Anchor opening in the user's idiom — drawn from
{{symbolic_anchor_description}}.]
Tomate un segundo. Notá dónde estás. Notá tres cosas que estás viendo,
oyendo, sintiendo. Esta es tu pausa. [/SAY]
```

## Beat 2 — Entry into the work

```
[SAY] Vamos al trabajo de hoy. Te recuerdo el stuck point de fondo:
"{{enemy_name}}". Y la versión modificada que construiste: 
"{{new_belief_target}}". [/SAY]

[SAY] Ahora vas a decir tu mantra de desidentificación, en voz alta:
"{{desidentification_mantra}}" [/SAY]

[SAY] Y tu mantra de esperanza, anclado en {{symbolic_anchor_description}}:
"{{hope_mantra}}" [/SAY]

[SAY] ¿Cómo se sintió hoy el stuck point — apareció? ¿Cuándo? [/SAY]
```

## Beat 3 — Intentions

```
[SAY] Tres intenciones, en tres horizontes.

Próximos minutos: leé los dos mantras en voz alta una vez más.

Resto del día: si aparece {{behaviour_to_change}}, ANTES de hacerlo o no
hacerlo, ejecutá la acción de protección que corresponda — sin pensar,
solo hacela. La lista está en tu Ritual Doc.

Largo plazo: hacé la práctica del día — [today's gradual-new-belief
practice from Part B Component 4]. Anotá la evidencia. [/SAY]
```

## Beat 4 — The pact

```
[SAY] Tu pacto para las próximas 24 horas: una cosa concreta y chica.
¿Cuál es? [/SAY]
```

(Capture into the next-day reporting cycle.)

---

# Step 4 — Blacklist sweep

Output swept for *paciente / recaída / terapia / comportamiento autodestructivo* in spoken `[SAY]` blocks. None remain in the user-facing text. CPT's own native usage ("patient", "therapy") appears only in this document's meta sections and rep-only ☞ guidance, where it's acceptable per §1.5.

# Step 5 — Self-check against procedure §5

- ☑ Mission preserved (oratory + immediate enabler elimination + progressive trigger disarming).
- ☑ All four Ritual components present, each with its internal requirements satisfied.
- ☑ Daily AI call uses canonical 4-beat structure (Exit / Entry / Intentions / Pact).
- ☑ Canonical variables populated by arrival path before Ritual hand-off (Session 11 inventory).
- ☑ Vocabulary blacklist respected in spoken text.
- ☑ Arrival path reads as recognizable CPT to a CPT-trained therapist (12 sessions, Impact Statement → Trauma Account → Challenging Questions → modified belief).
- ☑ Per-framework instantiation: stuck-point metaphor used consistently across the path. Socratic register throughout.

# Step 6 — Holes surfaced by this rewrite (to feed back into the procedure)

1. **Anchor surfacing not in CPT.** CPT does not natively capture `symbolic_anchor_description`. We added a brief Session 1 beat. The procedure should explicitly say: *when the framework doesn't surface a canonical Ritual input, the synthesizer extends the arrival path with a brief beat to capture it — rather than producing a Ritual component with that input missing.* (Already in §1.2's "What an adaptation MUST and MAY do" — confirmed live.)
2. **Trauma Account authoring agency.** CPT requires the patient to write; Samwise's existing behavioural-design agent (`writeToDocTab`) is agent-authored. The procedure should add an authoring-agency dimension to the placement rubric (agent-authored / patient-authored / co-authored). Flagged for ritual-agent infra change.
3. **Per-framework Hope Mantra verb choice.** The Hope Mantra's verb (prayer / commitment / discipline / pledge) depends on whether the anchor is religious / philosophical / scientific / ancestral. The procedure should add a one-line guide: *the synthesizer picks the verb from the anchor's tradition, not from a generic vocabulary*. Currently implicit.
4. **Component 3's enabler-action specificity.** The table in this worked example is structural; the actual cell content depends on enablers we don't know yet (they come from the live user's Session 6). The synthesizer can produce a TEMPLATE row with `[CLINICIAN: customize per enabler in Session 12]` markers, but cannot pre-fill specific actions. The procedure should explicitly note that Component 3 ships as a template with cells filled live with the clinician + user.
