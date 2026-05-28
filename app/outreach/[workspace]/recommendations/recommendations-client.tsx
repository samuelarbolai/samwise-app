"use client";

import { useMemo, useState, useTransition } from "react";
import { DbBox } from "../../_components/db-box";
import { DbTable, type DbTableColumn } from "../../_components/db-table";
import { StatusChip } from "../../_components/status-chip";
import { DbButton } from "../../_components/db-form";
import { EditPanel } from "../../_components/edit-panel";
import type { Contact, RecommendationStatus } from "../../_types";
import { updateContact } from "../../actions";

interface Props {
  workspace: string;
  contacts: Contact[];
}

const NEXT_STATUS: Record<RecommendationStatus, RecommendationStatus> = {
  "Not asked": "Asked",
  Asked: "Promised",
  Promised: "Confirmed",
  Confirmed: "Confirmed",
  Refused: "Refused",
};

export function RecommendationsClient({ workspace, contacts }: Props) {
  const [items, setItems] = useState(contacts);
  const [, startTransition] = useTransition();
  const [selected, setSelected] = useState<Contact | null>(null);
  const [draftNote, setDraftNote] = useState("");

  const eligible = useMemo(
    () =>
      items
        .filter(
          (c) =>
            c.step !== "Dead" &&
            c.recommendationStatus !== "Refused" &&
            (c.step === "Optimization" ||
              c.step === "Disqualified" ||
              c.step === "Recommendation" ||
              c.recommendationStatus !== "Not asked"),
        )
        .sort((a, b) => priority(b) - priority(a)),
    [items],
  );

  function bump(id: string, patch: Partial<Contact>) {
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

  const columns: DbTableColumn<Contact>[] = [
    {
      key: "name",
      label: "Name",
      render: (c) => (
        <span>
          <strong>{c.name}</strong>
          {c.occupation ? (
            <span style={{ color: "var(--ink-muted)" }}> — {c.occupation}</span>
          ) : null}
        </span>
      ),
    },
    {
      key: "step",
      label: "Step",
      width: "150px",
      render: (c) => <StatusChip status={c.step} />,
    },
    {
      key: "rec",
      label: "Rec status",
      width: "150px",
      render: (c) => (
        <span style={{ fontWeight: 600 }}>
          {c.recommendationStatus}
          {c.recommendationCount ? ` · ${c.recommendationCount}` : ""}
        </span>
      ),
    },
    {
      key: "next",
      label: "Suggested next move",
      render: (c) => (
        <span>{suggestNextMove(c)}</span>
      ),
    },
    {
      key: "action",
      label: "",
      width: "140px",
      render: (c) => {
        const next = NEXT_STATUS[c.recommendationStatus];
        if (c.recommendationStatus === "Confirmed" || c.recommendationStatus === "Refused") {
          return null;
        }
        return (
          <DbButton
            variant="primary"
            onClick={(e) => {
              e.stopPropagation();
              const patch: Partial<Contact> = { recommendationStatus: next };
              if (next === "Confirmed") {
                patch.recommendationCount = (c.recommendationCount ?? 0) + 1;
              }
              bump(c.id, patch);
            }}
          >
            → {next}
          </DbButton>
        );
      },
    },
  ];

  return (
    <>
      <DbBox
        title={`Recommendation pipeline (${eligible.length})`}
        rightSlot={
          <span style={{ color: "var(--ink-muted)" }}>
            Sorted by closest to a confirmed rec.
          </span>
        }
      >
        <DbTable
          columns={columns}
          rows={eligible}
          getRowId={(c) => c.id}
          onRowClick={(c) => {
            setSelected(c);
            setDraftNote("");
          }}
          emptyMessage="No one in the recommendation pipeline yet."
        />
      </DbBox>

      {selected ? (
        <EditPanel
          title={`${selected.name} · ${selected.recommendationStatus}`}
          onClose={() => setSelected(null)}
        >
          <div className="db-form">
            <p style={{ color: "var(--ink-muted)" }}>
              {suggestNextMove(selected)}
            </p>
            <textarea
              className="db-input db-input--multi"
              rows={4}
              placeholder="What did you say to them? What did they say back?"
              value={draftNote}
              onChange={(e) => setDraftNote(e.target.value)}
            />
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <DbButton
                variant="primary"
                onClick={() => {
                  const next = NEXT_STATUS[selected.recommendationStatus];
                  const patch: Partial<Contact> = {
                    recommendationStatus: next,
                    notes: appendNote(selected.notes, draftNote),
                  };
                  if (next === "Confirmed") {
                    patch.recommendationCount = (selected.recommendationCount ?? 0) + 1;
                  }
                  bump(selected.id, patch);
                  setSelected({ ...selected, ...patch });
                  setDraftNote("");
                }}
              >
                → {NEXT_STATUS[selected.recommendationStatus]}
              </DbButton>
              <DbButton
                onClick={() => {
                  bump(selected.id, {
                    recommendationStatus: "Refused",
                    notes: appendNote(selected.notes, draftNote),
                  });
                  setSelected(null);
                }}
              >
                Mark refused
              </DbButton>
            </div>
          </div>
        </EditPanel>
      ) : null}
    </>
  );
}

function priority(c: Contact): number {
  const recRank: Record<string, number> = {
    Promised: 5,
    Asked: 4,
    "Not asked": 3,
    Confirmed: 1,
    Refused: 0,
  };
  const stepBoost =
    c.step === "Optimization"
      ? 2
      : c.step === "Recommendation"
        ? 3
        : c.step === "Disqualified"
          ? 1
          : 0;
  return recRank[c.recommendationStatus] * 10 + stepBoost;
}

function suggestNextMove(c: Contact): string {
  if (c.recommendationStatus === "Promised") {
    return "Follow up to confirm who they introduced you to.";
  }
  if (c.recommendationStatus === "Asked") {
    return "Push for a concrete name and a warm intro this week.";
  }
  if (c.recommendationStatus === "Not asked") {
    if (c.step === "Optimization") {
      return "They use the product. Ask: who else needs this?";
    }
    if (c.step === "Disqualified") {
      return "Bad fit, but the ask still works: who in your network does fit?";
    }
    return "Time to make the ask.";
  }
  if (c.recommendationStatus === "Confirmed") {
    return "Thank them. Ask if there's another person.";
  }
  return "";
}

function appendNote(existing: string | undefined, addition: string): string | undefined {
  const a = addition.trim();
  if (!a) return existing;
  const stamp = new Date().toISOString().slice(0, 10);
  const entry = `[${stamp}] ${a}`;
  return existing ? `${existing}\n${entry}` : entry;
}
