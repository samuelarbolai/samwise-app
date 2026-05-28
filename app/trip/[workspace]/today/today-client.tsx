"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { DbBox } from "../../../outreach/_components/db-box";
import { DbButton, DbField, DbInput } from "../../../outreach/_components/db-form";
import { FKeyFooter } from "../../../outreach/_components/f-key-footer";
import type { DailyPlan, EventItem, RouteBlueprint } from "../../_types";
import { logSpend, updateDailyPlan } from "../../actions";

interface Props {
  workspace: string;
  today: string;
  plan: DailyPlan | null;
  events: EventItem[];
  routes: RouteBlueprint[];
  spentToday: number;
}

export function TripTodayClient({
  workspace,
  today,
  plan,
  events,
  routes,
  spentToday: initialSpent,
}: Props) {
  const [morningChecked, setMorningChecked] = useState(plan?.morningChecked ?? false);
  const [eveningChecked, setEveningChecked] = useState(plan?.eveningChecked ?? false);
  const [spentToday, setSpentToday] = useState(initialSpent);
  const [, startTransition] = useTransition();

  const todaysEvents = useMemo(
    () =>
      events
        .filter((e) => e.date === today)
        .sort((a, b) => (a.time ?? "").localeCompare(b.time ?? "")),
    [events, today],
  );

  const pickedToday = useMemo(
    () => todaysEvents.filter((e) => e.picked),
    [todaysEvents],
  );

  const route = useMemo(
    () => (plan?.routeId ? routes.find((r) => r.id === plan.routeId) ?? null : null),
    [plan, routes],
  );

  function check(field: "morningChecked" | "eveningChecked", value: boolean) {
    if (field === "morningChecked") setMorningChecked(value);
    else setEveningChecked(value);
    if (!plan) return;
    startTransition(async () => {
      try {
        await updateDailyPlan(workspace, plan.date, { [field]: value });
      } catch (e) {
        console.error(e);
      }
    });
  }

  async function quickSpend(label: string, amount: number) {
    const optimistic = spentToday + amount;
    setSpentToday(optimistic);
    try {
      await logSpend(workspace, {
        date: today,
        label,
        amountUSD: amount,
        category: "Other",
      });
    } catch (e) {
      console.error(e);
      setSpentToday(spentToday);
    }
  }

  return (
    <>
      <div className="today-head">
        <h1 className="page-title">{formatHeading(today)}</h1>
        {plan ? (
          <p className="label-eyebrow" style={{ marginTop: 4 }}>
            {plan.headline}
          </p>
        ) : (
          <p className="label-eyebrow">No specific plan for this date.</p>
        )}
      </div>

      {plan?.contingencyOfTheDay ? (
        <DbBox title="Contingency of the day">
          <p>{plan.contingencyOfTheDay}</p>
        </DbBox>
      ) : null}

      <div className="today-grid">
        <DbBox title={`Picked events (${pickedToday.length})`}>
          {pickedToday.length === 0 ? (
            <p style={{ color: "var(--ink-muted)" }}>Nothing locked for today.</p>
          ) : (
            <ul className="event-list">
              {pickedToday.map((e) => (
                <li key={e.id} className="event-list__item">
                  <div className="event-list__time">{e.time ?? "—"}</div>
                  <div>
                    <strong>{e.title}</strong>
                    <div className="event-list__loc">{e.location}</div>
                    <div className="event-list__meta">
                      <span>{e.cost}</span>
                      <span>·</span>
                      <span>{e.registration}</span>
                      {e.link ? (
                        <>
                          <span>·</span>
                          <a href={e.link} target="_blank" rel="noreferrer">
                            link
                          </a>
                        </>
                      ) : null}
                    </div>
                    {e.notes ? (
                      <div className="event-list__notes">{e.notes}</div>
                    ) : null}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </DbBox>

        <DbBox
          title="Today's route"
          rightSlot={
            route ? (
              <Link href={`/trip/${workspace}/routes`} className="db-btn db-btn--inline">
                Full routes →
              </Link>
            ) : null
          }
        >
          {!route ? (
            <p style={{ color: "var(--ink-muted)" }}>
              No route assigned. Visit Routes to assign one.
            </p>
          ) : (
            <>
              <p style={{ marginBottom: 8 }}>
                <strong>{route.name}</strong>
                <br />
                <span style={{ color: "var(--ink-muted)" }}>{route.fromTo}</span>
              </p>
              <ol className="route-steps">
                {route.steps.map((s, i) => (
                  <li key={i}>
                    <span className="route-steps__mode">{s.mode}</span>
                    <span>{s.detail}</span>
                    {s.minutes ? (
                      <span className="route-steps__time">{s.minutes}m</span>
                    ) : null}
                  </li>
                ))}
              </ol>
              <p
                style={{
                  color: "var(--ink-muted)",
                  fontSize: 11,
                  marginTop: 8,
                  paddingTop: 6,
                  borderTop: "1px dashed var(--rule-soft)",
                }}
              >
                Total ~{route.totalMinutes ?? "—"} min · ${route.totalCostUSD ?? 0}
              </p>
            </>
          )}
        </DbBox>

        <DbBox title="Today's budget">
          <div className="budget-today">
            <div className="budget-today__row">
              <span className="label-eyebrow">Allowance</span>
              <span>${plan?.budgetAllowanceUSD ?? "—"}</span>
            </div>
            <div className="budget-today__row">
              <span className="label-eyebrow">Spent</span>
              <span style={{ color: spentToday > (plan?.budgetAllowanceUSD ?? Infinity) ? "var(--amber-deep)" : "var(--ink)" }}>
                ${spentToday.toFixed(2)}
              </span>
            </div>
            <div className="budget-today__row">
              <span className="label-eyebrow">Remaining</span>
              <span>
                $
                {Math.max(
                  0,
                  (plan?.budgetAllowanceUSD ?? 0) - spentToday,
                ).toFixed(2)}
              </span>
            </div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 8 }}>
              <DbButton onClick={() => quickSpend("Coffee", 5)}>+ Coffee $5</DbButton>
              <DbButton onClick={() => quickSpend("Meeting coffee", 32)}>
                + Meeting $32
              </DbButton>
              <DbButton onClick={() => quickSpend("Snack", 8)}>+ Snack $8</DbButton>
              <Link href={`/trip/${workspace}/budget`} className="db-btn">
                Full budget →
              </Link>
            </div>
          </div>
        </DbBox>

        <DbBox title="Morning brief / Evening debrief">
          <div className="db-form">
            <div className="prompt-block">
              <label className="db-checkbox">
                <input
                  type="checkbox"
                  checked={morningChecked}
                  onChange={(e) => check("morningChecked", e.target.checked)}
                />
                <strong>Morning</strong>
              </label>
              <p style={{ color: "var(--ink-muted)", margin: "4px 0 0 22px" }}>
                {plan?.morningPrompt ?? "—"}
              </p>
            </div>
            <div className="prompt-block">
              <label className="db-checkbox">
                <input
                  type="checkbox"
                  checked={eveningChecked}
                  onChange={(e) => check("eveningChecked", e.target.checked)}
                />
                <strong>Evening</strong>
              </label>
              <p style={{ color: "var(--ink-muted)", margin: "4px 0 0 22px" }}>
                {plan?.eveningPrompt ?? "—"}
              </p>
            </div>
          </div>
        </DbBox>
      </div>

      <FKeyFooter
        keys={[
          { key: "C", label: "Calendar", href: `/trip/${workspace}/calendar` },
          { key: "R", label: "Routes", href: `/trip/${workspace}/routes` },
          { key: "B", label: "Budget", href: `/trip/${workspace}/budget` },
        ]}
        rightSlot={<span>trip-day · {today}</span>}
      />
    </>
  );
}

function formatHeading(iso: string): string {
  const d = new Date(iso + "T00:00:00");
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}
