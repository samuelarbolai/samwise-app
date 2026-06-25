"use client"

import { useState } from "react"
import { toast } from "sonner"
import { Sparkles } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Spinner } from "@/components/ui/spinner"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Label } from "@/components/ui/label"

import { loadDemoCall } from "@/lib/copilot/load-demo-call"
import { prefillFromDemoCall } from "@/lib/copilot/prefill-from-demo-call"
import { extractOnboardingFromDoc } from "@/lib/copilot/load-from-doc"
import { prefillFromDocExtraction } from "@/lib/copilot/prefill-from-doc-extraction"
import { ONBOARDING_VARIABLES } from "./onboarding-call-config"
import type { LoadedScript } from "@/lib/copilot/load-script"
import type { SessionState } from "@/lib/copilot/session-storage"

// Three-mode prefill for onboarding sessions:
//   - "firestore": loadDemoCall by email/phone/name → hydrate matching
//     onboarding variables from the most recent demoCalls doc.
//   - "doc":       extractOnboardingFromDoc by Doc URL → Gemini sparse
//     extraction → hydrate matching onboarding variables.
//   - "manual":    no-op; clinician types directly. (Default if cleared.)
//
// Mirrors QualifyPrefillRow's shape so the surface inside CopilotSurface's
// `topSlot` stays consistent across demo and onboarding modes.

type Mode = "firestore" | "doc" | "manual"

interface OnboardingPrefillRowProps {
  script: LoadedScript
  setState: React.Dispatch<React.SetStateAction<SessionState | null>>
}

export function OnboardingPrefillRow({
  script,
  setState,
}: OnboardingPrefillRowProps) {
  const [mode, setMode] = useState<Mode>("firestore")
  const [identifier, setIdentifier] = useState("")
  const [docLink, setDocLink] = useState("")
  const [loading, setLoading] = useState(false)

  const handleLoad = async () => {
    if (mode === "manual") return
    setLoading(true)
    try {
      if (mode === "firestore") {
        const id = identifier.trim()
        if (!id) {
          toast.error("Type a prospect email / phone / name first.")
          return
        }
        const resp = await loadDemoCall(id)
        if (!resp.ok) {
          toast.error("No demo call on file", {
            description: `Looked up "${id}". The prospect either hasn't done a demo yet or the identifier doesn't match.`,
          })
          return
        }
        const { filledCount } = prefillFromDemoCall({
          demoCall: resp.demoCall,
          variables: ONBOARDING_VARIABLES,
          script,
          setState,
        })
        toast.success("Prefilled from demo call", {
          description:
            filledCount > 0
              ? `Pre-filled ${filledCount} variable${filledCount === 1 ? "" : "s"} from the prior demo session.`
              : "No overlapping fields to pre-fill.",
        })
        return
      }

      // mode === "doc"
      const url = docLink.trim()
      if (!url) {
        toast.error("Paste a Google Doc URL first.")
        return
      }
      const payload = await extractOnboardingFromDoc(url)
      const { filledCount } = prefillFromDocExtraction({
        payload,
        variables: ONBOARDING_VARIABLES,
        script,
        setState,
      })
      toast.success("Prefilled from Doc", {
        description:
          filledCount > 0
            ? `Extracted ${filledCount} variable${filledCount === 1 ? "" : "s"} from the Doc.`
            : "No extractable variables found. Fill manually.",
      })
    } catch (err) {
      toast.error("Prefill failed", {
        description: err instanceof Error ? err.message : "Unknown error.",
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <FieldGroup>
      <Field>
        <FieldLabel className="text-xs">
          <Sparkles className="h-3.5 w-3.5" />
          Pre-fill onboarding session
        </FieldLabel>
        <RadioGroup
          value={mode}
          onValueChange={(v) => setMode(v as Mode)}
          className="flex gap-4"
        >
          <div className="flex items-center gap-1.5">
            <RadioGroupItem value="firestore" id="prefill-firestore" />
            <Label htmlFor="prefill-firestore" className="text-xs font-normal">
              Firestore (email)
            </Label>
          </div>
          <div className="flex items-center gap-1.5">
            <RadioGroupItem value="doc" id="prefill-doc" />
            <Label htmlFor="prefill-doc" className="text-xs font-normal">
              Google Doc URL
            </Label>
          </div>
          <div className="flex items-center gap-1.5">
            <RadioGroupItem value="manual" id="prefill-manual" />
            <Label htmlFor="prefill-manual" className="text-xs font-normal">
              Manual
            </Label>
          </div>
        </RadioGroup>

        {mode === "firestore" && (
          <div className="flex gap-2 mt-2">
            <Input
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
        )}

        {mode === "doc" && (
          <div className="flex gap-2 mt-2">
            <Input
              type="url"
              placeholder="https://docs.google.com/document/d/..."
              value={docLink}
              onChange={(e) => setDocLink(e.target.value)}
              disabled={loading}
              className="h-8"
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleLoad}
              disabled={loading || !docLink.trim()}
            >
              {loading ? <Spinner className="h-4 w-4" /> : "Extract"}
            </Button>
          </div>
        )}

        {mode === "manual" && (
          <p className="text-xs text-muted-foreground mt-1">
            Type directly into the variables below. No prefill.
          </p>
        )}
      </Field>
    </FieldGroup>
  )
}
