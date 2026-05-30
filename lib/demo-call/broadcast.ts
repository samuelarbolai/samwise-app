"use client"

import type { Room } from "livekit-client"
import type { DemoCallVariable } from "@/app/copilot/demo-call-config"

// The story stages Samuel can broadcast to the prospect's screen.
// "hidden" clears the visual; the other three map 1:1 to the three
// scenes of the Ritual Story (doc spine → cycle → neuro crossfade).
// Kept here next to the publisher; the landing side declares its own
// copy of this union (cross-repo dup, same as VideoCallExperience).
export type StoryStage = "hidden" | "doc" | "cycle" | "neuro"

// Publishes two kinds of data events over the LiveKit DataChannel:
//   - demo-call:variable_update — a userVisible variable's cleaned
//     value changed (existing; mirrors /qualify's shape).
//   - demo-call:show_visual — Samuel advanced the in-call story to a
//     new stage (new). Carries only the stage; the prospect side
//     already holds the captured variables from the update events.
export interface VariableBroadcaster {
  diffAndPublish: (
    prevCleaned: Record<string, string>,
    nextCleaned: Record<string, string>,
    variables: DemoCallVariable[],
  ) => void
  publishVisual: (stage: StoryStage) => void
}

export function createVariableBroadcaster(room: Room): VariableBroadcaster {
  const encoder = new TextEncoder()
  return {
    diffAndPublish(prev, next, variables) {
      for (const v of variables) {
        if (!v.userVisible) continue
        const before = prev[v.name] ?? ""
        const after = next[v.name] ?? ""
        if (before === after) continue
        const payload = encoder.encode(
          JSON.stringify({
            type: "demo-call:variable_update",
            name: v.name,
            value: after,
          }),
        )
        // Reliable transport — order is important for the user's
        // "watching their notes get rewritten" experience.
        void room.localParticipant.publishData(payload, { reliable: true })
      }
    },
    publishVisual(stage) {
      const payload = encoder.encode(
        JSON.stringify({ type: "demo-call:show_visual", stage }),
      )
      // Reliable + ordered: the prospect must never see a stale stage
      // after Samuel advances. Same transport flags as the variables.
      void room.localParticipant.publishData(payload, { reliable: true })
    },
  }
}
