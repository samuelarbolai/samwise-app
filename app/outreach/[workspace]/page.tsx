import { redirect } from "next/navigation";

export default async function OutreachWorkspaceIndex({
  params,
}: {
  params: Promise<{ workspace: string }>;
}) {
  const { workspace } = await params;
  redirect(`/outreach/${workspace}/today`);
}
