"use client"

import { useEffect, useRef } from "react"
import type { LoadedPhase, ScriptBlock } from "@/lib/copilot/load-script"
import { DEMO_CALL_VARIABLES } from "./demo-call-config"

interface ScriptPaneProps {
  phases: LoadedPhase[]
  cleaned: Record<string, string>
}

function renderText(
  text: string,
  cleaned: Record<string, string>,
): React.ReactNode[] {
  const parts: React.ReactNode[] = []
  const re = /\{\{(\w+)\}\}/g
  let lastIdx = 0
  let match: RegExpExecArray | null
  let key = 0
  while ((match = re.exec(text)) !== null) {
    if (match.index > lastIdx) parts.push(text.slice(lastIdx, match.index))
    const name = match[1]
    const value = cleaned[name]
    if (value) {
      parts.push(
        <span key={key++} className="font-semibold text-foreground">
          {value}
        </span>,
      )
    } else {
      // Cell unfilled (the rep hasn't typed yet AND the qualification
      // didn't have a value for it, OR cleaning is in flight). Render
      // the literal placeholder string so the rep can SEE which variable
      // is missing and find the row to fill. Italic + muted so a real
      // cleaned value next to it pops visually.
      parts.push(
        <span
          key={key++}
          className="italic text-muted-foreground/60"
          title={`{{${name}}}`}
        >
          {`{{${name}}}`}
        </span>,
      )
    }
    lastIdx = re.lastIndex
  }
  if (lastIdx < text.length) parts.push(text.slice(lastIdx))
  return parts
}

function Block({
  block,
  cleaned,
}: {
  block: ScriptBlock
  cleaned: Record<string, string>
}) {
  if (block.kind === "say") {
    return (
      <div className="rounded-md border-2 border-foreground/25 bg-card p-4 leading-relaxed whitespace-pre-wrap text-[15px] text-foreground">
        {renderText(block.text, cleaned)}
      </div>
    )
  }
  return (
    <p className="px-4 text-xs italic text-muted-foreground whitespace-pre-wrap leading-relaxed">
      {renderText(block.text, cleaned)}
    </p>
  )
}

// Defensive fallback: if a phase was cached before the wrapper started
// normalizing the old { text } shape, surface its raw text as a single
// say block instead of rendering nothing.
function resolveBlocks(p: LoadedPhase): ScriptBlock[] {
  if (Array.isArray(p.blocks) && p.blocks.length > 0) return p.blocks
  const legacyText = (p as unknown as { text?: string }).text
  if (typeof legacyText === "string" && legacyText.trim()) {
    return [{ kind: "say", text: legacyText }]
  }
  return []
}

// A phase may opt into conditional visibility by including a single
// `[CONDITION: var=value]` line outside any [SAY] block. Gemini's parser
// usually coalesces consecutive rep-only lines into one note block —
// so the marker line typically arrives concatenated with the phase's
// Goal line or other surrounding guidance (e.g. "[CONDITION: ...]\nGoal: ...").
// Both helpers below operate per-line within note blocks instead of
// requiring the whole block to match.
const CONDITION_RE = /^\s*\[CONDITION:\s*(\w+)\s*=\s*([\w-]+)\s*\]\s*$/

function parsePhaseCondition(
  phase: LoadedPhase,
): { var: string; value: string } | null {
  for (const block of phase.blocks) {
    if (block.kind !== "note") continue
    for (const line of block.text.split("\n")) {
      const m = CONDITION_RE.exec(line)
      if (m) return { var: m[1], value: m[2] }
    }
  }
  return null
}

// Removes the [CONDITION: …] line from each note block so the rep doesn't
// see it in the rendered script. If a note block was nothing but the marker,
// drop the block entirely; otherwise keep the remaining text.
function blocksWithoutConditionMarker(blocks: ScriptBlock[]): ScriptBlock[] {
  const out: ScriptBlock[] = []
  for (const b of blocks) {
    if (b.kind !== "note") {
      out.push(b)
      continue
    }
    const filteredText = b.text
      .split("\n")
      .filter((line) => !CONDITION_RE.test(line))
      .join("\n")
      .trim()
    if (filteredText) {
      out.push({ kind: "note", text: filteredText })
    }
  }
  return out
}

// Passive scroll target — used by the IntersectionObserver as the rep
// reads the script. Simple direct mapping: scroll to the matching
// vars-phase-{n} if it exists; no-op otherwise. This is "what is the
// rep reading right now," not "what variable do they want to fix."
function scrollVarsToPhase(phaseNumber: LoadedPhase["number"]) {
  const target = document.getElementById(`vars-phase-${String(phaseNumber)}`)
  target?.scrollIntoView({ behavior: "smooth", block: "start" })
}

// Deliberate-click target — used when the rep clicks a script phase
// title. Intent: "I saw a weird substitution in this phase; take me to
// the variable so I can fix it." Parses the phase's say blocks for the
// first {{var_name}} whose variable exists in DEMO_CALL_VARIABLES,
// scrolls to that variable's vars-pane phase section. Falls back to
// the passive mapping if the phase has no resolvable substitutions.
function scrollVarsToFirstSubstitutedVar(phase: LoadedPhase) {
  const blocks: ScriptBlock[] =
    Array.isArray(phase.blocks) && phase.blocks.length > 0
      ? phase.blocks
      : (phase as unknown as { text?: string }).text
        ? [{ kind: "say", text: (phase as unknown as { text: string }).text }]
        : []
  const re = /\{\{(\w+)\}\}/g
  for (const block of blocks) {
    if (block.kind !== "say") continue
    re.lastIndex = 0
    let m: RegExpExecArray | null
    while ((m = re.exec(block.text)) !== null) {
      const varName = m[1]
      const variable = DEMO_CALL_VARIABLES.find((v) => v.name === varName)
      if (!variable) continue
      const target = document.getElementById(
        `vars-phase-${String(variable.phase)}`,
      )
      if (target) {
        target.scrollIntoView({ behavior: "smooth", block: "start" })
        return
      }
    }
  }
  // Fallback: no substitutions found OR none resolved to a known
  // variable. Scroll to the matching vars-phase by phase number if it
  // exists; else no-op.
  scrollVarsToPhase(phase.number)
}

export function ScriptPane({ phases, cleaned }: ScriptPaneProps) {
  // Passive sync: as the rep scrolls the script pane, scroll the
  // variables pane to whichever phase header has just crossed into the
  // top of the viewport. One-way only (script → variables) so there is
  // no feedback loop. The variables pane never scrolls the script back.
  // Last-fired phase is tracked so we don't re-emit scrolls when the
  // active phase hasn't actually changed.
  const lastFiredRef = useRef<string | null>(null)
  useEffect(() => {
    const headers = Array.from(
      document.querySelectorAll<HTMLElement>("[data-script-phase]"),
    )
    if (headers.length === 0) return
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort(
            (a, b) =>
              a.boundingClientRect.top - b.boundingClientRect.top,
          )
        if (visible.length === 0) return
        const id = visible[0].target.getAttribute("data-script-phase")
        if (!id || id === lastFiredRef.current) return
        lastFiredRef.current = id
        scrollVarsToPhase(id)
      },
      // Effective trigger zone = top 30% of the viewport. A phase counts
      // as "active" when its header crosses into that band.
      { rootMargin: "0px 0px -70% 0px", threshold: 0 },
    )
    headers.forEach((h) => observer.observe(h))
    return () => observer.disconnect()
  }, [phases])

  return (
    <div className="mx-auto max-w-3xl p-6">
      {phases.map((p) => {
        const condition = parsePhaseCondition(p)
        if (condition && cleaned[condition.var] !== condition.value) {
          return null
        }
        const visibleBlocks = blocksWithoutConditionMarker(resolveBlocks(p))
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
    </div>
  )
}
