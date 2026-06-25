"use client"

import type { DemoCallVariable } from "@/app/for-experts/demo-call-config"
import type { LoadedScript } from "@/lib/copilot/load-script"
import {
  makeEmptyState,
  type SessionState,
} from "@/lib/copilot/session-storage"
import { cleanVariableDebounced } from "@/lib/copilot/clean-variable"
import type { DemoCallDoc } from "./load-demo-call"
import type React from "react"

// =====================================================================
// Mirrors prefill-from-qualification.ts but for the demo→onboarding
// prefill path. Used by /copilot's OnboardingPrefillRow when the
// clinician picks "From Firestore (email)" mode and the loadDemoCall
// lookup returns a doc.
//
// The two pieces of metadata below ARE the prefill contract — name-
// for-name mapping from demo variables → onboarding variables. Adding
// a new shared variable requires:
//   (a) an ONBOARDING_VARIABLES entry in onboarding-call-config.ts, AND
//   (b) listing the field name here.
//
// Onboarding's pre-call list is intentionally broader than demo's
// prefills because onboarding's upstream IS the demo, which captures
// the full Phase 5b set live.
// =====================================================================

const DEMO_TO_ONBOARDING_FIELDS: string[] = [
  // From qualification (passed through the demo)
  "prospect_name",
  "behaviour_to_change",
  "behaviour_example",
  "core_motivation",
  "life_stage_context",
  "problem_duration_self_reported",
  "symbolic_anchor_description",
  "alternatives_tried",
  "why_alternatives_failed",
  // From the demo's Phase 5b live captures
  "feelings_during_relapse",
  "intention_behind_action",
  "thoughts_during_relapse",
  "self_talk_after_relapse",
  "view_of_their_life_in_that_moment",
  "consequences_for_them",
  "grado_de_identificacion",
  // Demo's late-phase captures
  "clinical_picture_description",
  "biologic_symbolic_analogy",
  "self_destructive_behaviour",
]

export interface PrefillResult {
  filledCount: number
}

/**
 * Build a fresh SessionState seeded from a demo-call doc, commit it
 * via setState, and kick off the background cleaning calls for every
 * cleanable variable that got a value.
 *
 * Reset-before-fill (mirrors prefill-from-qualification.ts) — without
 * the reset, only the variables in DEMO_TO_ONBOARDING_FIELDS would get
 * overwritten and every other variable would keep the previous
 * prospect's value (the localStorage-restored state).
 */
export function prefillFromDemoCall(args: {
  demoCall: DemoCallDoc
  variables: DemoCallVariable[]
  script: LoadedScript
  setState: React.Dispatch<React.SetStateAction<SessionState | null>>
}): PrefillResult {
  const { demoCall, variables, script, setState } = args
  const cleaned = demoCall.cleaned ?? {}

  // Build the cross-context bundle from the WHOLE cleaned demo map.
  const qOtherVars: Record<string, string> = {}
  for (const [k, v] of Object.entries(cleaned)) {
    if (typeof v === "string" && v.trim()) qOtherVars[k] = v
  }

  const fresh = makeEmptyState(variables)
  if (typeof demoCall.prospectKey === "string" && demoCall.prospectKey) {
    fresh.qualificationProspectKey = demoCall.prospectKey
  }

  const cleaningTriggers: Array<{
    variable: DemoCallVariable
    value: string
  }> = []
  let filledCount = 0

  for (const key of DEMO_TO_ONBOARDING_FIELDS) {
    const value = cleaned[key]
    if (typeof value !== "string" || !value.trim()) continue
    const variable = variables.find((v) => v.name === key)
    if (!variable) continue

    fresh.raw[key] = value
    if (!variable.cleanable) {
      fresh.cleaned[key] = value
    } else {
      fresh.cleaning[key] = true
      cleaningTriggers.push({ variable, value })
    }
    filledCount++
  }

  setState(fresh)

  for (const { variable, value } of cleaningTriggers) {
    cleanVariableDebounced(
      variable,
      value,
      script,
      qOtherVars,
      (cleanedVal) => {
        setState((prev) =>
          prev
            ? {
                ...prev,
                cleaned: { ...prev.cleaned, [variable.name]: cleanedVal },
                cleaning: { ...prev.cleaning, [variable.name]: false },
              }
            : prev,
        )
      },
    )
  }

  return { filledCount }
}
