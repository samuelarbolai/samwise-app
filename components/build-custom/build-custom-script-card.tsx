"use client"

import { useEffect, useState } from "react"
import {
  FieldGroup,
  Field,
  FieldLabel,
  FieldDescription,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Button } from "@/components/ui/button"
import { Spinner } from "@/components/ui/spinner"
import { CustomScriptEditor } from "./custom-script-editor"

// Configure via NEXT_PUBLIC_SAMWISE_SYNTH_URL in samwise-app/.env.local
// (local dev) or in the Vercel project env (prod). When unset, the submit
// button shows a "synthesizer not configured" error and bails out.
const SYNTH_URL = process.env.NEXT_PUBLIC_SAMWISE_SYNTH_URL ?? ""
const LAST_SCRIPT_KEY = "custom-script:last-script-id"

interface ScriptListItem {
  scriptId: string
  frameworkName: string
  createdAt: number | null
  updatedAt: number | null
  contentPreview: string
}

export function BuildCustomScriptCard() {
  // Form state
  const [text, setText] = useState("")
  const [url, setUrl] = useState("")
  const [pdfBase64, setPdfBase64] = useState<string | null>(null)
  const [pdfName, setPdfName] = useState<string | null>(null)
  const [frameworkName, setFrameworkName] = useState("")
  const [therapistName, setTherapistName] = useState("")
  const [therapistEmail, setTherapistEmail] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Active script state
  const [scriptId, setScriptId] = useState<string | null>(null)
  const [therapistId, setTherapistId] = useState<string | null>(null)
  const [scriptContent, setScriptContent] = useState<string | null>(null)

  // Lookup-by-email panel state
  const [lookupEmail, setLookupEmail] = useState("")
  const [lookupResults, setLookupResults] = useState<ScriptListItem[] | null>(
    null
  )
  const [lookupLoading, setLookupLoading] = useState(false)
  const [lookupError, setLookupError] = useState<string | null>(null)

  // On mount: if we have a cached scriptId, fetch its content + populate.
  // The Firestore source-of-truth means stale cache is fine — refetch
  // always returns the latest.
  useEffect(() => {
    const cachedId = localStorage.getItem(LAST_SCRIPT_KEY)
    if (!cachedId) return
    fetch(`/api/build-custom/script/${cachedId}`)
      .then(async (r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`)
        return r.json() as Promise<{
          scriptId: string
          therapistId: string
          content: string
        }>
      })
      .then((j) => {
        setScriptId(j.scriptId)
        setTherapistId(j.therapistId)
        setScriptContent(j.content)
      })
      .catch(() => {
        // Cached id is gone or unreachable — silently drop it
        localStorage.removeItem(LAST_SCRIPT_KEY)
      })
  }, [])

  async function handlePdfChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]
    if (!f) {
      setPdfBase64(null)
      setPdfName(null)
      return
    }
    const buf = await f.arrayBuffer()
    const b64 = btoa(
      new Uint8Array(buf).reduce((s, b) => s + String.fromCharCode(b), "")
    )
    setPdfBase64(b64)
    setPdfName(f.name)
  }

  async function handleSubmit() {
    if (!SYNTH_URL) {
      setError(
        "Synthesizer not configured. Set NEXT_PUBLIC_SAMWISE_SYNTH_URL in samwise-app/.env.local (or in the Vercel env)."
      )
      return
    }
    setLoading(true)
    setError(null)
    try {
      const body: Record<string, unknown> = {
        therapistName: therapistName || undefined,
        therapistEmail: therapistEmail.trim(),
        frameworkName: frameworkName || undefined,
      }
      if (text.trim()) body.text = text.trim()
      if (url.trim()) body.url = url.trim()
      if (pdfBase64) body.pdfBase64 = pdfBase64
      const r = await fetch(SYNTH_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })
      if (!r.ok) {
        const errJson = await r.json().catch(() => ({}))
        throw new Error(errJson.error || `Synthesis failed: ${r.status}`)
      }
      const j = (await r.json()) as {
        therapistId: string
        scriptId: string
        content: string
      }
      setTherapistId(j.therapistId)
      setScriptId(j.scriptId)
      setScriptContent(j.content)
      localStorage.setItem(LAST_SCRIPT_KEY, j.scriptId)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unknown error")
    } finally {
      setLoading(false)
    }
  }

  async function handleLookup() {
    const email = lookupEmail.trim()
    if (!email) return
    setLookupLoading(true)
    setLookupError(null)
    setLookupResults(null)
    try {
      const r = await fetch(
        `/api/build-custom/therapist-scripts?email=${encodeURIComponent(email)}`
      )
      if (!r.ok) {
        const j = await r.json().catch(() => ({}))
        throw new Error(j.error || `HTTP ${r.status}`)
      }
      const j = (await r.json()) as {
        therapistId: string
        scripts: ScriptListItem[]
      }
      setLookupResults(j.scripts)
    } catch (e) {
      setLookupError(e instanceof Error ? e.message : "Unknown error")
    } finally {
      setLookupLoading(false)
    }
  }

  async function handleOpenScript(id: string) {
    setError(null)
    try {
      const r = await fetch(`/api/build-custom/script/${id}`)
      if (!r.ok) throw new Error(`HTTP ${r.status}`)
      const j = (await r.json()) as {
        scriptId: string
        therapistId: string
        content: string
      }
      setScriptId(j.scriptId)
      setTherapistId(j.therapistId)
      setScriptContent(j.content)
      localStorage.setItem(LAST_SCRIPT_KEY, j.scriptId)
      setLookupResults(null)
      setLookupEmail("")
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to open script")
    }
  }

  function handleClearActive() {
    localStorage.removeItem(LAST_SCRIPT_KEY)
    setScriptId(null)
    setTherapistId(null)
    setScriptContent(null)
  }

  function handleLoadInCopilot() {
    if (!scriptId) return
    // Handoff via localStorage — /for-experts page reads this on mount,
    // calls loadCustomScript, and mounts the loaded script into the
    // copilot surface. Cleared by the consumer.
    localStorage.setItem("copilot:pending-script-id", scriptId)
    window.location.href = "/for-experts"
  }

  // therapistEmail required (keys the therapists/{therapistId} Firestore
  // doc) + at least one framework-material source.
  const canSubmit =
    !loading &&
    therapistEmail.trim().length > 0 &&
    (text.trim().length > 0 || url.trim().length > 0 || !!pdfBase64)

  return (
    <div className="w-full max-w-2xl mx-auto p-6 py-12 space-y-10">
      <header>
        <h2 className="text-xl font-medium mb-1">
          Build a custom Samwise script
        </h2>
        <p className="text-sm text-muted-foreground">
          Adapt Samwise to a therapist&rsquo;s existing framework. Drop the
          framework material (PDF, URL, or pasted text); we synthesize a
          per-therapist Samwise script the therapist can review, edit, and
          load into the copilot.
        </p>
      </header>

      <section className="rounded-lg border bg-muted/30 p-5 space-y-4 text-sm">
        <div>
          <h3 className="text-base font-medium mb-1 text-foreground">
            What you&rsquo;re aiming for
          </h3>
          <p className="text-muted-foreground">
            Our mission is to help users achieve the behavioural change they
            desire. We believe this is primarily achieved through{" "}
            <strong className="text-foreground">rituals</strong> with a
            specific three-part structure: oratory, immediate elimination of
            enablers, and progressive disarming of triggers.
          </p>
        </div>

        <div>
          <h4 className="font-medium text-foreground mb-2">
            Every script we generate ends at the same Ritual
          </h4>
          <p className="text-muted-foreground mb-3">
            Whatever your framework, the daily Ritual the user performs has
            four mandatory components. The rest of the script — sessions,
            intake, exercises, vocabulary, pacing — is yours; we infer it from
            your framework material and propose it back.
          </p>
          <ol className="space-y-2 list-decimal list-inside text-muted-foreground">
            <li>
              <strong className="text-foreground">
                Desidentification Mantra
              </strong>{" "}
              <em className="text-xs">(oratory — declare war)</em>
              <br />
              Said aloud daily. Separates the user from the identification
              with the problem (&ldquo;I have X&rdquo;, never &ldquo;I am
              X&rdquo;). Names the antagonist concretely, declares
              adversarial intent, commits to persistence.
            </li>
            <li>
              <strong className="text-foreground">Hope Mantra</strong>{" "}
              <em className="text-xs">
                (oratory — surrender to a higher force)
              </em>
              <br />
              Said aloud daily. Invokes the user&rsquo;s own anchor
              (tradition, philosophy, principle, deity), acknowledges
              finitude, asks for help, surrenders the outcome.
            </li>
            <li>
              <strong className="text-foreground">
                Immediate Protection against Enablers
              </strong>{" "}
              <em className="text-xs">(concrete action — defense, right now)</em>
              <br />
              One pre-designed physical action per enabler, doable in under
              60 seconds when the impulse fires. Removes the condition that
              allows the impulse to succeed (not resists it).
            </li>
            <li>
              <strong className="text-foreground">
                Gradual Development of a New Belief
              </strong>{" "}
              <em className="text-xs">
                (daily practice — offense, over time)
              </em>
              <br />
              One small daily action calibrated to the user&rsquo;s tolerance
              window, producing observable evidence that, day by day,
              disarms the triggers.
            </li>
          </ol>
        </div>

        <div>
          <h4 className="font-medium text-foreground mb-2">
            Why this shape
          </h4>
          <p className="text-muted-foreground mb-2">
            Oratory splits into two mantras because combat energy and
            surrender energy are tonally opposed and chronologically
            sequenced — one mantra can&rsquo;t carry both. Action splits
            into two time horizons because behaviour happens on two scales:
            right now (need defense) and over time (need offense). One
            action can&rsquo;t serve both. Removing any of the four breaks
            the structure.
          </p>
          <p className="text-muted-foreground">
            Your framework provides the arrival path — how you take the user
            from first contact to ready-to-perform. The Ritual is the
            destination.
          </p>
        </div>
      </section>

      <FieldGroup>
        <Field>
          <FieldLabel>Framework name</FieldLabel>
          <FieldDescription>
            Optional. Shows up in the generated script title.
          </FieldDescription>
          <Input
            value={frameworkName}
            onChange={(e) => setFrameworkName(e.target.value)}
            placeholder="CPT, ITAA 12-steps, Brief Strategic Therapy, …"
          />
        </Field>

        <Field>
          <FieldLabel>Therapist name</FieldLabel>
          <Input
            value={therapistName}
            onChange={(e) => setTherapistName(e.target.value)}
            placeholder="Optional"
          />
        </Field>

        <Field>
          <FieldLabel>Therapist email (required)</FieldLabel>
          <FieldDescription>
            Required. Keys the therapist&rsquo;s record so they can return
            to edit this script later.
          </FieldDescription>
          <Input
            type="email"
            value={therapistEmail}
            onChange={(e) => setTherapistEmail(e.target.value)}
            placeholder="therapist@example.com"
            required
          />
        </Field>

        <div className="text-sm text-muted-foreground -mb-3">
          Framework material — provide any combination of the three. We
          concatenate whatever you give us. The more substantive the total,
          the better the synthesis (aim for ~500+ words combined).
        </div>

        <Field>
          <FieldLabel>Paste framework material</FieldLabel>
          <FieldDescription>
            Free-form text — manual excerpts, notes, your own description of
            the framework.
          </FieldDescription>
          <Textarea
            rows={8}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Paste the canonical text of the therapist&rsquo;s framework here…"
          />
        </Field>

        <Field>
          <FieldLabel>URL of framework material</FieldLabel>
          <FieldDescription>
            A public URL to the framework&rsquo;s canonical description
            (manual chapter, APA page, framework site). We fetch + extract
            the main content.
          </FieldDescription>
          <Input
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://…"
          />
        </Field>

        <Field>
          <FieldLabel>Upload PDF</FieldLabel>
          <FieldDescription>
            The framework&rsquo;s manual or chapter as a PDF.
          </FieldDescription>
          <Input
            type="file"
            accept="application/pdf"
            onChange={handlePdfChange}
          />
          {pdfBase64 && (
            <p className="text-xs text-muted-foreground mt-1">
              {pdfName} loaded ({Math.round(pdfBase64.length / 1024)} KB)
            </p>
          )}
        </Field>

        <Button onClick={handleSubmit} disabled={!canSubmit}>
          {loading ? (
            <>
              <Spinner className="mr-2" /> Synthesizing…
            </>
          ) : (
            "Build custom Samwise script"
          )}
        </Button>

        {error && (
          <p className="text-sm text-destructive">{error}</p>
        )}
        {!SYNTH_URL && (
          <p className="text-xs text-muted-foreground">
            Note: NEXT_PUBLIC_SAMWISE_SYNTH_URL is not set; submit will fail
            until it is configured.
          </p>
        )}
      </FieldGroup>

      {scriptId && scriptContent !== null && (
        <section className="border-t pt-8 space-y-4">
          <div className="flex items-baseline justify-between gap-4">
            <div>
              <h3 className="text-base font-medium">
                Your custom Samwise script
              </h3>
              <p className="text-xs text-muted-foreground mt-1">
                Therapist id <code>{therapistId}</code> · script id{" "}
                <code>{scriptId}</code>. Edits autosave to Firestore.
              </p>
            </div>
            <Button size="sm" variant="ghost" onClick={handleClearActive}>
              Close
            </Button>
          </div>
          <CustomScriptEditor
            key={scriptId}
            scriptId={scriptId}
            initialContent={scriptContent}
            onLoadInCopilot={handleLoadInCopilot}
          />
        </section>
      )}

      <section className="border-t pt-8 space-y-3">
        <h3 className="text-base font-medium">
          Find an existing script
        </h3>
        <p className="text-sm text-muted-foreground">
          Enter a therapist&rsquo;s email to find their previously generated
          custom Samwise scripts.
        </p>
        <FieldGroup>
          <Field>
            <Input
              type="email"
              value={lookupEmail}
              onChange={(e) => setLookupEmail(e.target.value)}
              placeholder="therapist@example.com"
            />
          </Field>
          <Button
            size="sm"
            variant="outline"
            onClick={handleLookup}
            disabled={!lookupEmail.trim() || lookupLoading}
          >
            {lookupLoading ? (
              <>
                <Spinner className="mr-2" /> Searching…
              </>
            ) : (
              "Find scripts"
            )}
          </Button>
        </FieldGroup>
        {lookupError && (
          <p className="text-sm text-destructive">{lookupError}</p>
        )}
        {lookupResults && lookupResults.length === 0 && (
          <p className="text-sm text-muted-foreground">
            No scripts found for that email.
          </p>
        )}
        {lookupResults && lookupResults.length > 0 && (
          <ul className="space-y-2">
            {lookupResults.map((s) => (
              <li
                key={s.scriptId}
                className="border rounded-md p-3 hover:bg-muted/30 cursor-pointer"
                onClick={() => handleOpenScript(s.scriptId)}
              >
                <div className="flex items-baseline justify-between">
                  <span className="font-medium text-sm">
                    {s.frameworkName}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {s.createdAt
                      ? new Date(s.createdAt).toLocaleString()
                      : "—"}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                  {s.contentPreview || "(empty)"}
                </p>
                <p className="text-[10px] text-muted-foreground mt-1 font-mono">
                  {s.scriptId}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
