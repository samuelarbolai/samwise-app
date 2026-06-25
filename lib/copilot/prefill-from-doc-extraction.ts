"use client"

import type { DemoCallVariable } from "@/app/for-experts/demo-call-config"
import type { LoadedScript } from "@/lib/copilot/load-script"
import {
  makeEmptyState,
  type SessionState,
} from "@/lib/copilot/session-storage"
import { cleanVariableDebounced } from "@/lib/copilot/clean-variable"
import type { DocExtractionPayload } from "./load-from-doc"
import type React from "react"

// =====================================================================
// Sibling to prefill-from-demo-call.ts and prefill-from-qualification.ts.
// Takes the sparse extraction payload from extractOnboardingFromDoc
// (LLM-extracted onboarding variables from any Doc the clinician
// pointed at) and hydrates the onboarding session state.
//
// Sparse semantics: only variables Gemini found evidence for are in
// `payload.extracted`. Everything else stays empty for the clinician
// to fill manually.
// =====================================================================

export interface PrefillResult {
  filledCount: number
}

export function prefillFromDocExtraction(args: {
  payload: DocExtractionPayload
  variables: DemoCallVariable[]
  script: LoadedScript
  setState: React.Dispatch<React.SetStateAction<SessionState | null>>
}): PrefillResult {
  const { payload, variables, script, setState } = args
  const extracted = payload.extracted ?? {}

  // Build cross-context bundle from the whole extraction.
  const otherVars: Record<string, string> = {}
  for (const [k, v] of Object.entries(extracted)) {
    if (typeof v === "string" && v.trim()) otherVars[k] = v
  }

  const fresh = makeEmptyState(variables)

  const cleaningTriggers: Array<{
    variable: DemoCallVariable
    value: string
  }> = []
  let filledCount = 0

  for (const [name, value] of Object.entries(extracted)) {
    if (typeof value !== "string" || !value.trim()) continue
    const variable = variables.find((v) => v.name === name)
    if (!variable) continue

    fresh.raw[name] = value
    if (!variable.cleanable) {
      fresh.cleaned[name] = value
    } else {
      fresh.cleaning[name] = true
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
      otherVars,
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
