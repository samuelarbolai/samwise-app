"use client"

import { useEffect, useRef, useState } from "react"
import { toast } from "sonner"
import type { Room } from "livekit-client"

import {
  VideoCallExperience,
  type VideoCallInit,
} from "@/components/demo-call/VideoCallExperience"
import { VariablesTable } from "@/app/copilot/variables-table"
import { ScriptPane } from "@/app/copilot/script-pane"
import { QualifyPrefillRow } from "@/app/copilot/qualify-prefill-row"
import { StoryControl } from "@/app/copilot/story-control"
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

// Init response from /api/walk-in/init { mode: "join_existing" }.
interface TherapistInitResponse {
  token: string
  wsUrl: string
  roomName: string
  booking: {
    roomName: string
    prospectKey: string
    prospect: { name: string; email: string }
    language: "en" | "es"
    scheduledFor: string
  }
}

// Therapist's surface for a walk-in. Near-dupe of DemoCallShell — only
// the init endpoint and id param name differ. Kept as a separate file
// rather than generalizing for v1; the duplication is small (~150 lines)
// and clearer ownership beats premature abstraction.
export function WalkInShell({ walkInId }: { walkInId: string }) {
  const [init, setInit] = useState<TherapistInitResponse | null>(null)
  const [script, setScript] = useState<LoadedScript | null>(null)
  const [state, setStateRaw] = useState<SessionState | null>(null)
  const [error, setError] = useState<string | null>(null)

  const broadcasterRef = useRef<VariableBroadcaster | null>(null)
  const [roomReady, setRoomReady] = useState(false)

  // setState wrapper publishes diffs over DataChannel when a userVisible
  // variable's cleaned value changes. Same pattern as DemoCallShell.
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
        const res = await fetch("/api/walk-in/init", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            mode: "join_existing",
            walkInId,
            side: "therapist",
          }),
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

        const fresh = makeEmptyState(DEMO_CALL_VARIABLES)
        setStateRaw(fresh)

        // loadQualification expects a RAW identifier (email/phone/name)
        // — it normalizes internally via the phone>email>name chain.
        // We must NOT pass `booking.prospectKey` which is already
        // normalized as `"email:foo@bar.com"`; the cloud function
        // would re-interpret that as a name and never find a match.
        // Use prospect.email directly. Guest walk-ins (blank email)
        // skip the lookup entirely.
        const identifier = initData.booking.prospect.email
        if (identifier) {
          const q = await loadQualification(identifier)
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
        }
      } catch (err) {
        if (cancelled) return
        setError(
          err instanceof Error ? err.message : "Could not join the call.",
        )
      }
    })()
    return () => {
      cancelled = true
    }
  }, [walkInId])

  const handleRoomReady = (room: Room) => {
    broadcasterRef.current = createVariableBroadcaster(room)
    setRoomReady(true)
  }

  if (error) {
    return (
      <main className="flex h-screen items-center justify-center bg-neutral-950 p-6 text-neutral-100">
        <div className="max-w-md text-center">
          <h1 className="text-lg font-semibold">Could not join the call.</h1>
          <p className="mt-2 text-sm text-neutral-400">{error}</p>
        </div>
      </main>
    )
  }

  if (!init || !script || !state) {
    return (
      <main className="flex h-screen items-center justify-center bg-neutral-950 text-neutral-100">
        <p className="text-sm text-neutral-400">Joining the call…</p>
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
          peerLabel={firstName ? `${firstName} waiting…` : undefined}
          onRoomReady={handleRoomReady}
        />
      </section>
      <section className="overflow-auto border-r">
        <StoryControl
          ready={roomReady}
          onPublish={(stage) => broadcasterRef.current?.publishVisual(stage)}
        />
        {/* Manual qualification-load fallback — always available. The
            auto-prefill on mount tries booking.prospect.email; this
            row lets the rep load a different identifier if the
            auto-prefill missed (different email at /qualify vs /book)
            or if the rep wants to re-load mid-call. Seeded with the
            booking email so the common case is a one-tap reload. */}
        <div className="border-b bg-muted/30 p-4">
          <QualifyPrefillRow
            script={script}
            setState={setState}
            initialIdentifier={init.booking.prospect.email}
          />
        </div>
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
