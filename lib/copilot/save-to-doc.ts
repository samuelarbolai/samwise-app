// Wrapper around the writeOnboardingToDoc Firebase cloud function in
// samwise-backend/cloud-functions/functions/src/index.ts. Appends a
// markdown notes block at the END of the supplied Google Doc.
//
// The clinician supplies the Doc URL at save time (per the agreed
// convention — there's no per-session canonical Doc).
//
// Permission: the service account needs Editor on the supplied Doc.
// Either direct share with the service account email OR "anyone with
// link can edit". A 403 surfaces here as a thrown Error.

export const WRITE_ONBOARDING_TO_DOC_URL =
  "https://writeonboardingtodoc-b6fhjlgejq-uc.a.run.app"

interface SaveToDocPayload {
  googleDocLink: string
  cleaned: Record<string, string>
  variableOrder?: string[]
}

interface SaveToDocResponse {
  ok: true
  docId: string
}

export async function saveOnboardingToDoc(
  payload: SaveToDocPayload,
): Promise<SaveToDocResponse> {
  const res = await fetch(WRITE_ONBOARDING_TO_DOC_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(
      (err as { error?: string }).error ||
        `writeOnboardingToDoc failed (${res.status})`,
    )
  }
  return (await res.json()) as SaveToDocResponse
}
