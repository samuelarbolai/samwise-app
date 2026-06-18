# current-plan.md — Demo Call: grado-driven desidentificación skip

> Overwrites the previous plan (Samuel notification emails — shipped, separate task in the master Vibe doc).
> Neurotic-implementer rules in force: ask before deducing; never commit unless asked.
> This feature spans THREE surfaces; companion slice: `samwise-backend/ritual-agent/current-plan.md` (agent prompt).

## Plan Summary

Add a flow case to the Demo Call: **prospects who don't need the full desidentificación teaching skip it via a smooth transition and land at "Roadmap to achieve core motivation" → Paso 2.**

Decisions locked with the user (this session):

1. **Driver = `grado_de_identificacion`** (captured at end of Phase 5b; values `low | medium | high`). It REPLACES `fit_state` as the branch driver.
2. **Threshold:** `low` and `medium` skip the desid teaching. `high` runs the full arc.
3. **Skip scope (low/medium):** the user's short block REPLACES Phase 6's full teaching; **Phase 7 and Phase 8 are skipped entirely**; **Phase 9 Paso 1 is skipped** (it recaps a mantra that was never built); the flow lands on **Phase 9 Paso 2**.
4. **Phase 8.5** is rewritten from an *evaluation/re-classification* into an *acknowledgment* of the identification status ("la identificación marca el fit") — it no longer sets `fit_state`.
5. **Referral path (Phases 16–17)** is now **appended for `low` only** — gated on `grado_de_identificacion=low` instead of `fit_state=still_disqualified`.

Resulting flow per identification level:

| Level | Phase 6 | Phase 7 | Phase 8 | Phase 8.5 | Phase 9 | Phases 10–15.6 | Phases 16–17 |
|---|---|---|---|---|---|---|---|
| **high** | full block | ✓ | ✓ (mantra) | ack | Paso 1→4 | ✓ close | — |
| **medium** | short block | skip | skip | ack | Paso 2→4 | ✓ close | — |
| **low** | short block | skip | skip | ack | Paso 2→4 | ✓ close | ✓ appended |

### ⚠️ Open decisions to confirm at plan review (I did NOT guess these — flagging instead)

- **(A) Does low/medium really continue through the price/close (Phases 10–15.6)?** Q4's "appended" reading = yes (low gets close **and** referral appended). If you want low to skip price and go straight to referral, that flips Phases 10–15.6 to `[CONDITION: grado=high,medium]`.
- **(B) The short block hardcodes "grado de identificación bajo."** For a *medium* prospect that reads slightly off. Keep verbatim, or substitute `{{grado_de_identificacion}}` (→ "bajo"/"medio")?
- **(C) Phase 8.5 was one of the three admission-test scarcity beats** (Phase 1 frame / Phase 8.5 pause / Phase 10–11 verdict — see `samwise-script-work`, "Admission-test scarcity"). Turning it into an acknowledgment removes the middle beat; the skill says run all three or none. Accept dropping it, or relocate the scarcity?
- **(D) Skipping Phase 9 Paso 1 also skips its `doc` + `promise` story visuals** — the skip path would start the visual sequence at `loop` (Paso 2). Fine, or keep the doc/promise reveal in the skip path?
- **(E) `fit_state` becomes vestigial.** Plan = leave the variable defined (harmless captured field) but remove all `[CONDITION: fit_state=…]` usage. OK, or fully retire it?
- **(F) Phases 16–17 SAY content was written for *disqualified* prospects** ("you saw the framework but it's for someone else"). For a low-id prospect who just went through the close, that framing is slightly off. Out of scope per Rule 1 unless you want it softened — flagging only.

### Blocker note

The Google Drive MCP was erroring earlier (`net::ERR_FAILED`); it has since reconnected, but this MCP appears read-only for Docs. **The script-Doc edits (Phase B) will be delivered as exact copy-paste text for you to apply in Google Docs** (the established pattern — you own the teleprompter Doc; the copilot reads it live). The code changes (copilot mechanism + agent prompt) I apply directly.

## Plan Architecture (Flow)

```
grado_de_identificacion (set at end of Phase 5b)
        │
        ├── high ──► Phase 6 full ─► 7 ─► 8 ─► 8.5 ack ─► 9 (Paso 1→4) ─► 10–15.6 close
        │
        ├── medium ─► Phase 6 short ─►(skip 7,8)─► 8.5 ack ─► 9 (Paso 2→4) ─► 10–15.6 close
        │
        └── low ────► Phase 6 short ─►(skip 7,8)─► 8.5 ack ─► 9 (Paso 2→4) ─► 10–15.6 close ─► 16–17 referral
```

Two consumers, edited in lockstep (per `samwise-script-work` "Two consumers… only ONE reads the Doc"):
- **Human `/copilot`** — parses the script Doc; needs the new block-level `[CONDITION:]` primitive (Phase A) + the Doc edits (Phase B).
- **Autonomous demo-call agent** — does NOT read the Doc; its authored prompt needs the branch logic added (companion plan, Phase D).

## Plan Structure (Directories and files)

```
samwise-app/
├── app/copilot/script-pane.tsx       EDIT — block-level + value-list [CONDITION:] primitive (core mechanism change)
└── app/copilot/demo-call-config.ts   EDIT — grado_de_identificacion.defaultValue = "high"; doc-comment fit_state as vestigial

Google Doc 1sBHuGaXCFaP8cmQdUgNpoQYwCq3L4-OfDMDoPR73a5g   EDIT (hand to user) — Phases 6,7,8,8.5,9,16,17 markers + 8.5 rewrite + short block

samwise-backend/ritual-agent/src/flows/demo-call/prompts/demo-call-prompt.ts   EDIT — see companion plan
samwise-backend/ritual-agent/src/flows/demo-call/*.test.ts                      ADD — branch behaviour tests (TDD per AGENTS.md)
```

No new deps, no new env vars, no localStorage bump (no persisted-shape change — `defaultValue` flows through existing `makeEmptyState`).

## Modifications (in phases and steps)

### Phase A — Copilot mechanism: block-level + value-list `[CONDITION:]`

#### A1 — Rework the condition primitive in `script-pane.tsx`

- **In-file location:** replace `CONDITION_RE`, `parsePhaseCondition`, and `blocksWithoutConditionMarker` (lines ~114–149) with the new `filterBlocksByCondition` + helpers; update the render map (lines ~241–271).
- **Should NOT be modified:** `renderText`, `renderParagraphs`, `Block`, `resolveBlocks`, `scrollVarsToPhase`, `scrollVarsToFirstSubstitutedVar`, the `IntersectionObserver` effect.
- **Backward-compat guarantee:** a single `[CONDITION:]` at the TOP of a phase with no close gates the whole phase to end-of-phase = the original whole-phase behaviour, so existing `fit_state` tags keep working during the Doc migration.
- **Code (replace the three helpers):**

```ts
// A phase's blocks can carry inline conditional regions:
//   [CONDITION: var=val]        opens a region (renders only if cleaned[var] is val)
//   [CONDITION: var=v1,v2]      comma = OR (any listed value matches)
//   [/CONDITION]                closes the current region (back to "always show")
// A region runs from its opening marker to the next [CONDITION:]/[/CONDITION]
// or the end of the phase. A single marker at the TOP of a phase with no
// close therefore gates the WHOLE phase — preserving the original
// whole-phase behaviour (and the legacy fit_state usage) unchanged.
//
// Markers live in note blocks (outside [SAY]); the parser coalesces
// consecutive note lines into one block, so note blocks are processed
// LINE-by-LINE. SAY blocks are gated as a unit by whatever region is
// active when they appear. State carries ACROSS blocks within the phase.
const CONDITION_OPEN_RE =
  /^\s*\[CONDITION:\s*(\w+)\s*=\s*([\w,\s-]+?)\s*\]\s*$/
const CONDITION_CLOSE_RE = /^\s*\[\/CONDITION\]\s*$/

type ActiveCond = { var: string; values: string[] } | null

function condMatches(
  active: ActiveCond,
  cleaned: Record<string, string>,
): boolean {
  if (!active) return true
  return active.values.includes((cleaned[active.var] ?? "").trim())
}

// Walks a phase's blocks in order, applying inline [CONDITION:] regions and
// stripping the marker lines. Returns only the blocks/lines that should
// render for the current `cleaned` state.
function filterBlocksByCondition(
  blocks: ScriptBlock[],
  cleaned: Record<string, string>,
): ScriptBlock[] {
  const out: ScriptBlock[] = []
  let active: ActiveCond = null
  for (const b of blocks) {
    if (b.kind === "say") {
      if (condMatches(active, cleaned)) out.push(b)
      continue
    }
    const keptLines: string[] = []
    for (const line of b.text.split("\n")) {
      const open = CONDITION_OPEN_RE.exec(line)
      if (open) {
        active = {
          var: open[1],
          values: open[2]
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean),
        }
        continue
      }
      if (CONDITION_CLOSE_RE.test(line)) {
        active = null
        continue
      }
      if (condMatches(active, cleaned)) keptLines.push(line)
    }
    const text = keptLines.join("\n").trim()
    if (text) out.push({ kind: "note", text })
  }
  return out
}
```

- **Code (render map — replace lines ~241–271 body):**

```tsx
{phases.map((p) => {
  const visibleBlocks = filterBlocksByCondition(resolveBlocks(p), cleaned)
  // Whole phase gated out (every block filtered) → hide the section,
  // preserving the original "[CONDITION:] hides the phase" UX.
  if (visibleBlocks.length === 0) return null
  return (
    <section key={String(p.number)} className="mb-10">
      <h2
        id={`script-phase-${String(p.number)}`}
        data-script-phase={String(p.number)}
        className="mb-4 scroll-mt-4"
      >
        <button
          type="button"
          onClick={() => scrollVarsToFirstSubstitutedVar(p)}
          className="text-xs font-semibold text-muted-foreground uppercase tracking-widest hover:text-foreground transition cursor-pointer text-left w-full"
          title="Jump variables pane to the first variable substituted here"
        >
          {typeof p.number === "number" ? `Phase ${p.number}` : p.number} —{" "}
          {p.title}
        </button>
      </h2>
      <div className="flex flex-col gap-3">
        {visibleBlocks.map((b, i) => (
          <Block key={i} block={b} cleaned={cleaned} />
        ))}
      </div>
    </section>
  )
})}
```

- **Explanation:** one stateful pass per phase; `active` carries across blocks so a region opened in one note block gates the SAY blocks that follow until closed. Value-list `=low,medium` is OR. Empty-after-filter ⇒ hidden section.

#### A2 — `demo-call-config.ts`: default the branch driver + mark fit_state vestigial

- **In-file location:** the `grado_de_identificacion` entry (~line 384) and the `fit_state` entry (~line 408).
- **Should NOT be modified:** the variables' `options`, `phase`, or any other variable.
- **Change:** add `defaultValue: "high"` to `grado_de_identificacion` (so the full arc is the safe default the rep sees before classifying at end of 5b — mirrors `fit_state.defaultValue = "qualified"`); note in `meaning` that it drives `[CONDITION]` desid-depth. Add a comment on `fit_state` that it is no longer a branch driver (kept as a passive captured field; pending decision E).

### Phase B — Script Doc edits (HAND TO USER as copy-paste)

Doc `1sBHuGaXCFaP8cmQdUgNpoQYwCq3L4-OfDMDoPR73a5g`. All `[CONDITION:]`/`[/CONDITION]` markers go on their OWN line, OUTSIDE any `[SAY]` block. Exact specs:

- **Phase 6** — wrap the existing full block, then add the short variant:
  ```
  [CONDITION: grado_de_identificacion=high]
  …(existing full Phase 6 SAY block + the "¿Qué pensás…" + rebound Q&A, unchanged)…
  [/CONDITION]
  [CONDITION: grado_de_identificacion=low,medium]
  [SAY] (the user's short block — verbatim, pending decision B) [/SAY]
  [/CONDITION]
  ```
- **Phase 7** — add `[CONDITION: grado_de_identificacion=high]` as the FIRST body line (whole phase gated; runs to end of phase, no close needed).
- **Phase 8** — same: `[CONDITION: grado_de_identificacion=high]` first body line.
- **Phase 8.5** — REWRITE body from evaluation → acknowledgment (skeleton below; adjust to your voice). No `[CONDITION:]` (runs for all). Remove the fit_state-setting instruction.
- **Phase 9** — keep the intro SAY for all; gate Paso 1 only:
  ```
  [SAY] Te cuento exactamente cómo es el proceso… [/SAY]
  [CONDITION: grado_de_identificacion=high]
  Paso 1 — …(existing recap + doc/promise visuals)…
  [/CONDITION]
  Paso 2 — …(unchanged, for all)…  / Paso 3 — … / Paso 4 — …
  ```
- **Phases 9, 10, 11, 12, 13, 14, 15, 15.5, 15.6** — DELETE the `[CONDITION: fit_state=qualified]` lines (now unconditional).
- **Phases 16, 17** — change `[CONDITION: fit_state=still_disqualified]` → `[CONDITION: grado_de_identificacion=low]`.

Proposed Phase 8.5 acknowledgment (skeleton — replace spoken lines with your wording; marked adaptable per Rule 8, no fabricated prospect behaviour):
```
Goal: Acknowledge the identification level and name the fit. No longer an evaluation — grado_de_identificacion was set at end of Phase 5b and drives the flow.
[SAY] [Acknowledge per {{grado_de_identificacion}}: high → "por cómo viviste esto, tu identificación es alta — y eso es justo lo que nos dice que hay un muy buen fit para trabajar juntos"; low/medium → a brief affirmation that ya manejás bien la desidentificación y podemos pasar al roadmap.] [/SAY]
```

### Phase C — Verify the copilot mechanism (local)

- `cd samwise-app && pnpm dev`, open `/copilot`, load the Doc.
- Toggle `grado_de_identificacion`: `high` → Phase 6 full + 7/8 visible + Phase 9 Paso 1 visible + no 16/17. `medium` → Phase 6 short + 7/8 hidden + Phase 9 from Paso 2 + no 16/17. `low` → as medium + 16/17 visible.
- Confirm legacy backward-compat: a phase with a single top `[CONDITION: fit_state=qualified]` still hides/shows correctly.

### Phase D — Agent prompt (companion plan)

See `samwise-backend/ritual-agent/current-plan.md`. Summary: add grado-driven branch logic to `demo-call-prompt.ts` (Phase 6 variant, skip 7/8 for low/medium, Phase 8.5 acknowledgment rewrite, Phase 9 Paso-1 gate, fit_state→grado for 16/17 append, update the `[If fit_state…]` steering line + `<variables>`), update `buildCurrentPhaseBlock`'s "never skip" wording to allow the branch skips, and add TDD tests (per AGENTS.md).

### Testing phase

- **Local test:** Phase C (copilot). For the agent: `pnpm test` in ritual-agent with new branch tests.
- **Integration test:** end-to-end autonomous demo at each grado level once deployed (lobby → walk-in/init → agent → demo-voice-room).
- **Update README:** n/a.

### After implementation

- Update `samwise-app/context-for-code-agent.md` (the `/copilot` `[CONDITION:]` paragraph): document block-level + value-list scoping and that grado replaced fit_state as the demo branch driver.
- Update the `samwise-session-copilot` (section 9) and `samwise-demo-call-agent` skills.
- Mark the task DONE in the master Vibe doc Projects tab (manual user step).
- Hand over per-repo commit messages when committable.
