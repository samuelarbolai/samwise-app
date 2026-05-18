"use client"

import { useEffect, useRef } from "react"
import type { LoadedPhase, ScriptBlock } from "@/lib/copilot/load-script"

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
      parts.push(
        <span
          key={key++}
          className="italic text-muted-foreground/60"
        >{`{{${name}}}`}</span>,
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

function scrollVarsToPhase(phaseNumber: LoadedPhase["number"]) {
  const target = document.getElementById(`vars-phase-${String(phaseNumber)}`)
  target?.scrollIntoView({ behavior: "smooth", block: "start" })
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
      {phases.map((p) => (
        <section key={String(p.number)} className="mb-10">
          <h2
            id={`script-phase-${String(p.number)}`}
            data-script-phase={String(p.number)}
            className="mb-4 scroll-mt-4"
          >
            <button
              type="button"
              onClick={() => scrollVarsToPhase(p.number)}
              className="text-xs font-semibold text-muted-foreground uppercase tracking-widest hover:text-foreground transition cursor-pointer text-left w-full"
              title="Jump variables pane to this phase"
            >
              {typeof p.number === "number" ? `Phase ${p.number}` : p.number} —{" "}
              {p.title}
            </button>
          </h2>
          <div className="flex flex-col gap-3">
            {resolveBlocks(p).map((b, i) => (
              <Block key={i} block={b} cleaned={cleaned} />
            ))}
          </div>
        </section>
      ))}
    </div>
  )
}
