// Migrated 2026-06-01 to the UNIFIED demo-persistence CF `extractDemoCall`
// (rep_state mode) — same demoCalls write, now ONE path shared with the
// autonomous demo-call agent (which uses transcript mode). Update this hash
// if Firebase assigns a different one on deploy.
export const EXTRACT_DEMO_CALL_URL =
  "https://extractdemocall-b6fhjlgejq-uc.a.run.app"

interface SavePayload {
  raw: Record<string, string>
  cleaned: Record<string, string>
  qualificationProspectKey?: string
}

interface SaveResponse {
  ok: true
  docId: string
  prospectKey: string
}

// Persists a completed demo call to the `demoCalls` Firestore
// collection via the appendDemoCallRow cloud function. Sends both raw
// (the rep's mid-call brain dump) and cleaned (the LLM-cleaned
// script-fit values) so the doc has a full audit trail — useful for
// tuning cleanVariable prompts later. The function URL is the same as
// the old sheet-based save; only the request/response shapes changed.
//
// Function-name leftover: `appendDemoCallRow` no longer appends to a
// sheet, but the URL is unchanged so renaming would be churn for no
// gain.
export async function appendDemoCallRow(
  payload: SavePayload,
): Promise<SaveResponse> {
  const res = await fetch(EXTRACT_DEMO_CALL_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    // rep_state mode: the human copilot has typed raw/cleaned values, no
    // transcript. The CF writes the same demoCalls shape it always did.
    body: JSON.stringify({ mode: "rep_state", ...payload }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(
      (err as { error?: string }).error ||
        `extractDemoCall failed (${res.status})`,
    )
  }
  return (await res.json()) as SaveResponse
}
