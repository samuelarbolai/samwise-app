# Samwise × CPT — Worked Example

> **⚠️ STALE as of 2026-06-26 reframe.** This example was produced under an earlier version of the procedure where the WHOLE Samwise funnel (qualification + demo + onboarding + ...) was canon and frameworks were adapted INTO Samwise's pre-existing slots. The reframe restricts canon to the Ritual + Daily Call only; everything upstream is the therapist's arrival path, INFERRED from framework material.
>
> **The right shape under the new procedure:** infer CPT's typical clinical arrival path (psychoeducation → Impact Statement → Trauma Account → Challenging Questions Worksheet pass) and append the canonical Samwise Ritual + Daily Call at the end. NOT a section-by-section adaptation of every Samwise script.
>
> This file is kept as historical reference for the failure mode it surfaced. Pending rewrite (or trash) — Samuel's call.

*Original draft 0.1, 2026-06-26. Produced by walking `adaptation-procedure.md` §3 against the APA description of Cognitive Processing Therapy (Resick / Monson / Chard, 2016).*

## How this example uses the procedure

**CPT components placed across the funnel** (per the §2 placement rubric):

| CPT component | Structural role | Samwise slot(s) |
|---|---|---|
| **Impact Statement** (the written "why did this happen + what does this mean about me / others / the world") | Initial belief capture | Section 1 — Qualification prompts |
| **Trauma Account** (detailed written narrative of the worst traumatic experience, read aloud) | Narrative integration of origins | Section 4 — Behavioural-design "Possible Origins" tab |
| **Challenging Questions / Patterns / Beliefs Worksheets** | Cognitive intervention / belief modification | Section 2 Demo Phase 8 mantra-construction (build) AND Optimization session (recovery) — same mechanism, different formatting per slot |
| **Socratic questioning** | Clinician engagement register | Reflect → Track → Align → Guide (across every emotional moment). Not a separate slot — it's HOW the clinician engages, not WHERE. |

**Canon-preserved verbatim** (no CPT swap):

- 4-beat call structure (Exit / Entry / Intentions / The pact)
- Phase 1.5 reflection
- Phase 5b 9-step structure (with IFS reframe at Step 5 — re-cast as "the part of you that was avoiding…", which is parts-language CPT also accepts)
- Phase 11 verdict
- Vocabulary blacklist (paciente / recaída / terapia / comportamiento autodestructivo) — CPT's own native vocabulary (PTSD, *paciente*, *recaída*, *síntomas*, *terapia*) gets neutralized in spoken text per Rule 7
- `{{variable}}` slot names and positions

**CPT-specific vocabulary swaps in spoken text:**

| Generic | CPT-flavored Spanish |
|---|---|
| el enemigo / el problema | *el stuck point* (kept in English as a fixed clinical term, italicized) — or *"la creencia que te tiene atascado"* in fuller form |
| desidentificación | *desidentificación con la creencia bloqueante* (same canonical move, named explicitly) |
| la enfermedad | *la creencia bloqueante* / *el patrón cognitivo* |
| recaída | *un regreso al patrón de evitación* / *una vuelta a la creencia bloqueante* |
| paciente | persona / their name |
| terapia | *el proceso* / *este acompañamiento* |
| comportamiento autodestructivo | `{{behaviour_to_change}}` or *"el comportamiento de evitación que querés cambiar"* |

**`behaviour_to_change` mental model for CPT users:** the behaviour is typically an **avoidance behaviour** (avoiding a place, a person, a thought, a sensation) — the *consequence* of an unhelpful belief about a past event. Examples used below: avoiding intimate touch, avoiding driving past a specific intersection, avoiding sleep without alcohol. The Samwise structural shape (verb + object, grounded in a moment) holds.

---

# Section 1 — Qualification prompts (Impact Statement integration)

The Samwise qualification captures `behaviour_to_change` and `core_motivation` in a thin shape (verb-phrase + one-line reason). CPT's **Impact Statement** is structurally similar but deeper — it asks not just WHAT the behaviour is but WHY the person believes the originating event happened and WHAT it means about themselves / others / the world. This depth is exactly what Phase 1.5's reflection needs to land.

The qualify agent extends its `behaviour_to_change` + `core_motivation` capture with three Impact-Statement style follow-ups:

```
After capturing behaviour_to_change (the verb-phrase grounded in a moment) and
core_motivation (the deeper reason for changing), ask in the same conversational
register:

  [SAY] Quiero entender algo más para que el siguiente paso sea útil. Cuando
  pensás en el evento original — el momento del que viene esto — ¿qué creés
  que pasó? ¿Por qué pasó? [/SAY]

  → Capture verbatim into: impact_self_attribution

  [SAY] Y a partir de ese evento, ¿qué empezaste a creer sobre vos mismo —
  algo así como "yo soy / yo no soy / yo siempre / yo nunca"? [/SAY]

  → Capture verbatim into: impact_self_belief

  [SAY] ¿Y sobre los demás, o sobre el mundo? [/SAY]

  → Capture verbatim into: impact_world_belief
```

**Three new qualification variables:**

- `impact_self_attribution` — what the person believes caused the originating event (often self-blaming in trauma)
- `impact_self_belief` — the stuck point about themselves (e.g. *"no soy confiable"*, *"no puedo proteger a los que quiero"*)
- `impact_world_belief` — the stuck point about others / the world (e.g. *"la gente es peligrosa"*, *"no se puede confiar en nadie"*)

These three feed Phase 1.5 reflection (richer playback) AND feed Phase 6 teaching (the rep names the stuck-point pattern using the prospect's own attribution/belief language) AND seed Phase 8 mantra construction (the worksheet challenges these three beliefs specifically).

**Behaviour grounding rule (§Phase B holds verbatim):** behaviour_to_change is still required as a SENTENCE describing one specific recent grounded moment (WHEN / WHERE / ACTIVITY / ACTION). Vague avoidance ("evito el tráfico") is not acceptable until grounded to a moment ("el martes pasado a las 7pm, en la ruta a casa, di una vuelta de 20 minutos extra para no pasar por la Quinta Avenida").

---

# Section 2 — Demo Call script (CPT-adapted)

```
[TYPE: demo]
[VERSION: 0.1-cpt]
```

**Duration:** 30 minutes
**Goal:** Compatibility check + first close (commitment to next session + deposit)
**Framework:** Cognitive Processing Therapy (Resick / Monson / Chard)
**Prerequisite:** Complete the "Before the Call" prep doc.

Variable syntax: `{{variable_name}}` = slot to fill from the qualification doc or live during the call. All variables map 1:1 to columns in the prospect sheet.

Marker syntax: text inside `[SAY] / [/SAY]` is read aloud to the prospect. Everything outside is rep-only guidance.

## Phase 1 — Set validations and expectations

**Goal:** Frame the call. Establish authority and pacing. Get explicit consent to begin.

```
[SAY] Hola. Que bueno tenerte aquí.

Primero quiero darte contexto importante, y avisarte que la llamada va a
durar 30 minutos.

Nosotros somos un programa de cambio de comportamiento en donde el servicio
principal es una herramienta de acompañamiento construida sobre el trabajo
de los psicólogos cognitivo-conductuales — específicamente sobre el marco
del procesamiento cognitivo (CPT), desarrollado para entender cómo las
creencias que se forman después de eventos difíciles mantienen los patrones
que querés cambiar. Lo creamos porque creemos que la clave para soltar esos
patrones está en hacer rituales muy personales, anclados en las creencias
específicas tuyas que están bloqueando el cambio.

Estamos en el primer paso, que es el espacio de compatibilidad y bienvenida.
En estos 30 minutos voy a evaluar con vos si tu caso es uno con el que
podemos trabajar bien — y también para que vos tengas claridad sobre qué es
lo que querés. No todas las personas que llegan a este paso pasan al
siguiente. Eso es parte del proceso. [/SAY]

[SAY] ¿Estás listo para empezar? ¿Tenés alguna pregunta? [/SAY]
```

⚠️ **Pacing rule:** Do not rush this. The prospect needs to feel the unhurried authority before anything else lands. CPT-specific note: the framing names CPT explicitly because therapists evaluating Samwise for their own use need to know we're framework-aware. Drop the explicit CPT mention if the prospect is a patient (not a clinician evaluator).

## Phase 1.5 — Reflect what they already shared (2-3 min)

**Goal:** Before asking anything, name back what they shared in the qualification, in their own words. This is where the prospect decides whether you're paying attention. CPT-extended: also reflect the impact-statement triad.

⚠️ This phase is non-negotiable.

```
[SAY] Antes de empezar con las preguntas, quiero confirmar contigo lo que ya
compartiste. Quiero asegurarme de que te escuché bien. [/SAY]
```

**Behaviour:**
```
[SAY] Lo que querés cambiar es {{behaviour_to_change}}. [/SAY]
```

**Core motivation:**
```
[SAY] Y la razón de fondo, según lo que escribiste, es {{core_motivation}}. [/SAY]
```

**Impact triad (CPT-specific reflection beat):**
```
[SAY] También me dijiste algo importante sobre cómo entendés lo que pasó:
sentís que {{impact_self_attribution}}. Y a partir de eso, empezaste a creer
sobre vos que {{impact_self_belief}} — y sobre los demás o el mundo, que
{{impact_world_belief}}. [/SAY]
```

☞ **CPT-specific:** the impact triad is the Phase 1.5 anchor for everything downstream. The three captured beliefs ARE the candidate stuck points. Naming them back precisely is what makes Phase 6's teaching land — the rep doesn't have to argue them out of an abstract "stuck pattern", they push against THEIR specific beliefs.

**Worldview / anchor:**
```
[SAY] ¿Hay algo en lo que te apoyás para sacar fuerza — una tradición, una
filosofía, una creencia? [/SAY]
```
(Capture → `symbolic_anchor_description`. Skip cleanly if "ninguno" — don't perform spirituality.)

**Journey:**
```
[SAY] ¿Qué cosas ya intentaste para cambiar esto, y qué sentís que les
faltó? [/SAY]
```
(Capture → `alternatives_tried` + `why_alternatives_failed`)

**Close:**
```
[SAY] ¿Es así? ¿Hay algo que esté diciendo mal, o que quieras agregar? [/SAY]
```

Wait. Let them correct you. The correction IS the qualification.

## Phase 3 — Bond with the customer and their problem

(Verbatim per canonical Demo. CPT does not change the bonding phase.)

```
[SAY] ¿Qué te trajo acá? [/SAY]    → Capture {{referral}}
[SAY] ¿Qué esperás? [/SAY]         → Capture {{expectation}}
[SAY] Si estás aquí, significa que estás tomando las decisiones correctas
para que así sea. Sentite feliz por eso. [/SAY]
```

## Phase 4 — First close (alignment commitment)

(Verbatim per canonical Demo.)

```
[SAY] Te quiero confirmar algo, decime si es exacto:
Esperás reducir {{behaviour_to_change}}.
Viniste acá porque {{referral}}.
Y realmente necesitás resolver esto porque querés {{core_motivation}}.
¿Es así? [/SAY]
```

Wait for explicit confirmation.

## Phase 5 — Desidentification demo (CPT-flavored)

**Goal:** Help the prospect see distance between THEMSELVES and the stuck point. CPT's mechanism (separating fact-from-the-event from belief-about-the-event) IS desidentification by another name — the worked example just names the move with CPT precision.

### 5a. Create the Samwise Ritual Doc

```
[SAY] Voy a abrir un documento donde vamos a ir capturando algunas cosas
durante esta conversación. Te lo voy a compartir al final. [/SAY]
```

### 5b. Functional analysis of the moment they already shared

**Goal:** Gather data on how identified the prospect is with the stuck point AND make the moment present enough that Phase 6's teaching lands with weight.

☞ **ANCHOR** on `{{behaviour_example}}` from qualification. CPT-specific note: the moment captured is an AVOIDANCE moment (e.g. "the moment I turned the car around to avoid the intersection"), not a relapse-into-consumption moment. The 9-step structure is identical.

☞ **ORDER MATTERS** — same canonical order. Sensory → somatic → cognitive → meta-cognitive.

#### Step 1 — Anchor on the qualify moment

```
[SAY] Volvamos a ese momento que ya me contaste — {{behaviour_example}}. [/SAY]
```

#### Step 2 — Sensory recreation

```
[SAY] Quiero que me ayudes a verlo juntos por dentro, despacio. ¿Dónde
estabas? ¿Sentado o parado? ¿Qué hora era más o menos? ¿Qué sonido había
alrededor? [/SAY]
```

#### Step 3 — Action re-anchor

```
[SAY] Y ahí, [eco del contexto sensorial], fue cuando {{behaviour_to_change}}. [/SAY]
```

#### Step 4 — Feelings during the moment

```
[SAY] En ese segundo, justo antes de hacerlo — ¿qué sentías? [/SAY]
```
**Capture:** `{{feelings_during_relapse}}`

#### Step 5 — Intention behind the action (CPT-cast parts reframe — DEFAULT, not fallback)

☞ The IFS reframe at Step 5 IS THE LOAD-BEARING MOVE of 5b and translates cleanly into CPT. CPT clinicians regularly use parts-language for protective avoidance ("the part of you that was avoiding…"). Do NOT swap to "what cognitive distortion were you running?" — that's a different beat (Phase 6's territory) and it skips the desidentification distance Step 5 creates.

```
[SAY] Ese momento en que {{behaviour_to_change}} — esa parte tuya que actuó
ahí, ¿qué estaba tratando de hacer por vos? ¿De qué te estaba protegiendo?
¿O hacia qué te estaba llevando? [/SAY]
```

**Capture:** `{{intention_behind_action}}`

☞ The CPT-flavored answer is typically *"me estaba protegiendo de sentir / recordar / enfrentar [X]"*. The avoidance had a protective intention. Naming it AS protective (rather than as failure) is what makes Phase 6's stuck-point teaching land.

#### Step 6 — Thoughts during the moment

(Amplification opener — same canonical structure.)

```
[SAY] [Lee la línea sugerida en /for-experts — dos opciones opuestas
+ escape hatch] [/SAY]
```

**Capture:** `{{thoughts_during_relapse}}`

☞ **CPT-specific amplification tuning:** the two opposed poles for `thoughts_during_relapse` should be calibrated to CPT's six belief domains (safety / trust / power / control / esteem / intimacy). Example pair for an avoidance-driving prospect: *"si paso por ahí algo malo va a pasar"* (safety) vs. *"soy un cobarde por evitarlo"* (esteem). The escape hatch lets them go to a third belief domain entirely.

#### Step 7 — Self-talk after the moment

```
[SAY] [Lee la línea sugerida en /for-experts — dos quotes opuestos +
"¿o algo más feo que eso?"] [/SAY]
```

**Capture:** `{{self_talk_after_relapse}}` — VERBATIM.

#### Step 8 — View of life in that moment (PEAK — synthesis amplification)

```
[SAY] Por cómo me lo describís — [eco breve: feelings + thoughts + self-talk]
— suena como que en ese momento tu vida se veía como [tu síntesis CPT-flavored:
"un terreno minado donde tenés que esquivar para sobrevivir" / "una pelea
con vos mismo sobre qué creer" / "una cárcel hecha de creencias viejas"].
¿Se parece a eso? ¿O era distinto? [/SAY]
```

**Capture:** `{{view_of_their_life_in_that_moment}}`

⚠️ The **CORRECTION** is the gold. Synthesis-amplification is preserved verbatim from canon.

#### Step 9 — Consequences

```
[SAY] Y este patrón, repitiéndose una y otra vez — ¿qué te ha costado en tu
vida? ¿En tus relaciones, en tu trabajo, en cómo te ves a vos mismo? [/SAY]
```

**Capture:** `{{consequences_for_them}}`

#### End of 5b — assess identification

```
[SAY] Dejame tomar un momento con lo que acabamos de ver. [/SAY]
```

Write: `{{grado_de_identificacion}}` = low / medium / high (per canonical rubric).

## Phase 6 — Second close (problem awareness, CPT-flavored)

**Goal:** Name the deeper problem (stuck-point identification) and get them to see they have it.

`[CONDITION: grado_de_identificacion=high]`

```
[SAY] Imagina que la creencia que querés cambiar — esa creencia de fondo
que escuchamos antes ({{impact_self_belief}}) — es un *stuck point*, un
punto donde tu mente se quedó atascada después del evento original. Cada
vez que {{behaviour_to_change}}, ese stuck point gana espacio: confirma su
propia historia. La evitación lo refuerza.

Es casi imposible cambiar el comportamiento cuando uno cree que ese
comportamiento es uno mismo — cuando creemos que SOMOS la creencia
bloqueante en lugar de simplemente TENERLA. Esto se llama identificarse
con el stuck point.

Cuando una persona tiene un grado de identificación muy alto, probablemente
se trata muy mal a sí misma con sus propios pensamientos en esos momentos
— y la creencia se hace más rígida cada vez.

Vos en este momento parecés estar en un grado de identificación alto.

La solución se llama desidentificación con la creencia bloqueante, y
consiste en ver el stuck point como algo que tu mente fabricó para
protegerte después de un evento difícil — no como verdad sobre quién sos.
Entender que vos no sos tus creencias bloqueantes; las tenés, las podés
mirar, las podés desafiar.

Y justamente eso es lo primero que empezamos a resolver con Samwise:
ayudarte a desidentificarte para que puedas desafiar el stuck point
directamente, en lugar de declararte la guerra a vos mismo. [/SAY]

[SAY] ¿Qué pensás de lo que te acabo de decir? [/SAY]
```

Common rebound: *"Wow, nunca lo había visto así. ¿Pero cómo se resuelve? ¿Por qué me tengo que desidentificar si la creencia es mía? ¿Decir que no es mía no es una mentira?"*

```
[SAY] No es decir que no es tuya — es decir que la creencia la fabricó tu
mente en un momento difícil, y como toda fabricación, se puede revisar.
Esas son exactamente las preguntas que la próxima sesión está diseñada
para responder, una por una, aplicadas a tu caso. Las vamos a trabajar
con un proceso concreto que se llama el desafío socrático — preguntas
específicas que te ayudan a probar la creencia contra la evidencia real
de tu vida. [/SAY]
```

`[/CONDITION]`

`[CONDITION: grado_de_identificacion=low,medium]`

(Short ack version — same structure as canonical Demo, with the stuck-point vocabulary substituted. SKIP Phases 7 & 8, go to 8.5.)

`[/CONDITION]`

## Phase 7 — Solution: introduce desidentification (CPT-flavored)

`[CONDITION: grado_de_identificacion=high]`

```
[SAY] La clave para resolver este patrón está en ser consciente de que las
creencias bloqueantes — los stuck points — son una respuesta biológicamente
normal del cerebro después de eventos difíciles. No son una falla moral. La
mente forma esas creencias para predecir y evitar peligro futuro; el
problema es que se quedan congeladas, fuera de proporción con la realidad
actual.

Las personas que las resuelven no las resisten — las desafían. Las
examinan. Comparan la creencia con la evidencia. Y construyen una creencia
nueva, más exacta, que protege sin paralizar.

Cuando te das cuenta de eso, un episodio de {{behaviour_to_change}} ya no
es un fracaso personal — es una señal de que el stuck point sigue
encendido y que el desafío todavía no terminó. Es información útil, no
condena.

¿Dónde entramos nosotros? Te ayudamos a que cuando aparezca el momento de
evitar, no tengas que confiar mágicamente en vos. En vez de eso, te vamos
a dar una acción exacta para ese momento — un desafío al stuck point
preparado de antemano, en tus propias palabras. Tu trabajo no es sentirte
fuerte — tu trabajo es leer y seguir el desafío. Un protocolo. Así es
como te empezás a desidentificar de la creencia bloqueante. [/SAY]

[SAY] ¿Cómo vas con lo que te acabo de decir? [/SAY]

[SAY] Te quiero invitar a construir juntos un mantra de desidentificación.
La idea es tomar la creencia bloqueante que escuchamos antes
({{impact_self_belief}}), pasarla por un desafío concreto, y construir una
versión nueva — más precisa, más útil — que vas a leer en voz alta cada
día como recordatorio. [/SAY]
```

`[/CONDITION]`

## Phase 8 — Third close (mantra commitment via worksheet)

`[CONDITION: grado_de_identificacion=high]`

**Goal:** Construct the desidentification mantra using a compact CPT Challenging Questions Worksheet pass. The OUTPUT of the worksheet IS the mantra.

☞ **This is the load-bearing CPT-specific adaptation.** The canonical Samwise Phase 8 builds the mantra as a fight-the-enemy declaration. CPT replaces the construction MECHANISM: the mantra emerges from challenging the stuck point against evidence. The mantra has the same FORM (a sentence the person reads aloud daily) but a different SOURCE (cognitive challenge, not pure declaration).

Open the Ritual Doc. Build the desidentification section together.

**Worksheet pass — five Socratic prompts:**

```
[SAY] Vamos a tomar la creencia bloqueante específica
({{impact_self_belief}}) y la vamos a desafiar con cinco preguntas. No
hace falta que tengas las respuestas perfectas — la idea es ver la
creencia desde ángulos que normalmente no la mirás. [/SAY]
```

1. *Evidencia.* `[SAY] ¿Qué evidencia REAL — eventos concretos, no
   sensaciones — apoya la creencia "{{impact_self_belief}}"? ¿Y qué
   evidencia real la contradice? [/SAY]`
   Capture both lists into the Ritual Doc.

2. *Hábito vs. hecho.* `[SAY] ¿Esta creencia la armaste a partir del
   evento original, o ya la tenías de antes? Si es nueva del evento — ¿qué
   creías sobre vos antes de que pasara? [/SAY]`

3. *Doble estándar.* `[SAY] Si un amigo cercano te contara exactamente
   esto mismo — el mismo evento, la misma reacción — ¿le dirías que
   {{impact_self_belief}}? ¿O le dirías otra cosa? ¿Qué le dirías? [/SAY]`

4. *Contexto.* `[SAY] La creencia "{{impact_self_belief}}" es CIERTA en
   todas las áreas de tu vida — todas, sin excepción — o hay áreas donde
   claramente NO es cierta? Nombrame una. [/SAY]`

5. *Construcción de la versión modificada.* `[SAY] Mirando todo lo que
   acabás de decir — ¿cuál sería una versión MÁS PRECISA de esta creencia?
   No el opuesto, no algo positivo a la fuerza — algo que recoja la
   verdad de lo que pasó, y también lo que sabés ahora que la creencia
   vieja ignora. [/SAY]`

   **Capture:** `{{clinical_picture_description}}` — written into the Ritual Doc as the modified belief. This IS the mantra.

**Mantra ceremony:**

Have them write down and say out loud:

```
[SAY] Yo no soy "{{impact_self_belief}}". Esa creencia la armé después
de un evento difícil, y ahora sé que la verdad más precisa es
"{{clinical_picture_description}}". Voy a leer esta verdad nueva cada
día hasta que mi mente la reconozca tan rápido como reconocía la vieja. [/SAY]
```

`[/CONDITION]`

## Phase 8.5 — Acknowledge the fit

(Verbatim per canonical Demo.)

`[CONDITION: grado_de_identificacion=high]`
```
[SAY] Por cómo viviste todo esto, veo que tu identificación con la creencia
bloqueante es alta — y eso es justamente lo que me dice que hay un muy buen
fit para trabajar juntos. [/SAY]
```
`[/CONDITION]`

`[CONDITION: grado_de_identificacion=low,medium]`
```
[SAY] Perfecto. Te muestro entonces cómo es todo el proceso de acá en
adelante. [/SAY]
```
`[/CONDITION]`

## Phase 9 — Roadmap to achieve core motivation

(Verbatim per canonical Demo, with two CPT-specific substitutions:)

- *"mantra de desidentificación"* → *"mantra construido por desafío socrático"*
- In Paso 3's ritual mechanism explanation, the "said part" now reads: *"Mantras (versiones modificadas de las creencias bloqueantes construidas con desafío socrático): desidentificación, protection, new belief."*

## Phase 10 — Eliminate perception of risk

(Verbatim per canonical Demo. No CPT swap.)

## Phase 11 — Price (with the canonical verdict line)

(Verbatim per canonical Demo. The verdict line *"Antes de hablar de inversión, te confirmo algo: vi lo que necesitaba ver. Tu caso es uno con el que podemos trabajar bien."* is canon and NOT touched.)

## Phase 12 — Close and next steps (CPT-flavored closing reframe)

**Goal:** Close on something the framework GIVES, not something the prospect has to manufacture. CPT-specific frame: the deliverable is the **modified belief** (the mantra they just wrote in Phase 8) + the daily worksheet practice. Concrete artifacts, not "tenés que tener fe."

(All branching from canonical Demo preserved. Outcome / next_step / rep_notes capture unchanged.)

## Phase 13 — Handling the economic rebound

(Verbatim per canonical Demo. Mirror, diagnose, dignified exit.)

## Phase 14 — Handling the alternatives rebound

(Verbatim per canonical Demo.)

## Phase 15 — Handling the scientific evidence rebound (CPT-extended)

```
[SAY] CPT es una de las terapias para trauma con más evidencia clínica del
mundo — la APA la recomienda con la evidencia más fuerte para PTSD. La
diferencia con Samwise es que en lugar de pedirte tareas y desaparecer
entre sesiones, te acompañamos cada día con el agente para que el desafío
socrático lo hagas en el momento que aparece la creencia bloqueante — no
una semana después. La adherencia es lo que multiplica el efecto: cuando
las personas hacen el trabajo cognitivo entre sesiones, alrededor del 65%
avanza significativamente, frente a un 35% en quienes no las hacen. Cuando
las hacen con calidad, sube al 70%. Si querés revisar la literatura
académica, tenemos una sección en nuestra página con links. [/SAY]
```

## Phase 15.5 — Handling the sustainability rebound

(Verbatim per canonical Demo, with the daily-ritual breakdown using the 4-beat structure named explicitly: Exit from the day / Entry into the work / Intentions / The pact. CPT-specific note in Intentions beat: *"En Intentions el agente te pide leer la versión modificada de tu stuck point del día, en voz alta."*)

## Phase 15.6 — Handling the continuity rebound

(Verbatim per canonical Demo. *"Cuando el stuck point muta, agendamos una sesión con la Dra. Ana María y hacemos un nuevo worksheet pass."*)

## Phase 16 — Rebound: confirm value, surface why, bridge to referral

`[CONDITION: grado_de_identificacion=low]`

(Verbatim per canonical Demo. Reflect → Track → Align → Guide.)

## Phase 17 — Rebound: per-name follow-up

`[CONDITION: grado_de_identificacion=low]`

(Verbatim per canonical Demo.)

`[END]`

---

# Section 3 — Onboarding script (CPT-adapted)

```
[TYPE: onboarding]
[VERSION: 0.1-cpt]
```

90 minutes with the clinician (Dra. Ana María). Builds the full ritual.

**CPT-specific phase deltas** (only sections where CPT changes the canonical Onboarding):

- **Phase 4a — Name the enemy** → renamed to *"Name the stuck point"*. `enemy_name` is filled with the CPT formulation: the specific belief-domain + the specific belief. Example: *"Mi stuck point de seguridad: 'todo lugar nuevo es peligroso'"*. Same canonical position; just framed as a stuck point.

- **Phase 6 — Teaching the loop** → CPT cognitive avoidance loop replaces the generic enemy-attacks-confidence framing:
  ```
  [SAY] El patrón funciona así: pasa un evento difícil → tu mente arma una
  creencia para entender lo que pasó y predecir el peligro futuro (esa es
  el stuck point) → la creencia te lleva a evitar situaciones que la
  podrían contradecir → la evitación impide que tu mente recoja evidencia
  nueva → el stuck point se hace más rígido. La salida es romper el ciclo
  por el lado cognitivo: desafiar la creencia con evidencia real, no
  esperar a sentirte distinto. [/SAY]
  ```

- **Phase 7a — Concrete action protocol** → "pedir ayuda = fe en sí mismo" reframe gets CPT casting: the concrete action IS the worksheet. *"No tenés que tener fe. Tenés que tomar el papel y contestar las cinco preguntas. La fe viene después, como subproducto."*

- **Phase 8 — Mantra construction** → full Challenging Questions Worksheet pass (same five questions as Demo Phase 8, longer-form). Each of three mantras (desidentificación / protection / new belief) is built by ONE worksheet pass. Total three passes in this 90-minute session.

- **Phase 9 (unsettling_reality)** → CPT-specific framing: `{{unsettling_reality}}` is the precise stuck point in CPT vocabulary, distinguished from `{{scary_reality}}` (the visible avoidance pattern). Don't move past this beat until the patient has stated the stuck point in one clear sentence, using one of CPT's six domains (safety / trust / power / control / esteem / intimacy).

- **Phase 12b — Activity for the new belief** → CPT calls this **behavioural experiments**: small actions specifically designed to test the modified belief against new evidence. The activity is selected with the patient based on which domain the modified belief lives in. Example: if the modified belief is *"puedo manejar incomodidad sin que pase nada catastrófico"*, the daily activity could be one 30-second exposure to a previously avoided thing.

All other Onboarding phases (1, 2, 3, 5, 10, 11, 12a, 13, 14) preserved verbatim. The Phase 15 REBOUNDS convention also preserved — CPT-specific rebounds can be added per the convention if the compressed version doesn't land.

---

# Section 4 — Behavioural-design "Possible Origins" tab spec → Trauma Account

The behavioural-design flow currently fills a "Possible origins" tab with a timeline of moments where the loop turned on / evolved. CPT replaces this with the **Trauma Account** procedure.

**Structural mapping:**

| Possible Origins (canonical) | Trauma Account (CPT) |
|---|---|
| Timeline of moments where the loop turned on / evolved | Single detailed written narrative of the WORST traumatic experience |
| Per-entry structure: year/age, experience before, experience during, feelings, thoughts, experience after | Per-paragraph structure: sensory recreation (sights / sounds / smells / body sensations) + thoughts at the time + meaning made after |
| Agent walks the user topic by topic; agent writes via `writeToDocTab` | Patient writes the account themselves between sessions, then reads it aloud in the next session with the clinician |
| Multiple entries OK | ONE event, in full detail |

**Adaptation note (a real procedure hole):** the canonical Possible Origins flow has the AGENT write to the Doc autonomously. CPT's Trauma Account requires the PATIENT to write it — the writing itself is therapeutic (it breaks the avoidance pattern of not writing about it). The behavioural-design agent for CPT users CANNOT autonomously write the account; it must instead **facilitate the patient writing it**. This is a meaningful infra change downstream — the `writeToDocTab` tool needs a mode where the user dictates / types and the agent only confirms / asks follow-ups, never authors.

**Agent script delta:**

The CPT-adapted behavioural-design agent walks the patient through writing the account aloud (or typing), prompting only:
- *"¿Qué pasó? Contame el evento de principio a fin, despacio."*
- *"Pausá un segundo — ¿qué estabas viendo, oliendo, oyendo en ese momento?"*
- *"¿Y qué pensaste en ese segundo?"*
- *"¿Y después, cuando ya pasó, qué empezaste a creer sobre vos mismo?"*

The agent writes only the patient's verbatim words. No synthesis, no compression.

---

# Section 5 — Call Design (Mantras / Protection / Activity, CPT-flavored)

The Ritual tab has three sub-topics: Protection / Mantras / Activity for the New Belief. CPT instantiation:

**Mantras (3):**

- *Desidentificación mantra* — output of Phase 8 worksheet pass on `impact_self_belief`. *"Yo no soy [creencia vieja]. La verdad más precisa es [creencia modificada]."*
- *Protection mantra* — short reminder phrase that anchors the modified belief in the body. *"Cuando aparezca el impulso de [behaviour_to_change], paro un segundo y digo: [creencia modificada]."*
- *New belief mantra* — the modified belief in its purest form, said as affirmation. Built from the worksheet output, NOT invented as a positive slogan.

**Protection:**

The concrete action the patient takes when the stuck point fires. CPT-specific: the protection IS a mini-worksheet pass in the moment.
- Step 1: name the belief that just fired.
- Step 2: ask one of the five challenging questions (rotate per day).
- Step 3: read the modified belief out loud.

This is structurally similar to canonical Samwise protection but with CPT's cognitive challenge embedded in the protocol.

**Activity for the new belief:**

A daily behavioural experiment — a small action that gives the modified belief evidence to land on. Selected with the clinician during Call Design. Examples (depending on the patient's domain):
- For *safety* domain: drive past a previously-avoided intersection once a day for 5 seconds.
- For *intimacy* domain: send one text expressing a vulnerable feeling to one trusted person.
- For *power/control* domain: make one small decision today that you previously would have deferred.

Each activity is calibrated to the patient's tolerance window — bigger than yesterday, smaller than overwhelming.

---

# Section 6 — Daily AI agent prompt (4-beat ritual, CPT-flavored)

The daily AI call follows the canonical 4-beat structure verbatim; only the *content* of each beat shifts to CPT vocabulary.

**Beat 1 — Exit from the day** *(unchanged)*

Symbolic anchor + sensory grounding + permission for the pause.

**Beat 2 — Entry into the work**

```
[SAY] Vamos al trabajo cognitivo del día. Te recuerdo tu stuck point de
fondo: "{{impact_self_belief}}". Y tu versión modificada, que vos mismo
construiste con el desafío socrático: "{{clinical_picture_description}}".
Tomate un segundo para volver a oír las dos. [/SAY]

[SAY] ¿Cómo se sintió hoy la creencia vieja — apareció? ¿Cuándo? [/SAY]
```

**Beat 3 — Intentions** *(CPT-extended)*

```
[SAY] Tres intenciones, en tres horizontes.

Para los próximos minutos: leé la versión modificada en voz alta, tres
veces, despacio.

Para el resto del día: cuando aparezca el impulso de {{behaviour_to_change}},
ANTES de hacerlo o no hacerlo, pasá la creencia que aparezca por una de
las cinco preguntas. Hoy te toca la pregunta: [rotating: evidencia / hábito
vs hecho / doble estándar / contexto / construcción]. Anotá la respuesta,
aunque sea en el teléfono.

Para el largo plazo: hacé el behavioural experiment del día — [activity
specific to current modified belief domain]. [/SAY]
```

**Beat 4 — The pact**

```
[SAY] Tu pacto para las próximas 24 horas: una sola cosa, concreta y
chica. ¿Cuál es? [/SAY]
```

(Same structure as canonical pact; the content tends to be CPT-flavored — a worksheet pass, a behavioural experiment iteration, a text to a trusted person, etc.)

---

# Section 7 — §5 self-check answers for this worked example

Per the procedure's §5 hard constraints, this example answers each before being declared finished:

- Did I keep the 4-beat call structure intact? **Y** — Exit / Entry / Intentions / Pact preserved verbatim in Section 6, named explicitly in Phase 15.5.
- Did I keep every mandatory beat from §1.4 (Phase 1.5, Phase 5b 9-step, Phase 11 verdict)? **Y** — all three preserved verbatim, Phase 1.5 extended with the impact-statement triad (additive, not replacement).
- Did I keep Phase 5b's 9-step ordering and the IFS reframe at Step 5? **Y** — order verbatim, parts-language at Step 5 preserved (CPT clinicians use parts-language; the move is identical).
- Did I sweep the spoken text for *paciente / recaída / terapia / comportamiento autodestructivo*? **Y** — instances of "patient" / "recaída" / "terapia" in CPT's own native vocabulary were neutralized (persona / *regreso al patrón de evitación* / *el proceso* respectively). One exception flagged for review: the word *terapia* appears in the Phase 15 science-evidence rebound (*"CPT es una de las terapias para trauma con más evidencia clínica"*) where it's referring to the broader field, not Samwise itself. Decision needed: hard-replace or accept the meta-reference?
- Did I preserve every `{{variable}}` slot exactly as written? **Y** — plus 3 new ones added (`impact_self_attribution`, `impact_self_belief`, `impact_world_belief`).
- Did I preserve every `[SAY] / [/SAY]` marker exactly? **Y**.
- Did I only modify what the procedure designates as swappable? **Y** — Section 1's three new variables are additive per the rubric's "Initial belief capture" role; Section 4's Trauma-Account swap is per "Narrative integration"; Phase 8's worksheet pass is per "Cognitive intervention" multi-slot allowance.
- Did I avoid mixing metaphors across phases? **Y** — *stuck point* / *creencia bloqueante* / *desidentificación con la creencia bloqueante* used consistently across all sections.
- Did the framework's stance on user agency get respected in the closing reframe? **Y** — Phase 12 lands on a concrete CPT deliverable (the modified belief written in the Ritual Doc + the daily worksheet practice), not on self-belief manufacture. CPT's mid-agency stance (clinician-guided, patient does the cognitive work) is honored.
- For multi-slot framework components: did I format the same mechanism differently per slot? **Y** — CPT Worksheets appear at: (a) Demo Phase 8 as a compact 5-question pass producing the desidentificación mantra; (b) Onboarding Phase 8 as three full 5-question passes producing all three mantras; (c) Daily ritual Beat 3 as a single rotating challenging-question application in the moment; (d) Optimization session (deferred, not in this manifest) as a full pass on a new emergent stuck point.

---

# Section 8 — Procedure holes this example surfaced (push back into adaptation-procedure.md)

These are the points where I had to invent or guess because the procedure was vague. Per the user's Phase A.2 instruction, these get folded back into the procedure as sharpening edits:

1. **Behaviour-shape implication of framework choice.** CPT is for PTSD → `behaviour_to_change` is almost always an AVOIDANCE behaviour, not a consumption / impulse behaviour. The procedure should note that the behavioural-shape mental model shifts per framework family (CPT → avoidance; ITAA → compulsion; Brief Strategic → "attempted solution"; IFS → protector activation). This affects the Phase 5b Step 3 wording and the qualification framing.

2. **Phase 1.5 extensibility.** The procedure says "Phase 1.5 is mandatory." It doesn't say whether frameworks can ADD beats to it. CPT adds the impact-statement triad — additive, not replacement. The procedure should explicitly allow additive Phase 1.5 beats for frameworks that capture richer initial data, with the constraint that the canonical 4 beats (behaviour / motivation / worldview / journey) all still play.

3. **Multi-slot synthesis ambiguity.** Section 4 found a real conflict: CPT's Trauma Account requires the PATIENT to write, but the existing behavioural-design `writeToDocTab` tool is AGENT-authored. The procedure's §2 placement rubric says where things land, not WHO produces them. The procedure should add a column to the rubric: **authoring agency per slot** (agent-authored / patient-authored / co-authored). Otherwise the synthesizer will silently misplace authoring authority.

4. **Vocabulary-blacklist meta-reference exception.** When the framework's NAME (CPT, ITAA, etc.) contains a blacklisted word ("therapy" → *terapia*), references TO the framework itself collide with the blacklist. Section 7 flagged Phase 15's *"CPT es una de las terapias…"* — should the rule be: blacklist applies to first-person references to Samwise's offering, exemption for third-person references to the framework field? Procedure should specify.

5. **Mantra-construction mechanism vs. mantra-form interaction.** Canonical Samwise Phase 8 builds the mantra as a declaration ("Estoy enfermo con… lo voy a aplastar"). CPT replaces the MECHANISM (worksheet → modified belief) but the FORM stays a sentence. What about frameworks where the form ALSO changes (e.g. IFS where the "mantra" is a dialogue, not a single sentence)? The procedure should explicitly allow per-framework mantra forms, with the constraint that whatever the form, it must be (a) said out loud daily and (b) anchored in the daily ritual's Intentions beat.

---

*End of draft 0.1. Push back in chat; I edit the file via the Edit tool; you refresh `/for-experts` → Build custom samwise → CPT Worked Example to see changes live.*
