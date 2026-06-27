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

// Phase C: paste the deployed synthesizeCustomScript function URL here.
// Until then, submit is disabled (no synthesis happens client-side).
const SYNTH_URL = ""
const LAST_DOC_KEY = "custom-script:last-doc"

type InputMode = "text" | "url" | "pdf"

export function BuildCustomScriptCard() {
  const [mode, setMode] = useState<InputMode>("text")
  const [text, setText] = useState("")
  const [url, setUrl] = useState("")
  const [pdfBase64, setPdfBase64] = useState<string | null>(null)
  const [frameworkName, setFrameworkName] = useState("")
  const [therapistName, setTherapistName] = useState("")
  const [therapistEmail, setTherapistEmail] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [resultUrl, setResultUrl] = useState<string | null>(null)
  const [hydrateUrl, setHydrateUrl] = useState("")

  useEffect(() => {
    const cached = localStorage.getItem(LAST_DOC_KEY)
    if (cached) setResultUrl(cached)
  }, [])

  async function handlePdfChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]
    if (!f) return
    const buf = await f.arrayBuffer()
    const b64 = btoa(
      new Uint8Array(buf).reduce((s, b) => s + String.fromCharCode(b), "")
    )
    setPdfBase64(b64)
  }

  async function handleSubmit() {
    if (!SYNTH_URL) {
      setError(
        "Synthesizer not deployed yet (Phase C). Submit will work once the cloud function is live."
      )
      return
    }
    setLoading(true)
    setError(null)
    try {
      const body: Record<string, unknown> = {
        inputMode: mode,
        therapistName: therapistName || undefined,
        therapistEmail: therapistEmail || undefined,
        frameworkName: frameworkName || undefined,
      }
      if (mode === "pdf") body.pdfBase64 = pdfBase64
      if (mode === "url") body.url = url
      if (mode === "text") body.text = text
      const r = await fetch(SYNTH_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })
      if (!r.ok) throw new Error(`Synthesis failed: ${r.status}`)
      const j = (await r.json()) as { documentUrl: string }
      setResultUrl(j.documentUrl)
      localStorage.setItem(LAST_DOC_KEY, j.documentUrl)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unknown error")
    } finally {
      setLoading(false)
    }
  }

  function handleHydrate() {
    if (!hydrateUrl.trim()) return
    localStorage.setItem(LAST_DOC_KEY, hydrateUrl.trim())
    setResultUrl(hydrateUrl.trim())
    setHydrateUrl("")
  }

  function handleClearResult() {
    localStorage.removeItem(LAST_DOC_KEY)
    setResultUrl(null)
  }

  function handleLoadInCopilot() {
    if (!resultUrl) return
    // Paste the Doc URL into the copilot URL gate via a localStorage handoff
    // (the copilot reads this on switch). Simpler than lifting setView.
    localStorage.setItem("copilot:pending-load-url", resultUrl)
    window.location.href = "/for-experts"
  }

  const canSubmit =
    !loading &&
    ((mode === "text" && text.trim().length > 200) ||
      (mode === "url" && url.trim().length > 0) ||
      (mode === "pdf" && pdfBase64))

  return (
    <div className="w-full max-w-2xl mx-auto p-6 py-12 space-y-10">
      <header>
        <h2 className="text-xl font-medium mb-1">
          Build a custom Samwise script
        </h2>
        <p className="text-sm text-muted-foreground">
          Adapt Samwise to a therapist&rsquo;s existing framework. Drop the
          framework material (PDF, URL, or pasted text); we synthesize a
          per-therapist Samwise script Google Doc the therapist can review and
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
            Optional. Shows up in the generated Doc&rsquo;s title.
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
          <FieldLabel>Therapist email</FieldLabel>
          <FieldDescription>
            Optional. If provided, the generated Doc is Editor-shared with
            this email so the therapist can edit directly.
          </FieldDescription>
          <Input
            type="email"
            value={therapistEmail}
            onChange={(e) => setTherapistEmail(e.target.value)}
            placeholder="therapist@example.com"
          />
        </Field>

        <Field>
          <FieldLabel>Input mode</FieldLabel>
          <div className="flex gap-4 pt-1">
            {(["text", "url", "pdf"] as InputMode[]).map((m) => (
              <label
                key={m}
                className="flex items-center gap-2 text-sm cursor-pointer"
              >
                <input
                  type="radio"
                  name="input-mode"
                  checked={mode === m}
                  onChange={() => setMode(m)}
                />
                {m.toUpperCase()}
              </label>
            ))}
          </div>
        </Field>

        {mode === "text" && (
          <Field>
            <FieldLabel>Paste framework material</FieldLabel>
            <FieldDescription>
              The more substantive the material, the better the synthesis.
              Aim for ~500+ words.
            </FieldDescription>
            <Textarea
              rows={10}
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Paste the canonical text of the therapist&rsquo;s framework here…"
            />
          </Field>
        )}

        {mode === "url" && (
          <Field>
            <FieldLabel>URL of framework material</FieldLabel>
            <FieldDescription>
              A public URL to the framework&rsquo;s canonical description
              (manual chapter, APA page, framework site).
            </FieldDescription>
            <Input
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://…"
            />
          </Field>
        )}

        {mode === "pdf" && (
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
                PDF loaded ({Math.round(pdfBase64.length / 1024)} KB)
              </p>
            )}
          </Field>
        )}

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
            Note: the synthesizer cloud function is not yet deployed (Phase C).
            Submit will be wired once it is live.
          </p>
        )}
      </FieldGroup>

      {resultUrl && (
        <section className="border-t pt-8">
          <h3 className="text-base font-medium mb-2">
            Your custom Samwise script
          </h3>
          <p className="text-sm text-muted-foreground mb-3">
            The Doc URL is cached locally, so this stays here on refresh. Open
            it in Google Docs to edit, or load it into the Copilot to walk
            through a call with it.
          </p>
          <a
            href={resultUrl}
            target="_blank"
            rel="noreferrer"
            className="text-primary underline text-sm break-all block mb-4"
          >
            {resultUrl}
          </a>
          <div className="flex gap-2 flex-wrap">
            <Button size="sm" variant="default" onClick={handleLoadInCopilot}>
              Load in Copilot to test
            </Button>
            <Button
              size="sm"
              variant="outline"
              asChild
            >
              <a href={resultUrl} target="_blank" rel="noreferrer">
                Open in Google Docs
              </a>
            </Button>
            <Button size="sm" variant="ghost" onClick={handleClearResult}>
              Clear
            </Button>
          </div>
        </section>
      )}

      <section className="border-t pt-8">
        <h3 className="text-base font-medium mb-2">
          Continue from an existing Doc
        </h3>
        <p className="text-sm text-muted-foreground mb-3">
          Paste a previously generated custom Samwise Doc URL to re-hydrate it
          here. Useful when returning to a script built in a prior session.
        </p>
        <FieldGroup>
          <Field>
            <Input
              value={hydrateUrl}
              onChange={(e) => setHydrateUrl(e.target.value)}
              placeholder="https://docs.google.com/document/d/…"
            />
          </Field>
          <Button
            size="sm"
            variant="outline"
            onClick={handleHydrate}
            disabled={!hydrateUrl.trim()}
          >
            Load
          </Button>
        </FieldGroup>
      </section>
    </div>
  )
}
