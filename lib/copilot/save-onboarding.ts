// Wrapper around the extractOnboarding Firebase cloud function in
// samwise-backend/cloud-functions/functions/src/index.ts. Single mode
// in v1 (rep_state only — no autonomous onboarding agent yet). Writes
// one doc to `onboardingSessions/${prospectKey}-${Date.now()}`.

export const EXTRACT_ONBOARDING_URL =
  "https://extractonboarding-b6fhjlgejq-uc.a.run.app"

interface SaveOnboardingPayload {
  raw: Record<string, string>
  cleaned: Record<string, string>
  qualificationProspectKey?: string
}

interface SaveOnboardingResponse {
  ok: true
  docId: string
  prospectKey: string
}

export async function saveOnboardingToFirestore(
  payload: SaveOnboardingPayload,
): Promise<SaveOnboardingResponse> {
  const res = await fetch(EXTRACT_ONBOARDING_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(
      (err as { error?: string }).error ||
        `extractOnboarding failed (${res.status})`,
    )
  }
  return (await res.json()) as SaveOnboardingResponse
}
