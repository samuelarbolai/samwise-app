"use client";

import { useState, useTransition } from "react";
import { DbBox } from "../../../outreach/_components/db-box";
import type { PreTripTodo } from "../../_types";
import { toggleTodo } from "../../actions";

interface Props {
  workspace: string;
  todos: PreTripTodo[];
}

export function PreTripClient({ workspace, todos: initial }: Props) {
  const [todos, setTodos] = useState(initial);
  const [, startTransition] = useTransition();

  function toggle(id: string, done: boolean) {
    setTodos((ts) => ts.map((t) => (t.id === id ? { ...t, done } : t)));
    startTransition(async () => {
      try {
        await toggleTodo(workspace, id, done);
      } catch (e) {
        console.error(e);
      }
    });
  }

  const sorted = [...todos].sort((a, b) => {
    if (a.done !== b.done) return a.done ? 1 : -1;
    if (a.dueDate && b.dueDate) return a.dueDate.localeCompare(b.dueDate);
    if (a.dueDate) return -1;
    if (b.dueDate) return 1;
    return 0;
  });

  const done = todos.filter((t) => t.done).length;

  return (
    <>
      <p className="label-eyebrow">
        {done} of {todos.length} pre-trip todos done
      </p>
      <DbBox title="Pre-trip todos">
        <ul className="todo-list">
          {sorted.map((t) => (
            <li key={t.id} className="todo-item">
              <label className="db-checkbox">
                <input
                  type="checkbox"
                  checked={t.done}
                  onChange={(e) => toggle(t.id, e.target.checked)}
                />
                <span
                  style={{
                    textDecoration: t.done ? "line-through" : "none",
                    color: t.done ? "var(--ink-muted)" : "var(--ink)",
                  }}
                >
                  {t.label}
                </span>
              </label>
              <div className="todo-item__meta">
                {t.dueDate ? (
                  <span className="label-eyebrow">due {t.dueDate}</span>
                ) : null}
                {t.link ? (
                  <a href={t.link} target="_blank" rel="noreferrer">
                    open →
                  </a>
                ) : null}
              </div>
              {t.notes ? <p className="todo-item__notes">{t.notes}</p> : null}
            </li>
          ))}
        </ul>
      </DbBox>
    </>
  );
}
