import { TripPageShell } from "../../_components/page-shell";
import { DbBox } from "../../../outreach/_components/db-box";
import { listRoutes } from "../../actions";

export default async function TripRoutesPage({
  params,
}: {
  params: Promise<{ workspace: string }>;
}) {
  const { workspace } = await params;
  const routes = await listRoutes(workspace);
  return (
    <TripPageShell workspace={workspace} currentSection="routes">
      {routes.map((r) => (
        <DbBox key={r.id} title={r.name}>
          <p style={{ marginBottom: 8 }}>
            <strong>{r.fromTo}</strong>
            <br />
            <span style={{ color: "var(--ink-muted)" }}>
              Total ~{r.totalMinutes ?? "—"} min · ${r.totalCostUSD ?? 0}
            </span>
          </p>
          <ol className="route-steps">
            {r.steps.map((s, i) => (
              <li key={i}>
                <span className="route-steps__mode">{s.mode}</span>
                <span>{s.detail}</span>
                {s.minutes ? (
                  <span className="route-steps__time">{s.minutes}m</span>
                ) : null}
                {s.cost ? (
                  <span className="route-steps__time">${s.cost.toFixed(2)}</span>
                ) : null}
              </li>
            ))}
          </ol>
          {r.notes ? (
            <p
              style={{
                color: "var(--ink-muted)",
                fontSize: 11,
                marginTop: 10,
                paddingTop: 8,
                borderTop: "1px dashed var(--rule-soft)",
              }}
            >
              {r.notes}
            </p>
          ) : null}
        </DbBox>
      ))}
    </TripPageShell>
  );
}
