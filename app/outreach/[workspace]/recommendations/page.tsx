import { PageShell } from "../../_components/page-shell";
import { listContacts } from "../../actions";
import { RecommendationsClient } from "./recommendations-client";

export default async function OutreachRecommendationsPage({
  params,
}: {
  params: Promise<{ workspace: string }>;
}) {
  const { workspace } = await params;
  const contacts = await listContacts(workspace);
  return (
    <PageShell workspace={workspace} currentSection="recommendations">
      <RecommendationsClient workspace={workspace} contacts={contacts} />
    </PageShell>
  );
}
