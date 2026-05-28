import { TripPageShell } from "../../_components/page-shell";
import { listPacking } from "../../actions";
import { PackingClient } from "./packing-client";

export default async function TripPackingPage({
  params,
}: {
  params: Promise<{ workspace: string }>;
}) {
  const { workspace } = await params;
  const items = await listPacking(workspace);
  return (
    <TripPageShell workspace={workspace} currentSection="packing">
      <PackingClient workspace={workspace} items={items} />
    </TripPageShell>
  );
}
