import { DemoCallShell } from "@/components/demo-call/DemoCallShell"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

// Therapist-side surface for the human-to-human Demo Call.
// Auth: see current-plan.md "Open decisions" — bookingId-as-credential is
// acceptable for v1 internal testing; add Clerk before non-test users.
export default async function DemoCallTherapistPage({
  params,
}: {
  params: Promise<{ bookingId: string }>
}) {
  const { bookingId } = await params
  return <DemoCallShell bookingId={bookingId} />
}
