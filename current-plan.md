# current-plan.md — User-facing /ritual-call + Update ritual button

> Overwrites the previous plan ("Demo Call: grado-driven desidentificación skip" — shipped, separate task in the master Vibe doc).
> Neurotic-implementer rules in force. Minimal-changes-only mandate from the user: do not touch anything that does not need to change.
> Backend (cloud functions, synthesis prompt, ritual-call agent prompt) is **out of scope** this round, per the user's answers in this session.

## Plan Summary

Make `/ritual-call` work as a self-contained user-facing experience that a user can land on from a link in their inbox, paste their Google Doc link, talk to the onboarding agent (current behaviour), and then click an **"Update ritual"** button that re-runs `registerNewRitual` against the same Doc so the call schedule + ritual data in Firestore are rebuilt from whatever they wrote in the Doc during the conversation.

Three changes in samwise-app:

1. **Persist the pasted Doc link in `localStorage`** so the input is pre-filled on return visits ("if there is a session, pre-load the google docs session"). On a cold visit the input block still shows blank ("if there is no session, offer the input block").
2. **Add an "Update ritual" button** inside the live-call view (`ActiveControls`) next to "End conversation". On click it POSTs the cached `docLink` to the existing `registerNewRitual` cloud function and toasts success/failure. No new endpoint, no backend change.
3. **Lock the route to the call experience only.** Remove the "Back to Samwise" header link from `RitualCallExperience.tsx` so users have no nav into the operator UI. Remove the "Demo Call copilot" sidebar entry from `app/page.tsx` so the operator console no longer advertises it from the main shell (route stays reachable by direct URL).

Nothing else moves. The agent dispatch, LiveKit wiring, audio sink, push-to-talk, mic-mute-on-hidden, state machine, error handling, and `/api/ritual-call/init` route are all untouched.

## Plan Architecture (Flow)

1. User receives a link → opens `app.samwise.life/ritual-call`.
2. `RitualCallExperience` mounts. `useEffect` reads `localStorage["ritual-call:docLink"]` and hydrates the `docLink` state. If present, `PasteLinkForm` shows the link pre-filled; otherwise blank. **NEW.**
3. User submits → existing `start()` runs (POST `/api/ritual-call/init` → dispatch agent → mint token → connect Room). Also writes the link to `localStorage` so it survives a refresh. **NEW: the localStorage write.**
4. User talks to the agent (current behaviour, untouched).
5. User clicks **Update ritual** → fires a new `updateRitual()` callback that POSTs `{ googleDocLink: docLink }` to `https://registernewritual-b6fhjlgejq-uc.a.run.app` (same URL the operator console uses). Toast shows success/failure. The LiveKit room is **not** disconnected — the user can keep talking or click "End conversation" themselves. **NEW.**
6. User clicks "End conversation" → existing behaviour.

## Plan Structure (Directories and files)

```
samwise-app/
├── current-plan.md                              # THIS FILE
├── app/
│   └── page.tsx                                 # MODIFIED: remove Demo Call copilot SidebarMenuItem
└── components/
    └── ritual-call/
        └── RitualCallExperience.tsx             # MODIFIED: localStorage hydrate/save,
                                                 #           Update ritual button,
                                                 #           remove Back to Samwise header
```

No new files. No new routes. No new API endpoints. No package changes.

---

## Modifications (in phases and steps)

### Phase 1 / Step 1 — Hydrate + persist the doc link

- **In-file location:** `samwise-app/components/ritual-call/RitualCallExperience.tsx`, inside `RitualCallExperience()`. Add a hydration `useEffect` immediately after the existing unmount-cleanup `useEffect` (around current lines 40–45). Add a one-line persistence write inside the existing `start()` callback, immediately after the existing `setPhase('identifying')` call (current line ~95).
- **Should not be modified:** the `roomRef` cleanup effect, the `setMic` callback, the visibility-change auto-mute effect, the spacebar PTT effect, the state machine phases, the room creation block, any LiveKit event wiring, the audio sink ref, the `startingRef` guard.
- **Code (hydration effect — new):**

  ```tsx
  const DOC_LINK_STORAGE_KEY = 'ritual-call:docLink';

  // Hydrate the doc link from localStorage on first mount so a returning
  // user does not have to paste their link again. Cold visits stay blank.
  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(DOC_LINK_STORAGE_KEY);
      if (saved) setDocLink(saved);
    } catch {
      // localStorage can be unavailable (private mode, blocked storage);
      // fall through to the blank form — the user can still paste manually.
    }
  }, []);
  ```

  Constant declared at module top, above the component. The try/catch survives storage-disabled browsers (Safari private mode) without breaking the page.

- **Code (persistence inside `start`):** add a single line at the top of `start`, right after `setPhase('identifying')`:

  ```tsx
  try { window.localStorage.setItem(DOC_LINK_STORAGE_KEY, docLink); } catch {}
  ```

- **Explanation:** writing on `start()` (rather than on every keystroke) keeps the cache as "the link the user actually used", not whatever half-typed value they left behind. Hydration on mount makes the pre-fill behaviour deterministic on the next visit.

### Phase 1 / Step 2 — Add the Update ritual button

- **In-file location:** same file. Two edits: (a) a new `updateRitual` callback alongside `endConversation` (around current lines 187–202), and (b) a new button inside `ActiveControls` (around current lines 315–362).
- **Should not be modified:** the `endConversation` callback itself, the `reconnect` callback, the mic button + spacebar handling inside `ActiveControls`, the `Disconnected` component, the `Status` component, the `PasteLinkForm` component.
- **Code (new callback inside the component):**

  ```tsx
  const REGISTER_RITUAL_URL =
    'https://registernewritual-b6fhjlgejq-uc.a.run.app';

  const [isUpdating, setIsUpdating] = useState(false);

  // POST the cached docLink to the same cloud function the operator
  // console uses. Does NOT disconnect the room — user keeps talking
  // and ends the conversation deliberately when ready.
  const updateRitual = useCallback(async () => {
    if (!docLink || isUpdating) return;
    setIsUpdating(true);
    try {
      const res = await fetch(REGISTER_RITUAL_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ googleDocLink: docLink }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? `Failed (${res.status})`);
      toast.success('Ritual updated');
    } catch (err) {
      toast.error('Could not update ritual', {
        description: err instanceof Error ? err.message : 'Unknown error.',
      });
    } finally {
      setIsUpdating(false);
    }
  }, [docLink, isUpdating]);
  ```

  `REGISTER_RITUAL_URL` lives next to the component (matching the pattern in `app/page.tsx`). `toast` is `import { toast } from 'sonner';` — sonner is already used elsewhere in the app.

- **Code (button inside `ActiveControls`):** add a third prop and a button. Pass `onUpdate` and `updating` from the parent. Inside `ActiveControls`, render a new button immediately ABOVE "End conversation":

  ```tsx
  <button
    type="button"
    onClick={onUpdate}
    disabled={updating}
    className="rounded-md border border-input px-4 py-2 text-sm text-muted-foreground transition-colors hover:border-foreground hover:text-foreground disabled:opacity-40"
  >
    {updating ? 'Updating ritual…' : 'Update ritual'}
  </button>
  ```

  Updated `ActiveControls` signature:

  ```tsx
  function ActiveControls({
    onMicDown,
    onMicUp,
    onUpdate,
    onEnd,
    hot,
    updating,
  }: {
    onMicDown: () => void;
    onMicUp: () => void;
    onUpdate: () => void;
    onEnd: () => void;
    hot: boolean;
    updating: boolean;
  }) { … }
  ```

  At the call site:

  ```tsx
  {phase === 'active' ? (
    <ActiveControls
      onMicDown={() => void setMic(true)}
      onMicUp={() => void setMic(false)}
      onUpdate={() => void updateRitual()}
      onEnd={endConversation}
      hot={isHot}
      updating={isUpdating}
    />
  ) : null}
  ```

- **Explanation:** the button is non-destructive — clicking it does not disconnect the room or change phase. Re-clicks are blocked by `isUpdating`. The failure path surfaces the cloud function's error message verbatim via sonner.

### Phase 1 / Step 3 — Remove the "Back to Samwise" header

- **In-file location:** `RitualCallExperience.tsx`, the `<header>` block at current lines 215–227.
- **Should not be modified:** anything else inside the root `<div>` — the gold glow shadow, the phase-keyed sub-components, the audio sink div.
- **Code:** delete the entire `<header>…</header>` block. Also remove the now-unused imports: `Link` from `'next/link'` and `ArrowLeft` from `'lucide-react'`. Tsc will fail the build if either remains unused, since the file is in `"use client"` mode and the rest of the file references neither.
- **Explanation:** the page is now a destination, not a card inside the operator app. Without the header link, the only ways out are "End conversation" (returns to the paste-link form), closing the tab, or typing a different URL — all acceptable for a user-only link.

### Phase 2 / Step 0 — Remove the Create Ritual Doc feature (added mid-implementation)

- **In-file location:** `samwise-app/app/page.tsx`.
- **What changed:**
  - Removed the `CREATE_DOC_URL` constant.
  - Narrowed `type View` from `"create" | "register"` to `"register"`.
  - Removed the `"create"` entry from `NAV`; default view is now `"register"`.
  - Removed the `view === "create" && <CreateRitualDocCard />` branch from `<main>`.
  - Deleted the entire `CreateRitualDocCard` function, the `MetadataForm` / `MetadataField` types, and the `INITIAL_METADATA` constant.
  - Pruned now-unused imports: `FilePlus`, `ExternalLink`, `User`, `Mic`, `Languages`, `Phone`, `Clock`, and the whole `@/components/ui/select` import block.
- **Out of scope:** the `createRitualDoc` cloud function itself stays — only the UI advertisement is removed.

### Phase 2 / Step 1 — Remove the Demo Call copilot sidebar entry

- **In-file location:** `samwise-app/app/page.tsx`, the second `SidebarMenuItem` inside the "User experience" SidebarGroup at current lines 129–136.
- **Should not be modified:** the "Ritual call" entry above it (current lines 121–128), the Operator tools group, the `NAV` constant, any of the form components below the sidebar, the layout, the wordmark, the footer.
- **Code:** delete the six-line `<SidebarMenuItem>…</SidebarMenuItem>` block that wraps `<Link href="/copilot">`. Leave the surrounding `SidebarMenu` and `SidebarGroupContent` intact. Also remove the now-unused `Sparkles` import iff it is no longer referenced elsewhere in the file. (`Sparkles` is also used as the icon for the "Register Ritual" `NAV` item — Step 0 sanity check before deleting the import.)
- **Sanity check (run before deleting the import):** `grep -n 'Sparkles' samwise-app/app/page.tsx` — if it still appears in `NAV`, KEEP the import.
- **Explanation:** the `/copilot` route itself stays — operators with the URL can still reach it; it is just no longer advertised in the user-facing nav. A user landing on `/ritual-call` from their inbox has no chrome leading them to the operator console.

---

## Testing phase

### Local test (always)

1. From `samwise-app/`, run `pnpm dev` (or `npm run dev`, matching the project's package-manager-of-record).
2. Open `http://localhost:3000/`. Verify:
   - "Ritual call" appears in the User experience sidebar group.
   - "Demo Call copilot" is **gone** from the sidebar.
3. Open `http://localhost:3000/ritual-call`. Verify:
   - No "Back to Samwise" link in the header. The header area is empty (or absent) — the only UI is the paste-link form.
   - The Doc link input is **blank** (first visit, no localStorage value yet).
4. Paste a known-good Doc link → click Start.
5. While the call is `'active'`, verify:
   - The "Update ritual" button is visible above "End conversation".
   - Clicking it shows a "Ritual updated" toast (or a descriptive error toast if the cloud function rejects).
   - The room stays connected — clicking the button does not drop the call or change the visible phase.
6. End the conversation, refresh the page. Verify:
   - The paste-link input is **pre-filled** with the link from step 4. (localStorage hydration works.)
7. Open dev-tools → Application → Local Storage → confirm a `ritual-call:docLink` key holds the URL.
8. Optional: open the page in a private window → verify the input is blank and the page does not crash (try/catch survives storage-disabled browsers).

### Integration test

After deploying samwise-app to Vercel:

1. Send the production URL `app.samwise.life/ritual-call` to a test user (or open in an incognito browser yourself).
2. Paste a real Doc that already exists in Firestore. Confirm:
   - The agent dispatches and joins (same as today — nothing changed in `/api/ritual-call/init`).
   - Clicking "Update ritual" returns a 200 from `registernewritual-b6fhjlgejq-uc.a.run.app`.
   - The ritual doc in Firestore reflects the updated `userInputs`/`schedules` content from the latest Doc snapshot.

### Update README

`samwise-app` has no README that documents the ritual-call surface; the canonical reference is the `samwise-app-livekit-integration` skill. Skip a README edit. Skill update is captured under "After implementation" below.

---

## After implementation

### Update `samwise-app/context-for-code-agent.md`

Append a Recent Changes entry dated 2026-06-23:
- `/ritual-call` is now a self-contained user-facing surface. The pasted Doc link is persisted in `localStorage["ritual-call:docLink"]` and hydrated on mount. An "Update ritual" button inside `ActiveControls` POSTs the cached link to `registerNewRitual` without disconnecting the room. The "Back to Samwise" header link was removed so users have no nav into the operator UI. The "Demo Call copilot" sidebar entry was removed from `/`; the `/copilot` route remains reachable by direct URL.

### Update `samwise-app-livekit-integration` skill

In `samwise-app/.claude/skills/samwise-app-livekit-integration/SKILL.md`:
- Add a short note under "Client-side LiveKit wiring" → "Reusing the same room across multiple sessions" mentioning the localStorage persistence pattern for inputs the user re-uses across sessions.
- Update the "Sidebar integration" section to drop the second User experience entry from the snippet (only "Ritual call" remains).

### Mark task DONE

User manually marks the corresponding task in the master Vibe doc Projects tab.

---

## Explicitly OUT of scope (do not touch this round)

- `ritual_synthesis_prompt.txt` — frozen until a separate task.
- `samwise-backend/cloud-functions/functions/src/index.ts` (`registerNewRitual`, `createRitualDoc`) — frozen.
- `samwise-backend/ritual-agent/src/flows/onboarding/agent.ts` — frozen.
- `google-doc-template.md` — frozen (will be updated alongside the synthesis prompt later).
- `/api/ritual-call/init/route.ts` — frozen.
- The LiveKit `Room` wiring (`livekit-dispatch.ts`, audio sink, PTT, room cleanup) — frozen.
- The `/copilot` route's code — frozen (only its sidebar advertisement is removed).
- The dispatch-metadata contract between the app and ritual-agent — frozen.
