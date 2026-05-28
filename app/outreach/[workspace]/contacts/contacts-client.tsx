"use client";

import { useMemo, useState, useTransition } from "react";
import { DbBox } from "../../_components/db-box";
import { DbTable, type DbTableColumn } from "../../_components/db-table";
import { StatusChip } from "../../_components/status-chip";
import { FKeyFooter } from "../../_components/f-key-footer";
import { EditPanel } from "../../_components/edit-panel";
import {
  DbButton,
  DbCheckbox,
  DbField,
  DbInput,
  DbSelect,
  DbTextarea,
} from "../../_components/db-form";
import {
  RECOMMENDATION_STATUSES,
  SOURCE_OPTIONS,
  STEP_OPTIONS,
  TIER_OPTIONS,
  type Contact,
  type Step,
} from "../../_types";
import {
  createContact,
  deleteContact,
  updateContact,
} from "../../actions";

interface Props {
  workspace: string;
  initialContacts: Contact[];
}

export function ContactsClient({ workspace, initialContacts }: Props) {
  const [contacts, setContacts] = useState<Contact[]>(initialContacts);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showNew, setShowNew] = useState(false);
  const [filterStep, setFilterStep] = useState<Step | "All">("All");
  const [filterText, setFilterText] = useState("");
  const [isPending, startTransition] = useTransition();

  const filtered = useMemo(() => {
    const q = filterText.trim().toLowerCase();
    return contacts.filter((c) => {
      if (filterStep !== "All" && c.step !== filterStep) return false;
      if (q) {
        const hay = [
          c.name,
          c.occupation ?? "",
          c.blocker ?? "",
          c.nextAction ?? "",
          c.notes ?? "",
        ]
          .join(" ")
          .toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [contacts, filterStep, filterText]);

  const selected = useMemo(
    () => (selectedId ? contacts.find((c) => c.id === selectedId) ?? null : null),
    [contacts, selectedId],
  );

  function handleUpdate(id: string, patch: Partial<Contact>) {
    setContacts((cs) =>
      cs.map((c) => (c.id === id ? { ...c, ...patch, updatedAt: Date.now() } : c)),
    );
    startTransition(async () => {
      try {
        await updateContact(workspace, id, patch);
      } catch (e) {
        console.error("update failed", e);
      }
    });
  }

  function handleDelete(id: string) {
    if (!confirm("Delete this contact? This cannot be undone.")) return;
    setContacts((cs) => cs.filter((c) => c.id !== id));
    setSelectedId(null);
    startTransition(async () => {
      try {
        await deleteContact(workspace, id);
      } catch (e) {
        console.error("delete failed", e);
      }
    });
  }

  async function handleCreate(data: Partial<Contact>) {
    const tempId = `tmp-${Date.now()}`;
    const optimistic: Contact = {
      id: tempId,
      name: data.name ?? "",
      step: data.step ?? "Queued",
      recommendationStatus: "Not asked",
      ...data,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    setContacts((cs) => [optimistic, ...cs]);
    setShowNew(false);
    try {
      const realId = await createContact(workspace, data);
      setContacts((cs) =>
        cs.map((c) => (c.id === tempId ? { ...c, id: realId } : c)),
      );
    } catch (e) {
      console.error("create failed", e);
      setContacts((cs) => cs.filter((c) => c.id !== tempId));
    }
  }

  const columns: DbTableColumn<Contact>[] = [
    {
      key: "name",
      label: "Name",
      render: (c) => (
        <span>
          <span style={{ fontWeight: 600 }}>{c.name || <em>untitled</em>}</span>
          {c.occupation ? (
            <span style={{ color: "var(--ink-muted)" }}> — {c.occupation}</span>
          ) : null}
        </span>
      ),
    },
    {
      key: "step",
      label: "Step",
      width: "140px",
      render: (c) => <StatusChip status={c.step} />,
    },
    {
      key: "source",
      label: "Source",
      width: "90px",
      render: (c) => <span style={{ color: "var(--ink-muted)" }}>{c.source ?? "—"}</span>,
    },
    {
      key: "blocker",
      label: "Blocker / Next",
      render: (c) => (
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          {c.blocker ? (
            <span style={{ color: "var(--amber-deep)" }}>
              ✕ {truncate(c.blocker, 90)}
            </span>
          ) : null}
          {c.nextAction ? (
            <span>→ {truncate(c.nextAction, 90)}</span>
          ) : null}
          {!c.blocker && !c.nextAction ? (
            <span style={{ color: "var(--ink-muted)" }}>—</span>
          ) : null}
        </div>
      ),
    },
    {
      key: "rec",
      label: "Rec",
      width: "100px",
      render: (c) => (
        <span style={{ color: "var(--ink-muted)", fontSize: 11 }}>
          {c.recommendationStatus}
          {c.recommendationCount ? ` (${c.recommendationCount})` : ""}
        </span>
      ),
    },
  ];

  const stepCounts = useMemo(() => {
    const map = new Map<string, number>();
    contacts.forEach((c) => map.set(c.step, (map.get(c.step) ?? 0) + 1));
    return map;
  }, [contacts]);

  return (
    <>
      <div className="filter-row">
        <FilterPill
          active={filterStep === "All"}
          onClick={() => setFilterStep("All")}
        >
          All ({contacts.length})
        </FilterPill>
        {STEP_OPTIONS.map((s) => (
          <FilterPill
            key={s}
            active={filterStep === s}
            onClick={() => setFilterStep(s)}
          >
            {s} ({stepCounts.get(s) ?? 0})
          </FilterPill>
        ))}
      </div>

      <DbBox
        title={`Contacts (${filtered.length} shown / ${contacts.length} total)`}
        rightSlot={
          <input
            value={filterText}
            onChange={(e) => setFilterText(e.target.value)}
            placeholder="filter..."
            className="db-input db-input--inline"
          />
        }
      >
        <DbTable
          columns={columns}
          rows={filtered}
          getRowId={(c) => c.id}
          onRowClick={(c) => setSelectedId(c.id)}
          selectedId={selectedId ?? undefined}
          emptyMessage="No contacts match your filter."
        />
      </DbBox>

      {selected ? (
        <EditPanel
          title={`Edit · ${selected.name || "untitled"}`}
          onClose={() => setSelectedId(null)}
          footer={
            <DbButton variant="danger" onClick={() => handleDelete(selected.id)}>
              Delete
            </DbButton>
          }
        >
          <ContactForm
            contact={selected}
            onChange={(patch) => handleUpdate(selected.id, patch)}
          />
        </EditPanel>
      ) : null}

      {showNew ? (
        <EditPanel title="New contact" onClose={() => setShowNew(false)}>
          <NewContactForm onCreate={handleCreate} onCancel={() => setShowNew(false)} />
        </EditPanel>
      ) : null}

      <FKeyFooter
        keys={[
          { key: "N", label: "New contact", onClick: () => setShowNew(true) },
          { key: "Esc", label: "Close panel", onClick: () => setSelectedId(null) },
        ]}
        rightSlot={
          isPending ? <span>saving…</span> : <span>{contacts.length} entries</span>
        }
      />
    </>
  );
}

function FilterPill({
  active,
  children,
  onClick,
}: {
  active: boolean;
  children: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`filter-pill ${active ? "filter-pill--active" : ""}`}
    >
      {children}
    </button>
  );
}

function ContactForm({
  contact,
  onChange,
}: {
  contact: Contact;
  onChange: (patch: Partial<Contact>) => void;
}) {
  return (
    <div className="db-form">
      <DbField label="Name">
        <DbInput
          defaultValue={contact.name}
          onBlur={(e) =>
            e.target.value !== contact.name && onChange({ name: e.target.value })
          }
        />
      </DbField>
      <div className="db-form__row">
        <DbField label="Phone">
          <DbInput
            defaultValue={contact.phone ?? ""}
            onBlur={(e) =>
              e.target.value !== (contact.phone ?? "") &&
              onChange({ phone: e.target.value || undefined })
            }
          />
        </DbField>
        <DbField label="Occupation">
          <DbInput
            defaultValue={contact.occupation ?? ""}
            onBlur={(e) =>
              e.target.value !== (contact.occupation ?? "") &&
              onChange({ occupation: e.target.value || undefined })
            }
          />
        </DbField>
      </div>
      <div className="db-form__row">
        <DbField label="Step">
          <DbSelect
            value={contact.step}
            onChange={(v) => onChange({ step: v as Step })}
            options={STEP_OPTIONS}
          />
        </DbField>
        <DbField label="Recommendation">
          <DbSelect
            value={contact.recommendationStatus}
            onChange={(v) =>
              onChange({ recommendationStatus: v as Contact["recommendationStatus"] })
            }
            options={RECOMMENDATION_STATUSES}
          />
        </DbField>
      </div>
      <div className="db-form__row">
        <DbField label="Source">
          <DbSelect
            value={contact.source ?? "Personal"}
            onChange={(v) => onChange({ source: v as Contact["source"] })}
            options={SOURCE_OPTIONS}
          />
        </DbField>
        <DbField label="Tier">
          <DbSelect
            value={contact.tier ?? ""}
            onChange={(v) =>
              onChange({ tier: (v || undefined) as Contact["tier"] })
            }
            options={["", ...TIER_OPTIONS]}
          />
        </DbField>
      </div>
      <DbField label="Hook (specific reason to reach out)">
        <DbTextarea
          rows={2}
          defaultValue={contact.hook ?? ""}
          onBlur={(e) =>
            e.target.value !== (contact.hook ?? "") &&
            onChange({ hook: e.target.value || undefined })
          }
        />
      </DbField>
      <DbField label="Blocker (what's stuck)">
        <DbTextarea
          rows={2}
          defaultValue={contact.blocker ?? ""}
          onBlur={(e) =>
            e.target.value !== (contact.blocker ?? "") &&
            onChange({ blocker: e.target.value || undefined })
          }
        />
      </DbField>
      <DbField label="Next action">
        <DbTextarea
          rows={2}
          defaultValue={contact.nextAction ?? ""}
          onBlur={(e) =>
            e.target.value !== (contact.nextAction ?? "") &&
            onChange({ nextAction: e.target.value || undefined })
          }
        />
      </DbField>
      <DbField label="Rituals owned (one per line)">
        <DbTextarea
          rows={3}
          defaultValue={(contact.ritualsOwned ?? []).join("\n")}
          onBlur={(e) => {
            const next = e.target.value
              .split("\n")
              .map((l) => l.trim())
              .filter(Boolean);
            onChange({ ritualsOwned: next.length > 0 ? next : undefined });
          }}
        />
      </DbField>
      <DbField label="Notes">
        <DbTextarea
          rows={3}
          defaultValue={contact.notes ?? ""}
          onBlur={(e) =>
            e.target.value !== (contact.notes ?? "") &&
            onChange({ notes: e.target.value || undefined })
          }
        />
      </DbField>
      <DbCheckbox
        label="In product backlog (this contact's issue spawned a backlog item)"
        checked={!!contact.inBacklog}
        onChange={(v) => onChange({ inBacklog: v })}
      />
    </div>
  );
}

function NewContactForm({
  onCreate,
  onCancel,
}: {
  onCreate: (data: Partial<Contact>) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [source, setSource] = useState<Contact["source"]>("LinkedIn");
  const [step, setStep] = useState<Step>("Queued");
  const [hook, setHook] = useState("");

  return (
    <form
      className="db-form"
      onSubmit={(e) => {
        e.preventDefault();
        if (!name.trim()) return;
        onCreate({
          name: name.trim(),
          phone: phone.trim() || undefined,
          source,
          step,
          hook: hook.trim() || undefined,
          recommendationStatus: "Not asked",
        });
      }}
    >
      <DbField label="Name">
        <DbInput
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
      </DbField>
      <DbField label="Phone (optional)">
        <DbInput value={phone} onChange={(e) => setPhone(e.target.value)} />
      </DbField>
      <div className="db-form__row">
        <DbField label="Source">
          <DbSelect
            value={source ?? "LinkedIn"}
            onChange={(v) => setSource(v as Contact["source"])}
            options={SOURCE_OPTIONS}
          />
        </DbField>
        <DbField label="Step">
          <DbSelect
            value={step}
            onChange={(v) => setStep(v as Step)}
            options={STEP_OPTIONS}
          />
        </DbField>
      </div>
      <DbField label="Hook (specific reason)">
        <DbTextarea
          rows={2}
          value={hook}
          onChange={(e) => setHook(e.target.value)}
        />
      </DbField>
      <div style={{ display: "flex", gap: 8 }}>
        <DbButton type="submit" variant="primary" disabled={!name.trim()}>
          Create
        </DbButton>
        <DbButton type="button" onClick={onCancel}>
          Cancel
        </DbButton>
      </div>
    </form>
  );
}

function truncate(s: string, max: number): string {
  if (s.length <= max) return s;
  return s.slice(0, max - 1) + "…";
}
