import { PageShell } from "../../_components/page-shell";
import { listMistakes } from "../../actions";
import { MistakesClient } from "./mistakes-client";

export default async function OutreachMistakesPage({
  params,
}: {
  params: Promise<{ workspace: string }>;
}) {
  const { workspace } = await params;
  const mistakes = await listMistakes(workspace);
  return (
    <PageShell workspace={workspace} currentSection="mistakes">
      <MistakesClient workspace={workspace} initialMistakes={mistakes} />
    </PageShell>
  );
}
