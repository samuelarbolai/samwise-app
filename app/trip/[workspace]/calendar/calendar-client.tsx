"use client";

import { useMemo, useState, useTransition } from "react";
import { DbBox } from "../../../outreach/_components/db-box";
import { DbButton } from "../../../outreach/_components/db-form";
import { FKeyFooter } from "../../../outreach/_components/f-key-footer";
import type { EventItem, Tier, Registration } from "../../_types";
import { updateEvent } from "../../actions";

const TIER_LABEL: Record<Tier, string> = {
  T1: "T1 · recovery",
  T2: "T2 · phone-free",
  T3: "T3 · healthtech peers",
  T4: "T4 · adjacent",
  base: "base · original",
};

interface Props {
  workspace: string;
  events: EventItem[];
}

export function CalendarClient({ workspace, events: initial }: Props) {
  const [events, setEvents] = useState(initial);
  const [filter, setFilter] = useState<"all" | "picked" | "fixed" | "anytime" | "recurring" | "outside">("all");
  const [, startTransition] = useTransition();

  const filtered = useMemo(() => {
    return events.filter((e) => {
      if (filter === "all") return true;
      if (filter === "picked") return e.picked;
      return e.dateKind === filter;
    });
  }, [events, filter]);

  function togglePicked(id: string, picked: boolean) {
    setEvents((es) => es.map((e) => (e.id === id ? { ...e, picked } : e)));
    startTransition(async () => {
      try {
        await updateEvent(workspace, id, { picked });
      } catch (e) {
        console.error(e);
      }
    });
  }

  const grouped = groupByDay(filtered);

  return (
    <>
      <div className="filter-row">
        {(["all", "picked", "fixed", "anytime", "recurring", "outside"] as const).map(
          (f) => (
            <button
              key={f}
              type="button"
              onClick={() => setFilter(f)}
              className={`filter-pill ${filter === f ? "filter-pill--active" : ""}`}
            >
              {f}
            </button>
          ),
        )}
      </div>

      {grouped.map(([groupKey, items]) => (
        <DbBox key={groupKey} title={groupKey}>
          <ul className="event-list">
            {items.map((e) => (
              <li key={e.id} className="event-list__item">
                <button
                  type="button"
                  className={`event-pick ${e.picked ? "event-pick--on" : ""}`}
                  onClick={() => togglePicked(e.id, !e.picked)}
                  aria-label={e.picked ? "Unpick" : "Pick"}
                >
                  {e.picked ? "✓" : "·"}
                </button>
                <div className="event-list__time">{e.time ?? "—"}</div>
                <div style={{ flex: 1 }}>
                  <strong>{e.title}</strong>
                  <div className="event-list__loc">{e.location}</div>
                  <div className="event-list__meta">
                    <span>{e.cost}</span>
                    <span>·</span>
                    <span>{e.registration}</span>
                    <span>·</span>
                    <span>{TIER_LABEL[e.tier]}</span>
                    {e.cadence ? (
                      <>
                        <span>·</span>
                        <span>{e.cadence}</span>
                      </>
                    ) : null}
                    {e.link ? (
                      <>
                        <span>·</span>
                        <a href={e.link} target="_blank" rel="noreferrer">
                          link
                        </a>
                      </>
                    ) : null}
                  </div>
                  {e.notes ? <div className="event-list__notes">{e.notes}</div> : null}
                </div>
              </li>
            ))}
          </ul>
        </DbBox>
      ))}

      <FKeyFooter
        keys={[{ key: "T", label: "Back to Today", href: `/trip/${workspace}/today` }]}
        rightSlot={
          <span>
            {events.filter((e) => e.picked).length} picked / {events.length} total
          </span>
        }
      />
    </>
  );
}

function groupByDay(items: EventItem[]): Array<[string, EventItem[]]> {
  const out = new Map<string, EventItem[]>();
  items.forEach((e) => {
    const key =
      e.dateKind === "fixed"
        ? `${e.date} · ${e.day ?? ""}`
        : e.dateKind === "anytime"
          ? "Anytime"
          : e.dateKind === "recurring"
            ? "Recurring (check link before trip)"
            : e.dateKind === "outside"
              ? "Outside window"
              : "Other";
    if (!out.has(key)) out.set(key, []);
    out.get(key)!.push(e);
  });
  return Array.from(out.entries());
}
