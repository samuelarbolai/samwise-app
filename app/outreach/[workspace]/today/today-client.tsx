"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { DbBox } from "../../_components/db-box";
import { StatusChip } from "../../_components/status-chip";
import { DbButton, DbField, DbInput } from "../../_components/db-form";
import type { Contact, DailySession } from "../../_types";
import { updateContact, updateDailySession } from "../../actions";

interface Props {
  workspace: string;
  today: string;
  contacts: Contact[];
  session: DailySession;
}

export function TodayClient({ workspace, today, contacts, session }: Props) {
  const [items, setItems] = useState<Contact[]>(contacts);
  const [s, setS] = useState<DailySession>(session);
  const [, startTransition] = useTransition();

  const pushRec = useMemo(
    () =>
      items
        .filter(
          (c) =>
            (c.step === "Optimization" && c.recommendationStatus === "Not asked") ||
            (c.step === "Disqualified" && c.recommendationStatus === "Not asked") ||
            (c.step === "Recommendation" && c.recommendationStatus === "Promised") ||
            (c.step === "Recommendation" && c.recommendationStatus === "Asked"),
        )
        .sort((a, b) => priorityRecScore(b) - priorityRecScore(a)),
    [items],
  );

  const replyWaiting = useMemo(
    () => items.filter((c) => c.step === "Replied"),
    [items],
  );

  const followUpsDue = useMemo(() => {
    const todayMs = new Date(today + "T00:00:00").getTime();
    const fiveDaysMs = 5 * 24 * 60 * 60 * 1000;
    return items.filter((c) => {
      if (c.dueDate && c.dueDate <= today) return true;
      if (c.step === "Sent" && todayMs - c.createdAt > fiveDaysMs) return true;
      return false;
    });
  }, [items, today]);

  const meetingsToday = useMemo(() => {
    return items.filter((c) => c.dueDate === today && c.step === "Scheduled");
  }, [items, today]);

  function bumpContact(id: string, patch: Partial<Contact>) {
    setItems((cs) =>
      cs.map((c) => (c.id === id ? { ...c, ...patch, updatedAt: Date.now() } : c)),
    );
    startTransition(async () => {
      try {
        await updateContact(workspace, id, patch);
      } catch (e) {
        console.error(e);
      }
    });
  }

  function updateSession(patch: Partial<DailySession>) {
    setS((p) => ({ ...p, ...patch }));
    startTransition(async () => {
      try {
        await updateDailySession(workspace, today, patch);
      } catch (e) {
        console.error(e);
      }
    });
  }

  return (
    <>
      <div className="today-head">
        <h1 className="page-title">{formatHeading(today)}</h1>
        <p className="label-eyebrow">The goal today is to get recommended.</p>
      </div>

      <DbBox
        title={`Push for recommendation (${pushRec.length})`}
        rightSlot={
          <Link
            href={`/outreach/${workspace}/recommendations`}
            className="db-btn db-btn--inline"
          >
            Full pipeline →
          </Link>
        }
      >
        {pushRec.length === 0 ? (
          <p style={{ color: "var(--ink-muted)" }}>
            No one in the recommendation bin. Move someone in Optimization or
            Disqualified to "Asked" once you've requested a referral.
          </p>
        ) : (
          <ul className="rec-list">
            {pushRec.slice(0, 8).map((c) => (
              <RecRow
                key={c.id}
                contact={c}
                onBump={(p) => bumpContact(c.id, p)}
                onMarkAsked={() =>
                  bumpContact(c.id, {
                    recommendationStatus: "Asked",
                    step: c.step === "Disqualified" ? "Disqualified" : "Recommendation",
                  })
                }
              />
            ))}
          </ul>
        )}
      </DbBox>

      <div className="today-grid">
        <DbBox title={`Replies waiting (${replyWaiting.length})`}>
          {replyWaiting.length === 0 ? (
            <p style={{ color: "var(--ink-muted)" }}>None.</p>
          ) : (
            <ul className="rec-list">
              {replyWaiting.map((c) => (
                <li key={c.id} className="rec-row">
                  <div>
                    <strong>{c.name}</strong>
                    {c.hook ? (
                      <span style={{ color: "var(--ink-muted)", marginLeft: 8 }}>
                        — {c.hook}
                      </span>
                    ) : null}
                  </div>
                  <Link
                    href={`/outreach/${workspace}/contacts`}
                    className="db-btn db-btn--inline"
                  >
                    Open
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </DbBox>

        <DbBox title={`Follow-ups due (${followUpsDue.length})`}>
          {followUpsDue.length === 0 ? (
            <p style={{ color: "var(--ink-muted)" }}>
              No follow-ups due today.
            </p>
          ) : (
            <ul className="rec-list">
              {followUpsDue.map((c) => (
                <li key={c.id} className="rec-row">
                  <div>
                    <strong>{c.name}</strong>
                    <StatusChip status={c.step} />
                  </div>
                  <DbButton
                    onClick={() =>
                      bumpContact(c.id, {
                        nextAction: c.nextAction
                          ? c.nextAction
                          : "Send 5-day follow-up.",
                      })
                    }
                  >
                    Snooze 5d
                  </DbButton>
                </li>
              ))}
            </ul>
          )}
        </DbBox>

        <DbBox title={`Meetings today (${meetingsToday.length})`}>
          {meetingsToday.length === 0 ? (
            <p style={{ color: "var(--ink-muted)" }}>None.</p>
          ) : (
            <ul className="rec-list">
              {meetingsToday.map((c) => (
                <li key={c.id} className="rec-row">
                  <div>
                    <strong>{c.name}</strong>
                    {c.notes ? (
                      <span style={{ color: "var(--ink-muted)", marginLeft: 8 }}>
                        {c.notes}
                      </span>
                    ) : null}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </DbBox>

        <DbBox title="Daily targets">
          <div className="today-targets">
            <DbField label="LinkedIn target / sent">
              <div className="target-row">
                <DbInput
                  type="number"
                  min={0}
                  value={s.targetLinkedin ?? 25}
                  onChange={(e) =>
                    updateSession({ targetLinkedin: Number(e.target.value) || 0 })
                  }
                  style={{ width: 70 }}
                />
                <span style={{ color: "var(--ink-muted)" }}>/</span>
                <DbInput
                  type="number"
                  min={0}
                  value={s.sentCount}
                  onChange={(e) =>
                    updateSession({ sentCount: Number(e.target.value) || 0 })
                  }
                  style={{ width: 70 }}
                />
                <ProgressBar value={s.sentCount} target={s.targetLinkedin ?? 25} />
              </div>
            </DbField>
            <DbField label="Replies received">
              <DbInput
                type="number"
                min={0}
                value={s.repliesCount}
                onChange={(e) =>
                  updateSession({ repliesCount: Number(e.target.value) || 0 })
                }
                style={{ width: 90 }}
              />
            </DbField>
            <DbField label="Meetings held">
              <DbInput
                type="number"
                min={0}
                value={s.meetingsCount}
                onChange={(e) =>
                  updateSession({ meetingsCount: Number(e.target.value) || 0 })
                }
                style={{ width: 90 }}
              />
            </DbField>
          </div>
        </DbBox>
      </div>
    </>
  );
}

function RecRow({
  contact,
  onBump,
  onMarkAsked,
}: {
  contact: Contact;
  onBump: (patch: Partial<Contact>) => void;
  onMarkAsked: () => void;
}) {
  return (
    <li className="rec-row">
      <div className="rec-row__left">
        <strong>{contact.name}</strong>
        <StatusChip status={contact.step} />
        <span className="label-eyebrow">{contact.recommendationStatus}</span>
        {contact.nextAction ? (
          <div className="rec-row__action">→ {contact.nextAction}</div>
        ) : null}
      </div>
      <div className="rec-row__right">
        {contact.recommendationStatus === "Not asked" ? (
          <DbButton variant="primary" onClick={onMarkAsked}>
            Mark asked
          </DbButton>
        ) : contact.recommendationStatus === "Promised" ? (
          <DbButton
            variant="primary"
            onClick={() =>
              onBump({
                recommendationStatus: "Confirmed",
                recommendationCount: (contact.recommendationCount ?? 0) + 1,
              })
            }
          >
            Confirm rec
          </DbButton>
        ) : (
          <DbButton
            onClick={() =>
              onBump({ recommendationStatus: "Promised" })
            }
          >
            Mark promised
          </DbButton>
        )}
      </div>
    </li>
  );
}

function ProgressBar({ value, target }: { value: number; target: number }) {
  const pct = target > 0 ? Math.min(100, Math.round((value / target) * 100)) : 0;
  return (
    <div
      style={{
        flex: 1,
        height: 10,
        border: "1px solid var(--rule)",
        background: "var(--paper-deep)",
        position: "relative",
        marginLeft: 6,
      }}
      aria-label={`${value} of ${target}`}
    >
      <div
        style={{
          position: "absolute",
          inset: 0,
          width: `${pct}%`,
          background: pct >= 100 ? "var(--moss)" : "var(--accent-gold)",
        }}
      />
    </div>
  );
}

function priorityRecScore(c: Contact): number {
  const recRank: Record<string, number> = {
    Promised: 4,
    Asked: 3,
    "Not asked": 2,
    Refused: 0,
    Confirmed: 1,
  };
  const stepBoost = c.step === "Optimization" ? 1 : 0;
  return recRank[c.recommendationStatus] * 10 + stepBoost;
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
