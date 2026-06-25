// Wrapper around the extractOnboardingFromDoc Firebase cloud function
// in samwise-backend/cloud-functions/functions/src/index.ts. The
// function reads any Google Doc the clinician points at (demo
// transcript, intake notes, prior session log, etc.), asks Gemini to
// extract the onboarding variable set, and returns a SPARSE map
// (omitted variables = no clear evidence in the source).
//
// Consumed by /copilot in onboarding mode as the second of three
// prefill paths: Firestore-by-email, this one, and manual.

export const EXTRACT_ONBOARDING_FROM_DOC_URL =
  "https://extractonboardingfromdoc-b6fhjlgejq-uc.a.run.app"

export interface DocExtractionPayload {
  extracted: Record<string, string>
  sourceDocId: string
}

export async function extractOnboardingFromDoc(
  googleDocLink: string,
): Promise<DocExtractionPayload> {
  const res = await fetch(EXTRACT_ONBOARDING_FROM_DOC_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ googleDocLink }),
    // Mirror the cloud function's no-cache stance — clinicians edit
    // intake docs between attempts and must always see the live Doc.
    cache: "no-store",
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(
      (err as { error?: string }).error ||
        `extractOnboardingFromDoc failed (${res.status})`,
    )
  }
  return (await res.json()) as DocExtractionPayload
}
