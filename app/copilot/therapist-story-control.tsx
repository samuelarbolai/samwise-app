"use client"

import { useState } from "react"
import type { TherapistStage } from "@/lib/demo-call/broadcast"

// Samuel's in-call control for the Therapist Demo Story shown on the
// THERAPIST's screen during the 50-min therapist-demo call. Mirrors
// StoryControl, with the therapist stages and the therapist-demo:show_visual
// transport. Six actions; clicking publishes the stage over the DataChannel.
// Disabled until the LiveKit room is ready (publish would no-op before then).
const STAGES: { stage: TherapistStage; label: string }[] = [
  { stage: "case", label: "1 · Meet the case" },
  { stage: "ritual", label: "2 · The ritual" },
  { stage: "call", label: "3 · The call" },
  { stage: "arc", label: "4 · The arc" },
  { stage: "collaboration", label: "5 · Where you fit" },
  { stage: "offer", label: "6 · The offer" },
]

export function TherapistStoryControl({
  ready,
  onPublish,
}: {
  ready: boolean
  onPublish: (stage: TherapistStage) => void
}) {
  const [active, setActive] = useState<TherapistStage>("hidden")

  function go(stage: TherapistStage) {
    onPublish(stage)
    setActive(stage)
  }

  return (
    <div className="sticky top-0 z-10 flex flex-col gap-2 border-b bg-background p-4">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          Visuals on therapist&apos;s screen
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
