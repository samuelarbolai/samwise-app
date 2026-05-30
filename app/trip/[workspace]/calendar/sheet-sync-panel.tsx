"use client";

import { useState } from "react";
import { EditPanel } from "../../../outreach/_components/edit-panel";
import {
  DbButton,
  DbField,
  DbInput,
} from "../../../outreach/_components/db-form";
import {
  pushCalendarToSheet,
  setSheetConfig,
  syncCalendarFromSheet,
} from "../../actions";

interface Props {
  workspace: string;
  initialSheetId: string | null;
  initialTabName: string | null;
  lastPushedAt: number | null;
  serviceAccountEmail: string | null;
  onClose: () => void;
}

export function SheetSyncPanel({
  workspace,
  initialSheetId,
  initialTabName,
  lastPushedAt,
  serviceAccountEmail,
  onClose,
}: Props) {
  const [sheetId, setSheetId] = useState(initialSheetId ?? "");
  const [tabName, setTabName] = useState(initialTabName ?? "trip-app");
  const [pending, setPending] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null);

  async function handleSave() {
    if (!sheetId.trim() || !tabName.trim()) return;
    setPending(true);
    setResult(null);
    try {
      await setSheetConfig(workspace, sheetId.trim(), tabName.trim());
      setResult({ ok: true, text: "Config saved." });
    } catch (e) {
      setResult({ ok: false, text: errMsg(e) });
    } finally {
      setPending(false);
    }
  }

  async function handlePush() {
    if (!sheetId.trim() || !tabName.trim()) {
      setResult({ ok: false, text: "Save config first." });
      return;
    }
    setPending(true);
    setResult(null);
    try {
      // Save first so push always uses the latest values.
      await setSheetConfig(workspace, sheetId.trim(), tabName.trim());
      const r = await pushCalendarToSheet(workspace);
      setResult({
        ok: true,
        text: `Wrote ${r.rowsWritten} rows to "${r.tabName}".`,
      });
    } catch (e) {
      setResult({ ok: false, text: errMsg(e) });
    } finally {
      setPending(false);
    }
  }

  async function handlePull() {
    if (
      !confirm(
        "Apply the May 29 hard-coded sheet sync? This is a one-shot patch — it does not actually read the live sheet.",
      )
    )
      return;
    setPending(true);
    setResult(null);
    try {
      const r = await syncCalendarFromSheet(workspace);
      setResult({
        ok: true,
        text: `Patched ${r.matched} events: ${r.patched.join(", ") || "(none)"}`,
      });
    } catch (e) {
      setResult({ ok: false, text: errMsg(e) });
    } finally {
      setPending(false);
    }
  }

  return (
    <EditPanel title="Sheet sync" onClose={onClose}>
      <div className="db-form">
        <DbField
          label="Spreadsheet ID"
          hint="From the URL: docs.google.com/spreadsheets/d/<this part>/edit"
        >
          <DbInput
            value={sheetId}
            onChange={(e) => setSheetId(e.target.value)}
            placeholder="1qmpT9..."
            spellCheck={false}
          />
        </DbField>

        <DbField label="Tab name" hint="Created if it doesn't exist.">
          <DbInput
            value={tabName}
            onChange={(e) => setTabName(e.target.value)}
            spellCheck={false}
          />
        </DbField>

        {serviceAccountEmail ? (
          <div
            style={{
              padding: 10,
              border: "1px dashed var(--rule)",
              background: "var(--paper-deep)",
            }}
          >
            <p
              style={{
                margin: 0,
                fontSize: 11,
                color: "var(--ink-muted)",
                fontFamily: "var(--font-mono)",
              }}
            >
              <strong>One-time setup:</strong> share the spreadsheet with this
              service account (Editor access).
            </p>
            <code
              style={{
                display: "block",
                marginTop: 6,
                fontSize: 11,
                color: "var(--ink)",
                userSelect: "all",
                wordBreak: "break-all",
              }}
            >
              {serviceAccountEmail}
            </code>
          </div>
        ) : null}

        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <DbButton onClick={handleSave} disabled={pending}>
            Save config
          </DbButton>
          <DbButton variant="primary" onClick={handlePush} disabled={pending}>
            ↑ Push app → sheet
          </DbButton>
          <DbButton onClick={handlePull} disabled={pending}>
            ↓ Pull May 29 sheet (one-shot)
          </DbButton>
        </div>

        {lastPushedAt ? (
          <p
            style={{
              fontSize: 11,
              color: "var(--ink-muted)",
              fontFamily: "var(--font-mono)",
            }}
          >
            Last pushed: {new Date(lastPushedAt).toLocaleString()}
          </p>
        ) : null}

        {result ? (
          <p
            style={{
              fontSize: 12,
              color: result.ok ? "var(--moss)" : "var(--amber-deep)",
              fontFamily: "var(--font-mono)",
              padding: "8px 10px",
              border: `1px solid ${result.ok ? "var(--moss)" : "var(--amber-deep)"}`,
              background: "var(--paper)",
              marginTop: 0,
            }}
          >
            {result.text}
          </p>
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
            What pushes
          </summary>
          <ul
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: 11,
              color: "var(--ink-muted)",
              lineHeight: 1.6,
              paddingLeft: 16,
              margin: "6px 0 0",
            }}
          >
            <li>Push clears the target tab and rewrites it.</li>
            <li>
              Columns: Picked, Date, Day, Time, Title, Location, Cost, Tier,
              Registration type, Status, Link, Notes, Date kind, Cadence.
            </li>
            <li>Pull is one-shot, hard-coded to the May 29 deltas.</li>
          </ul>
        </details>
      </div>
    </EditPanel>
  );
}

function errMsg(e: unknown): string {
  if (e instanceof Error) return e.message;
  return String(e);
}
