"use client"

import type { Room } from "livekit-client"
import type { DemoCallVariable } from "@/app/copilot/demo-call-config"

// Publishes a `demo-call:variable_update` data event over LiveKit
// DataChannel whenever a userVisible variable's cleaned value changes.
// Mirrors /qualify's `qualification:variable_update` shape, so the
// landing-side <VariablesPanel> can be reused unchanged.
export interface VariableBroadcaster {
  diffAndPublish: (
    prevCleaned: Record<string, string>,
    nextCleaned: Record<string, string>,
    variables: DemoCallVariable[],
  ) => void
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
  }
}
