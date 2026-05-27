"use client"

import { useEffect, useRef, useState } from "react"
import { toast } from "sonner"
import type { Room } from "livekit-client"

import {
  VideoCallExperience,
  type VideoCallInit,
} from "./VideoCallExperience"
import { VariablesTable } from "@/app/copilot/variables-table"
import { ScriptPane } from "@/app/copilot/script-pane"
import {
  DEFAULT_DEMO_SCRIPT_DOC_URL,
  DEMO_CALL_VARIABLES,
} from "@/app/copilot/demo-call-config"
import { loadCallScript, type LoadedScript } from "@/lib/copilot/load-script"
import { loadQualification } from "@/lib/copilot/load-qualification"
import {
  makeEmptyState,
  type SessionState,
} from "@/lib/copilot/session-storage"
import { prefillFromQualification } from "@/lib/copilot/prefill-from-qualification"
import {
  createVariableBroadcaster,
  type VariableBroadcaster,
} from "@/lib/demo-call/broadcast"

interface TherapistInitResponse {
  token: string
  wsUrl: string
  roomName: string
  booking: {
    roomName: string
    prospectKey: string
    prospect: { name: string; email: string; phone: string }
    language: "en" | "es"
    scheduledFor: string
  }
}

// Therapist-side wrapper. 3-column layout: VideoCallExperience (left),
// VariablesTable (middle), ScriptPane (right). Uses the copilot panes
// directly (NOT <CopilotSurface>, which renders its own 2-col grid — that
// would nest a grid inside our middle column).
//
// On mount: POST /api/demo-call/init (which also kicks off egress server-
// side), load the canonical demo script, attempt prefill from the
// booking's qualification by prospectKey. Then wire a setState wrapper
// through a DataChannel broadcaster so cleaned userVisible variables
// land on the user side as the rep types.
export function DemoCallShell({ bookingId }: { bookingId: string }) {
  const [init, setInit] = useState<TherapistInitResponse | null>(null)
  const [script, setScript] = useState<LoadedScript | null>(null)
  const [state, setStateRaw] = useState<SessionState | null>(null)
  const [error, setError] = useState<string | null>(null)

  // Broadcaster ref so the setState wrapper closure always sees the
  // latest broadcaster without re-binding.
  const broadcasterRef = useRef<VariableBroadcaster | null>(null)

  // Every commit goes through diffAndPublish so any changed userVisible
  // variable's cleaned value flows out over DataChannel. The wrapper
  // function identity is stable across renders.
  const setState: React.Dispatch<React.SetStateAction<SessionState | null>> = (
    updater,
  ) => {
    setStateRaw((prev) => {
      const next =
        typeof updater === "function"
          ? (updater as (s: SessionState | null) => SessionState | null)(prev)
          : updater
      const broadcaster = broadcasterRef.current
      if (next && broadcaster) {
        broadcaster.diffAndPublish(
          prev?.cleaned ?? {},
          next.cleaned,
          DEMO_CALL_VARIABLES,
        )
      }
      return next
    })
  }

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const res = await fetch("/api/demo-call/init", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ bookingId, side: "therapist" }),
        })
        if (!res.ok) {
          const body = (await res.json().catch(() => ({}))) as {
            error?: string
          }
          throw new Error(body.error ?? `Init failed (${res.status})`)
        }
        const initData = (await res.json()) as TherapistInitResponse
        if (cancelled) return
        setInit(initData)

        const loaded = await loadCallScript(DEFAULT_DEMO_SCRIPT_DOC_URL)
        if (loaded.scriptType !== "demo") {
          throw new Error(
            `Loaded a non-demo script (scriptType="${loaded.scriptType}")`,
          )
        }
        if (cancelled) return
        setScript(loaded)

        // Build empty state first so the UI can render the variables
        // table while the qualification fetch is in flight.
        const fresh = makeEmptyState(DEMO_CALL_VARIABLES)
        setStateRaw(fresh) // raw setter; broadcaster isn't wired yet anyway.

        const q = await loadQualification(initData.booking.prospectKey)
        if (q.ok && !cancelled) {
          const { filledCount } = prefillFromQualification({
            qualification: q.qualification,
            variables: DEMO_CALL_VARIABLES,
            script: loaded,
            setState: setStateRaw,
          })
          toast.success("Qualification loaded", {
            description: `Pre-filled ${filledCount} variable${filledCount === 1 ? "" : "s"}.`,
          })
        } else if (!q.ok && !cancelled) {
          toast.info("No qualification on file for this prospect.")
        }
      } catch (err) {
        if (cancelled) return
        setError(
          err instanceof Error
            ? err.message
            : "Could not start the demo call.",
        )
      }
    })()
    return () => {
      cancelled = true
    }
  }, [bookingId])

  const handleRoomReady = (room: Room) => {
    broadcasterRef.current = createVariableBroadcaster(room)
  }

  if (error) {
    return (
      <main className="flex h-screen items-center justify-center bg-neutral-950 p-6 text-neutral-100">
        <div className="max-w-md text-center">
          <h1 className="text-lg font-semibold">Could not start the call.</h1>
          <p className="mt-2 text-sm text-neutral-400">{error}</p>
        </div>
      </main>
    )
  }

  if (!init || !script || !state) {
    return (
      <main className="flex h-screen items-center justify-center bg-neutral-950 text-neutral-100">
        <p className="text-sm text-neutral-400">Loading the call…</p>
      </main>
    )
  }

  const initForVideo: VideoCallInit = {
    token: init.token,
    wsUrl: init.wsUrl,
    roomName: init.roomName,
  }
  const firstName = init.booking.prospect.name.split(" ")[0] ?? ""

  return (
    <main className="grid h-screen grid-cols-[minmax(360px,1fr)_minmax(380px,1fr)_2fr]">
      <section className="relative h-full border-r">
        <VideoCallExperience
          init={initForVideo}
          peerLabel={firstName ? `${firstName} joining…` : undefined}
          onRoomReady={handleRoomReady}
        />
      </section>
      <section className="overflow-auto border-r">
        <VariablesTable
          variables={DEMO_CALL_VARIABLES}
          state={state}
          setState={setState}
          docUrl={DEFAULT_DEMO_SCRIPT_DOC_URL}
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
