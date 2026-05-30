import { TripPageShell } from "../../_components/page-shell";
import { getSheetConfig, listEvents } from "../../actions";
import { CalendarClient } from "./calendar-client";

export default async function TripCalendarPage({
  params,
}: {
  params: Promise<{ workspace: string }>;
}) {
  const { workspace } = await params;
  const [events, sheetConfig] = await Promise.all([
    listEvents(workspace),
    getSheetConfig(workspace),
  ]);
  return (
    <TripPageShell workspace={workspace} currentSection="calendar">
      <CalendarClient
        workspace={workspace}
        events={events}
        sheetConfig={sheetConfig}
      />
    </TripPageShell>
  );
}
