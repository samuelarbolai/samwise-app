import type { LoadedScript } from "./load-script"
import type { DemoCallVariable } from "@/app/for-experts/demo-call-config"

// Bumped to v5 when /copilot gained onboarding mode (a second
// scriptType beyond "demo"). The persisted PersistedSession already
// carries the scriptType inside `script.scriptType`, so a single key
// is enough — page.tsx routes restored sessions to the right config
// based on that field. Any session persisted under v1–v4 is silently
// ignored on mount and appears as a fresh URL gate.
const KEY = "copilot:session:v5"

export interface SuggestionEntry {
  /** The generated SAY line. Empty string = "no suggestion (skip marker)"
   * which happens for e.g. Phase 1.5 worldview confirmation when no
   * symbolic anchor is on file. */
  line: string
  /** True while a generation request is in flight. UI shows a spinner. */
  generating: boolean
  /** Last error message, if generation failed. UI shows it inline so the
   * rep can retry. */
  error?: string
}

export interface SessionState {
  raw: Record<string, string>
  cleaned: Record<string, string>
  cleaning: Record<string, boolean>
  /** LLM-generated rep-line suggestions, keyed by variable name. Filled
   * lazily — see suggestions/pre-generation flow in page.tsx +
   * variables-table.tsx. */
  suggestions: Record<string, SuggestionEntry>
  // Set during handleLoadQualification. Forwarded to appendDemoCallRow
  // at save time so the resulting demoCalls doc inherits the same
  // prospectKey as the qualifications doc — clean cross-collection
  // linkage without the rep having to retype an email.
  qualificationProspectKey?: string
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
  const suggestions: Record<string, SuggestionEntry> = {}
  for (const v of vars) {
    const initial = v.defaultValue ?? ""
    raw[v.name] = initial
    cleaned[v.name] = initial
    cleaning[v.name] = false
    if (v.suggestTechnique) {
      suggestions[v.name] = { line: "", generating: false }
    }
  }
  // Auto-set call_date today.
  if (raw.call_date !== undefined) {
    const today = new Date().toISOString().slice(0, 10)
    raw.call_date = today
    cleaned.call_date = today
  }
  return { raw, cleaned, cleaning, suggestions }
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
