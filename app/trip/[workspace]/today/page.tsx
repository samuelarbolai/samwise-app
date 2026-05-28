import { TripPageShell } from "../../_components/page-shell";
import {
  getDailyPlan,
  listEvents,
  listRoutes,
  listSpend,
} from "../../actions";
import { TripTodayClient } from "./today-client";

export default async function TripTodayPage({
  params,
}: {
  params: Promise<{ workspace: string }>;
}) {
  const { workspace } = await params;
  const today = new Date().toISOString().slice(0, 10);
  const [plan, events, routes, allSpend] = await Promise.all([
    getDailyPlan(workspace, today),
    listEvents(workspace),
    listRoutes(workspace),
    listSpend(workspace),
  ]);
  const spentToday = allSpend
    .filter((s) => s.date === today)
    .reduce((acc, s) => acc + s.amountUSD, 0);

  return (
    <TripPageShell workspace={workspace} currentSection="today">
      <TripTodayClient
        workspace={workspace}
        today={today}
        plan={plan}
        events={events}
        routes={routes}
        spentToday={spentToday}
      />
    </TripPageShell>
  );
}
