# current-plan.md — Switch /copilot persistence from Google Sheets to Firestore

## Plan Summary

The rep is no longer using the funnel sheet. Switch the end-of-call "Save" action to write a Firestore doc instead of appending a sheet row. Decisions confirmed:

- **Collection:** `demoCalls` (camelCase; sibling of existing `rituals`, `users`, `qualifications`).
- **Doc shape:** `{ raw: Record<string,string>, cleaned: Record<string,string>, prospectKey, createdAt, repName, outcome }`. Both `raw` and `cleaned` preserved for audit and cleaning-prompt tuning.
- **Doc ID:** `${prospectKey}-${Date.now()}` — mirrors `submitQualification`'s pattern. Each save is a new doc; multiple saves per prospect allowed; latest wins by `createdAt`.
- **prospectKey derivation:** prefer the qualification's `prospectKey` if a qualification was loaded into this session (preserves linkage between qualification + demo-call docs in dashboards). Fallback: derive from `cleaned.prospect_name` using the same normalization the qualification function uses (lowercase, non-alphanum → hyphen, trim hyphens).
- **Function name unchanged.** Keep `appendDemoCallRow` to avoid frontend URL/constant churn; the name is now misleading but no consumer cares. Same URL hash on redeploy.
- **Sheet code removed from this function.** `getSheetsClient` stays in the module (cheap; no other caller today, but harmless).

### Explicitly out of scope

- Renaming the function (`appendDemoCallRow` → `saveDemoCall`). Cosmetic; keep the name and the URL.
- Cleaning up `FUNNEL_SHEET_ID` / `DEMO_CALL_TAB` / `FUNNEL_SHEET_COLUMNS` from the frontend config. Vestigial now but harmless; leave them.
- Firestore rules / security. There are none on the collection today and matching the `qualifications` pattern means none yet either. Owner can add later.
- The dashboarding UI itself. User said "later."

## Plan Architecture (Flow)

1. Rep finishes call → clicks Save.
2. Frontend POSTs `{ raw, cleaned, qualificationProspectKey? }` to `appendDemoCallRow` URL.
3. Backend computes `prospectKey` (prefers body's `qualificationProspectKey`, else derives from `cleaned.prospect_name`).
4. Backend writes `{ raw, cleaned, prospectKey, createdAt, repName, outcome }` to `demoCalls/${prospectKey}-${Date.now()}`.
5. Backend returns `{ ok: true, docId }`.
6. Frontend toasts success with the docId, clears localStorage, redirects to fresh `/copilot`.

## Plan Structure (Directories and files)

```
samwise-backend/cloud-functions/functions/src/
└── index.ts                                  # MODIFIED: rewrite appendDemoCallRow body (Sheets → Firestore)

samwise-app/
├── app/copilot/
│   ├── page.tsx                              # MODIFIED: thread qualificationProspectKey through SessionState on prefill
│   └── variables-table.tsx                   # MODIFIED: change call signature, button label, success toast
└── lib/copilot/
    ├── append-row.ts                         # MODIFIED: new request body shape, new response shape
    └── session-storage.ts                    # MODIFIED: extend SessionState with optional qualificationProspectKey, bump key to v3
```

Five files. No backend deploy of `cleanVariable` / `loadCallScript` (untouched).

---

## Modifications (in phases and steps)

### Phase 1 — Backend rewrite

#### Step 1.1 — Rewrite `appendDemoCallRow` body in `index.ts`

- **In-file location:** lines ~1463–1500 (the entire `appendDemoCallRow` HTTP handler body).
- **Should not be modified:** `DEMO_CALL_COLUMNS` (leave for reference, even though unused), `getSheetsClient`, `getFirestore`, the function signature `export const appendDemoCallRow = onRequest({cors: true}, ...)`, the URL hash will stay the same since we're updating an existing function.
- **New body:**

```ts
export const appendDemoCallRow = onRequest(
  {cors: true},
  async (req, res) => {
    interface SaveBody {
      raw: Record<string, string>;
      cleaned: Record<string, string>;
      // Optional: forwarded from the frontend when the rep loaded a
      // qualification doc into this session. Preserves prospectKey
      // continuity between qualifications + demoCalls collections.
      qualificationProspectKey?: string;
    }

    try {
      const body = req.body as SaveBody;
      if (!body || typeof body !== "object" || !body.cleaned) {
        res.status(400).json({error: "cleaned required"});
        return;
      }

      const cleaned = body.cleaned;
      const raw = body.raw ?? {};
      const prospectName = (cleaned.prospect_name ?? "").trim();
      if (!prospectName && !body.qualificationProspectKey) {
        res.status(400).json({error: "prospect_name or qualificationProspectKey required"});
        return;
      }

      const prospectKey = body.qualificationProspectKey ||
        prospectName
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/(^-|-$)/g, "");

      const db = getFirestore();
      const docId = `${prospectKey}-${Date.now()}`;
      await db.collection("demoCalls").doc(docId).set({
        raw,
        cleaned,
        prospectKey,
        repName: cleaned.rep_name ?? "",
        outcome: cleaned.outcome ?? "",
        createdAt: FieldValue.serverTimestamp(),
      });

      res.status(200).json({ok: true, docId, prospectKey});
    } catch (err) {
      logger.error("appendDemoCallRow failed", err);
      const message = err instanceof Error ? err.message : String(err);
      res.status(500).json({error: message});
    }
  }
);
```

- **Explanation:** Stateless. Reads `cleaned` + `raw` from body, derives `prospectKey` (preferring `qualificationProspectKey` for cross-collection continuity), writes one doc to `demoCalls`. `repName` and `outcome` lifted to top-level fields for cheap dashboard queries later. No Sheets API call.

#### Step 1.2 — Deploy `appendDemoCallRow`

```bash
cd samwise-backend/cloud-functions/functions
pnpm run build && firebase deploy --only functions:appendDemoCallRow
```

URL unchanged.

#### Step 1.3 — Curl test

```bash
curl -X POST 'https://appenddemocallrow-b6fhjlgejq-uc.a.run.app' \
  -H 'Content-Type: application/json' \
  -d '{
    "raw": {"prospect_name": "Test Prospect", "rep_name": "Samuel Giraldo Concha"},
    "cleaned": {"prospect_name": "Test Prospect", "rep_name": "Samuel Giraldo Concha", "outcome": "follow-up"}
  }'
```

Pass: response is `{ok: true, docId: "test-prospect-<timestamp>", prospectKey: "test-prospect"}` and a doc appears in Firestore at `demoCalls/test-prospect-<timestamp>`.

---

### Phase 2 — Frontend wire-up

#### Step 2.1 — Update `lib/copilot/append-row.ts`

Replace the entire file with:

```ts
export const APPEND_DEMO_CALL_ROW_URL =
  "https://appenddemocallrow-b6fhjlgejq-uc.a.run.app"

interface SavePayload {
  raw: Record<string, string>
  cleaned: Record<string, string>
  qualificationProspectKey?: string
}

interface SaveResponse {
  ok: true
  docId: string
  prospectKey: string
}

// Persists a completed demo call to the `demoCalls` Firestore
// collection via the appendDemoCallRow cloud function. Sends both raw
// (rep's mid-call notes) and cleaned (LLM-cleaned script-fit values)
// for audit. The function URL is the same as the old sheet-based save;
// only the request/response shapes changed.
export async function appendDemoCallRow(
  payload: SavePayload,
): Promise<SaveResponse> {
  const res = await fetch(APPEND_DEMO_CALL_ROW_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error || `appendDemoCallRow failed (${res.status})`)
  }
  return await res.json()
}
```

#### Step 2.2 — Update `lib/copilot/session-storage.ts`

- Extend `SessionState` with optional `qualificationProspectKey?: string`.
- Bump the storage key to `copilot:session:v3` (shape changed). Old v2 sessions silently ignored on mount.

```ts
const KEY = "copilot:session:v3"

export interface SessionState {
  raw: Record<string, string>
  cleaned: Record<string, string>
  cleaning: Record<string, boolean>
  qualificationProspectKey?: string
}
```

The rest of the file unchanged.

#### Step 2.3 — Update `app/copilot/page.tsx`

In `handleLoadQualification`, set `qualificationProspectKey` into `fresh` after building it:

```ts
const fresh = makeEmptyState(DEMO_CALL_VARIABLES)
fresh.qualificationProspectKey =
  typeof q.prospectKey === "string" ? q.prospectKey : undefined
```

#### Step 2.4 — Update `app/copilot/variables-table.tsx`

- `handleSave` now calls the new wrapper with `{ raw, cleaned, qualificationProspectKey }`.
- Button label `"Save to funnel sheet"` → `"Save call"`.
- Success toast wording: `"Saved (doc ${docId})."`

```ts
const handleSave = async () => {
  if (!state.cleaned.prospect_name && !state.qualificationProspectKey) {
    toast.error("Missing prospect_name", {
      description: "Cannot save without it.",
    })
    return
  }
  try {
    const { docId } = await appendDemoCallRow({
      raw: state.raw,
      cleaned: state.cleaned,
      qualificationProspectKey: state.qualificationProspectKey,
    })
    toast.success(`Saved (doc ${docId}).`)
    clearSessionState()
    window.location.href = "/copilot"
  } catch (err) {
    toast.error("Save failed", {
      description: err instanceof Error ? err.message : "Unknown error.",
    })
  }
}
```

And the button:

```tsx
<Button onClick={handleSave} className="mt-4">
  Save call
</Button>
```

---

### Phase 3 — Verify end-to-end

In the preview:
1. Reload `/copilot` (the v2 session in localStorage gets ignored; URL gate appears OR the stub session if we re-seed).
2. Load David's qualification → confirm `state.qualificationProspectKey` becomes populated (visible via `JSON.parse(localStorage.getItem('copilot:session:v3'))`).
3. Fill a couple of live-captured fields.
4. Click "Save call".
5. Confirm toast shows `Saved (doc <prospectKey>-<timestamp>).`
6. Check Firestore `demoCalls` collection — the doc exists with `raw`, `cleaned`, `prospectKey == qualification's prospectKey`, `repName`, `outcome`, `createdAt`.

---

## Testing phase

### Local test
- Phase 1 Step 3 curl above.
- Phase 3 end-to-end in preview.

### Integration test
Same as Phase 3 — single end-to-end against the live Firebase project.

### Update README
None.

---

## After implementation

### Update `samwise-app/context-for-code-agent.md`
No structural change. Skip.

### Update `samwise-session-copilot` skill
Append a small note under section 0 / 1 noting:
- `appendDemoCallRow` now writes to Firestore `demoCalls` collection, not the funnel sheet.
- Doc shape: `{ raw, cleaned, prospectKey, repName, outcome, createdAt }`.
- `qualificationProspectKey` preserved through SessionState (v3) for cross-collection linkage.
- Sheet-side code (`DEMO_CALL_COLUMNS`, `getSheetsClient`) is now dormant — left for future "export to sheet" path if needed.

### Mark task DONE
User marks **"Improve the copilot"** DONE in the master Vibe doc Projects tab once this lands.
