import { TripPageShell } from "../../_components/page-shell";
import { listBudgetLines, listSpend } from "../../actions";
import { BudgetClient } from "./budget-client";

export default async function TripBudgetPage({
  params,
}: {
  params: Promise<{ workspace: string }>;
}) {
  const { workspace } = await params;
  const [budgetLines, spend] = await Promise.all([
    listBudgetLines(workspace),
    listSpend(workspace),
  ]);
  return (
    <TripPageShell workspace={workspace} currentSection="budget">
      <BudgetClient workspace={workspace} budgetLines={budgetLines} initialSpend={spend} />
    </TripPageShell>
  );
}
