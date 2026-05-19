"use client"

import { useEffect, useState } from "react"
import { toast } from "sonner"
import { FileText, Send, Sparkles } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Spinner } from "@/components/ui/spinner"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Field, FieldLabel, FieldGroup } from "@/components/ui/field"

import {
  DEFAULT_DEMO_SCRIPT_DOC_URL,
  DEMO_CALL_VARIABLES,
} from "./demo-call-config"
import { loadCallScript, type LoadedScript } from "@/lib/copilot/load-script"
import { cleanVariableDebounced } from "@/lib/copilot/clean-variable"
import {
  loadQualification,
  type QualificationDoc,
} from "@/lib/copilot/load-qualification"
import {
  loadSessionState,
  type SessionState,
  makeEmptyState,
} from "@/lib/copilot/session-storage"
import { VariablesTable } from "./variables-table"
import { ScriptPane } from "./script-pane"

export default function CopilotPage() {
  const [docUrl, setDocUrl] = useState(DEFAULT_DEMO_SCRIPT_DOC_URL)
  const [isLoading, setIsLoading] = useState(false)
  const [script, setScript] = useState<LoadedScript | null>(null)
  const [state, setState] = useState<SessionState | null>(null)

  // Restore last session on mount if one exists in localStorage.
  useEffect(() => {
    const restored = loadSessionState()
    if (restored) {
      setScript(restored.script)
      setState(restored.state)
      setDocUrl(restored.docUrl)
    }
  }, [])

  const handleLoad = async () => {
    if (!docUrl.trim()) return
    setIsLoading(true)
    try {
      const loaded = await loadCallScript(docUrl.trim())
      if (loaded.scriptType !== "demo") {
        toast.error("Only Demo Call scripts are supported in v1.", {
          description: `Got scriptType="${loaded.scriptType}". Pick a Demo script Doc and try again.`,
        })
        return
      }
      setScript(loaded)
      setState(makeEmptyState(DEMO_CALL_VARIABLES))
      toast.success("Script loaded", {
        description: `${loaded.phases.length} phases.`,
      })
    } catch (err) {
      toast.error("Could not load script", {
        description: err instanceof Error ? err.message : "Unknown error.",
      })
    } finally {
      setIsLoading(false)
    }
  }

  // ── Pre-fill from qualification ────────────────────────────────────
  // The /qualify route at samwise-landing captures the prospect's first
  // pass on the same variables we re-elicit during the Demo Call. When
  // the rep loads a prospect's qualification doc here, we populate the
  // matching variables' raw-note inputs and trigger the existing
  // debounced cleaner just as if the rep had typed each value. The rep
  // can still edit any field — this is a starting point, not a lock.
  const [qualifyIdentifier, setQualifyIdentifier] = useState("")
  const [isLoadingQualification, setIsLoadingQualification] = useState(false)

  // Fields the qualification doc shares with DEMO_CALL_VARIABLES. The
  // mapping is name-for-name except where the wording differs.
  const QUALIFICATION_TO_DEMO_FIELDS: Array<keyof QualificationDoc> = [
    "prospect_name",
    "behaviour_to_change",
    "core_motivation",
    "alternatives_tried",
    "why_alternatives_failed",
  ]

  const handleLoadQualification = async () => {
    const identifier = qualifyIdentifier.trim()
    if (!identifier || !script || !state) return
    setIsLoadingQualification(true)
    try {
      const resp = await loadQualification(identifier)
      if (!resp.ok) {
        toast.error("No qualification found", {
          description: `Looked up "${identifier}". The prospect either hasn't done /qualify yet or the identifier doesn't match.`,
        })
        return
      }
      const q = resp.qualification

      // Find each match against DEMO_CALL_VARIABLES and update state.
      // For cleanable fields we trigger cleanVariableDebounced exactly
      // as VariablesTable's setRaw does; for non-cleanable fields we
      // mirror raw into cleaned directly.
      let filledCount = 0
      for (const key of QUALIFICATION_TO_DEMO_FIELDS) {
        const value = q[key]
        if (typeof value !== "string" || !value.trim()) continue
        const variable = DEMO_CALL_VARIABLES.find((v) => v.name === key)
        if (!variable) continue

        setState((prev) =>
          prev ? { ...prev, raw: { ...prev.raw, [key]: value } } : prev,
        )
        if (!variable.cleanable) {
          setState((prev) =>
            prev
              ? { ...prev, cleaned: { ...prev.cleaned, [key]: value } }
              : prev,
          )
        } else {
          setState((prev) =>
            prev
              ? { ...prev, cleaning: { ...prev.cleaning, [key]: true } }
              : prev,
          )
          cleanVariableDebounced(variable, value, script, (cleaned) => {
            setState((prev) =>
              prev
                ? {
                    ...prev,
                    cleaned: { ...prev.cleaned, [key]: cleaned },
                    cleaning: { ...prev.cleaning, [key]: false },
                  }
                : prev,
            )
          })
        }
        filledCount++
      }

      const outcomeLabel = q.outcome ?? "unknown outcome"
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
      setIsLoadingQualification(false)
    }
  }

  if (!script || !state) {
    return (
      <main className="flex flex-1 flex-col items-center justify-start p-4 py-12">
        <Card className="w-full max-w-lg">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
              <FileText className="h-6 w-6 text-primary" />
            </div>
            <CardTitle className="text-2xl">Load Demo Call script</CardTitle>
            <CardDescription>
              The script Doc URL is pre-filled with the canonical v0.3 Demo
              script. Change it only if you're iterating on a fork.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="doc-url">
                  <FileText className="h-4 w-4" />
                  Script Google Doc URL
                </FieldLabel>
                <Input
                  id="doc-url"
                  type="url"
                  value={docUrl}
                  onChange={(e) => setDocUrl(e.target.value)}
                  disabled={isLoading}
                />
              </Field>
              <Button
                onClick={handleLoad}
                disabled={isLoading}
                className="w-full"
              >
                {isLoading ? (
                  <>
                    <Spinner className="mr-2" />
                    Loading...
                  </>
                ) : (
                  <>
                    <Send className="mr-2 h-4 w-4" />
                    Load script
                  </>
                )}
              </Button>
            </FieldGroup>
          </CardContent>
        </Card>
      </main>
    )
  }

  return (
    <main className="grid h-screen grid-cols-[minmax(380px,1fr)_2fr]">
      <section className="border-r overflow-auto">
        <div className="border-b bg-muted/30 p-4">
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
                  value={qualifyIdentifier}
                  onChange={(e) => setQualifyIdentifier(e.target.value)}
                  disabled={isLoadingQualification}
                  className="h-8"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleLoadQualification}
                  disabled={
                    isLoadingQualification || !qualifyIdentifier.trim()
                  }
                >
                  {isLoadingQualification ? (
                    <Spinner className="h-4 w-4" />
                  ) : (
                    "Load"
                  )}
                </Button>
              </div>
            </Field>
          </FieldGroup>
        </div>
        <VariablesTable
          variables={DEMO_CALL_VARIABLES}
          state={state}
          setState={setState}
          docUrl={docUrl}
          script={script}
        />
      </section>
      <section className="overflow-auto">
        <ScriptPane phases={script.phases} cleaned={state.cleaned} />
      </section>
    </main>
  )
}
