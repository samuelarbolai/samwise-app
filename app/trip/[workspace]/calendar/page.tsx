import { TripPageShell } from "../../_components/page-shell";
import { listEvents } from "../../actions";
import { CalendarClient } from "./calendar-client";

export default async function TripCalendarPage({
  params,
}: {
  params: Promise<{ workspace: string }>;
}) {
  const { workspace } = await params;
  const events = await listEvents(workspace);
  return (
    <TripPageShell workspace={workspace} currentSection="calendar">
      <CalendarClient workspace={workspace} events={events} />
    </TripPageShell>
  );
}
