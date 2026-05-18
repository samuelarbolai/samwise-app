import type { LoadedScript } from "./load-script"
import type { DemoCallVariable } from "@/app/copilot/demo-call-config"

// Bumped to v2 when the script phase shape changed from { text } to
// { blocks: [{ kind, text }] }. Any session persisted under v1 is silently
// ignored on mount and will appear as a fresh URL gate to the rep.
const KEY = "copilot:session:v2"

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
