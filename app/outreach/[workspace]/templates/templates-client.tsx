"use client";

import { useMemo, useState, useTransition } from "react";
import { DbBox } from "../../_components/db-box";
import { EditPanel } from "../../_components/edit-panel";
import { FKeyFooter } from "../../_components/f-key-footer";
import {
  DbButton,
  DbField,
  DbInput,
  DbSelect,
  DbTextarea,
} from "../../_components/db-form";
import {
  AUDIENCE_OPTIONS,
  type Audience,
  type Template,
} from "../../_types";
import {
  createTemplate,
  createTemplateVersion,
  lockTemplate,
} from "../../actions";

interface Props {
  workspace: string;
  initialTemplates: Template[];
}

export function TemplatesClient({ workspace, initialTemplates }: Props) {
  const [templates, setTemplates] = useState<Template[]>(initialTemplates);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showNew, setShowNew] = useState(false);
  const [isPending, startTransition] = useTransition();

  const selected = useMemo(
    () => (selectedId ? templates.find((t) => t.id === selectedId) ?? null : null),
    [templates, selectedId],
  );

  const grouped = useMemo(() => {
    const out: Record<Audience, Template[]> = {
      T1: [],
      T2: [],
      Phone: [],
    };
    templates.forEach((t) => out[t.audience].push(t));
    Object.values(out).forEach((list) =>
      list.sort((a, b) => {
        if (a.retired !== b.retired) return a.retired ? 1 : -1;
        return b.version - a.version || b.createdAt - a.createdAt;
      }),
    );
    return out;
  }, [templates]);

  async function handleNewVersion(parentId: string, newBody: string) {
    const parent = templates.find((t) => t.id === parentId);
    if (!parent) return;
    const tempId = `tmp-${Date.now()}`;
    const optimistic: Template = {
      ...parent,
      id: tempId,
      version: parent.version + 1,
      body: newBody,
      parentVersionId: parentId,
      locked: false,
      retired: false,
      createdAt: Date.now(),
    };
    setTemplates((ts) => [
      optimistic,
      ...ts.map((t) => (t.id === parentId ? { ...t, retired: true } : t)),
    ]);
    setSelectedId(tempId);
    try {
      const realId = await createTemplateVersion(workspace, parentId, newBody);
      setTemplates((ts) =>
        ts.map((t) => (t.id === tempId ? { ...t, id: realId } : t)),
      );
      setSelectedId(realId);
    } catch (e) {
      console.error(e);
    }
  }

  function handleLock(templateId: string) {
    setTemplates((ts) =>
      ts.map((t) => (t.id === templateId ? { ...t, locked: true, lockedAt: Date.now() } : t)),
    );
    startTransition(async () => {
      try {
        await lockTemplate(workspace, templateId);
      } catch (e) {
        console.error(e);
      }
    });
  }

  async function handleCreateNew(data: { name: string; audience: Audience; body: string }) {
    const tempId = `tmp-${Date.now()}`;
    const optimistic: Template = {
      id: tempId,
      ...data,
      version: 1,
      locked: false,
      retired: false,
      createdAt: Date.now(),
    };
    setTemplates((ts) => [optimistic, ...ts]);
    setShowNew(false);
    try {
      const realId = await createTemplate(workspace, data);
      setTemplates((ts) =>
        ts.map((t) => (t.id === tempId ? { ...t, id: realId } : t)),
      );
    } catch (e) {
      console.error(e);
      setTemplates((ts) => ts.filter((t) => t.id !== tempId));
    }
  }

  return (
    <>
      {(["T1", "T2", "Phone"] as const).map((aud) => {
        const list = grouped[aud];
        return (
          <DbBox
            key={aud}
            title={`${aud} templates (${list.length})`}
            rightSlot={
              <button
                type="button"
                className="db-btn db-btn--inline"
                onClick={() => setShowNew(true)}
              >
                + New
              </button>
            }
          >
            {list.length === 0 ? (
              <p style={{ color: "var(--ink-muted)" }}>
                No templates in this audience yet.
              </p>
            ) : (
              <ul className="template-list">
                {list.map((t) => (
                  <li
                    key={t.id}
                    className={`template-item ${selectedId === t.id ? "template-item--selected" : ""} ${t.retired ? "template-item--retired" : ""}`}
                    onClick={() => setSelectedId(t.id)}
                  >
                    <div className="template-item__head">
                      <span className="template-item__name">
                        {t.name}{" "}
                        <span className="template-item__version">
                          v{t.version}
                          {t.locked ? " · locked" : ""}
                          {t.retired ? " · retired" : ""}
                        </span>
                      </span>
                    </div>
                    <pre className="template-item__preview">
                      {truncate(t.body, 280)}
                    </pre>
                  </li>
                ))}
              </ul>
            )}
          </DbBox>
        );
      })}

      {selected ? (
        <EditPanel
          title={`${selected.name} · v${selected.version}`}
          onClose={() => setSelectedId(null)}
          footer={
            <>
              {!selected.locked && !selected.retired ? (
                <DbButton onClick={() => handleLock(selected.id)}>Lock</DbButton>
              ) : null}
              <DbButton variant="primary" onClick={() => setSelectedId(null)}>
                Done
              </DbButton>
            </>
          }
        >
          <TemplateForm
            template={selected}
            onNewVersion={(body) => handleNewVersion(selected.id, body)}
          />
        </EditPanel>
      ) : null}

      {showNew ? (
        <EditPanel title="New template" onClose={() => setShowNew(false)}>
          <NewTemplateForm onCreate={handleCreateNew} onCancel={() => setShowNew(false)} />
        </EditPanel>
      ) : null}

      <FKeyFooter
        keys={[
          { key: "N", label: "New template", onClick: () => setShowNew(true) },
          { key: "Esc", label: "Close panel", onClick: () => setSelectedId(null) },
        ]}
        rightSlot={isPending ? <span>saving…</span> : <span>{templates.length} versions</span>}
      />
    </>
  );
}

function TemplateForm({
  template,
  onNewVersion,
}: {
  template: Template;
  onNewVersion: (body: string) => void;
}) {
  const [body, setBody] = useState(template.body);
  const dirty = body !== template.body;
  return (
    <div className="db-form">
      <DbField label="Audience">
        <span style={{ fontFamily: "var(--font-mono)", fontSize: 13 }}>
          {template.audience}
        </span>
      </DbField>
      <DbField
        label="Body"
        hint={
          template.locked
            ? "This version is locked. Use 'Save as new version' to iterate."
            : template.retired
              ? "This version is retired. View only."
              : "Edits create a new version when saved."
        }
      >
        <DbTextarea
          rows={12}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          readOnly={template.locked || template.retired}
        />
      </DbField>
      {!template.retired ? (
        <DbButton
          variant="primary"
          disabled={!dirty}
          onClick={() => onNewVersion(body)}
        >
          Save as v{template.version + 1}
        </DbButton>
      ) : null}
      <details>
        <summary
          style={{
            fontFamily: "var(--font-manrope)",
            fontSize: 10,
            letterSpacing: "0.18em",
            textTransform: "uppercase",
            color: "var(--ink-muted)",
            cursor: "pointer",
          }}
        >
          Metadata
        </summary>
        <ul style={{ fontFamily: "var(--font-mono)", fontSize: 11, lineHeight: 1.6, color: "var(--ink-muted)" }}>
          <li>Created: {new Date(template.createdAt).toISOString().slice(0, 16).replace("T", " ")}</li>
          {template.lockedAt ? <li>Locked: {new Date(template.lockedAt).toISOString().slice(0, 16).replace("T", " ")}</li> : null}
          {template.parentVersionId ? <li>Parent version: {template.parentVersionId}</li> : null}
        </ul>
      </details>
    </div>
  );
}

function NewTemplateForm({
  onCreate,
  onCancel,
}: {
  onCreate: (data: { name: string; audience: Audience; body: string }) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState("");
  const [audience, setAudience] = useState<Audience>("T1");
  const [body, setBody] = useState("");

  return (
    <form
      className="db-form"
      onSubmit={(e) => {
        e.preventDefault();
        if (!name.trim() || !body.trim()) return;
        onCreate({ name: name.trim(), audience, body: body.trim() });
      }}
    >
      <DbField label="Name">
        <DbInput autoFocus value={name} onChange={(e) => setName(e.target.value)} />
      </DbField>
      <DbField label="Audience">
        <DbSelect
          value={audience}
          onChange={(v) => setAudience(v as Audience)}
          options={AUDIENCE_OPTIONS}
        />
      </DbField>
      <DbField label="Body">
        <DbTextarea rows={10} value={body} onChange={(e) => setBody(e.target.value)} />
      </DbField>
      <div style={{ display: "flex", gap: 8 }}>
        <DbButton type="submit" variant="primary" disabled={!name.trim() || !body.trim()}>
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
