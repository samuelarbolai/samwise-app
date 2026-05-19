// Wrapper around the loadQualification Firebase cloud function in
// samwise-backend/cloud-functions/functions/src/index.ts. The function
// reads the most-recent doc from the `qualifications` Firestore
// collection whose `prospectKey` matches the normalized identifier
// (phone, email, or name). Consumed by /copilot to pre-fill the
// rep-notes inputs for variables the prospect already covered during
// the Fit Assessment call at samwise-landing/app/qualify/.

export const LOAD_QUALIFICATION_URL =
  "https://loadqualification-b6fhjlgejq-uc.a.run.app"

// Mirrors samwise-landing/lib/qualify/schema.ts's QualificationPayload.
// All fields are optional in the response because the prospect may have
// been disqualified before reaching Capture (P2 fields would be absent).
export interface QualificationDoc {
  prospect_name?: string
  contact_email?: string
  contact_phone?: string
  language?: "es" | "en"

  // Priority 1 gates
  decision_taken?: "Y" | "N"
  behaviour_clarity?: "clear" | "vague"
  motivation_clarity?: "clear" | "vague"

  // Safety gates
  acute_risk_flag?: "Y" | "N"
  ownership_self_reported?: "self" | "external"

  // Priority 2 — verbatim capture (only on the qualified path)
  behaviour_to_change?: string
  core_motivation?: string
  problem_duration_self_reported?: string
  life_stage_context?: string
  symbolic_anchor_type?:
    | "religious"
    | "philosophical"
    | "esoteric"
    | "hyper-rational"
    | "none"
  symbolic_anchor_description?: string
  alternatives_tried?: string
  why_alternatives_failed?: string
  alternatives_exhaustion_level?: "low" | "medium" | "high"

  // Server-evaluated
  outcome?: "qualified" | "disqualified" | "safety_flagged"
  qualified?: boolean
  safetyFlagged?: boolean
  prospectKey?: string
  createdAt?: string

  // Allow forward-compat fields without TypeScript errors when the
  // cloud function returns extra metadata.
  [k: string]: unknown
}

export type LoadQualificationResponse =
  | { ok: true; qualification: QualificationDoc }
  | { ok: false; reason: "not_found" }

export async function loadQualification(
  identifier: string,
): Promise<LoadQualificationResponse> {
  const res = await fetch(LOAD_QUALIFICATION_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ identifier }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(
      (err as { error?: string }).error ||
        `loadQualification failed (${res.status})`,
    )
  }
  return (await res.json()) as LoadQualificationResponse
}
