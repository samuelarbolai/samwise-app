"use client";

import { useMemo, useState } from "react";
import { DbBox } from "../../../outreach/_components/db-box";
import {
  DbButton,
  DbField,
  DbInput,
  DbSelect,
} from "../../../outreach/_components/db-form";
import type { BudgetLine, SpendEntry } from "../../_types";
import { logSpend } from "../../actions";

const CATEGORIES: BudgetLine["category"][] = [
  "Transit",
  "Lodging",
  "Meetings",
  "Food",
  "Groceries",
  "Events",
  "Emergency",
  "Other",
];

interface Props {
  workspace: string;
  budgetLines: BudgetLine[];
  initialSpend: SpendEntry[];
}

export function BudgetClient({ workspace, budgetLines, initialSpend }: Props) {
  const [spend, setSpend] = useState<SpendEntry[]>(initialSpend);
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [category, setCategory] = useState<BudgetLine["category"]>("Food");
  const [label, setLabel] = useState("");
  const [amount, setAmount] = useState("");
  const [notes, setNotes] = useState("");

  const totals = useMemo(() => {
    const planned = budgetLines.reduce((acc, l) => acc + l.amountUSD, 0);
    const spent = spend.reduce((acc, s) => acc + s.amountUSD, 0);
    const byCategory = new Map<string, { planned: number; spent: number }>();
    CATEGORIES.forEach((c) => byCategory.set(c, { planned: 0, spent: 0 }));
    budgetLines.forEach((l) => {
      const e = byCategory.get(l.category)!;
      e.planned += l.amountUSD;
    });
    spend.forEach((s) => {
      const e = byCategory.get(s.category) ?? { planned: 0, spent: 0 };
      e.spent += s.amountUSD;
      byCategory.set(s.category, e);
    });
    return { planned, spent, remaining: planned - spent, byCategory };
  }, [budgetLines, spend]);

  async function handleLog(e: React.FormEvent) {
    e.preventDefault();
    const num = Number(amount);
    if (!label.trim() || !num || num <= 0) return;
    const optimistic: SpendEntry = {
      id: `tmp-${Date.now()}`,
      date,
      category,
      label: label.trim(),
      amountUSD: num,
      notes: notes.trim() || undefined,
    };
    setSpend((s) => [optimistic, ...s]);
    setLabel("");
    setAmount("");
    setNotes("");
    try {
      const realId = await logSpend(workspace, {
        date,
        category,
        label: optimistic.label,
        amountUSD: num,
        notes: optimistic.notes,
      });
      setSpend((s) =>
        s.map((entry) => (entry.id === optimistic.id ? { ...entry, id: realId } : entry)),
      );
    } catch (err) {
      console.error(err);
    }
  }

  return (
    <>
      <DbBox
        title="Budget summary"
        rightSlot={
          <span>
            Planned ${totals.planned.toFixed(0)} · Spent ${totals.spent.toFixed(2)} ·
            {" "}
            <strong
              style={{
                color: totals.remaining < 0 ? "var(--amber-deep)" : "var(--moss)",
              }}
            >
              ${totals.remaining.toFixed(2)} left
            </strong>
          </span>
        }
      >
        <table className="db-table">
          <thead>
            <tr>
              <th>Category</th>
              <th style={{ textAlign: "right" }}>Planned</th>
              <th style={{ textAlign: "right" }}>Spent</th>
              <th style={{ textAlign: "right" }}>Δ</th>
            </tr>
          </thead>
          <tbody>
            {CATEGORIES.map((cat) => {
              const e = totals.byCategory.get(cat)!;
              const delta = e.planned - e.spent;
              return (
                <tr key={cat} className="db-table__row">
                  <td>{cat}</td>
                  <td style={{ textAlign: "right" }}>${e.planned.toFixed(0)}</td>
                  <td style={{ textAlign: "right" }}>${e.spent.toFixed(2)}</td>
                  <td
                    style={{
                      textAlign: "right",
                      color: delta < 0 ? "var(--amber-deep)" : "var(--ink-muted)",
                    }}
                  >
                    ${delta.toFixed(2)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </DbBox>

      <DbBox title="Planned line items">
        <table className="db-table">
          <thead>
            <tr>
              <th>Category</th>
              <th>Label</th>
              <th style={{ textAlign: "right" }}>USD</th>
            </tr>
          </thead>
          <tbody>
            {budgetLines.map((l) => (
              <tr key={l.id} className="db-table__row">
                <td style={{ color: "var(--ink-muted)" }}>{l.category}</td>
                <td>
                  {l.label}
                  {l.notes ? (
                    <div
                      style={{
                        color: "var(--ink-muted)",
                        fontSize: 11,
                        marginTop: 2,
                      }}
                    >
                      {l.notes}
                    </div>
                  ) : null}
                </td>
                <td style={{ textAlign: "right" }}>${l.amountUSD.toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </DbBox>

      <DbBox title="Log spend">
        <form className="db-form" onSubmit={handleLog}>
          <div className="db-form__row">
            <DbField label="Date">
              <DbInput type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </DbField>
            <DbField label="Category">
              <DbSelect
                value={category}
                onChange={(v) => setCategory(v as BudgetLine["category"])}
                options={CATEGORIES}
              />
            </DbField>
          </div>
          <div className="db-form__row">
            <DbField label="What">
              <DbInput
                placeholder="e.g. Coffee w/ Sara"
                value={label}
                onChange={(e) => setLabel(e.target.value)}
              />
            </DbField>
            <DbField label="USD">
              <DbInput
                type="number"
                step="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
            </DbField>
          </div>
          <DbButton
            type="submit"
            variant="primary"
            disabled={!label.trim() || !Number(amount)}
          >
            Log
          </DbButton>
        </form>
      </DbBox>

      <DbBox title={`Spend ledger (${spend.length})`}>
        {spend.length === 0 ? (
          <p style={{ color: "var(--ink-muted)" }}>No entries yet.</p>
        ) : (
          <table className="db-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Category</th>
                <th>Label</th>
                <th style={{ textAlign: "right" }}>USD</th>
              </tr>
            </thead>
            <tbody>
              {spend.map((s) => (
                <tr key={s.id} className="db-table__row">
                  <td>{s.date}</td>
                  <td style={{ color: "var(--ink-muted)" }}>{s.category}</td>
                  <td>{s.label}</td>
                  <td style={{ textAlign: "right" }}>${s.amountUSD.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </DbBox>
    </>
  );
}
