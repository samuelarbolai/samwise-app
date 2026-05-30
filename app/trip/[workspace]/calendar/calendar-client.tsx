"use client";

import { useMemo, useState, useTransition } from "react";
import { DbBox } from "../../../outreach/_components/db-box";
import {
  DbButton,
  DbCheckbox,
  DbField,
  DbInput,
  DbSelect,
  DbTextarea,
} from "../../../outreach/_components/db-form";
import { EditPanel } from "../../../outreach/_components/edit-panel";
import { FKeyFooter } from "../../../outreach/_components/f-key-footer";
import {
  DATE_KIND_OPTIONS,
  REGISTRATION_STATUS_OPTIONS,
  REGISTRATION_TYPES,
  TIER_OPTIONS,
  type EventDateKind,
  type EventItem,
  type Registration,
  type RegistrationStatus,
  type Tier,
} from "../../_types";
import { updateEvent } from "../../actions";
import { SheetSyncPanel } from "./sheet-sync-panel";

const TIER_LABEL: Record<Tier, string> = {
  T1: "T1 · recovery",
  T2: "T2 · phone-free",
  T3: "T3 · healthtech peers",
  T4: "T4 · adjacent",
  base: "base · original",
};

const REG_STATUS_COLOR: Partial<Record<RegistrationStatus, string>> = {
  "Not started": "var(--ink-muted)",
  Applied: "var(--amber-deep)",
  "Pending approval": "var(--amber-deep)",
  Registered: "var(--moss)",
  Confirmed: "var(--moss)",
  Declined: "var(--ash)",
};

interface SheetConfig {
  sheetId: string | null;
  sheetTabName: string | null;
  lastPushedAt: number | null;
  serviceAccountEmail: string | null;
}

interface Props {
  workspace: string;
  events: EventItem[];
  sheetConfig: SheetConfig;
}

const REG_STATUS_CYCLE: RegistrationStatus[] = [
  "Not started",
  "Applied",
  "Pending approval",
  "Registered",
  "Confirmed",
  "Declined",
];

export function CalendarClient({ workspace, events: initial, sheetConfig }: Props) {
  const [events, setEvents] = useState(initial);
  const [filter, setFilter] = useState<
    "all" | "picked" | "fixed" | "anytime" | "recurring" | "outside"
  >("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showSheetSync, setShowSheetSync] = useState(false);
  const [, startTransition] = useTransition();

  const filtered = useMemo(() => {
    return events.filter((e) => {
      if (filter === "all") return true;
      if (filter === "picked") return e.picked;
      return e.dateKind === filter;
    });
  }, [events, filter]);

  const selected = useMemo(
    () => (selectedId ? events.find((e) => e.id === selectedId) ?? null : null),
    [events, selectedId],
  );

  function patch(id: string, p: Partial<EventItem>) {
    setEvents((es) => es.map((e) => (e.id === id ? { ...e, ...p } : e)));
    startTransition(async () => {
      try {
        await updateEvent(workspace, id, p);
      } catch (e) {
        console.error(e);
      }
    });
  }

  const grouped = groupByDay(filtered);

  function cycleRegistrationStatus(e: EventItem) {
    const current = e.registrationStatus ?? "Not started";
    const idx = REG_STATUS_CYCLE.indexOf(current);
    const next = REG_STATUS_CYCLE[(idx + 1) % REG_STATUS_CYCLE.length];
    patch(e.id, { registrationStatus: next });
  }

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
        <button
          type="button"
          onClick={() => setShowSheetSync(true)}
          className="filter-pill"
          title="Push app → sheet, or pull May 29 deltas"
          style={{
            marginLeft: "auto",
            borderStyle: "dashed",
          }}
        >
          ⇅ Sheet sync
        </button>
      </div>

      {grouped.map(([groupKey, items]) => (
        <DbBox key={groupKey} title={groupKey}>
          <ul className="event-list">
            {items.map((e) => {
              const status = e.registrationStatus ?? "Not started";
              return (
                <li key={e.id} className="event-list__item event-list__item--editable">
                  <button
                    type="button"
                    className={`event-pick ${e.picked ? "event-pick--on" : ""}`}
                    onClick={(ev) => {
                      ev.stopPropagation();
                      patch(e.id, { picked: !e.picked });
                    }}
                    aria-label={e.picked ? "Unpick" : "Pick"}
                  >
                    {e.picked ? "✓" : "·"}
                  </button>
                  <div className="event-list__time">{e.time ?? "—"}</div>
                  <div className="event-list__body event-list__body--static">
                    <div className="event-list__title-row">
                      <strong>{e.title}</strong>
                      <button
                        type="button"
                        className="event-edit-btn"
                        onClick={() => setSelectedId(e.id)}
                        title="Edit all fields"
                      >
                        ✎ Edit
                      </button>
                    </div>
                    <div className="event-list__loc">{e.location}</div>
                    <div className="event-list__meta">
                      <span>{e.cost}</span>
                      <span>·</span>
                      <span>{e.registration}</span>
                      <span>·</span>
                      <button
                        type="button"
                        className="status-chip-btn"
                        onClick={() => cycleRegistrationStatus(e)}
                        title="Click to cycle status"
                        style={{
                          color:
                            REG_STATUS_COLOR[status] ?? "var(--ink-muted)",
                          fontWeight: 600,
                        }}
                      >
                        {status.toUpperCase()}
                      </button>
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
                          <a
                            href={e.link}
                            target="_blank"
                            rel="noreferrer"
                            onClick={(ev) => ev.stopPropagation()}
                          >
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
              );
            })}
          </ul>
        </DbBox>
      ))}

      {showSheetSync ? (
        <SheetSyncPanel
          workspace={workspace}
          initialSheetId={sheetConfig.sheetId}
          initialTabName={sheetConfig.sheetTabName}
          lastPushedAt={sheetConfig.lastPushedAt}
          serviceAccountEmail={sheetConfig.serviceAccountEmail}
          onClose={() => setShowSheetSync(false)}
        />
      ) : null}

      {selected ? (
        <EditPanel
          title={`Edit · ${selected.title}`}
          onClose={() => setSelectedId(null)}
          footer={
            <DbButton variant="primary" onClick={() => setSelectedId(null)}>
              Done
            </DbButton>
          }
        >
          <EventForm
            event={selected}
            onChange={(p) => patch(selected.id, p)}
          />
        </EditPanel>
      ) : null}

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

function EventForm({
  event,
  onChange,
}: {
  event: EventItem;
  onChange: (patch: Partial<EventItem>) => void;
}) {
  return (
    <div className="db-form">
      <DbCheckbox
        label="Picked (locked into your skeleton)"
        checked={event.picked}
        onChange={(v) => onChange({ picked: v })}
      />

      <DbField label="Title">
        <DbInput
          defaultValue={event.title}
          onBlur={(e) =>
            e.target.value !== event.title && onChange({ title: e.target.value })
          }
        />
      </DbField>

      <div className="db-form__row">
        <DbField label="Date kind">
          <DbSelect
            value={event.dateKind}
            onChange={(v) => onChange({ dateKind: v as EventDateKind })}
            options={DATE_KIND_OPTIONS}
          />
        </DbField>
        <DbField label="Tier">
          <DbSelect
            value={event.tier}
            onChange={(v) => onChange({ tier: v as Tier })}
            options={TIER_OPTIONS}
          />
        </DbField>
      </div>

      {event.dateKind === "fixed" || event.dateKind === "outside" ? (
        <div className="db-form__row">
          <DbField label="Date (YYYY-MM-DD)">
            <DbInput
              type="date"
              defaultValue={event.date ?? ""}
              onBlur={(e) =>
                e.target.value !== (event.date ?? "") &&
                onChange({ date: e.target.value || undefined })
              }
            />
          </DbField>
          <DbField label="Day label">
            <DbInput
              defaultValue={event.day ?? ""}
              onBlur={(e) =>
                e.target.value !== (event.day ?? "") &&
                onChange({ day: e.target.value || undefined })
              }
            />
          </DbField>
        </div>
      ) : null}

      {event.dateKind === "recurring" ? (
        <DbField label="Cadence">
          <DbInput
            defaultValue={event.cadence ?? ""}
            onBlur={(e) =>
              e.target.value !== (event.cadence ?? "") &&
              onChange({ cadence: e.target.value || undefined })
            }
          />
        </DbField>
      ) : null}

      <DbField label="Time">
        <DbInput
          placeholder="e.g. 7:00–9:30 PM"
          defaultValue={event.time ?? ""}
          onBlur={(e) =>
            e.target.value !== (event.time ?? "") &&
            onChange({ time: e.target.value || undefined })
          }
        />
      </DbField>

      <DbField label="Location">
        <DbInput
          defaultValue={event.location}
          onBlur={(e) =>
            e.target.value !== event.location &&
            onChange({ location: e.target.value })
          }
        />
      </DbField>

      <div className="db-form__row">
        <DbField label="Cost">
          <DbInput
            defaultValue={event.cost}
            onBlur={(e) =>
              e.target.value !== event.cost && onChange({ cost: e.target.value })
            }
          />
        </DbField>
        <DbField label="Registration type">
          <DbSelect
            value={event.registration}
            onChange={(v) => onChange({ registration: v as Registration })}
            options={REGISTRATION_TYPES}
          />
        </DbField>
      </div>

      <DbField label="Registration status">
        <DbSelect
          value={event.registrationStatus ?? "Not started"}
          onChange={(v) =>
            onChange({ registrationStatus: v as RegistrationStatus })
          }
          options={REGISTRATION_STATUS_OPTIONS}
        />
      </DbField>

      <DbField label="Link">
        <DbInput
          type="url"
          defaultValue={event.link ?? ""}
          onBlur={(e) =>
            e.target.value !== (event.link ?? "") &&
            onChange({ link: e.target.value || undefined })
          }
        />
      </DbField>

      <DbField label="Notes">
        <DbTextarea
          rows={4}
          defaultValue={event.notes ?? ""}
          onBlur={(e) =>
            e.target.value !== (event.notes ?? "") &&
            onChange({ notes: e.target.value || undefined })
          }
        />
      </DbField>
    </div>
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
