import { WalkInShell } from "@/components/walk-in/WalkInShell"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

// Therapist-side surface for a walk-in. Samuel lands here from the
// notification email he gets when someone submits the /meet lobby.
export default async function MeetTherapistPage({
  params,
}: {
  params: Promise<{ walkInId: string }>
}) {
  const { walkInId } = await params
  return <WalkInShell walkInId={walkInId} />
}
