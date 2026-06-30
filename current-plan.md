# current-plan.md — Goal 1: Agent + editor in same view (v1 design)

> **Overwrites the previous plan** (the inverted onboarding — SHIPPED 2026-06-30).
> **Status: DESIGN. No code on disk yet.** Awaiting agreed go-ahead on the per-phase plan before implementation.
> **Touches three repos:** `samwise-app` (agent UI surface + DataChannel apply + tab-switch handoff), `samwise-backend/ritual-agent` (adapt 4 existing flows minimally — NO prompt changes), `samwise-backend/cloud-functions` (new `getRitualDocTab` reader).
> **Skills loaded for this evaluation:** `samwise-vibe-procedure`, `samwise-landing-page`, `samwise-script-work`, `ritual-synthesis-prompt`, `samwise-app-trip`, `samwise-app-livekit-integration`, `samwise-livekit-agents`, `tiptap`.

## Locked decisions

1. **Surface:** agent lives in the sidebar nav's footer slot (next to / replacing the Immerse toggle, TBD). On-demand only — user activates via spacebar (PTT) or a "Talk to your guide" button.
2. **Auto-dispatch ONCE** on first onboarding arrival to the Beginning tab. Agent speaks first (mirrors qualification's `onEnter → generateReply()` pattern). After that greeting, mic is PTT-only.
3. **Bundled v1:** ALL 4 agents integrated for ALL 5 agent-applicable tabs (Beginning · Ritual Call · Ritual · Possible origins · Behavioural picture). Metadata stays agent-less.
4. **Agent stays alive across tab switches**, with a verbal handoff: when the user moves to a different tab while an agent is active, the current agent says "I'm handing you over to my colleague who specializes in [next tab]" and the session transfers to the right flow.
5. **NO prompt changes in v1.** Worker-side tools, dispatch metadata, and DataChannel broadcasts adapt; agent prompts stay verbatim. A separate **prompt-changes-tracking list** (bottom of this file) captures what each flow's prompt will eventually need to know about the new architecture.
6. **`/ritual-creation` stays alive** as operator backup. Don't touch it.
7. **Onboarding-mode qualification writes go to `ritualDocs/{}` ONLY** — the legacy `qualifications/{}` Firestore write is SKIPPED when `ritual_doc_id` is in dispatch metadata. `/for-experts` copilot will need a separate update to look in `ritualDocs/` (out of scope for Goal 1).
8. **Operational visibility into seal status** — Samuel needs to know who sealed vs who's hanging. Already firing today: `notifySamuelOfOnboardingStart` on /start (workspace creation). NEW for v1: `notifySamuelOfSeal` fires when `registerRitualFromTiptap` succeeds. Samuel gets paired "started" + "sealed" emails per user; gap between them = a user who's hanging. (A proper admin dashboard listing all unsealed ritualDocs is a deferred follow-up.)
9. **Wall-clock hard cap (25 min)** + 10-min idle on every dispatched session, per `samwise-livekit-agents` rule.

## Per-tab agent mapping

| Tab | Agent flow | Read/Write | DataChannel events the client routes |
|---|---|---|---|
| **Beginning** | `flows/qualification/` | WRITE | `qualification:variable_update` → editor writes the captured variable's value under the right H2 (`behaviour_to_change` → "Behaviour I'd like to change", `core_motivation` → "Core motivation") |
| **Metadata** | *(none)* | — | — |
| **Ritual Call** | `flows/ritual-call-design/` | READ + guide | *(none — flow is read-only today)* |
| **Ritual** | `flows/ritual-design/` | READ + guide | *(none — flow is read-only today)* |
| **Lapse Map** | *(none in v1)* | — | — |
| **Possible origins** | `flows/behavioural-design/` | WRITE | `ritual-doc:tiptap_update { tab: 'Possible origins', mode: 'append', heading?, text }` |
| **Behavioural picture** | `flows/behavioural-design/` | WRITE | `ritual-doc:tiptap_update { tab: 'Behavioural picture', mode: 'replace', text }` |

## The cross-tab handoff mechanism

The hardest new piece. Spec:

### Trigger
The user moves to a different agent-applicable tab while an agent is connected. Movement happens via:
- Click in the sidebar nav
- Click on the "When you're ready..." bottom next-cue
- (No external triggers — keyboard nav, browser back/forward, etc. are out of scope for v1)

### Sequence
1. Client detects tab change while `agentState === 'active'`.
2. Client publishes `ritual-doc:handoff_request { to_tab: 'Ritual Call', to_flow: 'ritual-call-design' }` over DataChannel.
3. Current agent's worker receives the event (via a shared `attachHandoffListener` helper added to each flow's `index.ts`).
4. Worker calls `session.generateReply({ instructions: "Wrap up your current sentence warmly, then tell the user you're handing them over to your colleague who specializes in [to_tab name in user's language]. Keep it brief and warm. Do NOT call any tools." })`. This produces ONE spoken turn.
5. Worker waits for that reply to finish (`SpeechHandle.waitForPlayout()`), then `ctx.shutdown('handoff')`.
6. Client sees `RoomEvent.Disconnected` with reason 'handoff'; routes through the standard disconnect path WITHOUT showing an error.
7. Client immediately dispatches the new flow for the new tab via `/api/ritual-doc/[id]/init-agent`.
8. New session connects; new agent's `onEnter → generateReply()` fires its opener (qualification, ritual-call-design, ritual-design all already do this; behavioural-design's onEnter needs verification).
9. Client mounts the new room. UX is continuous; user perceives a handoff between two voices.

### Failure modes
- **Network drop during handoff:** the next dispatch fails. Client surfaces an inline error ("Couldn't reach the next guide — tap mic to retry"). Same recovery path as the existing race-trap.
- **Handoff while agent is mid-tool-call** (writing to the editor): wait for the current `setVariables` / `writeToTiptapTab` to complete before publishing the handoff event. Worker-side: the handoff listener should check `session.agentState !== 'thinking'` AND `session.agentState !== 'speaking'` before triggering shutdown.
- **Rapid tab switching:** debounce on the client side (300ms) so multiple back-and-forth clicks don't queue multiple handoffs.
- **Handoff to a tab with no agent (Metadata, Lapse Map):** end the current agent with the same farewell ("I'll step back; reach for me when you're ready to talk again"), DON'T dispatch a new one. User stays in the editor agent-less until they switch back to an agent-applicable tab or click "Talk to your guide."

### Shared helper (new file in ritual-agent)
`src/services/handoff.ts` — exports `attachHandoffListener(ctx, session, opts)`. Mirrors the shape of `attachIdleShutdown` from `flows/ritual-call-design/idleHandler.ts`. Each flow's `runXFlow(ctx, meta)` calls this after `session.start()`.

## What each existing agent flow needs to change

**Principle: NO prompt changes in v1.** Only tool implementations, dispatch metadata parsing, and added handoff listener.

### 1. `flows/qualification/` (Beginning tab)

- **Worker change A — dispatch metadata:** parser accepts new optional `ritual_doc_id: string` field. Backwards-compat: existing /qualify dispatches don't set this, behaviour unchanged.
- **Worker change B — extractQualification gate:** in `index.ts`'s `submitIfNotYet(reason)`, SKIP the `extractQualification` POST when `meta.ritual_doc_id` is set. The DataChannel `qualification:variable_update` events still fire (that's what the editor consumes); only the legacy Firestore write is skipped.
- **Worker change C — handoff listener:** attach `attachHandoffListener(ctx, session, { onHandoff: handleHandoff })` after `session.start()`.
- **Prompt: NO change.** Nova's opener already greets first; existing `<continuous-evaluation>`, `<audio-quality>`, `<hard-rules>` stay verbatim.
- **DataChannel:** existing `qualification:variable_update` event re-used. Client maps the variable name → editor H2 via a lookup table.

### 2. `flows/ritual-call-design/` (Ritual Call tab)

- **Worker change A — dispatch metadata:** parser accepts `ritual_doc_id: string`. When set, `google_doc_id` becomes optional.
- **Worker change B — readGoogleDoc tool fork:** the tool's `execute` checks for `meta.ritual_doc_id`. If set, calls a new cloud function `getRitualDocTab(ritualDocId, 'Ritual Call')` and returns its Markdown. If unset, calls existing `readRitualDocTabsAsText` against Drive (legacy path unchanged).
- **Worker change C — handoff listener:** as above.
- **Prompt: NO change.** Agent still calls `readGoogleDoc` as today; the tool's impl does the right thing based on metadata.
- **DataChannel:** none in v1 (flow is read-only; user types into the Tiptap editor, agent reads via the tool).

### 3. `flows/ritual-design/` (Ritual tab)

- Same shape as ritual-call-design. Same tool fork. Same handoff listener. Same `getRitualDocTab` CF (different tab name: `'Ritual'`).
- **Prompt: NO change.**

### 4. `flows/behavioural-design/` (Possible origins + Behavioural picture tabs)

- **Worker change A — dispatch metadata:** accept `ritual_doc_id`.
- **Worker change B — readGoogleDoc tool fork:** same as above. Two tab names in scope here (`'Possible origins'` and `'Behavioural picture'`).
- **Worker change C — writeToDocTab tool fork:** the existing tool's `execute` checks for `meta.ritual_doc_id`. If set, publishes `ritual-doc:tiptap_update { tab, mode, heading?, text }` over DataChannel (instead of calling the Drive `documents.batchUpdate`). The agent prompt's `writeToDocTab` instructions stay verbatim — the agent doesn't know whether the tool wrote to a Doc or broadcast a delta.
- **Worker change D — handoff listener.**
- **Prompt: NO change.** The `ONE BEAT RULE` and `EDIT FAILURE RECOVERY` text in the tool description stays verbatim — they apply identically to the Tiptap target.

## Notification additions

### `notifySamuelOfSeal({ ritualDocId, sealedRitualId, name? })`

- **Location:** `samwise-app/lib/notify/samuel.ts` — new method alongside `notifySamuelOfOnboardingStart` / `notifySamuelOfBooking`.
- **Trigger:** called from `registerRitualFromTiptap` cloud function AFTER successful seal (rituals/{id} written + users/{token} upserted + ritualDocs/{id} marked sealed). Best-effort — `console.warn` on failure, never block the seal response.
- **Body:** subject "X sealed their ritual." Includes editor URL + the sealed `rituals/{id}` doc reference for quick lookup. Same Fraunces/Manrope inline-styled HTML shell as the existing notifiers.
- **Cross-repo call:** the CF lives in samwise-backend; the notify helper lives in samwise-app. Either:
  - (a) Cross-origin POST from CF to a new samwise-app route `/api/notify/seal` (mirrors how landing notifies samwise-app today). Network round trip but clean separation.
  - (b) Reproduce `notifySamuelOfSeal` in the CF directly (write `mail/{}` doc via firebase-admin in the CF). No round trip; tiny duplication of email-shell HTML.
- **Recommendation:** (b). The CF already writes Firestore (`rituals/{}`, `users/{}`), so adding one more `mail/{}` write costs nothing. No extra network hop, no env-var coordination.
- **Operator-visible audit trail:** paired with `notifySamuelOfOnboardingStart` (fires on /start), Samuel gets a per-user create→seal pair. A user with a "started" email but no "sealed" email after N days is the "hanging" set. Manual until a dashboard is built; sufficient signal for v1.

## Cloud function needed

### `getRitualDocTab(ritualDocId, tab)`

- **Location:** `samwise-backend/cloud-functions/functions/src/getRitualDocTab.ts`. Export from `index.ts`.
- **Body:** Reuse `serializeTiptapToMarkdown` + the existing Firestore read (`db.collection('ritualDocs').doc(ritualDocId).get()`). Return the Markdown text of the requested tab. Returns 404 if doc not found, 400 if tab name invalid.
- **Auth:** CORS-open, same shape as existing functions. No auth in v1 — the agent worker calls it with the dispatched `ritual_doc_id`.
- **Env:** No new env vars; uses the same `FIREBASE_SERVICE_ACCOUNT`.
- **~30 lines.**

## samwise-app frontend changes

### New files
```
samwise-app/
├── app/ritual-doc/[id]/
│   ├── RitualDocAgent.tsx                            # NEW: sidebar-footer mic + state + Talk-to-guide button
│   ├── useRitualDocAgent.ts                          # NEW: LiveKit Room hook (state machine, PTT, audio sink, race-trap, handoff)
│   ├── useTiptapDeltaRouter.ts                       # NEW: subscribes to active editor instances per-tab, applies incoming DataChannel deltas
│   └── tiptap-delta-apply.ts                         # NEW: pure functions — writeUnderH2(editor, h2, text), appendUnderH2, replaceUnderH2
├── app/api/ritual-doc/[id]/
│   └── init-agent/route.ts                           # NEW: mint LiveKit token + dispatch agent per tab. Body: { tab: TabKey }
```

### Modified files
- `app/ritual-doc/[id]/RitualDocEditor.tsx` — wire `<RitualDocAgent>` into the sidebar's `footerSlot` (alongside or in place of the ImmerseToggle — TBD which). Pass a `getEditorForTab(tab)` callback so the delta-router can target the right tiptap instance.
- `components/sidebar-nav.tsx` — might need a second slot (e.g. `agentSlot` alongside `footerSlot`) so the Immerse toggle and the agent affordance coexist.

### State machine of the active agent session

```ts
type AgentPhase =
  | 'idle'              // no session
  | 'identifying'       // POST /api/ritual-doc/[id]/init-agent in flight
  | 'connecting'        // LiveKit room connecting
  | 'active'            // agent joined; PTT available
  | 'handing-off'       // tab changed; waiting for agent's farewell + shutdown
  | 'disconnected'      // session ended (any reason)
  | 'error';

interface AgentSessionMeta {
  tab: TabKey;          // which tab this session is for
  flow: AgentFlow;      // which flow was dispatched
  startedAt: number;
}
```

On tab change while `phase === 'active'`:
1. Publish `ritual-doc:handoff_request` over DataChannel
2. Set `phase = 'handing-off'`
3. Wait for `RoomEvent.Disconnected` (with reason 'handoff')
4. If the new tab has an agent flow → immediately call `init-agent` with the new tab → connect to new room → back to `phase = 'active'`
5. If the new tab is agent-less (Metadata / Lapse Map) → stay disconnected, render the "Talk to your guide" button greyed out with tooltip "No guide for this step"

### DataChannel router

`useTiptapDeltaRouter.ts` subscribes to `RoomEvent.DataReceived`:
- `qualification:variable_update { name, value }` → look up `BEGINNING_H2_FOR_VARIABLE[name]` → call `writeUnderH2(beginningEditor, h2, value)`
- `ritual-doc:tiptap_update { tab, mode, heading?, text }` → look up `editorForTab(tab)` → call the appropriate apply helper based on mode (append / replace / edit by heading)
- Anything else: ignore (existing /qualify events on legacy surfaces won't be received here)

### Auto-dispatch on first onboarding arrival

In `RitualDocEditor.tsx` mount effect:
- If `mode === 'onboarding'` AND `active === 'beginning'` AND `localStorage['ritual-doc:agent-greeted:<id>']` is unset:
  - Auto-dispatch agent for Beginning
  - Set the localStorage flag (so reload / re-mount doesn't re-dispatch and re-spam the greeting)
- All other agent invocations are user-initiated.

## What samwise-backend/ritual-agent needs

### New file
`src/services/handoff.ts` (~80 lines)
- `attachHandoffListener(ctx, session, { meta, onHandoff })` — subscribes to `RoomEvent.DataReceived`, filters on `ritual-doc:handoff_request`, waits for agent to be idle (not thinking/speaking), calls `session.generateReply({ instructions: ... })`, awaits playout, calls `ctx.shutdown('handoff')`.
- Helper: `handoffInstructions(to_tab: string, language: Language) => string` — returns a one-paragraph instruction for the LLM to deliver a warm handoff. Bilingual.

### Modified files
- `src/types/metadata.ts` — extend each of the 4 flow metadata types with optional `ritual_doc_id?: string`. Parser threads it through.
- `src/main.ts` — bump `BUILD_TAG`.
- `src/flows/qualification/index.ts` — gate `submitIfNotYet`'s `extractQualification` POST on `!meta.ritual_doc_id`; attach handoff listener.
- `src/flows/ritual-call-design/index.ts` — same metadata fork; attach handoff listener.
- `src/flows/ritual-call-design/tools/readGoogleDoc.ts` — fork on `meta.ritual_doc_id` (call CF or call existing Drive helper).
- `src/flows/ritual-design/index.ts` + `tools/readGoogleDoc.ts` — same pattern.
- `src/flows/behavioural-design/index.ts` — handoff listener; metadata fork.
- `src/flows/behavioural-design/tools/readGoogleDoc.ts` — fork on `meta.ritual_doc_id`.
- `src/flows/behavioural-design/tools/writeToDocTab.ts` — fork: when `meta.ritual_doc_id` set, publish DataChannel event via `room.localParticipant.publishData()` instead of calling `services/drive.ts` helpers.

### What does NOT change
- ZERO prompt files touched. `prompts/*.ts` and `prompts/*.txt` all stay verbatim.
- ZERO Drive helpers touched. Legacy Doc paths preserved.
- ZERO voice provider / Gemini config changes.
- ZERO existing tool descriptions / `describe()` blocks changed (so e.g. the `ONE BEAT RULE` in `writeToDocTab.ts`'s description stays verbatim; that text is identically applicable to a Tiptap broadcast).

## Implementation phases — step-by-step

### Phase P0 — Pre-impl greps

Before any code, verify five things. Each is a quick `grep` / `Read`; the answers shape some of the steps below.

- **P0.1** — Confirm `samwise-backend/ritual-agent/src/types/metadata.ts` parser shape. Goal: know exactly which discriminated-union case to extend with `ritual_doc_id?: string` per flow.
- **P0.2** — Confirm the existing DataChannel `publishData` call site in `samwise-backend/ritual-agent/src/flows/qualification/agent.ts` (the `setVariables` execute handler). Confirms the exact event-publish API we'll mirror for the handoff + writeToTiptapTab fork.
- **P0.3** — Confirm `samwise-backend/ritual-agent/src/flows/behavioural-design/tools/writeToDocTab.ts` shape (Zod schema + execute handler). Confirms what we fork in P3.
- **P0.4** — Confirm `samwise-backend/ritual-agent/src/flows/behavioural-design/agent.ts` has (or doesn't have) an `onEnter` override. If not, add one in P3 (mirrors qualification's pattern so the new agent speaks first on join).
- **P0.5** — Verify Tiptap commands for "find H2 by text → replace its following paragraph's content" — the `tiptap-delta-apply.ts` core operation. The existing `VoicePillToggle.tsx`'s `writeVoiceValue` already does this; we'll generalize that function. Confirm by re-reading the existing impl.

Each is a single grep/read. Total time: <5 min. Recorded as their own task.

---

### Phase P1 — Cloud function + seal notification

#### Step P1.1 — `samwise-backend/cloud-functions/functions/src/getRitualDocTab.ts`

- **In-file location:** new file
- **Should not be modified:** any existing cloud function
- **Code:**
  ```ts
  /**
   * getRitualDocTab (HTTP)
   *
   * Reads one tab of a `ritualDocs/{id}` document and returns its
   * Markdown-serialized text. Called by the ritual-agent worker's
   * read tools (forked when `ritual_doc_id` is in dispatch metadata)
   * so each design-flow agent can read the user's editor content
   * without going through Google Drive.
   *
   * Body: { ritualDocId: string, tab: string }
   *   tab values: 'metadata' | 'ritualCall' | 'ritual' | 'lapseMap'
   *               | 'possibleOrigins' | 'behaviouralPicture' | 'beginning'
   * Returns: { markdown: string } (200) | { error: string } (4xx/5xx)
   */
  import {onRequest} from "firebase-functions/https";
  import * as logger from "firebase-functions/logger";
  import {getFirestore} from "firebase-admin/firestore";
  import cors = require("cors");
  import {
    serializeTiptapToMarkdown,
    type JSONContent,
  } from "./tiptap-to-markdown";

  const corsHandler = cors({origin: true});

  const VALID_TABS = new Set([
    "beginning",
    "metadata",
    "ritualCall",
    "ritual",
    "lapseMap",
    "possibleOrigins",
    "behaviouralPicture",
  ]);

  // Display label per tab — passed to serializeTiptapToMarkdown as the
  // H1 prefix so the agent reads "# Ritual Call\n## Exit from the day\n..."
  // and can re-orient on which tab it's reading.
  const TAB_LABEL: Record<string, string> = {
    beginning: "Beginning",
    metadata: "Metadata",
    ritualCall: "Ritual Call",
    ritual: "Ritual",
    lapseMap: "Lapse Map",
    possibleOrigins: "Possible origins",
    behaviouralPicture: "Behavioural picture",
  };

  export const getRitualDocTab = onRequest((req, res) => {
    corsHandler(req, res, async () => {
      if (req.method !== "POST") {
        res.status(405).send({error: "Method not allowed"});
        return;
      }
      const {ritualDocId, tab} = (req.body ?? {}) as {
        ritualDocId?: string;
        tab?: string;
      };
      if (!ritualDocId) {
        res.status(400).send({error: "Missing ritualDocId"});
        return;
      }
      if (!tab || !VALID_TABS.has(tab)) {
        res.status(400).send({error: `Invalid tab: ${tab}`});
        return;
      }
      try {
        const db = getFirestore();
        const snap = await db.collection("ritualDocs").doc(ritualDocId).get();
        if (!snap.exists) {
          res.status(404).send({error: "ritualDoc not found"});
          return;
        }
        const data = snap.data() ?? {};
        const tabs = (data.tabs ?? {}) as Record<
          string,
          {tiptap?: JSONContent}
        >;
        const tiptap = tabs[tab]?.tiptap;
        const markdown = serializeTiptapToMarkdown(tiptap, TAB_LABEL[tab]);
        res.status(200).send({markdown});
      } catch (error) {
        logger.error("getRitualDocTab failed:", error);
        res.status(500).send({error: "Internal Server Error."});
      }
    });
  });
  ```
- **Explanation:** mirrors the shape of the existing `registerRitualFromTiptap` CF in the same directory. Reuses the existing `serializeTiptapToMarkdown` and `JSONContent` exports from `tiptap-to-markdown.ts`. Strict regex on tab name (no synthesis-prompt invocation needed — pure read).

#### Step P1.2 — register `getRitualDocTab` in `index.ts`

- **In-file location:** `samwise-backend/cloud-functions/functions/src/index.ts`
- **Should not be modified:** any existing export
- **Code (append next to existing `export {registerRitualFromTiptap}` line):**
  ```ts
  // Tab-scoped reader for ritualDocs/{id}. Called by ritual-agent's
  // design flows when their readGoogleDoc tool detects a ritual_doc_id
  // in dispatch metadata.
  export {getRitualDocTab} from "./getRitualDocTab";
  ```

#### Step P1.3 — `registerRitualFromTiptap.ts` — fire `notifySamuelOfSeal`

- **In-file location:** `samwise-backend/cloud-functions/functions/src/registerRitualFromTiptap.ts`
- **Should not be modified:** the existing seal logic — only add the notification AFTER the successful response is built.
- **Action:** add a best-effort `mail/` write to the `ritualDocs` collection AFTER the docRef.update() call but BEFORE `res.status(200).send(...)`. Code:
  ```ts
  // Best-effort seal notification — Samuel pairs this with the
  // earlier notifySamuelOfOnboardingStart (fired on /start) to spot
  // hanging users (started email but no sealed email after N days).
  try {
    const editorUrl = `https://app.samwise.life/ritual-doc/${ritualDocId}`;
    const subject = `${name} sealed their ritual.`;
    const text =
      `${name} just sealed their ritual.\n\n` +
      `Editor: ${editorUrl}\n` +
      `Sealed ritual id: ${ritualRef.id}\n` +
      `Workspace token: ${userID}\n` +
      `First call: ${firstCallAt ?? "(scheduled)"}\n`;
    const html = `<!doctype html><html><body style="margin:0;padding:0;` +
      `background:#FFFFFF;color:#000000;font-family:Georgia,serif;">` +
      `<table cellspacing="0" cellpadding="0" border="0" width="100%">` +
      `<tr><td align="center" style="padding:56px 24px;"><table cellspacing="0" cellpadding="0" border="0" width="560" style="max-width:560px;width:100%;">` +
      `<tr><td style="padding:0 0 40px 0;"><span style="font-family:Georgia,serif;font-style:italic;font-size:22px;">Samwise</span>` +
      `<span style="color:#D4A85A;font-size:9px;vertical-align:12px;padding-left:3px;">&#x2726;</span></td></tr>` +
      `<tr><td style="font-style:italic;font-size:20px;line-height:1.45;padding:0 0 28px 0;">${escapeHtml(name)} sealed their ritual.</td></tr>` +
      `<tr><td style="font-family:'Helvetica Neue',Arial,sans-serif;font-size:11px;letter-spacing:0.22em;text-transform:uppercase;color:#555;padding:0 0 6px 0;">Editor</td></tr>` +
      `<tr><td style="font-size:14px;padding:0 0 20px 0;"><a href="${editorUrl}" style="color:#000;">${editorUrl}</a></td></tr>` +
      `<tr><td style="font-family:'Helvetica Neue',Arial,sans-serif;font-size:11px;letter-spacing:0.22em;text-transform:uppercase;color:#555;padding:0 0 6px 0;">First call</td></tr>` +
      `<tr><td style="font-size:14px;padding:0 0 20px 0;">${firstCallAt ?? "(scheduled)"}</td></tr>` +
      `</table></td></tr></table></body></html>`;
    await db.collection("mail").add({
      to: "samuelgiraldoconcha@gmail.com",
      message: {subject, text, html},
    });
  } catch (err) {
    logger.warn("notifySamuelOfSeal failed (non-blocking):", err);
  }
  ```
  Plus a small helper at module scope:
  ```ts
  function escapeHtml(s: string): string {
    return s
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }
  ```
- **Explanation:** mirrors the email-shell HTML structure from `samwise-app/lib/notify/samuel.ts`. Hardcoded recipient (Samuel). `try/catch` ensures a failed mail write doesn't break the seal response.

---

### Phase P2 — Worker: metadata + handoff helper

#### Step P2.1 — extend `src/types/metadata.ts`

- **In-file location:** `samwise-backend/ritual-agent/src/types/metadata.ts`
- **Should not be modified:** the discriminated-union shape; the parser's defaulting logic
- **Action:** add `ritual_doc_id?: string` to each of: `QualificationMeta`, `RitualCallDesignMeta`, `RitualDesignMeta`, `BehaviouralDesignMeta`. Parser threads it through with empty-string default per existing convention. Confirm exact field names at P0.1.

#### Step P2.2 — `src/services/handoff.ts`

- **In-file location:** new file at `samwise-backend/ritual-agent/src/services/handoff.ts`
- **Code:**
  ```ts
  /**
   * Cross-tab handoff helper — attaches a DataChannel listener that
   * triggers a verbal handoff + ctx.shutdown when the client publishes
   * `ritual-doc:handoff_request { to_tab, to_flow }`.
   *
   * Each agent flow (qualification, ritual-call-design, ritual-design,
   * behavioural-design) calls attachHandoffListener after session.start()
   * to opt into the cross-tab orchestration on /ritual-doc/[id].
   */
  import {RoomEvent, type Room} from "@livekit/rtc-node";
  import {type voice, type JobContext} from "@livekit/agents";
  import * as logger from "firebase-functions/logger"; // or use console — ritual-agent uses console

  type Lang = "en" | "es";

  // Bilingual instruction template — passed to generateReply so the
  // LLM speaks a warm handoff in the user's language. The agent
  // does NOT call any tools during this turn (instruction is explicit).
  function handoffInstructions(toTabLabel: string, lang: Lang): string {
    if (lang === "es") {
      return (
        `Termina con calidez la frase que estás diciendo. ` +
        `Luego, dile al usuario en una o dos frases breves que vas ` +
        `a pasarlo con tu colega que se especializa en ${toTabLabel}. ` +
        `Habla con calidez. NO llames ninguna herramienta. ` +
        `Después de tu frase, quédate en silencio.`
      );
    }
    return (
      `Warmly wrap up the sentence you are saying. ` +
      `Then, tell the user in one or two short sentences that you are ` +
      `handing them over to your colleague who specializes in ${toTabLabel}. ` +
      `Speak warmly. Do NOT call any tools. ` +
      `After your sentence, stay silent.`
    );
  }

  // Display labels matching the editor's TAB_LABELS — passed to the
  // handoff prompt so the agent can name the next tab in spoken text.
  const TAB_LABEL: Record<string, {en: string; es: string}> = {
    beginning: {en: "your beginning", es: "tu comienzo"},
    metadata: {en: "your details", es: "tus datos"},
    ritualCall: {en: "your ritual call", es: "tu llamada del ritual"},
    ritual: {en: "your ritual", es: "tu ritual"},
    lapseMap: {en: "your lapse map", es: "tu mapa de recaídas"},
    possibleOrigins: {en: "your possible origins", es: "tus orígenes"},
    behaviouralPicture: {
      en: "your behavioural picture",
      es: "tu imagen conductual",
    },
  };

  export function attachHandoffListener(args: {
    ctx: JobContext;
    session: voice.AgentSession;
    room: Room;
    language: Lang;
  }): void {
    const {ctx, session, room, language} = args;
    let handoffInFlight = false;

    room.on(RoomEvent.DataReceived, (payload, _participant) => {
      if (handoffInFlight) return;
      let parsed: {type?: string; to_tab?: string; to_flow?: string};
      try {
        parsed = JSON.parse(new TextDecoder().decode(payload));
      } catch {
        return;
      }
      if (parsed.type !== "ritual-doc:handoff_request" || !parsed.to_tab) {
        return;
      }
      handoffInFlight = true;

      const toLabel =
        TAB_LABEL[parsed.to_tab]?.[language] ?? "the next step";
      const instructions = handoffInstructions(toLabel, language);

      // Wait for the agent to be idle (not thinking/speaking) before
      // triggering the farewell — prevents cutting off a mid-tool
      // call or mid-sentence reply.
      const waitForIdle = async (): Promise<void> => {
        const maxWaitMs = 5000;
        const start = Date.now();
        while (Date.now() - start < maxWaitMs) {
          const state = session.agentState;
          if (state !== "thinking" && state !== "speaking") return;
          await new Promise((r) => setTimeout(r, 100));
        }
      };

      void (async () => {
        try {
          await waitForIdle();
          const handle = session.generateReply({instructions});
          // Wait for the farewell to actually finish playing before
          // shutting down. 300ms buffer so Cartesia's tail doesn't
          // clip.
          try {
            // SpeechHandle in @livekit/agents — exposes waitForPlayout
            // in 1.2+. If it doesn't, fall back to a 5s timeout.
            await (handle as unknown as {
              waitForPlayout: () => Promise<void>;
            }).waitForPlayout?.();
          } catch {/* tolerate */}
          await new Promise((r) => setTimeout(r, 300));
          ctx.shutdown("handoff");
        } catch (err) {
          console.error("[handoff] failed:", err);
          ctx.shutdown("handoff_error");
        }
      })();
    });
  }
  ```
- **Explanation:** ~80 lines. Subscribes to `RoomEvent.DataReceived`, filters on `ritual-doc:handoff_request`, waits for agent idle, fires a `generateReply` with instructions, awaits playout, shuts down. `handoffInFlight` flag prevents double-trigger. Bilingual instruction template + tab-label map keep the farewell language-correct.
- **Open API verification:** `voice.AgentSession.agentState`, `SpeechHandle.waitForPlayout()`, `ctx.shutdown(reason)` — confirm exact APIs at implementation time against the installed `@livekit/agents` version (1.2.0 on ritual-agent).

#### Step P2.3 — bump BUILD_TAG in `src/main.ts`

- **Action:** `BUILD_TAG = '2026-06-30-ritual-doc-agent-v1'`. Per `samwise-livekit-agents` skill, bump on every deploy.

---

### Phase P3 — Worker: per-flow forks

Each flow gets the same 3-change pattern: (1) metadata fork, (2) tool impl fork on `ritual_doc_id`, (3) `attachHandoffListener` call.

#### Step P3.1 — `flows/qualification/index.ts`

- **In-file location:** `samwise-backend/ritual-agent/src/flows/qualification/index.ts`
- **Should not be modified:** the agent prompt; the `setVariables` tool definition; the `submitIfNotYet` function body except the gate; the existing idle/hard-cap logic.
- **Action 1:** in `submitIfNotYet(reason)`, gate the `extractQualification` POST on `!meta.ritual_doc_id`. When `ritual_doc_id` is set, skip the POST entirely (the `qualification:variable_update` DataChannel events still fire via the existing `setVariables` execute — that's what the editor consumes).
- **Action 2:** after `session.start()`, attach the handoff listener:
  ```ts
  attachHandoffListener({ctx, session, room: ctx.room, language: meta.language});
  ```

#### Step P3.2 — `flows/ritual-call-design/index.ts`

- **In-file location:** `samwise-backend/ritual-agent/src/flows/ritual-call-design/index.ts`
- **Should not be modified:** prompt, agent class, idle/hard-cap
- **Action:** attach handoff listener after `session.start()`.

#### Step P3.3 — `flows/ritual-call-design/tools/readGoogleDoc.ts`

- **In-file location:** the existing readGoogleDoc tool file (verify exact name at P0)
- **Should not be modified:** Zod schema; tool `describe`; the existing Drive-path code
- **Action:** in the execute handler, fork on `meta.ritual_doc_id`:
  ```ts
  if (meta.ritual_doc_id) {
    const res = await fetch(GET_RITUAL_DOC_TAB_URL, {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({
        ritualDocId: meta.ritual_doc_id,
        tab: 'ritualCall',  // hardcoded per flow
      }),
    });
    if (!res.ok) throw new Error(`getRitualDocTab failed (${res.status})`);
    const {markdown} = await res.json();
    return markdown;
  }
  // existing Drive path
  return await readRitualDocTabsAsText(meta.google_doc_id);
  ```
  Add `GET_RITUAL_DOC_TAB_URL = process.env.GET_RITUAL_DOC_TAB_URL ?? '...'` at module scope. New env var on the agent's deployed secrets.

#### Step P3.4 — `flows/ritual-design/index.ts` + `tools/readGoogleDoc.ts`

Same pattern as P3.2 + P3.3. Hardcoded tab name: `'ritual'`.

#### Step P3.5 — `flows/behavioural-design/index.ts` + `tools/readGoogleDoc.ts`

Same as ritual-design. For the read tool, behavioural-design reads TWO tabs (Possible origins + Behavioural picture); the tool's argument shape already lets the agent pick which one. The fork translates to two possible CF calls (one per tab argument).

#### Step P3.6 — `flows/behavioural-design/tools/writeToDocTab.ts`

- **In-file location:** the existing writeToDocTab tool
- **Should not be modified:** Zod schema; tool `describe` (including the ONE BEAT RULE paragraph); the existing Drive-helper-call code path
- **Action:** in the execute handler, fork on `meta.ritual_doc_id`. When set:
  ```ts
  // Map UI-friendly tab labels (the agent uses) to schema TabKeys.
  const TAB_KEY_MAP: Record<string, string> = {
    'Possible origins': 'possibleOrigins',
    'Behavioural picture': 'behaviouralPicture',
  };
  const tabKey = TAB_KEY_MAP[args.tab];
  if (!tabKey) return `error: unknown tab "${args.tab}"`;

  const payload = {
    type: 'ritual-doc:tiptap_update',
    tab: tabKey,
    mode: args.mode,         // 'append' | 'replace' | 'edit'
    heading: args.heading,   // optional; required for 'edit'
    text: args.text,
  };
  await ctx.room.localParticipant.publishData(
    new TextEncoder().encode(JSON.stringify(payload)),
    {reliable: true},
  );
  return 'ok';
  ```
  Existing Drive-path code stays as fallback when `meta.ritual_doc_id` is unset.
- **Explanation:** the agent's prompt still says "call writeToDocTab" — it never knows whether the call wrote to a Doc or broadcast a delta. The ONE BEAT RULE in the tool's description applies identically to either target.

#### Step P3.7 — `flows/behavioural-design/agent.ts` — confirm/add `onEnter`

- **Action:** Per P0.4 grep — if no `onEnter` override exists, add one that mirrors qualification's pattern:
  ```ts
  override async onEnter(): Promise<void> {
    this.session.generateReply();
  }
  ```
  So the agent speaks first on join (instead of waiting for the user).

---

### Phase P4 — App: agent UI + LiveKit hook

#### Step P4.1 — `app/api/ritual-doc/[id]/init-agent/route.ts`

- **In-file location:** new file
- **Code:**
  ```ts
  /**
   * Mints a LiveKit token for the user + dispatches the appropriate
   * agent flow per the requested tab. Called by the client whenever
   * the user invokes the agent (manual click) or a tab change
   * triggers a re-dispatch after a handoff.
   *
   * Body: { tab: TabKey, language?: 'en' | 'es' }
   * Returns: { token, wsUrl, roomName, flow }
   */
  import {NextResponse} from 'next/server';
  import {z} from 'zod';
  import {
    createAgentDispatch,
    getLiveKitWsUrl,
    mintRoomAccessToken,
  } from '@/lib/livekit-dispatch';
  import {getDb} from '@/lib/firebase-admin';

  export const runtime = 'nodejs';

  // Mapping per locked design: which agent flow serves each tab.
  const FLOW_FOR_TAB: Record<string, string> = {
    beginning: 'qualification',
    ritualCall: 'ritual-call-design',
    ritual: 'ritual-design',
    possibleOrigins: 'behavioural-design',
    behaviouralPicture: 'behavioural-design',
    // metadata + lapseMap intentionally absent — no agent
  };

  const Body = z.object({
    tab: z.enum([
      'beginning', 'ritualCall', 'ritual',
      'possibleOrigins', 'behaviouralPicture',
    ]),
    language: z.enum(['en', 'es']).optional(),
  });

  export async function POST(
    req: Request,
    {params}: {params: Promise<{id: string}>},
  ) {
    const {id} = await params;
    let body: unknown;
    try {body = await req.json();} catch {
      return NextResponse.json({error: 'Invalid JSON'}, {status: 400});
    }
    const parsed = Body.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({error: 'Invalid body'}, {status: 400});
    }
    const flow = FLOW_FOR_TAB[parsed.data.tab];
    if (!flow) {
      return NextResponse.json(
        {error: `No agent for tab: ${parsed.data.tab}`},
        {status: 400},
      );
    }

    // Look up the ritualDoc to get its workspaceToken (= userID) and
    // language. The token doubles as identity (no auth in v1).
    const snap = await getDb().collection('ritualDocs').doc(id).get();
    if (!snap.exists) {
      return NextResponse.json({error: 'ritualDoc not found'}, {status: 404});
    }
    const data = snap.data() ?? {};
    const userID: string = data.workspaceToken ?? `anon-${Date.now()}`;
    const language: 'en' | 'es' =
      parsed.data.language ?? (data.language === 'es' ? 'es' : 'en');

    const roomName = `ritual-doc-${id}-${parsed.data.tab}-${Date.now()}`;

    await createAgentDispatch({
      agentName: 'ritual-agent',
      roomName,
      metadata: {
        flow,
        ritual_doc_id: id,
        language,
        // Per-flow flow-specific fields. All four flows accept the
        // ritual_doc_id discriminator + language; flow-specific fields
        // stay empty/defaulted for now since the prompt doesn't change.
        prospect_name: '',
        prospect_email: '',
      },
    });

    const token = await mintRoomAccessToken({
      identity: userID,
      roomName,
    });

    return NextResponse.json({
      token,
      wsUrl: getLiveKitWsUrl(),
      roomName,
      flow,
    });
  }
  ```
- **Explanation:** mirrors `/api/ritual-call/init` structure verbatim (parse → resolve → dispatch → mint → return). `FLOW_FOR_TAB` is the per-tab agent mapping from the locked design. Room name encodes the tab so log-grepping shows which tab a session was for. `prospect_name` / `prospect_email` left empty since we don't capture them (matches the user's "no email at /start" decision).

#### Step P4.2 — `app/ritual-doc/[id]/useRitualDocAgent.ts`

- **In-file location:** new file
- **Action:** the central LiveKit Room hook. Exports a hook returning `{ phase, dispatch(tab), end(), pttDown(), pttUp(), publishHandoff(toTab) }`. Internals:
  - `Room` from `livekit-client`
  - State machine: `'idle' | 'identifying' | 'connecting' | 'active' | 'handing-off' | 'disconnected' | 'error'`
  - Audio sink: hidden `<audio autoPlay playsInline>` element via portal or returned ref
  - Race-trap on disconnect (removeAllListeners FIRST)
  - PTT: `setMicrophoneEnabled(true/false)` on hold/release, spacebar mirror with INPUT/TEXTAREA guards
  - DataChannel event subscription (delegate to `useTiptapDeltaRouter`)
  - On `dispatch(tab)`: POST `/api/ritual-doc/[id]/init-agent`, connect, mute mic, listen
  - On `publishHandoff(toTab)`: `room.localParticipant.publishData({ type: 'ritual-doc:handoff_request', to_tab, to_flow })` then expect Disconnected within ~5s; on that, set phase to `handing-off`
- **Size:** ~250 lines. Mirrors `RitualCallExperience.tsx`'s wiring + adds the handoff publish.

#### Step P4.3 — `app/ritual-doc/[id]/RitualDocAgent.tsx`

- **In-file location:** new file
- **Action:** the visible affordance. Lives in the sidebar's `footerSlot`. Shape:
  - When `phase === 'idle'` AND active tab has an agent: render "Talk to your guide" button + small mic icon. Click → `dispatch(activeTab)`.
  - When `phase === 'active'`: render PTT mic button (hold-to-talk) + tiny state dot (idle / listening / speaking / thinking). Status text underneath.
  - When `phase === 'handing-off'`: render "Handing you over…" + spinner.
  - When `phase === 'disconnected' | 'error'`: render "Reconnect to the guide" button + error msg if any.
  - When active tab is `metadata` or `lapseMap`: render greyed-out "No guide for this step" tooltip.
- **Spacebar handler:** at the page level (in `RitualDocEditor`) — fires PTT on hold. Guards: ignore on INPUT/TEXTAREA focus, ignore `e.repeat`.
- **Visual register:** Manrope small caps + gold hairline dashes (same brand language as the Seal CTA). Mic is a subtle pill.

#### Step P4.4 — `app/ritual-doc/[id]/RitualDocEditor.tsx` — wire into sidebar footer

- **In-file location:** existing file
- **Should not be modified:** the existing nav structure; the ImmerseToggle; the editor pane wiring; the tab/subtitle/next-cue setup
- **Action:** the sidebar's `footerSlot` currently holds `<ImmerseToggle ... />`. Replace with a small stack:
  ```tsx
  footerSlot={
    <div className="flex flex-col gap-3">
      <RitualDocAgent
        docId={id}
        activeTab={active}
        agentState={agentState}
        onDispatch={dispatch}
        onEnd={endAgent}
        onPttDown={pttDown}
        onPttUp={pttUp}
      />
      <ImmerseToggle isFullscreen={isFullscreen} onToggle={...} />
    </div>
  }
  ```
- The page-level spacebar handler wraps `pttDown` / `pttUp` from the hook.

---

### Phase P5 — App: DataChannel router + apply

#### Step P5.1 — `app/ritual-doc/[id]/tiptap-delta-apply.ts`

- **In-file location:** new file
- **Action:** pure functions that operate on a Tiptap `Editor` instance:
  - `writeUnderH2(editor, h2Text, content)` — finds the H2 paragraph by text match, replaces the next paragraph's content with `content`. Generalization of `VoicePillToggle.tsx`'s `writeVoiceValue`.
  - `appendUnderH2(editor, h2Text, content)` — appends a new paragraph below the existing content under H2.
  - `replaceTabContent(editor, content)` — replaces the entire editor doc.
  - `editEntryByHeading(editor, heading, content)` — finds H2 matching `heading`, replaces all content until the next H2.
- **Size:** ~100 lines. Defensive: all functions silently no-op if the H2 can't be found (the editor might not have that subsection mounted).

#### Step P5.2 — `app/ritual-doc/[id]/useTiptapDeltaRouter.ts`

- **In-file location:** new file
- **Action:** hook that subscribes to incoming DataChannel events and routes them to the right editor instance:
  ```ts
  // Variable-name → Beginning-tab H2 mapping
  const BEGINNING_H2_FOR_VARIABLE: Record<string, string> = {
    behaviour_to_change: "Behaviour I'd like to change",
    core_motivation: 'Core motivation',
  };

  // Caller registers editor refs per active tab via setEditorForTab.
  // Router uses the latest registered editor for the target tab when
  // applying a delta.
  ```
- Wired in `useRitualDocAgent.ts`'s DataReceived listener:
  - `qualification:variable_update { name, value }` → look up H2 → call `writeUnderH2(beginningEditor, h2, value)`
  - `ritual-doc:tiptap_update { tab, mode, heading?, text }` → look up editor for tab → call the appropriate apply helper
  - All other event names: ignore
- **EditorPane already calls `onEditorReady` per Phase C work earlier.** Add a similar `onEditorReady` plumbing in `RitualDocEditor` that registers each tab's editor instance with the router as it mounts.

---

### Phase P6 — App: handoff orchestration + auto-dispatch

#### Step P6.1 — Tab-change handoff in `RitualDocEditor.tsx`

- **In-file location:** existing file
- **Action:** add a `useEffect` that watches `active` (the active tab):
  ```tsx
  const prevTabRef = useRef(active);
  useEffect(() => {
    if (prevTabRef.current === active) return;
    const prevTab = prevTabRef.current;
    prevTabRef.current = active;
    if (agentState.phase !== 'active') return;
    // Agent is connected and the user just switched tabs.
    if (TABS_WITH_AGENT.has(active)) {
      publishHandoff(active);  // → worker shuts down → onDisconnected → dispatch(active)
    } else {
      publishHandoff(null);    // → worker shuts down → stay disconnected
    }
  }, [active, agentState.phase, publishHandoff]);
  ```
  The hook's internal `onDisconnected` listener checks if the disconnect reason was `'handoff'` and the next tab has an agent — if so, immediately call `dispatch(nextTab)` to start the new session.

#### Step P6.2 — Auto-dispatch on first onboarding arrival

- **In-file location:** `RitualDocEditor.tsx`
- **Action:** on mount, if `mode === 'onboarding'` AND `active === 'beginning'`:
  ```tsx
  useEffect(() => {
    if (mode !== 'onboarding' || active !== 'beginning') return;
    const key = `ritual-doc:agent-greeted:${id}`;
    try {
      if (window.localStorage.getItem(key)) return;
      window.localStorage.setItem(key, '1');
    } catch {/* private mode — degrade to always-auto */}
    dispatch('beginning');
  }, [mode, active, id, dispatch]);
  ```
- **Failure mode:** if the dispatch fails, the localStorage flag is already set → on next mount the agent doesn't auto-dispatch. User can click "Talk to your guide" to retry.

---

### Phase P7 — Local test + context update

#### Local test plan

1. `pnpm dev` in samwise-app + samwise-backend/cloud-functions emulator + ritual-agent in dev mode.
2. Mint a fresh ritualDoc via `/start` → land on `/ritual-doc/[id]?mode=onboarding&from=transition`.
3. Beginning tab: confirm agent auto-dispatches and Nova greets first. PTT spacebar to respond. Confirm `qualification:variable_update` events flow → editor writes under "Behaviour I'd like to change" / "Core motivation" H2s.
4. Click sidebar nav to switch to Ritual Call tab. Confirm:
   - Current agent (qualification) speaks a handoff line
   - Disconnects
   - ritual-call-design agent dispatches and greets
5. Repeat for Ritual tab.
6. Switch to Metadata tab → current agent says farewell, no new dispatch. "No guide for this step" tooltip visible.
7. Switch back to Ritual → ritual-design dispatches fresh.
8. Click Seal → success screen. Check Firebase email inbox: should see "X sealed their ritual." email.
9. (Skip behavioural-design tests in onboarding-mode — those tabs are hidden.)

#### Update context-for-code-agent.md across three repos

- **samwise-app**: new section under Module Structure describing the agent integration on /ritual-doc/[id], the per-tab flow mapping, the handoff mechanism.
- **samwise-backend/ritual-agent**: new section noting the four flows now accept `ritual_doc_id` metadata, with non-destructive forks in their read/write tools.
- **samwise-backend/cloud-functions**: `getRitualDocTab` documented; `registerRitualFromTiptap` notes the seal notification.

---

Total: ~7 phases, mostly small-to-medium. No giant blocks. Honors "I don't want big changes here."

## Prompt-changes-tracking list (deferred to a future round)

Per locked decision #5, agent prompts stay verbatim in v1. But several prompts WILL eventually want to know about the new architecture, for fidelity. Tracked here so they aren't forgotten:

### `flows/qualification/prompts/qualification-prompt.ts`
- **`<environment>` block** mentions "the conversation happens over voice." Still accurate.
- **`<closing>` block** describes the booking-link finalize-hold. In ritual-doc-onboarding mode there's no booking link — the user just continues on to the next tab. Prompt could say "you're not the only voice — when the user moves to a different topic, you'll hand them over to a colleague who specializes in it." Not load-bearing in v1 (the handoff is mechanical, not narrative).
- **`<continuous-evaluation>`** counts user turns and tracks variable state. The cross-tab handoff resets this counter for the next agent — fine, since each agent runs its own continuous-evaluation. No change needed.

### `flows/ritual-call-design/prompts/*.ts`
- The opener instructs the agent to verify the Doc state via `readGoogleDoc`. Still accurate (the tool now reads from Tiptap, but the agent doesn't know). Prompt could be updated to say "Document" instead of "Google Doc" for clarity. Cosmetic.

### `flows/ritual-design/prompts/*.ts`
- Same as ritual-call-design.

### `flows/behavioural-design/prompts/*.ts`
- `writeToDocTab` tool description (the `ONE BEAT RULE` paragraph) refers to "the document." Accurate. No change.
- The agent's persona / role / arc instructions don't reference Google Docs at all. No change.

### Shared
- None of the four prompts mentions Google Docs by brand name in load-bearing ways. Best-case: zero prompt changes ever needed. Worst-case: small wording polish in a follow-up round.

## Risks + open items

1. **Handoff acoustic timing.** Worst case: the agent's farewell sentence finishes just as the new agent's greeting starts, creating audio overlap. Mitigation: handoff helper awaits `SpeechHandle.waitForPlayout()` AND a 300ms buffer before `ctx.shutdown`. Test live.
2. **Editor commit timing on Tiptap deltas.** If a `qualification:variable_update` arrives WHILE the user is typing in the same H2's paragraph, the agent's write may overwrite the user's keystrokes. Mitigation: the `writeUnderH2` helper checks if the paragraph already has user content; if so, append below it rather than replace. Decide per-variable: for `behaviour_to_change`, user-typed content should win (agent doesn't overwrite). For `core_motivation`, same.
3. **`behavioural-design`'s `onEnter` may not exist** — verify the file. If it doesn't override `onEnter`, add it (mirrors qualification's pattern). Smallest possible behaviour: speak the opener on join.
4. **`/for-experts` copilot will stop seeing new prospects** once the Tiptap-only write lands. Out of scope here — log it as a known follow-up.
5. **`/ritual-call` route uses qualification flow with the legacy `extractQualification` POST**. Our metadata-gated skip means that route is unaffected (no `ritual_doc_id` in its dispatch). Verify in P0 greps.
6. **Worker idle/hard-cap on handoff:** the current session's hard-cap timer terminates when the session ends. The NEW session starts fresh with its own 25-min cap. A user who tab-switches 5 times could keep an effective session alive for 5×25 = 125 minutes. Acceptable (each session is its own cost; LiveKit bills per active room minute regardless).

## Recommendation

Lock this design, then I write the step-by-step Phase-by-Phase implementation file (same shape as the inverted-onboarding plan). Honest read: this is a Medium-sized task — ~7 phases, each small-to-medium. Total LoC across 3 repos probably 600–900 lines net add (most of it the agent UI + handoff orchestration on the app side).

Say "go" to lock the design and have me write the step-by-step. Or push back on any decision above.
