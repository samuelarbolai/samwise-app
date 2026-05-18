// =====================================================================
// Demo Call config: variable list + per-variable metadata + default
// script Doc URL.
//
// Variable metadata is hardcoded here (not loaded from anywhere) for
// two reasons:
//   1. It rarely changes — script text iterates often, variables don't.
//   2. UI affordances (select options, verbatim tag, input kind,
//      framework-semantics for cleaning) don't exist in the script Doc
//      or funnel sheet in a parseable form.
//
// Source of truth for the variable list and its phase column:
//   https://docs.google.com/spreadsheets/d/1YS0ZVjB3rZK_AZKMeCbBbD__Mvz91lWXAqHcIBt0Cmw
//   (the metadata table at the bottom).
//
// `frameworkSemantics` is sent to the cleanVariable cloud function along
// with the surrounding script slots; it tells Gemini what to extract from
// the rep's raw note and what to ignore. Drawn from the synthesis-prompt
// skill's Rule 7 (tag-by-tag semantics) + the samwise-script-work skill.
// =====================================================================

export type DemoCallPhase =
  | "pre-call"
  | 2
  | 3
  | 5
  | 7
  | 8
  | 10
  | "post-call"

export type InputKind = "text" | "textarea" | "select" | "number" | "date"

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
}

// Pre-filled default Doc URL — the canonical v0.3 Demo script.
// The rep can override this in the URL input at /copilot.
export const DEFAULT_DEMO_SCRIPT_DOC_URL =
  "https://docs.google.com/document/d/1hntQClh8TUUVYOw148sFGRhy33JqtleuvI5BC8rM4eg/edit"

// Funnel-sheet target for appendDemoCallRow.
export const FUNNEL_SHEET_ID =
  "1YS0ZVjB3rZK_AZKMeCbBbD__Mvz91lWXAqHcIBt0Cmw"
// Tab name (NOT gid) — the funnel sheet's "Demo call" tab (gid=794107148).
export const DEMO_CALL_SHEET_TAB = "Demo call"

// Reps with login-like identity (no auth, just a dropdown).
export const KNOWN_REPS = ["Samuel Giraldo Concha", "Maria"]

export const DEMO_CALL_VARIABLES: DemoCallVariable[] = [
  // ---- Pre-call ----
  { name: "call_date",        label: "Call date",         phase: "pre-call", meaning: "Date of the call (YYYY-MM-DD).", inputKind: "date",   cleanable: false },
  { name: "rep_name",         label: "Rep",               phase: "pre-call", meaning: "Who ran the call.",               inputKind: "select", options: KNOWN_REPS, cleanable: false },
  { name: "prospect_name",    label: "Prospect name",     phase: "pre-call", meaning: "Lookup key; the prospect's name.",inputKind: "text",   cleanable: false },
  { name: "age_range",        label: "Age range",         phase: "pre-call", meaning: "Age bracket.",                    inputKind: "select", options: ["<20","20-29","30-39","40-49","50-59","60+"], cleanable: false },
  { name: "country",          label: "Country",           phase: "pre-call", meaning: "Country.",                        inputKind: "text",   cleanable: false },
  { name: "referral_source",  label: "Referral source",   phase: "pre-call", meaning: "How they got here (referral name / ad / organic).", inputKind: "text", cleanable: false },
  {
    name: "intake_behaviour",
    label: "Intake behaviour",
    phase: "pre-call",
    meaning: "Behaviour flagged on intake.",
    inputKind: "text",
    cleanable: true,
    frameworkSemantics: "The behaviour the prospect mentioned in their intake form. Short label (1-3 words), no commentary.",
  },
  {
    name: "intake_notes",
    label: "Intake notes",
    phase: "pre-call",
    meaning: "Their own words from intake.",
    inputKind: "textarea",
    cleanable: true,
    frameworkSemantics: "The prospect's verbatim words from the intake form. Preserve their phrasing — this is data, not a summary. Keep in the original language.",
  },
  {
    name: "prior_contact",
    label: "Prior contact",
    phase: "pre-call",
    meaning: "Past interactions or 'None'.",
    inputKind: "text",
    cleanable: true,
    frameworkSemantics: "Brief description of any prior interactions with the prospect. If none, return 'None'.",
  },

  // ---- Phase 2 ----
  {
    name: "behaviour_to_change",
    label: "Behaviour to change",
    phase: 2,
    meaning: "The specific behaviour (short label).",
    inputKind: "text",
    cleanable: true,
    frameworkSemantics: "Short label (1-3 words) for the SPECIFIC behaviour the prospect wants to change. NOT the motivation, NOT consequences, NOT context — just the behaviour name. Examples: 'doomscrolling', 'road rage', 'procrastinación'.",
  },

  // ---- Phase 3 ----
  {
    name: "referral",
    label: "Referral",
    phase: 3,
    meaning: "Why they came / who recommended.",
    inputKind: "textarea",
    cleanable: true,
    frameworkSemantics: "Why the prospect came to this call or who recommended Samwise. Concise — a name or short reason. First-person where it fits ('me lo recomendó X', 'vi un anuncio').",
  },
  {
    name: "core_motivation",
    label: "Core motivation",
    phase: 3,
    meaning: "What they're really trying to unlock.",
    inputKind: "textarea",
    cleanable: true,
    frameworkSemantics: "The prospect's life-stakes reason for wanting to change — what they stand to gain or lose in their actual life if they do or don't change. NOT the behaviour itself (that's behaviour_to_change). NOT historical context. NOT alternatives tried. Format as a first-person infinitive-led noun phrase or short clause that completes sentences like 'la razón de fondo es ___', 'querés ___', 'los resultados para ___'. Examples: 'ser un padre responsable para mis dos hijas', 'construir un negocio en EE.UU.', 'terminar mi tesis este año'. Preserve emotionally loaded language and personal stakes.",
  },
  {
    name: "expectation",
    label: "Expectation",
    phase: 3,
    meaning: "Their expectation in their own words.",
    inputKind: "textarea",
    cleanable: true,
    frameworkSemantics: "What the prospect explicitly said they expect from working with Samwise. Their own words where possible. First-person, preserve emotionally loaded language.",
  },
  {
    name: "self_destructive_behaviour",
    label: "Self-destructive behaviour",
    phase: 3,
    meaning: "Their framing of the problem; often = behaviour_to_change.",
    inputKind: "textarea",
    cleanable: true,
    frameworkSemantics: "The prospect's OWN framing of the self-destructive behaviour — often the same content as behaviour_to_change but in their voice and with more texture. NOT a clinical diagnosis (the framework deliberately externalizes this as a pattern, not as the prospect's identity).",
  },

  // ---- Phase 5 ----
  {
    name: "thoughts_during_relapse",
    label: "Thoughts during relapse",
    phase: 5,
    meaning: "Thoughts during relapse.",
    inputKind: "textarea",
    cleanable: true,
    frameworkSemantics: "The thoughts the prospect described having DURING a relapse. Quote or paraphrase in their voice and language. First-person where the script slot demands.",
  },
  {
    name: "feelings_during_relapse",
    label: "Feelings during relapse",
    phase: 5,
    meaning: "Feelings during relapse.",
    inputKind: "textarea",
    cleanable: true,
    frameworkSemantics: "Emotional states the prospect described feeling during a relapse. Their words: 'me siento cochina', 'numb', 'overwhelmed', etc.",
  },
  {
    name: "actions_during_relapse",
    label: "Actions during relapse",
    phase: 5,
    meaning: "What they do during relapse.",
    inputKind: "textarea",
    cleanable: true,
    frameworkSemantics: "Concrete actions/behaviours the prospect engages in during a relapse. Examples: 'scrolling 2+ hours, skipping work', 'comer compulsivamente'.",
  },
  {
    name: "intention_behind_action",
    label: "Intention behind action",
    phase: 5,
    meaning: "Intention behind the action.",
    inputKind: "textarea",
    cleanable: true,
    frameworkSemantics: "What the prospect was unconsciously seeking when the relapse happened. Examples: 'escape stress', 'feel needed', 'avoid feeling stupid'. Short noun phrase or short clause.",
  },
  {
    name: "self_talk_after_relapse",
    label: "Self-talk after relapse",
    phase: 5,
    meaning: "Self-talk after relapse — verbatim.",
    inputKind: "textarea",
    cleanable: true,
    verbatim: true,
    frameworkSemantics: "VERBATIM quote of what the prospect tells themselves after relapsing. The script literally quotes this back to them — preserve their exact wording in their original language. Fix only obvious typos and trim filler. NEVER paraphrase, translate, or summarize. Output as a direct quote without surrounding quote marks (the script provides those).",
  },
  {
    name: "consequences_for_them",
    label: "Consequences for them",
    phase: 5,
    meaning: "Consequences for their life.",
    inputKind: "textarea",
    cleanable: true,
    frameworkSemantics: "Real-life consequences of the behaviour for the prospect — relationships, work, health, dignity, missed deadlines, etc. In their voice, first-person where it fits.",
  },
  {
    name: "view_of_their_life_in_that_moment",
    label: "View of their life",
    phase: 5,
    meaning: "How they see life in that moment.",
    inputKind: "textarea",
    cleanable: true,
    frameworkSemantics: "How the prospect sees their life or themselves in the moment of relapse. Often dark, defeated, despairing. First-person. Preserve emotional charge — do not soften.",
  },
  { name: "grado_de_identificacion",   label: "Identification level",     phase: 5, meaning: "Rep's read on identification level.", inputKind: "select", options: ["low","medium","high"], cleanable: false },

  // ---- Phase 7 ----
  { name: "biologic_symbolic_analogy", label: "Biologic/symbolic analogy", phase: 7, meaning: "Analogy chosen for them.", inputKind: "select", options: ["flu","cold","allergy","diabetes","cancer","other"], cleanable: false },

  // ---- Phase 8 ----
  {
    name: "clinical_picture_description",
    label: "Clinical picture description",
    phase: 8,
    meaning: "Short description used in the mantra.",
    inputKind: "textarea",
    cleanable: true,
    frameworkSemantics: "A short externalising description of the prospect's pattern that goes inside their disidentification mantra ('Estoy enfermo con ___'). Should externalise the problem as a condition the prospect HAS, not who they ARE. Examples: 'una evasión compulsiva del trabajo bajo ansiedad', 'un patrón de huida frente a tareas difíciles'. Do not write a clinical diagnosis in the output — externalise in the prospect's voice and metaphor.",
  },

  // ---- Phase 10 ----
  {
    name: "alternatives_tried",
    label: "Alternatives tried",
    phase: 10,
    meaning: "What else they've tried.",
    inputKind: "textarea",
    cleanable: true,
    frameworkSemantics: "Brief list of solutions the prospect has previously tried. Comma-separated phrase. Examples: 'terapia espiritual, coaching de productividad', 'Pomodoro apps, productivity coach'. In the language the prospect used to describe them.",
  },
  {
    name: "why_alternatives_failed",
    label: "Why alternatives failed",
    phase: 10,
    meaning: "Why those didn't work.",
    inputKind: "textarea",
    cleanable: true,
    frameworkSemantics: "The reason the previous alternatives didn't deliver lasting change for the prospect. In their voice, first-person. Preserve specifics ('insights didn't stick between sessions', 'cuando se acabó el plan, todo se desvaneció').",
  },
  {
    name: "time_spent_in_alternatives",
    label: "Time spent in alternatives",
    phase: 10,
    meaning: "How long they've been trying.",
    inputKind: "text",
    cleanable: true,
    frameworkSemantics: "Total time the prospect has spent on previous alternatives. Examples: '3 años', '6 weeks', '1 year'. In the language used.",
  },
  { name: "total_money_spent_in_alternatives", label: "Total money spent (USD)", phase: 10, meaning: "Total spent on alternatives.",   inputKind: "number",   cleanable: false },
  { name: "monthly_budget_willingness",     label: "Monthly budget willingness (USD)", phase: 10, meaning: "Monthly budget they'd invest.", inputKind: "number", cleanable: false },

  // ---- Post-call ----
  { name: "outcome",   label: "Outcome",    phase: "post-call", meaning: "Call outcome.", inputKind: "select", options: ["closed","follow-up","disqualified","no"], cleanable: false },
  {
    name: "next_step",
    label: "Next step",
    phase: "post-call",
    meaning: "Specific next action.",
    inputKind: "text",
    cleanable: true,
    frameworkSemantics: "Concrete next action for this prospect — booked session date, follow-up date, etc. Short.",
  },
  {
    name: "rep_notes",
    label: "Rep notes",
    phase: "post-call",
    meaning: "Notes for handoff.",
    inputKind: "textarea",
    cleanable: true,
    frameworkSemantics: "Free-text rep notes for handoff to the clinician. Light cleanup only — preserve detail and observations. Not substituted into the spoken script.",
  },
]

// Column order in the funnel sheet's "Demo call" tab. Must match the
// sheet's header row exactly. If the sheet header changes, update this
// list — appendDemoCallRow writes in this order.
export const FUNNEL_SHEET_COLUMNS: string[] = DEMO_CALL_VARIABLES.map(
  (v) => v.name,
)
