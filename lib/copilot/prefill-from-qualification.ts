"use client"

import type {
  DemoCallVariable,
} from "@/app/copilot/demo-call-config"
import type { LoadedScript } from "@/lib/copilot/load-script"
import {
  makeEmptyState,
  type SessionState,
} from "@/lib/copilot/session-storage"
import { cleanVariableDebounced } from "@/lib/copilot/clean-variable"
import {
  firePreGeneration,
  type SuggestionUpdater,
} from "@/lib/copilot/suggest-rep-line"
import type { QualificationDoc } from "@/lib/copilot/load-qualification"
import type React from "react"

// =====================================================================
// Shared between /copilot's manual rep-typed prefill and
// /demo-call/[id]'s automatic booking-driven prefill. Both call this
// helper after a successful loadQualification(); both want the same
// fresh state + cleaning triggers + suggestion pre-generation behaviour.
//
// The two pieces of metadata below ARE the prefill contract. Adding a
// new shared variable requires:
//   (a) adding a DemoCallVariable entry in demo-call-config.ts, AND
//   (b) listing the field name here.
// =====================================================================

// Fields shared name-for-name between QualificationDoc and DEMO_CALL_VARIABLES.
const QUALIFICATION_TO_DEMO_FIELDS: Array<keyof QualificationDoc> = [
  "prospect_name",
  "behaviour_to_change",
  "behaviour_example",
  "core_motivation",
  "alternatives_tried",
  "why_alternatives_failed",
  "life_stage_context",
  "problem_duration_self_reported",
  "symbolic_anchor_type",
  "symbolic_anchor_description",
  "alternatives_exhaustion_level",
]

// Derived prefills — a qualification field copied into a differently-named
// demo variable. Use when data captured upstream IS the data Phase N
// captures live, just under a different field name.
const DERIVED_PREFILLS: Array<{
  from: keyof QualificationDoc
  to: string
}> = [{ from: "behaviour_to_change", to: "actions_during_relapse" }]

export interface PrefillResult {
  filledCount: number
}

/**
 * Build a fresh SessionState seeded from a qualification doc, commit it
 * via setState, fire suggestion pre-generation, and kick off the
 * background cleaning calls for every cleanable variable that got a
 * value. The cleaning callbacks themselves call setState again as the
 * Gemini responses arrive.
 *
 * Why a single setState commit before the async work: prevents flicker
 * (the rep sees ALL prefilled raw values at once, not a staggered
 * sequence) and prevents losing fields if a setState batches with
 * something unrelated mid-prefill.
 */
export function prefillFromQualification(args: {
  qualification: QualificationDoc
  variables: DemoCallVariable[]
  script: LoadedScript
  setState: React.Dispatch<React.SetStateAction<SessionState | null>>
}): PrefillResult {
  const { qualification: q, variables, script, setState } = args

  // Build the cross-context bundle from the WHOLE qualification doc —
  // richest disambiguation source the cleaner can have at prefill time.
  const qOtherVars: Record<string, string> = {}
  for (const [k, v] of Object.entries(q)) {
    if (typeof v === "string" && v.trim()) qOtherVars[k] = v
  }

  // Reset + apply prefills in ONE fresh state. Without this reset, only
  // the variables in QUALIFICATION_TO_DEMO_FIELDS would get overwritten
  // and every other variable would keep the previous prospect's value
  // (the localStorage-restored state).
  const fresh = makeEmptyState(variables)
  if (typeof q.prospectKey === "string" && q.prospectKey) {
    fresh.qualificationProspectKey = q.prospectKey
  }

  const cleaningTriggers: Array<{
    variable: DemoCallVariable
    value: string
  }> = []
  let filledCount = 0

  for (const key of QUALIFICATION_TO_DEMO_FIELDS) {
    const value = q[key]
    if (typeof value !== "string" || !value.trim()) continue
    const variable = variables.find((v) => v.name === key)
    if (!variable) continue

    fresh.raw[key] = value
    if (!variable.cleanable) {
      fresh.cleaned[key] = value
    } else {
      fresh.cleaning[key] = true
      // No initial cleaned seed — fresh.cleaned[key] is "" from
      // makeEmptyState. During the ~1.5s cleaning window the script-pane
      // fallback renders {{var_name}}, which is readable and signals the
      // cleaning-in-flight state.
      cleaningTriggers.push({ variable, value })
    }
    filledCount++
  }

  for (const { from, to } of DERIVED_PREFILLS) {
    const value = q[from]
    if (typeof value !== "string" || !value.trim()) continue
    const variable = variables.find((v) => v.name === to)
    if (!variable) continue
    if (fresh.raw[to]) continue // don't clobber a same-name prefill

    fresh.raw[to] = value
    if (!variable.cleanable) {
      fresh.cleaned[to] = value
    } else {
      fresh.cleaning[to] = true
      cleaningTriggers.push({ variable, value })
    }
    filledCount++
  }

  setState(fresh)

  // Fire suggestion pre-generation for any variable whose trigger is
  // "qualification_load" (currently only Phase 1.5 worldview
  // confirmation). Uses the fresh state so the generator sees all
  // qualification values immediately.
  const updateSuggestion: SuggestionUpdater = (varName, update) => {
    setState(
      (prev) =>
        prev && {
          ...prev,
          suggestions: {
            ...prev.suggestions,
            [varName]: {
              ...(prev.suggestions[varName] ?? {
                line: "",
                generating: false,
              }),
              ...update,
            },
          },
        },
    )
  }
  firePreGeneration("qualification_load", variables, fresh, updateSuggestion)

  for (const { variable, value } of cleaningTriggers) {
    cleanVariableDebounced(
      variable,
      value,
      script,
      qOtherVars,
      (cleaned) => {
        setState((prev) =>
          prev
            ? {
                ...prev,
                cleaned: { ...prev.cleaned, [variable.name]: cleaned },
                cleaning: { ...prev.cleaning, [variable.name]: false },
              }
            : prev,
        )
      },
    )
  }

  return { filledCount }
}
