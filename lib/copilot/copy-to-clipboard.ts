// Pure-client clipboard formatter for the onboarding save row's third
// destination (Firestore + Google Doc + Clipboard). Renders the
// cleaned variable map as phase-grouped markdown so the clinician can
// paste anywhere (Notion, email, follow-up note, another Doc).
//
// Mirrors the writeOnboardingToDoc cloud function's markdown shape so
// outputs across the three save destinations are visually consistent.

import type { DemoCallVariable } from "@/app/for-experts/demo-call-config"

function todayISO(): string {
  return new Date().toISOString().slice(0, 10)
}

/**
 * Renders cleaned values as phase-grouped markdown.
 *
 * Skips empty values and the "Not filled by user" placeholder per the
 * session-copilot skill section 7 convention. Within each phase the
 * variables render in the order they appear in `variables`.
 */
export function renderOnboardingNotesMarkdown(args: {
  cleaned: Record<string, string>
  variables: DemoCallVariable[]
}): string {
  const { cleaned, variables } = args
  const lines: string[] = [`## Onboarding session notes — ${todayISO()}`, ""]

  // Group by phase, preserving insertion order.
  const byPhase = new Map<string, DemoCallVariable[]>()
  for (const v of variables) {
    const key = String(v.phase)
    if (!byPhase.has(key)) byPhase.set(key, [])
    byPhase.get(key)!.push(v)
  }

  let any = false
  for (const [phase, vars] of byPhase) {
    const phaseLabel = /^\d+$/.test(phase) ? `Phase ${phase}` : phase
    const phaseLines: string[] = []
    for (const v of vars) {
      const value = cleaned[v.name]
      if (!value || value === "Not filled by user") continue
      phaseLines.push(`- **${v.label}** (\`${v.name}\`): ${value}`)
    }
    if (phaseLines.length === 0) continue
    lines.push(`### ${phaseLabel}`)
    lines.push(...phaseLines)
    lines.push("")
    any = true
  }

  if (!any) lines.push("_(no variables captured)_")
  return lines.join("\n")
}

/**
 * Copies the rendered markdown to the clipboard. Returns the string
 * that was copied (useful for toast + fallback "select to copy" UI).
 *
 * Caller is responsible for surfacing errors to the user.
 */
export async function copyOnboardingNotes(args: {
  cleaned: Record<string, string>
  variables: DemoCallVariable[]
}): Promise<string> {
  const md = renderOnboardingNotesMarkdown(args)
  if (
    typeof navigator === "undefined" ||
    !navigator.clipboard ||
    typeof navigator.clipboard.writeText !== "function"
  ) {
    throw new Error(
      "Clipboard not available in this browser context. Use the Firestore or Google Doc save instead.",
    )
  }
  await navigator.clipboard.writeText(md)
  return md
}
