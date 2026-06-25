// Client wrapper for the suggestRepLine cloud function.
// Cross-origin call — CORS is enabled on the cloud function side.

import type { DemoCallVariable } from "@/app/for-experts/demo-call-config"
import type { SessionState, SuggestionEntry } from "./session-storage"

// Update this constant if Firebase assigns a different hash on first
// deploy. Pattern mirrors LOAD_CALL_SCRIPT_URL in load-script.ts.
export const SUGGEST_REP_LINE_URL =
  "https://suggestrepline-b6fhjlgejq-uc.a.run.app"

export type SuggestTechnique = NonNullable<DemoCallVariable["suggestTechnique"]>

export interface SuggestRepLineRequest {
  technique: SuggestTechnique
  state: Record<string, string>
  language?: "es" | "en"
}

export interface SuggestRepLineResponse {
  line: string
}

/**
 * Generate one SAY line for the rep using the cloud function. The
 * function falls back to empty string on any error (Gemini failure,
 * timeout, etc.) so the frontend never throws on a failed suggestion —
 * the UI shows a "no suggestion available; retry" state instead.
 */
export async function suggestRepLine(
  req: SuggestRepLineRequest,
): Promise<SuggestRepLineResponse> {
  try {
    const res = await fetch(SUGGEST_REP_LINE_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(req),
    })
    if (!res.ok) return { line: "" }
    return (await res.json()) as SuggestRepLineResponse
  } catch {
    return { line: "" }
  }
}

/**
 * Build the state payload sent to suggestRepLine. We bundle every
 * captured-so-far value (preferring cleaned, falling back to raw) so the
 * generator has the richest context available. Hard cap is 30 fields to
 * keep the payload sane.
 */
export function buildSuggestState(
  state: SessionState,
): Record<string, string> {
  const out: Record<string, string> = {}
  const keys = new Set<string>([
    ...Object.keys(state.cleaned ?? {}),
    ...Object.keys(state.raw ?? {}),
  ])
  let count = 0
  for (const k of keys) {
    if (count >= 30) break
    const value = (state.cleaned[k] ?? state.raw[k] ?? "").trim()
    if (!value) continue
    out[k] = value
    count++
  }
  return out
}

/**
 * Updater function the trigger helpers below use to write back into
 * SessionState.suggestions. The caller (page.tsx or variables-table)
 * passes a closure that merges the update into the state via setState.
 */
export type SuggestionUpdater = (
  varName: string,
  update: Partial<SuggestionEntry>,
) => void

/**
 * Generate a single suggestion for a specific variable. Used by both
 * the trigger-based pre-generation flow AND the manual "Regenerate"
 * button. Idempotent on errors — sets `error` and `generating: false`
 * so the UI can offer a retry without throwing.
 */
export async function generateSuggestionFor(
  target: DemoCallVariable,
  state: SessionState,
  update: SuggestionUpdater,
): Promise<void> {
  if (!target.suggestTechnique) return
  update(target.name, { generating: true, error: undefined })
  try {
    const resp = await suggestRepLine({
      technique: target.suggestTechnique,
      state: buildSuggestState(state),
    })
    update(target.name, { line: resp.line, generating: false })
  } catch (err) {
    update(target.name, {
      generating: false,
      error: err instanceof Error ? err.message : "Failed",
    })
  }
}

/**
 * Fire pre-generation for every variable whose suggestTriggerVariable
 * matches the given triggerEvent. triggerEvent is either a captured
 * variable's name (fires when that variable is captured) or the special
 * value "qualification_load" (fires when a qualification doc loads).
 *
 * Skips targets that already have a non-empty line OR are currently
 * generating — re-triggering is safe but wastes a Gemini call.
 *
 * Non-blocking: kicks off all requests in parallel and returns. The UI
 * reflects per-target generating state via the update callback.
 */
export function firePreGeneration(
  triggerEvent: string,
  vars: DemoCallVariable[],
  state: SessionState,
  update: SuggestionUpdater,
): void {
  const targets = vars.filter(
    (v) =>
      v.suggestTechnique && v.suggestTriggerVariable === triggerEvent,
  )
  for (const target of targets) {
    const existing = state.suggestions?.[target.name]
    if (existing?.generating) continue
    if (existing?.line) continue
    // Fire and forget. Errors are captured into the SuggestionEntry by
    // generateSuggestionFor itself.
    void generateSuggestionFor(target, state, update)
  }
}
