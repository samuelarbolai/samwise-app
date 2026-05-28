import { TripPageShell } from "../../_components/page-shell";
import { listTodos } from "../../actions";
import { PreTripClient } from "./pre-trip-client";

export default async function PreTripPage({
  params,
}: {
  params: Promise<{ workspace: string }>;
}) {
  const { workspace } = await params;
  const todos = await listTodos(workspace);
  return (
    <TripPageShell workspace={workspace} currentSection="pre-trip">
      <PreTripClient workspace={workspace} todos={todos} />
    </TripPageShell>
  );
}
