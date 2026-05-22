import type { LoadedScript } from "./load-script"
import type { DemoCallVariable } from "@/app/copilot/demo-call-config"

// Bumped to v3 when SessionState gained `qualificationProspectKey` to
// preserve linkage between the qualifications + demoCalls Firestore
// collections at save time. Any session persisted under v1 or v2 is
// silently ignored on mount and appears as a fresh URL gate.
const KEY = "copilot:session:v3"

export interface SessionState {
  raw: Record<string, string>
  cleaned: Record<string, string>
  cleaning: Record<string, boolean>
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
