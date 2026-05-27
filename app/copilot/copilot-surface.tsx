"use client"

import type { ReactNode } from "react"
import type { DemoCallVariable } from "./demo-call-config"
import type { LoadedScript } from "@/lib/copilot/load-script"
import type { SessionState } from "@/lib/copilot/session-storage"
import { VariablesTable } from "./variables-table"
import { ScriptPane } from "./script-pane"

// =====================================================================
// The post-load Copilot surface, extracted from /copilot/page.tsx so it
// can ALSO be rendered inside /demo-call/[bookingId] as the middle/right
// columns of the therapist's 3-column shell.
//
// /copilot keeps the URL-paste gate, the localStorage restore logic, and
// the manual qualification-prefill UI — and passes its qualification UI
// as `topSlot`. /demo-call/[id] passes no topSlot because prefill
// happens automatically from the booking's prospectKey.
// =====================================================================

export interface CopilotSurfaceProps {
  variables: DemoCallVariable[]
  state: SessionState
  setState: React.Dispatch<React.SetStateAction<SessionState | null>>
  docUrl: string
  script: LoadedScript
  /** Optional ReactNode rendered above the variables table. /copilot
   * uses this to mount its manual qualification-prefill row. */
  topSlot?: ReactNode
}

export function CopilotSurface({
  variables,
  state,
  setState,
  docUrl,
  script,
  topSlot,
}: CopilotSurfaceProps) {
  return (
    <main className="grid h-screen grid-cols-[minmax(380px,1fr)_2fr]">
      <section className="border-r overflow-auto">
        {topSlot ? (
          <div className="border-b bg-muted/30 p-4">{topSlot}</div>
        ) : null}
        <VariablesTable
          variables={variables}
          state={state}
          setState={setState}
          docUrl={docUrl}
          script={script}
        />
      </section>
      <section className="overflow-auto">
        <ScriptPane
          phases={script.phases}
          cleaned={state.cleaned}
          version={script.version}
        />
      </section>
    </main>
  )
}
