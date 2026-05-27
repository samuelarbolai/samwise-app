"use client"

import { useState } from "react"
import { toast } from "sonner"
import { Sparkles } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Spinner } from "@/components/ui/spinner"
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field"

import { loadQualification } from "@/lib/copilot/load-qualification"
import { prefillFromQualification } from "@/lib/copilot/prefill-from-qualification"
import { DEMO_CALL_VARIABLES } from "./demo-call-config"
import type { LoadedScript } from "@/lib/copilot/load-script"
import type { SessionState } from "@/lib/copilot/session-storage"

// Manual prospect-identifier → qualification-prefill UI. Originally
// inlined in /copilot/page.tsx; extracted so the same affordance is
// available inside WalkInShell mid-call (per user 2026-05-27 — "as a
// fallback that is always available"). Use cases:
//   - Auto-prefill didn't find a qualification (prospect used a
//     different email at /qualify than at /book or /meet).
//   - Rep wants to load a different prospect's prior qualification.
//   - Rep wants to re-load to revert local edits.
//
// Loads route through the shared `prefillFromQualification` helper,
// so cleaning + suggestion pre-generation behave identically to the
// auto-prefill path. In WalkInShell the wrapping setState fires the
// DataChannel broadcaster, so loading a qualification mid-call also
// updates the prospect's <VariablesPanel> in real time.

interface QualifyPrefillRowProps {
  script: LoadedScript
  setState: React.Dispatch<React.SetStateAction<SessionState | null>>
  /** Optional seed value — `/meet/[id]`'s WalkInShell passes the
   * booking's prospect email so the input is pre-typed for the
   * common case. The rep can clear it to load a different prospect. */
  initialIdentifier?: string
}

export function QualifyPrefillRow({
  script,
  setState,
  initialIdentifier,
}: QualifyPrefillRowProps) {
  const [identifier, setIdentifier] = useState(initialIdentifier ?? "")
  const [loading, setLoading] = useState(false)

  const handleLoad = async () => {
    const id = identifier.trim()
    if (!id) return
    setLoading(true)
    try {
      const resp = await loadQualification(id)
      if (!resp.ok) {
        toast.error("No qualification found", {
          description: `Looked up "${id}". The prospect either hasn't done /qualify yet or the identifier doesn't match.`,
        })
        return
      }
      const { filledCount } = prefillFromQualification({
        qualification: resp.qualification,
        variables: DEMO_CALL_VARIABLES,
        script,
        setState,
      })
      const outcomeLabel = resp.qualification.outcome ?? "unknown outcome"
      toast.success(`Qualification loaded (${outcomeLabel})`, {
        description:
          filledCount > 0
            ? `Pre-filled ${filledCount} variable${filledCount === 1 ? "" : "s"} from the Fit Assessment.`
            : "No overlapping fields to pre-fill.",
      })
    } catch (err) {
      toast.error("Could not load qualification", {
        description: err instanceof Error ? err.message : "Unknown error.",
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <FieldGroup>
      <Field>
        <FieldLabel htmlFor="qualify-identifier" className="text-xs">
          <Sparkles className="h-3.5 w-3.5" />
          Pre-fill from qualification (Fit Assessment)
        </FieldLabel>
        <div className="flex gap-2">
          <Input
            id="qualify-identifier"
            type="text"
            placeholder="Prospect phone, email, or name"
            value={identifier}
            onChange={(e) => setIdentifier(e.target.value)}
            disabled={loading}
            className="h-8"
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleLoad}
            disabled={loading || !identifier.trim()}
          >
            {loading ? <Spinner className="h-4 w-4" /> : "Load"}
          </Button>
        </div>
      </Field>
    </FieldGroup>
  )
}
