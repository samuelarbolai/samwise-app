import { TripPageShell } from "../../_components/page-shell";
import { DbBox } from "../../../outreach/_components/db-box";
import { listContingencies } from "../../actions";

export default async function TripContingenciesPage({
  params,
}: {
  params: Promise<{ workspace: string }>;
}) {
  const { workspace } = await params;
  const items = await listContingencies(workspace);

  const grouped = new Map<string, typeof items>();
  items.forEach((c) => {
    if (!grouped.has(c.category)) grouped.set(c.category, []);
    grouped.get(c.category)!.push(c);
  });

  return (
    <TripPageShell workspace={workspace} currentSection="contingencies">
      {Array.from(grouped.entries()).map(([cat, list]) => (
        <DbBox key={cat} title={cat}>
          <ul className="contingency-list">
            {list.map((c) => (
              <li key={c.id} className="contingency-card">
                <p className="contingency-card__situation">
                  <strong>If:</strong> {c.situation}
                </p>
                <p className="contingency-card__action">
                  <strong>Then:</strong> {c.action}
                </p>
              </li>
            ))}
          </ul>
        </DbBox>
      ))}
    </TripPageShell>
  );
}
