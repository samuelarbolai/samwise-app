import { redirect } from "next/navigation";

export default async function TripWorkspaceIndex({
  params,
}: {
  params: Promise<{ workspace: string }>;
}) {
  const { workspace } = await params;
  redirect(`/trip/${workspace}/today`);
}
