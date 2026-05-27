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
import { loadQualification } from "@/lib/copilot/load-qualification"
import {
  loadSessionState,
  type SessionState,
  makeEmptyState,
} from "@/lib/copilot/session-storage"
import { prefillFromQualification } from "@/lib/copilot/prefill-from-qualification"
import { CopilotSurface } from "./copilot-surface"

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

  // ── Manual pre-fill from qualification ─────────────────────────────
  // The rep types a prospect's phone/email/name; loadQualification looks
  // up the most-recent qualification doc; prefillFromQualification (the
  // shared helper) builds the fresh state and triggers cleanings +
  // suggestion pre-generation. This is the manual path — /demo-call/[id]
  // uses the same helper but pulls the prospectKey from the booking doc
  // automatically.
  const [qualifyIdentifier, setQualifyIdentifier] = useState("")
  const [isLoadingQualification, setIsLoadingQualification] = useState(false)

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
            ? `Pre-filled ${filledCount} variable${filledCount === 1 ? "" : "s"} from the Fit Assessment. Prior session data cleared.`
            : "No overlapping fields to pre-fill. Prior session data cleared.",
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
              script. Change it only if you&apos;re iterating on a fork.
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

  // Manual qualification-prefill UI — passed as topSlot to CopilotSurface.
  // /demo-call/[id] does NOT pass a topSlot because it auto-prefills
  // from booking.prospectKey at mount time.
  const qualifyPrefillUI = (
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
            disabled={isLoadingQualification || !qualifyIdentifier.trim()}
          >
            {isLoadingQualification ? <Spinner className="h-4 w-4" /> : "Load"}
          </Button>
        </div>
      </Field>
    </FieldGroup>
  )

  return (
    <CopilotSurface
      variables={DEMO_CALL_VARIABLES}
      state={state}
      setState={setState}
      docUrl={docUrl}
      script={script}
      topSlot={qualifyPrefillUI}
    />
  )
}
