// =====================================================================
// Onboarding Session config: variable list + per-variable metadata +
// default script Doc URL.
//
// Mirrors demo-call-config.ts. REUSES the DemoCallVariable interface
// (per session-copilot skill: do not fork the interface). DemoCallPhase
// was widened 2026-06-24 to `string | number` so onboarding's phases 1–14
// fit.
//
// Source of truth for the script + variable list: the onboarding Doc
//   https://docs.google.com/document/d/1FrglmnZGDlFS7S89LgaKjKpDiRLEPGxkAYtOomjT08E
// and its "Quick variable reference" section. Variables that flow forward
// from the demo are reflected (not re-asked) in Phase 1 — but live here
// as "pre-call" entries so the clinician can verify / edit them and so
// the script substitution machinery has a value to render.
//
// `frameworkSemantics` is sent to the cleanVariable cloud function with
// the surrounding script slots; it tells Gemini what to extract from the
// clinician's raw note and what to ignore. Drawn from the
// samwise-script-work skill (Rule 7 tag-by-tag semantics) and the
// onboarding script's per-phase capture instructions.
// =====================================================================

import type { DemoCallVariable } from "./demo-call-config"

// Pre-filled default Doc URL — the canonical onboarding script (the
// rewritten v0.2 with [SAY] markers, [CONDITION:] branching on
// grado_de_identificacion, and the demo-call lessons applied).
// The clinician can override this in the URL input at /copilot.
export const DEFAULT_ONBOARDING_SCRIPT_DOC_URL =
  "https://docs.google.com/document/d/1FrglmnZGDlFS7S89LgaKjKpDiRLEPGxkAYtOomjT08E/edit"

// Reps with login-like identity (no auth, just a dropdown). Onboarding
// is currently single-clinician (Dra. Ana María) but kept as a select
// for forward-compat.
export const KNOWN_CLINICIANS = ["Dra. Ana María Reyes Tirado", "Samuel Giraldo Concha"]

export const ONBOARDING_VARIABLES: DemoCallVariable[] = [
  // ---- Pre-call: clinician workflow ----
  { name: "call_date",       label: "Session date",  phase: "pre-call", meaning: "Date of the onboarding session (YYYY-MM-DD).", inputKind: "date",   cleanable: false },
  { name: "clinician_name",  label: "Clinician",     phase: "pre-call", meaning: "Who ran the session.",                          inputKind: "select", options: KNOWN_CLINICIANS, cleanable: false },
  { name: "prospect_name",   label: "Prospect name", phase: "pre-call", meaning: "Lookup key; the prospect's name.",              inputKind: "text",   cleanable: false },

  // ---- Pre-session: prefilled from the demo (verify, do NOT re-ask) ----
  // These flow forward from the demo's Phase 5b captures + the
  // qualification's prefilled fields. Phase 1 reflects (in this order):
  // behaviour, motivation, anchor/worldview, journey, life-stage,
  // grounded moment, feelings, intention. The script's "¿Es así?" close
  // confirms or corrects.
  {
    name: "behaviour_to_change",
    label: "Behaviour to change",
    phase: "pre-call",
    meaning: "Short verb-phrase form. Used in Phase 1 reflection, Phase 2 timeline, Phase 5 retroceso definition.",
    inputKind: "text",
    cleanable: true,
    frameworkSemantics: "The specific behaviour the prospect wants to change — a SHORT verb-phrase form (verb + object). Used in slots like 'cuando {{behaviour_to_change}}'. NEVER substitute a clinical or abstract noun. NEVER produce the full incident description (that belongs to behaviour_example). Examples: 'sacaste el teléfono y abriste Twitter', 'le gritaste a tu hijo'.",
  },
  {
    name: "behaviour_example",
    label: "Behaviour example (Phase 2 anchor)",
    phase: "pre-call",
    meaning: "Full grounded incident (WHEN/WHERE/ACTIVITY/ACTION as a noun-phrase). Phase 2 opens from this: 'Volvamos a {{behaviour_example}}'.",
    inputKind: "textarea",
    cleanable: false,
  },
  {
    name: "core_motivation",
    label: "Core motivation",
    phase: "pre-call",
    meaning: "What they're really trying to unlock.",
    inputKind: "textarea",
    cleanable: true,
    frameworkSemantics: "First-person infinitive-led noun phrase or short clause that completes sentences like 'la razón de fondo es ___'. Preserve emotionally loaded language and personal stakes. Examples: 'ser un padre responsable para mis dos hijas', 'terminar mi tesis este año'.",
  },
  {
    name: "symbolic_anchor_description",
    label: "Symbolic anchor description",
    phase: "pre-call",
    meaning: "What they draw strength from, in their own words. Used in Phase 1 reflection AND Phase 12a symbolic mantra options.",
    inputKind: "textarea",
    cleanable: true,
    frameworkSemantics: "The prospect's own description of the tradition/philosophy they draw strength from. Preserve specific references (book titles, deities, practices). Do NOT abstract away into a generic noun like 'spirituality' or 'religión'. Examples: 'la oración católica de mi infancia', 'la filosofía estoica, sobre todo Marco Aurelio'.",
  },
  {
    name: "alternatives_tried",
    label: "Alternatives tried",
    phase: "pre-call",
    meaning: "What else they've tried.",
    inputKind: "textarea",
    cleanable: true,
    frameworkSemantics: "Brief list of solutions the prospect has previously tried. Comma-separated phrase. In the language the prospect used.",
  },
  {
    name: "why_alternatives_failed",
    label: "Why alternatives failed",
    phase: "pre-call",
    meaning: "Why those didn't work.",
    inputKind: "textarea",
    cleanable: true,
    verbatim: true,
    frameworkSemantics: "The reason previous alternatives didn't deliver lasting change. In their voice, first-person. Preserve specifics.",
  },
  {
    name: "life_stage_context",
    label: "Life stage context",
    phase: "pre-call",
    meaning: "Where they are right now: work, family, what's loud.",
    inputKind: "textarea",
    cleanable: true,
    frameworkSemantics: "Current life context. Use primarily to disambiguate other variables. Examples: 'construyendo nuestra empresa, casado con dos hijas pequeñas'.",
  },
  {
    name: "problem_duration_self_reported",
    label: "Problem duration",
    phase: "pre-call",
    meaning: "How long they've been struggling.",
    inputKind: "text",
    cleanable: true,
    frameworkSemantics: "Verbatim duration phrase. Examples: 'dos años', 'desde la universidad'.",
  },
  {
    name: "feelings_during_relapse",
    label: "Feelings during the moment",
    phase: "pre-call",
    meaning: "Somatic content from the demo's Phase 5b Step 4. Reflected in Phase 1 ('sentías {{feelings_during_relapse}}').",
    inputKind: "textarea",
    cleanable: true,
    frameworkSemantics: "Emotional states during a relapse, the prospect's words. Examples: 'me siento cochina', 'numb', 'overwhelmed'.",
  },
  {
    name: "intention_behind_action",
    label: "Intention (IFS)",
    phase: "pre-call",
    meaning: "What the part was trying to do for them. Reflected in Phase 1 ('estaba tratando de {{intention_behind_action}}').",
    inputKind: "textarea",
    cleanable: true,
    frameworkSemantics: "What the prospect was unconsciously seeking when the relapse happened. Short noun-phrase or clause. Examples: 'escape stress', 'feel needed', 'salirse del dolor un rato'.",
  },
  {
    name: "thoughts_during_relapse",
    label: "Thoughts during the moment",
    phase: "pre-call",
    meaning: "Demo Step 6 capture. Background context for Phase 9 unsettling-reality work.",
    inputKind: "textarea",
    cleanable: true,
    frameworkSemantics: "Thoughts the prospect described having DURING a relapse, in their voice and language.",
  },
  {
    name: "self_talk_after_relapse",
    label: "Self-talk after",
    phase: "pre-call",
    meaning: "VERBATIM quote from demo Step 7. Reflected in Phase 9 unsettling-reality work when needed.",
    inputKind: "textarea",
    cleanable: true,
    verbatim: true,
    frameworkSemantics: "VERBATIM quote of what the prospect tells themselves after relapsing. Preserve exact wording in original language. NEVER paraphrase or translate.",
  },
  {
    name: "view_of_their_life_in_that_moment",
    label: "View of life (PEAK)",
    phase: "pre-call",
    meaning: "Demo Step 8 capture — the corrected synthesis. Anchor for Phase 9 unsettling-reality work.",
    inputKind: "textarea",
    cleanable: true,
    frameworkSemantics: "How the prospect sees their life or themselves in the moment of relapse. Often dark, defeated. First-person. Preserve emotional charge.",
  },
  {
    name: "consequences_for_them",
    label: "Consequences",
    phase: "pre-call",
    meaning: "Demo Step 9 capture. Reinforces Phase 9 motivation.",
    inputKind: "textarea",
    cleanable: true,
    frameworkSemantics: "Real-life consequences of the behaviour — relationships, work, health, dignity. First-person where it fits.",
  },
  {
    name: "grado_de_identificacion",
    label: "Identification level (from demo)",
    phase: "pre-call",
    meaning: "Demo's end-of-5b read. DRIVES Phase 9 branch via [CONDITION] markers: low/medium = short ask, high = synthesis amplification with two opposed poles.",
    inputKind: "select",
    options: ["low", "medium", "high"],
    cleanable: false,
    // Default to "high" so the deeper Phase 9 path is the safe default
    // before the clinician verifies (mirrors demo's default).
    defaultValue: "high",
  },
  {
    name: "self_destructive_behaviour",
    label: "Self-destructive behaviour (legacy)",
    phase: "pre-call",
    meaning: "Legacy demo variable. Substituted in mantra slots that have not yet been swept for Rule 7 vocab. Editable by the clinician if needed.",
    inputKind: "textarea",
    cleanable: true,
    frameworkSemantics: "Externalised description of the loop in the prospect's voice. Examples: 'una evasión compulsiva del trabajo bajo ansiedad'.",
  },
  {
    name: "clinical_picture_description",
    label: "Clinical picture description",
    phase: "pre-call",
    meaning: "Short externalising description used in Phase 8 / Phase 12c desidentificación mantras.",
    inputKind: "textarea",
    cleanable: true,
    frameworkSemantics: "Short externalising description that goes inside the desidentificación mantra ('Estoy enfermo de ___'). Externalise as a condition the prospect HAS, in their voice and metaphor. Do NOT write a clinical diagnosis.",
  },
  {
    name: "biologic_symbolic_analogy",
    label: "Biologic/symbolic analogy (from demo)",
    phase: "pre-call",
    meaning: "The illness analogy used to build the desidentificación frame in the demo. Carries into Phase 3 and Phase 8.",
    inputKind: "select",
    options: ["flu", "cold", "allergy", "diabetes", "cancer", "other"],
    cleanable: false,
  },

  // ---- Phase 2 — Diagnosis: locate the origin ----
  {
    name: "problem_start_timeline",
    label: "Problem start timeline",
    phase: 2,
    meaning: "When the loop first turned on.",
    inputKind: "textarea",
    cleanable: true,
    frameworkSemantics: "When the behaviour first started, in the prospect's words. Examples: 'hace dos años, cuando me separé', 'en la universidad'.",
  },
  {
    name: "experience_before",
    label: "Experience before",
    phase: 2,
    meaning: "What life looked like before the loop kicked in.",
    inputKind: "textarea",
    cleanable: true,
    frameworkSemantics: "What was happening in the prospect's life just before the loop started. First-person, preserve specifics.",
  },
  {
    name: "experience_during",
    label: "Experience during",
    phase: 2,
    meaning: "What was happening when the loop kicked in.",
    inputKind: "textarea",
    cleanable: true,
    frameworkSemantics: "What was happening when the loop started. First-person, preserve specifics.",
  },
  {
    name: "experience_after",
    label: "Experience after",
    phase: 2,
    meaning: "What came after.",
    inputKind: "textarea",
    cleanable: true,
    frameworkSemantics: "What came after the loop started. First-person, preserve specifics.",
  },
  {
    name: "feelings_at_origin",
    label: "Feelings at origin",
    phase: 2,
    meaning: "Captured via the IFS reframe — what the part was trying to do for them the first time.",
    inputKind: "textarea",
    cleanable: true,
    frameworkSemantics: "Emotional states at the origin moment, the prospect's words. Preserve emotional charge.",
  },
  {
    name: "thoughts_at_origin",
    label: "Thoughts at origin",
    phase: 2,
    meaning: "What was going through their head at the origin.",
    inputKind: "textarea",
    cleanable: true,
    frameworkSemantics: "Thoughts at the origin moment, in their voice and language.",
  },
  {
    name: "precipitantes",
    label: "Precipitantes",
    phase: 2,
    meaning: "What triggers the loop in daily life.",
    inputKind: "textarea",
    cleanable: true,
    frameworkSemantics: "Daily-life triggers for the loop. Comma-separated phrase or short list.",
  },
  {
    name: "mantenedores",
    label: "Mantenedores",
    phase: 2,
    meaning: "What keeps the loop alive.",
    inputKind: "textarea",
    cleanable: true,
    frameworkSemantics: "What keeps the loop running once it starts. Comma-separated phrase or short list.",
  },

  // ---- Phase 3 — Offer a frame ----
  {
    name: "framework_metaphor",
    label: "Framework metaphor",
    phase: 3,
    meaning: "Which metaphor the prospect chose for the loop. Drives Phase 4 wording and Phase 8 mantra register.",
    inputKind: "select",
    options: ["gripa", "enemy", "other"],
    cleanable: false,
    // Default to "gripa" so the script can render before the prospect
    // picks; clinician overrides on capture.
    defaultValue: "gripa",
  },

  // ---- Phase 4 — Name the loop ----
  {
    name: "scary_reality",
    label: "Scary reality",
    phase: 4,
    meaning: "The reality that triggers the loop, in the prospect's wording. Candidate framings offered, prospect picks.",
    inputKind: "textarea",
    cleanable: true,
    frameworkSemantics: "The reality whose appearance triggers {{behaviour_to_change}}. In the prospect's own wording, first-person where it fits. Examples: 'no estoy donde quiero estar', 'estoy yendo hacia una vida que no se siente mía'.",
  },
  {
    name: "enemy_name",
    label: "Enemy name",
    phase: 4,
    meaning: "The name the prospect gave their enemy. Used throughout the rest of the session and the ritual.",
    inputKind: "text",
    cleanable: true,
    frameworkSemantics: "The proper-noun name the prospect chose for their enemy. Verbatim — preserve their exact word (could be 'la gripa', 'el hijueputa', 'la sombra', 'la bestia', etc.). Do NOT generalize.",
  },

  // ---- Phase 5 — Define a retroceso ----
  {
    name: "relapse_definition",
    label: "Retroceso definition",
    phase: 5,
    meaning: "The prospect's own wording of what a retroceso is for them. Variable name kept as relapse_definition for downstream compat; the spoken word is 'retroceso'.",
    inputKind: "textarea",
    cleanable: true,
    frameworkSemantics: "The prospect's own definition of a retroceso (the script's renamed 'recaída'). First-person, in their voice.",
  },

  // ---- Phase 6 — Habilitadores ----
  {
    name: "medium_of_consumption",
    label: "Medium of consumption",
    phase: 6,
    meaning: "What medium the prospect uses.",
    inputKind: "text",
    cleanable: true,
    frameworkSemantics: "The medium through which the behaviour happens (phone, laptop, food, etc.). Short noun.",
  },
  {
    name: "can_avoid_medium",
    label: "Can avoid medium?",
    phase: 6,
    meaning: "Usually 'no' — they work with it.",
    inputKind: "select",
    options: ["yes", "no"],
    cleanable: false,
  },
  {
    name: "usual_consumption_company",
    label: "Usual company",
    phase: 6,
    meaning: "Often 'nadie' — loneliness becomes the main enabler.",
    inputKind: "text",
    cleanable: true,
    frameworkSemantics: "Who the prospect is usually with when they fall into the loop. Often 'nadie' / 'alone'.",
  },
  {
    name: "main_enabler",
    label: "Main enabler",
    phase: 6,
    meaning: "The most-relied-on habilitador for this prospect (typically la soledad).",
    inputKind: "text",
    cleanable: true,
    frameworkSemantics: "The main habilitador for this prospect — single short noun-phrase. Examples: 'la soledad', 'el teléfono'.",
  },

  // ---- Phase 7 — Bloqueadores ----
  {
    name: "social_help_resistance_pattern",
    label: "Social-help resistance pattern",
    phase: 7,
    meaning: "Their specific resistance to asking for help.",
    inputKind: "textarea",
    cleanable: true,
    frameworkSemantics: "The prospect's specific resistance shape when asked about social help. First-person, in their voice. Examples: 'no quiero molestar', 'no esperás que la ayuda sea buena'.",
  },
  {
    name: "helpers_list",
    label: "Helpers list",
    phase: 7,
    meaning: "Names + relationships + how to contact in the moment. Goes directly into the ritual.",
    inputKind: "textarea",
    cleanable: true,
    frameworkSemantics: "List of 2-4 helpers the prospect committed to. Each entry: name + relationship + contact (phone/WhatsApp). Newline-separated.",
  },

  // ---- Phase 8 — Add immediate protection to the ritual ----
  {
    name: "mantra_v1",
    label: "Ritual v1 status",
    phase: 8,
    meaning: "Marker that the v1 mantras + blocker were written into the Ritual Doc.",
    inputKind: "select",
    options: ["complete", "partial", "skipped"],
    cleanable: false,
  },

  // ---- Phase 9 — Unsettling reality (the most important moment) ----
  {
    name: "unsettling_reality",
    label: "Unsettling reality (PEAK)",
    phase: 9,
    meaning: "The deeper form of scary_reality — the reality the new belief will face. Precise, in their voice, passes the three quality tests.",
    inputKind: "textarea",
    cleanable: true,
    frameworkSemantics: "The deeper form of {{scary_reality}} — what the prospect realises is actually inquietante about it. Must be precise, in their own voice. Honest and specific (no abstractions). Preserve metaphors verbatim.",
  },

  // ---- Phase 10 — Expectations reframe ----
  {
    name: "expectations_new",
    label: "Expectations (new)",
    phase: 10,
    meaning: "Where their faith now sits, in their own words. Completes 'Mi fe ahora está en ___'.",
    inputKind: "textarea",
    cleanable: true,
    frameworkSemantics: "The prospect's articulation of where their faith now sits. First-person, infinitive or noun-phrase that completes 'Mi fe ahora está en ___'.",
  },
  {
    name: "precipitants_list",
    label: "Precipitants list (3+)",
    phase: 10,
    meaning: "3+ specific moments where unsettling_reality appeared just before a retroceso. With IFS reframe per moment.",
    inputKind: "textarea",
    cleanable: true,
    frameworkSemantics: "At least 3 concrete moments where the prospect felt the unsettling reality just before a retroceso. Each moment short (1-2 sentences). Newline-separated.",
  },

  // ---- Phase 11 — Leap of faith ----
  {
    name: "leap_of_faith_reaction",
    label: "Leap-of-faith reaction",
    phase: 11,
    meaning: "Their honest, often resistant, response to putting faith in uncertain hopes.",
    inputKind: "textarea",
    cleanable: true,
    frameworkSemantics: "The prospect's honest response to the leap-of-faith framing. First-person, preserve emotional charge.",
  },

  // ---- Phase 12 — Complete the ritual ----
  {
    name: "symbolic_help_mantra",
    label: "Symbolic mantra",
    phase: 12,
    meaning: "Chosen from the prospect's tradition (named explicitly). Goes into Phase 12c ritual write.",
    inputKind: "textarea",
    cleanable: true,
    frameworkSemantics: "The symbolic mantra the prospect chose, sourced from their named tradition. Preserve their language and the specific tradition reference.",
  },
  {
    name: "daily_activity_to_face_reality",
    label: "Daily activity",
    phase: 12,
    meaning: "Embarrassingly small if needed. The one daily activity the prospect commits to.",
    inputKind: "textarea",
    cleanable: true,
    frameworkSemantics: "The single daily activity the prospect commits to facing {{unsettling_reality}}. Concrete, alcanzable, embarazosamente chica si hace falta.",
  },
  {
    name: "daily_activity_time_slot",
    label: "Daily activity time slot (DAY_HH:MM)",
    phase: 12,
    meaning: "Schedule key for downstream synthesis (e.g. MON_07:00). 24h time, half-hour boundary.",
    inputKind: "text",
    cleanable: false,
  },
  {
    name: "mantra_v2",
    label: "Ritual v2 status",
    phase: 12,
    meaning: "Marker that the complete ritual (mantras + bloqueador + daily activity) was written into the Ritual Doc.",
    inputKind: "select",
    options: ["complete", "partial", "skipped"],
    cleanable: false,
  },

  // ---- Phase 13 — Handoff ----
  {
    name: "ritual_handed_off_to_agent",
    label: "Ritual handed off to agent",
    phase: 13,
    meaning: "Y + timestamp once the first AI call is scheduled / activated.",
    inputKind: "text",
    cleanable: false,
  },
  {
    name: "next_optimization_date",
    label: "Next optimization date",
    phase: 13,
    meaning: "If scheduled.",
    inputKind: "date",
    cleanable: false,
  },

  // ---- Phase 14 — Close ----
  {
    name: "session_outcome",
    label: "Session outcome",
    phase: 14,
    meaning: "Did the ritual get built?",
    inputKind: "select",
    options: ["ritual_complete", "partial", "needs_followup"],
    cleanable: false,
  },

  // ---- Post-session ----
  {
    name: "clinician_notes",
    label: "Clinician notes",
    phase: "post-call",
    meaning: "What worked, what didn't, watch-outs for the agent, anything the demo team should know.",
    inputKind: "textarea",
    cleanable: true,
    frameworkSemantics: "Free-text clinician notes for handoff. Light cleanup only — preserve detail and observations. Not substituted into spoken script.",
  },
]

// Column order for the onboarding sheet (forward-compat; the
// onboardingSessions Firestore doc doesn't impose an order, but a
// future tracker sheet would need this in lockstep).
export const ONBOARDING_SHEET_COLUMNS: string[] = ONBOARDING_VARIABLES.map(
  (v) => v.name,
)
