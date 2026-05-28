"use client";

import { useState } from "react";
import { DbBox } from "../../_components/db-box";
import { EditPanel } from "../../_components/edit-panel";
import { FKeyFooter } from "../../_components/f-key-footer";
import {
  DbButton,
  DbField,
  DbInput,
  DbTextarea,
} from "../../_components/db-form";
import type { Mistake } from "../../_types";
import { createMistake } from "../../actions";

interface Props {
  workspace: string;
  initialMistakes: Mistake[];
}

export function MistakesClient({ workspace, initialMistakes }: Props) {
  const [mistakes, setMistakes] = useState<Mistake[]>(initialMistakes);
  const [showNew, setShowNew] = useState(false);

  async function handleAdd(data: Omit<Mistake, "id" | "createdAt">) {
    const tempId = `tmp-${Date.now()}`;
    const optimistic: Mistake = {
      id: tempId,
      ...data,
      createdAt: Date.now(),
    };
    setMistakes((m) => [optimistic, ...m]);
    setShowNew(false);
    try {
      const realId = await createMistake(workspace, data);
      setMistakes((m) =>
        m.map((entry) => (entry.id === tempId ? { ...entry, id: realId } : entry)),
      );
    } catch (e) {
      console.error(e);
      setMistakes((m) => m.filter((entry) => entry.id !== tempId));
    }
  }

  return (
    <>
      <DbBox
        title={`Mistakes log (${mistakes.length})`}
        rightSlot={
          <button
            type="button"
            className="db-btn db-btn--inline"
            onClick={() => setShowNew(true)}
          >
            + Log mistake
          </button>
        }
      >
        {mistakes.length === 0 ? (
          <p style={{ color: "var(--ink-muted)" }}>
            No mistakes logged. Most useful when you record them the moment they
            happen.
          </p>
        ) : (
          <ul className="mistake-list">
            {mistakes.map((m) => (
              <li key={m.id} className="mistake-item">
                <div className="mistake-item__head">
                  <span className="label-eyebrow">{m.date}</span>
                  {m.templateVersionFix ? (
                    <span
                      style={{
                        fontFamily: "var(--font-mono)",
                        fontSize: 10,
                        color: "var(--accent-gold)",
                      }}
                    >
                      → fix in template {m.templateVersionFix}
                    </span>
                  ) : null}
                </div>
                <p className="mistake-item__desc">{m.description}</p>
                <p className="mistake-item__lesson">
                  <strong>Lesson: </strong>
                  {m.lesson}
                </p>
              </li>
            ))}
          </ul>
        )}
      </DbBox>

      {showNew ? (
        <EditPanel title="Log mistake" onClose={() => setShowNew(false)}>
          <NewMistakeForm onCreate={handleAdd} onCancel={() => setShowNew(false)} />
        </EditPanel>
      ) : null}

      <FKeyFooter
        keys={[
          { key: "N", label: "Log mistake", onClick: () => setShowNew(true) },
        ]}
        rightSlot={<span>{mistakes.length} entries</span>}
      />
    </>
  );
}

function NewMistakeForm({
  onCreate,
  onCancel,
}: {
  onCreate: (data: Omit<Mistake, "id" | "createdAt">) => void;
  onCancel: () => void;
}) {
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [description, setDescription] = useState("");
  const [lesson, setLesson] = useState("");
  const [templateVersionFix, setTemplateVersionFix] = useState("");

  return (
    <form
      className="db-form"
      onSubmit={(e) => {
        e.preventDefault();
        if (!description.trim() || !lesson.trim()) return;
        onCreate({
          date,
          description: description.trim(),
          lesson: lesson.trim(),
          templateVersionFix: templateVersionFix.trim() || undefined,
        });
      }}
    >
      <DbField label="Date">
        <DbInput type="date" value={date} onChange={(e) => setDate(e.target.value)} />
      </DbField>
      <DbField
        label="What happened"
        hint="One or two sentences. Concrete."
      >
        <DbTextarea
          rows={3}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
      </DbField>
      <DbField
        label="Lesson"
        hint="What you would do differently next time."
      >
        <DbTextarea
          rows={3}
          value={lesson}
          onChange={(e) => setLesson(e.target.value)}
        />
      </DbField>
      <DbField label="Fix in template version (optional)">
        <DbInput
          placeholder="e.g. T1 v3"
          value={templateVersionFix}
          onChange={(e) => setTemplateVersionFix(e.target.value)}
        />
      </DbField>
      <div style={{ display: "flex", gap: 8 }}>
        <DbButton
          type="submit"
          variant="primary"
          disabled={!description.trim() || !lesson.trim()}
        >
          Log it
        </DbButton>
        <DbButton type="button" onClick={onCancel}>
          Cancel
        </DbButton>
      </div>
    </form>
  );
}
