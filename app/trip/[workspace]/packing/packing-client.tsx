"use client";

import { useState, useTransition } from "react";
import { DbBox } from "../../../outreach/_components/db-box";
import type { PackingItem } from "../../_types";
import { togglePacking } from "../../actions";

interface Props {
  workspace: string;
  items: PackingItem[];
}

export function PackingClient({ workspace, items: initial }: Props) {
  const [items, setItems] = useState(initial);
  const [, startTransition] = useTransition();

  function toggle(id: string, checked: boolean) {
    setItems((is) => is.map((i) => (i.id === id ? { ...i, checked } : i)));
    startTransition(async () => {
      try {
        await togglePacking(workspace, id, checked);
      } catch (e) {
        console.error(e);
      }
    });
  }

  const grouped = new Map<string, PackingItem[]>();
  items.forEach((i) => {
    if (!grouped.has(i.category)) grouped.set(i.category, []);
    grouped.get(i.category)!.push(i);
  });

  const total = items.length;
  const done = items.filter((i) => i.checked).length;

  return (
    <>
      <p className="label-eyebrow">
        {done} of {total} packed
      </p>
      {Array.from(grouped.entries()).map(([cat, list]) => (
        <DbBox key={cat} title={cat}>
          <ul className="packing-list">
            {list.map((i) => (
              <li key={i.id}>
                <label className="db-checkbox">
                  <input
                    type="checkbox"
                    checked={i.checked}
                    onChange={(e) => toggle(i.id, e.target.checked)}
                  />
                  <span
                    style={{
                      textDecoration: i.checked ? "line-through" : "none",
                      color: i.checked ? "var(--ink-muted)" : "var(--ink)",
                    }}
                  >
                    {i.label}
                  </span>
                </label>
              </li>
            ))}
          </ul>
        </DbBox>
      ))}
    </>
  );
}
