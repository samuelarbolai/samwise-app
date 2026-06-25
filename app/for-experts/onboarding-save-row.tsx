"use client"

import { useState } from "react"
import { toast } from "sonner"
import { Save } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Checkbox } from "@/components/ui/checkbox"
import { Spinner } from "@/components/ui/spinner"
import { Label } from "@/components/ui/label"

import { saveOnboardingToFirestore } from "@/lib/copilot/save-onboarding"
import { saveOnboardingToDoc } from "@/lib/copilot/save-to-doc"
import { copyOnboardingNotes } from "@/lib/copilot/copy-to-clipboard"
import { clearSessionState, type SessionState } from "@/lib/copilot/session-storage"
import type { DemoCallVariable } from "./demo-call-config"

// Three-destination save for onboarding sessions. Checkbox semantics
// (NOT radio) — the clinician can save to all three at once. Each
// destination is independent; one failure doesn't abort the others.
//
//   - Firestore: writes onboardingSessions/{prospectKey}-{ts} via
//     extractOnboarding. Identical contract to demo's extractDemoCall
//     rep_state mode.
//   - Google Doc: appends markdown notes block to the Doc URL the
//     clinician pastes here at save time. The CF's service account
//     needs Editor permission on the supplied Doc.
//   - Clipboard: pure-client formatter; copies phase-grouped markdown
//     for paste-anywhere.

interface OnboardingSaveRowProps {
  state: SessionState
  variables: DemoCallVariable[]
}

export function OnboardingSaveRow({ state, variables }: OnboardingSaveRowProps) {
  const [saveFirestore, setSaveFirestore] = useState(true)
  const [saveDoc, setSaveDoc] = useState(false)
  const [saveClipboard, setSaveClipboard] = useState(false)
  const [docLink, setDocLink] = useState("")
  const [saving, setSaving] = useState(false)

  const handleSave = async () => {
    if (!saveFirestore && !saveDoc && !saveClipboard) {
      toast.error("Pick at least one save destination.")
      return
    }
    if (saveDoc && !docLink.trim()) {
      toast.error("Paste a Google Doc URL or uncheck Google Doc.")
      return
    }
    if (
      saveFirestore &&
      !state.cleaned.prospect_name &&
      !state.qualificationProspectKey
    ) {
      toast.error("Missing prospect_name", {
        description:
          "Firestore save needs a prospect_name or a prefilled prospectKey.",
      })
      return
    }

    setSaving(true)
    const variableOrder = variables.map((v) => v.name)
    const results: Array<{ ok: boolean; label: string; detail?: string }> = []

    // Fire all selected destinations in parallel. Per-destination errors
    // are caught so one failure doesn't abort the others.
    const jobs: Array<Promise<void>> = []

    if (saveFirestore) {
      jobs.push(
        (async () => {
          try {
            const { docId } = await saveOnboardingToFirestore({
              raw: state.raw,
              cleaned: state.cleaned,
              qualificationProspectKey: state.qualificationProspectKey,
            })
            results.push({ ok: true, label: "Firestore", detail: docId })
          } catch (err) {
            results.push({
              ok: false,
              label: "Firestore",
              detail: err instanceof Error ? err.message : "Unknown error",
            })
          }
        })(),
      )
    }

    if (saveDoc) {
      jobs.push(
        (async () => {
          try {
            const { docId } = await saveOnboardingToDoc({
              googleDocLink: docLink.trim(),
              cleaned: state.cleaned,
              variableOrder,
            })
            results.push({ ok: true, label: "Google Doc", detail: docId })
          } catch (err) {
            results.push({
              ok: false,
              label: "Google Doc",
              detail: err instanceof Error ? err.message : "Unknown error",
            })
          }
        })(),
      )
    }

    if (saveClipboard) {
      jobs.push(
        (async () => {
          try {
            await copyOnboardingNotes({ cleaned: state.cleaned, variables })
            results.push({ ok: true, label: "Clipboard" })
          } catch (err) {
            results.push({
              ok: false,
              label: "Clipboard",
              detail: err instanceof Error ? err.message : "Unknown error",
            })
          }
        })(),
      )
    }

    await Promise.all(jobs)
    setSaving(false)

    const succeeded = results.filter((r) => r.ok)
    const failed = results.filter((r) => !r.ok)
    for (const r of succeeded) {
      toast.success(`${r.label} saved${r.detail ? ` (${r.detail})` : ""}.`)
    }
    for (const r of failed) {
      toast.error(`${r.label} failed`, { description: r.detail })
    }

    // Clear session + reload only if at least the persistent destinations
    // succeeded. Clipboard alone is not persistent — don't clear after a
    // clipboard-only save.
    const persistentSucceeded = succeeded.some(
      (r) => r.label === "Firestore" || r.label === "Google Doc",
    )
    if (persistentSucceeded && failed.length === 0) {
      clearSessionState()
      window.location.href = "/for-experts"
    }
  }

  return (
    <div className="rounded-md border p-3 bg-card flex flex-col gap-3">
      <div className="text-sm font-medium flex items-center gap-1.5">
        <Save className="h-3.5 w-3.5" />
        Save onboarding session
      </div>

      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-2">
          <Checkbox
            id="save-firestore"
            checked={saveFirestore}
            onCheckedChange={(v) => setSaveFirestore(v === true)}
          />
          <Label htmlFor="save-firestore" className="text-xs font-normal">
            Firestore (onboardingSessions)
          </Label>
        </div>
        <div className="flex items-center gap-2">
          <Checkbox
            id="save-doc"
            checked={saveDoc}
            onCheckedChange={(v) => setSaveDoc(v === true)}
          />
          <Label htmlFor="save-doc" className="text-xs font-normal">
            Append to Google Doc
          </Label>
        </div>
        {saveDoc && (
          <Input
            type="url"
            placeholder="https://docs.google.com/document/d/..."
            value={docLink}
            onChange={(e) => setDocLink(e.target.value)}
            disabled={saving}
            className="h-8 ml-6"
          />
        )}
        <div className="flex items-center gap-2">
          <Checkbox
            id="save-clipboard"
            checked={saveClipboard}
            onCheckedChange={(v) => setSaveClipboard(v === true)}
          />
          <Label htmlFor="save-clipboard" className="text-xs font-normal">
            Copy to clipboard (markdown)
          </Label>
        </div>
      </div>

      <Button onClick={handleSave} disabled={saving} className="mt-1">
        {saving ? (
          <>
            <Spinner className="mr-2 h-4 w-4" />
            Saving…
          </>
        ) : (
          "Save onboarding"
        )}
      </Button>
    </div>
  )
}
