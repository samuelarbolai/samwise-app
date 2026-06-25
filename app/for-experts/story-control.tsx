"use client"

import { useState } from "react"
import type { StoryStage } from "@/lib/demo-call/broadcast"

// Samuel's in-call control for the Ritual Story shown on the
// prospect's screen. Four actions; clicking publishes the stage over
// the DataChannel. Local state tracks what the prospect is currently
// seeing so the active stage is highlighted. Disabled until the
// LiveKit room is ready (publish would no-op before then).
const STAGES: { stage: StoryStage; label: string }[] = [
  { stage: "doc", label: "1 · Doc" },
  { stage: "promise", label: "2 · Promise" },
  { stage: "loop", label: "3 · Daily Loop" },
  { stage: "mechanism", label: "4 · Mechanism" },
  { stage: "experience", label: "5 · Six-Step Loop" },
]

export function StoryControl({
  ready,
  onPublish,
}: {
  ready: boolean
  onPublish: (stage: StoryStage) => void
}) {
  const [active, setActive] = useState<StoryStage>("hidden")

  function go(stage: StoryStage) {
    onPublish(stage)
    setActive(stage)
  }

  return (
    <div className="sticky top-0 z-10 flex flex-col gap-2 border-b bg-background p-4">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          Story on prospect&apos;s screen
        </span>
        {active !== "hidden" && (
          <button
            type="button"
            onClick={() => go("hidden")}
            disabled={!ready}
            className="text-xs text-muted-foreground underline disabled:opacity-40"
          >
            Clear
          </button>
        )}
      </div>
      <div className="flex flex-wrap gap-2">
        {STAGES.map(({ stage, label }) => (
          <button
            key={stage}
            type="button"
            onClick={() => go(stage)}
            disabled={!ready}
            aria-pressed={active === stage}
            className={
              "rounded-md border px-3 py-1.5 text-sm transition disabled:opacity-40 " +
              (active === stage
                ? "border-foreground bg-foreground text-background"
                : "border-input hover:bg-muted")
            }
          >
            {label}
          </button>
        ))}
      </div>
      {!ready && (
        <span className="text-xs text-muted-foreground">
          Waiting for the call to connect…
        </span>
      )}
    </div>
  )
}
