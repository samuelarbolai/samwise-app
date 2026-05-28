import { PageShell } from "../../_components/page-shell";
import { listTemplates } from "../../actions";
import { TemplatesClient } from "./templates-client";

export default async function OutreachTemplatesPage({
  params,
}: {
  params: Promise<{ workspace: string }>;
}) {
  const { workspace } = await params;
  const templates = await listTemplates(workspace);
  return (
    <PageShell workspace={workspace} currentSection="templates">
      <TemplatesClient workspace={workspace} initialTemplates={templates} />
    </PageShell>
  );
}
