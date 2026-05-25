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
//
// ORDER PRINCIPLE (2026-05-21): the array order matches the order the
// rep encounters / fills variables during the call. Pre-call holds rep-
// prep workflow first, then qualification-prefilled (in Phase 1.5
// reflection-order, then context). Live-captured groups follow in
// script-phase order. The Phase 2 group was dissolved (its only var was
// prefilled, moved to pre-call). The Phase 10 group was renamed to
// Phase 14 to match the script phase where those cost vars are
// actually captured (alternatives rebound).
// =====================================================================

export type DemoCallPhase =
  | "pre-call"
  | 3
  | 5
  | 7
  | 8
  | 14
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
  /** Initial value seeded into both raw and cleaned when a fresh session is
   * created. Used by phase-condition variables (e.g. fit_state) so the
   * default branch of the script is visible before the rep touches anything. */
  defaultValue?: string
}

// Pre-filled default Doc URL — the canonical Demo script.
// (v0.3 was deprecated 2026-05; the active Doc is the one below.)
// The rep can override this in the URL input at /copilot.
export const DEFAULT_DEMO_SCRIPT_DOC_URL =
  "https://docs.google.com/document/d/1sBHuGaXCFaP8cmQdUgNpoQYwCq3L4-OfDMDoPR73a5g/edit"

// Funnel-sheet target for appendDemoCallRow.
export const FUNNEL_SHEET_ID =
  "1YS0ZVjB3rZK_AZKMeCbBbD__Mvz91lWXAqHcIBt0Cmw"
// Tab name (NOT gid) — the funnel sheet's "Demo call" tab (gid=794107148).
export const DEMO_CALL_SHEET_TAB = "Demo call"

// Reps with login-like identity (no auth, just a dropdown).
export const KNOWN_REPS = ["Samuel Giraldo Concha", "Maria"]

export const DEMO_CALL_VARIABLES: DemoCallVariable[] = [
  // ---- Pre-call: rep-prep workflow ----
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

  // ---- Pre-call: prefilled from qualification ----
  // Ordered by first-use in the script. Phase 1.5 reflects (in this
  // order): behaviour, motivation, framework/anchor, journey/alternatives.
  // The remaining three (life_stage_context, problem_duration,
  // alternatives_exhaustion_level) are background mental-model context
  // not directly substituted, so they come last.
  {
    name: "behaviour_to_change",
    label: "Behaviour to change",
    phase: "pre-call",
    meaning: "The specific behaviour (short label).",
    inputKind: "text",
    cleanable: true,
    frameworkSemantics: "The specific behaviour the prospect wants to change — grounded as an action+activity, NOT an abstract label. Qualify produces a SENTENCE encoding the verb+object and the activity it interrupted (e.g. 'Saqué el teléfono y abrí Twitter cuando me senté a prospectar en LinkedIn', 'Gritarle a mi hijo cuando llego cansado del trabajo'). PRESERVE that sentence form — Phase 5's desidentification work anchors on this exact moment, so collapsing it into an abstract label ('doomscrolling', 'procrastinación', 'incumplimiento') destroys the specificity downstream slots depend on. Adapt grammar to fit the script slot (a 'cuando {{behaviour_to_change}}' slot wants a past-tense clause; a 'tu {{behaviour_to_change}}' slot wants a noun phrase) but keep the action+activity content verbatim. NEVER substitute a clinical or abstract noun for the prospect's specific framing. Use core_motivation and life_stage_context ONLY to disambiguate ambiguous senses (e.g. 'defaulting' → 'salir con mujeres mediocres' not 'incumplimiento'), never to inject motivation content. If the rep typed only a short label and nothing more, return the label unchanged — don't fabricate context.",
  },
  {
    name: "core_motivation",
    label: "Core motivation",
    phase: "pre-call",
    meaning: "What they're really trying to unlock.",
    inputKind: "textarea",
    cleanable: true,
    frameworkSemantics: "The prospect's life-stakes reason for wanting to change — what they stand to gain or lose in their actual life if they do or don't change. NOT the behaviour itself (that's behaviour_to_change). NOT historical context. NOT alternatives tried. Format as a first-person infinitive-led noun phrase or short clause that completes sentences like 'la razón de fondo es ___', 'querés ___', 'los resultados para ___'. Examples: 'ser un padre responsable para mis dos hijas', 'construir un negocio en EE.UU.', 'terminar mi tesis este año'. Preserve emotionally loaded language and personal stakes.",
  },
  {
    name: "symbolic_anchor_type",
    label: "Symbolic anchor type",
    phase: "pre-call",
    meaning: "Tradition / philosophy / esoteric / hyper-rational / none.",
    inputKind: "select",
    options: ["religious", "philosophical", "esoteric", "hyper-rational", "none"],
    cleanable: false,
  },
  {
    name: "symbolic_anchor_description",
    label: "Symbolic anchor description",
    phase: "pre-call",
    meaning: "What they draw strength from, in their own words.",
    inputKind: "textarea",
    cleanable: true,
    frameworkSemantics: "The prospect's own description of the tradition, philosophy, or set of principles they draw strength from. Used in Phase 1.5 reflect AND in Phase 7a mantra-building, so the cleaned form must read naturally as the OBJECT of phrases like 'te apoyás en ___' and 'sacás fuerza de ___'. Preserve the prospect's specific references (book titles, deities, practices) and their language. Examples: 'la oración católica de mi infancia', 'la filosofía estoica, sobre todo Marco Aurelio', 'rituales judíos y el simbolismo del Señor de los Anillos'. Do NOT abstract away their specifics into a generic noun like 'spirituality' or 'religión'.",
  },
  {
    name: "alternatives_tried",
    label: "Alternatives tried",
    phase: "pre-call",
    meaning: "What else they've tried.",
    inputKind: "textarea",
    cleanable: true,
    frameworkSemantics: "Brief list of solutions the prospect has previously tried. Comma-separated phrase. Examples: 'terapia espiritual, coaching de productividad', 'Pomodoro apps, productivity coach'. In the language the prospect used to describe them.",
  },
  {
    name: "why_alternatives_failed",
    label: "Why alternatives failed",
    phase: "pre-call",
    meaning: "Why those didn't work.",
    inputKind: "textarea",
    cleanable: true,
    verbatim: true,
    frameworkSemantics: "The reason the previous alternatives didn't deliver lasting change for the prospect. In their voice, first-person. Preserve specifics ('insights didn't stick between sessions', 'cuando se acabó el plan, todo se desvaneció').",
  },
  {
    name: "life_stage_context",
    label: "Life stage context",
    phase: "pre-call",
    meaning: "Where they are right now: work, family, what's loud.",
    inputKind: "textarea",
    cleanable: true,
    frameworkSemantics: "The prospect's current life context — what's happening for them right now (work, family, transitions, what's loud or stressful). NOT the behaviour, NOT motivation. Use it primarily to disambiguate other variables. Examples: 'construyendo nuestra empresa, casado con dos hijas pequeñas', 'finishing my thesis while taking care of my mother'.",
  },
  {
    name: "problem_duration_self_reported",
    label: "Problem duration",
    phase: "pre-call",
    meaning: "How long they've been struggling with this.",
    inputKind: "text",
    cleanable: true,
    frameworkSemantics: "How long the prospect has been struggling with the behaviour, in their own words. Examples: 'dos años', 'desde la universidad', 'mucho tiempo, quizás desde la secundaria'. Keep verbatim phrasing where possible; translate to the script language if needed but preserve their level of specificity.",
  },
  {
    name: "alternatives_exhaustion_level",
    label: "Alternatives exhaustion level",
    phase: "pre-call",
    meaning: "How much they've tried already (your judgment).",
    inputKind: "select",
    options: ["low", "medium", "high"],
    cleanable: false,
  },

  // ---- Phase 3 — Bond ----
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
    name: "expectation",
    label: "Expectation",
    phase: 3,
    meaning: "Their expectation in their own words.",
    inputKind: "textarea",
    cleanable: true,
    frameworkSemantics: "What the prospect explicitly said they expect from working with Samwise. Their own words where possible. First-person, preserve emotionally loaded language.",
  },

  // ---- Phase 5 — Desidentification demo ----
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

  // ---- Phase 7 — Solution intro ----
  { name: "biologic_symbolic_analogy", label: "Biologic/symbolic analogy", phase: 7, meaning: "Analogy chosen for them.", inputKind: "select", options: ["flu","cold","allergy","diabetes","cancer","other"], cleanable: false },

  // ---- Phase 8 — Mantra commitment + post-demo re-classify ----
  {
    name: "clinical_picture_description",
    label: "Clinical picture description",
    phase: 8,
    meaning: "Short description used in the mantra.",
    inputKind: "textarea",
    cleanable: true,
    frameworkSemantics: "A short externalising description of the prospect's pattern that goes inside their disidentification mantra ('Estoy enfermo con ___'). Should externalise the problem as a condition the prospect HAS, not who they ARE. Examples: 'una evasión compulsiva del trabajo bajo ansiedad', 'un patrón de huida frente a tareas difíciles'. Do not write a clinical diagnosis in the output — externalise in the prospect's voice and metaphor.",
  },
  {
    name: "fit_state",
    label: "Fit state (post-demo)",
    phase: 8,
    meaning: "Re-classification after the full Phase 5-8 desidentification arc. Drives [CONDITION] phase visibility in the script-pane: phases 9-15 (close path) show when 'qualified'; phases 16-17 (rebound) show when 'still_disqualified'.",
    inputKind: "select",
    options: ["qualified", "still_disqualified"],
    cleanable: false,
    defaultValue: "qualified",
  },

  // ---- Phase 14 — Alternatives rebound (live capture of cost vars) ----
  // Renamed from "Phase 10" — the script phase where the rep actually
  // captures these is Phase 14 (Handling the alternatives rebound). The
  // upstream prefilled variables alternatives_tried + why_alternatives_failed
  // moved to pre-call; only the cost vars remain here as live capture.
  {
    name: "time_spent_in_alternatives",
    label: "Time spent in alternatives",
    phase: 14,
    meaning: "How long they've been trying.",
    inputKind: "text",
    cleanable: true,
    frameworkSemantics: "Total time the prospect has spent on previous alternatives. Examples: '3 años', '6 weeks', '1 year'. In the language used.",
  },
  { name: "total_money_spent_in_alternatives", label: "Total money spent (USD)", phase: 14, meaning: "Total spent on alternatives.",   inputKind: "number",   cleanable: false },
  { name: "monthly_budget_willingness",     label: "Monthly budget willingness (USD)", phase: 14, meaning: "Monthly budget they'd invest.", inputKind: "number", cleanable: false },

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
//
// NOTE: this constant is currently UNUSED — appendDemoCallRow in the
// backend uses its own DEMO_CALL_COLUMNS list as the authoritative
// source. Kept here for reference + as a forward-compat slot.
export const FUNNEL_SHEET_COLUMNS: string[] = DEMO_CALL_VARIABLES.map(
  (v) => v.name,
)
