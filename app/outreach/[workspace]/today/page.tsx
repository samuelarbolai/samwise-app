import { PageShell } from "../../_components/page-shell";
import { getDailySession, listContacts } from "../../actions";
import { TodayClient } from "./today-client";

export default async function OutreachTodayPage({
  params,
}: {
  params: Promise<{ workspace: string }>;
}) {
  const { workspace } = await params;
  const today = new Date().toISOString().slice(0, 10);
  const [contacts, session] = await Promise.all([
    listContacts(workspace),
    getDailySession(workspace, today),
  ]);
  return (
    <PageShell workspace={workspace} currentSection="today">
      <TodayClient
        workspace={workspace}
        today={today}
        contacts={contacts}
        session={session}
      />
    </PageShell>
  );
}
