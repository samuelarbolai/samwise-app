// Wrapper around the loadDemoCall Firebase cloud function in
// samwise-backend/cloud-functions/functions/src/index.ts. The function
// reads the most-recent doc from the `demoCalls` Firestore collection
// whose `prospectKey` matches the normalized identifier (phone, email,
// or name). Consumed by /copilot in onboarding mode to pre-fill the
// onboarding variables from the prospect's prior demo session.
//
// Important (mirrors the loadQualification trap, session-copilot skill
// section 14): pass the RAW identifier (the prospect's email as the
// clinician would type it) — NOT an already-normalized "email:..."
// prospectKey. The cloud function normalizes internally.

export const LOAD_DEMO_CALL_URL =
  "https://loaddemocall-b6fhjlgejq-uc.a.run.app"

// Mirrors the cleaned-map shape extractDemoCall persists. All fields
// optional because the demo may have stopped at different phases and
// the autonomous agent's extraction is sparse.
export interface DemoCallDoc {
  prospectKey?: string
  raw?: Record<string, string>
  cleaned?: Record<string, string>
  repName?: string
  outcome?: string
  source?: "rep_state" | "extractDemoCall"
  createdAt?: unknown // Firestore Timestamp — opaque on the client

  // Allow forward-compat fields without TypeScript errors.
  [k: string]: unknown
}

export type LoadDemoCallResponse =
  | { ok: true; demoCall: DemoCallDoc }
  | { ok: false; reason: "not_found" }

export async function loadDemoCall(
  identifier: string,
): Promise<LoadDemoCallResponse> {
  const res = await fetch(LOAD_DEMO_CALL_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ identifier }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(
      (err as { error?: string }).error ||
        `loadDemoCall failed (${res.status})`,
    )
  }
  return (await res.json()) as LoadDemoCallResponse
}
