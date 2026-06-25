"use client"

import type { Room } from "livekit-client"
import type { DemoCallVariable } from "@/app/for-experts/demo-call-config"

// The story stages Samuel can broadcast to the prospect's screen, in
// Phase 9 order: doc → promise → loop → mechanism → experience.
// "hidden" clears the visual. The document renders as a persistent spine;
// "doc" shows it on its own (the first beat). A non-invasive "yet to be
// answered" list appears from the loop beat on (derived from the stage).
// Kept here next to the publisher; the landing side declares its own
// copy of this union (cross-repo dup, same as VideoCallExperience).
export type StoryStage =
  | "hidden"
  | "doc"
  | "promise"
  | "loop"
  | "mechanism"
  | "experience"

// The /therapists artifact visuals Samuel drives on the therapist's screen
// during the 50-min therapist-demo call. Hand-synced cross-repo mirror —
// landing's `TherapistDemoStory` declares the same union. Distinct namespace
// (`therapist-demo:show_visual`) so it never collides with the prospect demo.
export type TherapistStage =
  | "hidden"
  | "case"
  | "ritual"
  | "call"
  | "arc"
  | "collaboration"
  | "offer"

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
  /** Therapist-demo equivalent of publishVisual. Same reliable transport,
   *  different event-name namespace + stage union. */
  publishTherapistVisual: (stage: TherapistStage) => void
  /** Re-emit every non-empty userVisible cleaned value as variable_update
   *  events. Call when the prospect joins so prefilled / pre-join notes
   *  arrive — the diff path only fires on CHANGES while connected, and the
   *  on-mount qualification prefill bypasses the broadcaster entirely, so
   *  without this the prospect sees an empty notes panel until the rep
   *  edits something live. */
  publishSnapshot: (
    cleaned: Record<string, string>,
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
    publishVisual(stage) {
      const payload = encoder.encode(
        JSON.stringify({ type: "demo-call:show_visual", stage }),
      )
      // Reliable + ordered: the prospect must never see a stale stage
      // after Samuel advances. Same transport flags as the variables.
      void room.localParticipant.publishData(payload, { reliable: true })
    },
    publishTherapistVisual(stage) {
      const payload = encoder.encode(
        JSON.stringify({ type: "therapist-demo:show_visual", stage }),
      )
      void room.localParticipant.publishData(payload, { reliable: true })
    },
    publishSnapshot(cleaned, variables) {
      for (const v of variables) {
        if (!v.userVisible) continue
        const value = (cleaned[v.name] ?? "").trim()
        if (!value) continue
        const payload = encoder.encode(
          JSON.stringify({
            type: "demo-call:variable_update",
            name: v.name,
            value,
          }),
        )
        void room.localParticipant.publishData(payload, { reliable: true })
      }
    },
  }
}
