import { PageShell } from "../../_components/page-shell";
import { listContacts } from "../../actions";
import { ContactsClient } from "./contacts-client";

export default async function OutreachContactsPage({
  params,
}: {
  params: Promise<{ workspace: string }>;
}) {
  const { workspace } = await params;
  const contacts = await listContacts(workspace);
  return (
    <PageShell workspace={workspace} currentSection="contacts">
      <ContactsClient workspace={workspace} initialContacts={contacts} />
    </PageShell>
  );
}
