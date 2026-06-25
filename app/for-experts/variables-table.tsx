"use client"

import { useEffect, useMemo } from "react"
import { toast } from "sonner"

import {
  DemoCallVariable,
  DemoCallPhase,
} from "./demo-call-config"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Button } from "@/components/ui/button"
import { Spinner } from "@/components/ui/spinner"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  type SessionState,
  type SuggestionEntry,
  saveSessionState,
  clearSessionState,
} from "@/lib/copilot/session-storage"
import { cleanVariableDebounced } from "@/lib/copilot/clean-variable"
import { appendDemoCallRow } from "@/lib/copilot/append-row"
import {
  firePreGeneration,
  generateSuggestionFor,
  type SuggestionUpdater,
} from "@/lib/copilot/suggest-rep-line"
import type { LoadedScript } from "@/lib/copilot/load-script"

interface VariablesTableProps {
  variables: DemoCallVariable[]
  state: SessionState
  setState: React.Dispatch<React.SetStateAction<SessionState | null>>
  docUrl: string
  script: LoadedScript
  /** When provided, REPLACES the default "Save call" button at the
   * bottom of the variables pane. Onboarding mode passes
   * <OnboardingSaveRow /> here to get the three-destination save UI.
   * The default demo Save button keeps the existing demoCalls write
   * path. */
  saveOverride?: React.ReactNode
}

function groupByPhase(vars: DemoCallVariable[]) {
  const groups = new Map<DemoCallPhase, DemoCallVariable[]>()
  for (const v of vars) {
    if (!groups.has(v.phase)) groups.set(v.phase, [])
    groups.get(v.phase)!.push(v)
  }
  return Array.from(groups.entries())
}

export function VariablesTable({
  variables,
  state,
  setState,
  docUrl,
  script,
  saveOverride,
}: VariablesTableProps) {
  const groups = useMemo(() => groupByPhase(variables), [variables])

  // Autosave on every state change.
  useEffect(() => {
    saveSessionState({ docUrl, script, state })
  }, [state, docUrl, script])

  // Suggestion state updater — used by both pre-generation trigger fires
  // and manual "Sugerir/Regenerar" button clicks. Closes over setState.
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

  const setRaw = (name: string, raw: string) => {
    setState(
      (prev) => prev && { ...prev, raw: { ...prev.raw, [name]: raw } },
    )
    const v = variables.find((x) => x.name === name)!
    if (!v.cleanable) {
      // No LLM call — cleaned form == raw form.
      setState(
        (prev) =>
          prev && { ...prev, cleaned: { ...prev.cleaned, [name]: raw } },
      )
      // Trigger any suggestion that depends on THIS variable's capture.
      // For non-cleanable vars, fire immediately on raw set.
      if (raw && raw.trim()) {
        // Snapshot the latest state (the setState above is async; we
        // use the value we just computed as the trigger context).
        const stateForTrigger = {
          ...state,
          raw: { ...state.raw, [name]: raw },
          cleaned: { ...state.cleaned, [name]: raw },
        }
        firePreGeneration(name, variables, stateForTrigger, updateSuggestion)
      }
      return
    }
    setState(
      (prev) =>
        prev && { ...prev, cleaning: { ...prev.cleaning, [name]: true } },
    )
    // Build cross-variable context for disambiguation: every OTHER
    // variable's cleaned form (or its raw if cleaning hasn't run yet),
    // so the cleaner can resolve word-sense ambiguity using what's
    // already known about this prospect.
    const otherVars: Record<string, string> = {}
    for (const x of variables) {
      if (x.name === name) continue
      const cleanedVal = state.cleaned[x.name]
      const rawVal = state.raw[x.name]
      const val = (cleanedVal && cleanedVal.trim()) || (rawVal && rawVal.trim()) || ""
      if (val) otherVars[x.name] = val
    }
    cleanVariableDebounced(v, raw, script, otherVars, (cleaned) => {
      setState(
        (prev) =>
          prev && {
            ...prev,
            cleaned: { ...prev.cleaned, [name]: cleaned },
            cleaning: { ...prev.cleaning, [name]: false },
          },
      )
      // Cleaning completed — NOW fire any downstream suggestion that
      // depends on this variable's capture. Using the cleaned value as
      // input means suggestions get the highest-fidelity context.
      const stateForTrigger = {
        ...state,
        raw: { ...state.raw, [name]: raw },
        cleaned: { ...state.cleaned, [name]: cleaned },
      }
      firePreGeneration(name, variables, stateForTrigger, updateSuggestion)
    })
  }

  const setCleanedManual = (name: string, value: string) => {
    setState(
      (prev) =>
        prev && { ...prev, cleaned: { ...prev.cleaned, [name]: value } },
    )
  }

  const handleSave = async () => {
    if (!state.cleaned.prospect_name && !state.qualificationProspectKey) {
      toast.error("Missing prospect_name", {
        description: "Cannot save without prospect_name or a loaded qualification.",
      })
      return
    }
    try {
      const { docId } = await appendDemoCallRow({
        raw: state.raw,
        cleaned: state.cleaned,
        qualificationProspectKey: state.qualificationProspectKey,
      })
      toast.success(`Saved (doc ${docId}).`)
      clearSessionState()
      window.location.href = "/for-experts"
    } catch (err) {
      toast.error("Save failed", {
        description: err instanceof Error ? err.message : "Unknown error.",
      })
    }
  }

  const handleReset = () => {
    if (
      !confirm(
        "Clear this session and load a different script? Unsaved variables will be lost.",
      )
    )
      return
    clearSessionState()
    window.location.href = "/for-experts"
  }

  return (
    <div className="flex flex-col gap-6 p-4">
      <div className="flex items-center justify-between gap-2 pb-2 border-b">
        <p className="text-xs text-muted-foreground truncate">
          Script loaded ·{" "}
          <a
            href={docUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="underline"
          >
            open Doc
          </a>
        </p>
        <Button variant="ghost" size="sm" onClick={handleReset}>
          Load different script
        </Button>
      </div>
      {groups.map(([phase, vars]) => (
        <section
          key={String(phase)}
          id={`vars-phase-${String(phase)}`}
          className="scroll-mt-4"
        >
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground mb-3">
            {typeof phase === "number" ? `Phase ${phase}` : phase}
          </h2>
          <div className="flex flex-col gap-4">
            {vars.map((v) => (
              <VariableRow
                key={v.name}
                variable={v}
                rawValue={state.raw[v.name] ?? ""}
                cleanedValue={state.cleaned[v.name] ?? ""}
                isCleaning={!!state.cleaning[v.name]}
                suggestion={state.suggestions?.[v.name]}
                onRawChange={(val) => setRaw(v.name, val)}
                onCleanedChange={(val) => setCleanedManual(v.name, val)}
                onGenerateSuggestion={() =>
                  generateSuggestionFor(v, state, updateSuggestion)
                }
              />
            ))}
          </div>
        </section>
      ))}
      {saveOverride ?? (
        <Button onClick={handleSave} className="mt-4">
          Save call
        </Button>
      )}
    </div>
  )
}

interface VariableRowProps {
  variable: DemoCallVariable
  rawValue: string
  cleanedValue: string
  isCleaning: boolean
  suggestion?: SuggestionEntry
  onRawChange: (v: string) => void
  onCleanedChange: (v: string) => void
  onGenerateSuggestion: () => void
}

function VariableRow({
  variable,
  rawValue,
  cleanedValue,
  isCleaning,
  suggestion,
  onRawChange,
  onCleanedChange,
  onGenerateSuggestion,
}: VariableRowProps) {
  const v = variable
  return (
    <div className="rounded-md border p-3 bg-card">
      <div className="flex items-center justify-between mb-2">
        <label className="text-sm font-medium">{v.label}</label>
        {v.verbatim && (
          <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
            verbatim
          </span>
        )}
      </div>
      <p className="text-xs text-muted-foreground mb-2">{v.meaning}</p>

      {/* Suggestion panel — renders only if the variable has a
          suggestTechnique. Goes ABOVE the raw input so the rep reads
          the suggested SAY line before/while capturing the prospect's
          response. */}
      {v.suggestTechnique && (
        <SuggestionPanel
          entry={suggestion}
          onGenerate={onGenerateSuggestion}
        />
      )}

      {/* Skip raw/cleaned inputs entirely for rep-helper-only variables
          (e.g. Phase 1.5 worldview_confirmation_line — there's no
          prospect-side data to capture here, just a line the rep
          reads). */}
      {!v.repHelperOnly && (
        <>
          {v.inputKind === "select" ? (
            <Select value={rawValue} onValueChange={onRawChange}>
              <SelectTrigger>
                <SelectValue placeholder="Select…" />
              </SelectTrigger>
              <SelectContent>
                {v.options!.map((opt) => (
                  <SelectItem key={opt} value={opt}>
                    {opt}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : v.inputKind === "textarea" ? (
            <Textarea
              value={rawValue}
              onChange={(e) => onRawChange(e.target.value)}
              rows={3}
              placeholder="Raw note (type freely; will be cleaned)…"
            />
          ) : (
            <Input
              type={
                v.inputKind === "number"
                  ? "number"
                  : v.inputKind === "date"
                    ? "date"
                    : "text"
              }
              value={rawValue}
              onChange={(e) => onRawChange(e.target.value)}
              placeholder="Raw note…"
            />
          )}

          {v.cleanable && (
            <div className="mt-2 flex items-center gap-2 text-xs">
              <span className="text-muted-foreground min-w-[60px]">
                Cleaned:
              </span>
              {isCleaning ? (
                <span className="flex items-center gap-1 text-muted-foreground">
                  <Spinner className="h-3 w-3" /> cleaning…
                </span>
              ) : (
                <input
                  className="flex-1 bg-transparent border-b border-dashed border-muted-foreground/30 focus:outline-none focus:border-primary"
                  value={cleanedValue}
                  onChange={(e) => onCleanedChange(e.target.value)}
                  placeholder={rawValue ? "(awaiting cleaning…)" : ""}
                />
              )}
            </div>
          )}
        </>
      )}
    </div>
  )
}

interface SuggestionPanelProps {
  entry: SuggestionEntry | undefined
  onGenerate: () => void
}

/**
 * Renders the LLM-generated SAY line for variables with a
 * suggestTechnique. Three states:
 *  - generating: spinner + "Generando..."
 *  - line present: italic line in a tinted card + ↻ regenerate button
 *  - no line yet (or empty): "💡 Sugerir línea" button (+ inline error
 *    if the last attempt failed)
 *
 * The suggestion is meant to be READ ALOUD by the rep, possibly with
 * small adaptations to their register — it's a suggested SAY line, not
 * data to type into the variable.
 */
function SuggestionPanel({ entry, onGenerate }: SuggestionPanelProps) {
  const e = entry ?? { line: "", generating: false }
  const hasLine = !!e.line && !!e.line.trim()

  if (e.generating) {
    return (
      <div className="mb-3 rounded-md border border-dashed bg-muted/30 p-2.5 text-xs text-muted-foreground flex items-center gap-2">
        <Spinner className="h-3 w-3" />
        Generando línea sugerida…
      </div>
    )
  }

  if (hasLine) {
    return (
      <div className="mb-3 rounded-md border border-amber-200 bg-amber-50/50 dark:border-amber-900/50 dark:bg-amber-950/20 p-2.5">
        <div className="flex items-start justify-between gap-2">
          <p className="text-xs italic flex-1 leading-relaxed">
            <span className="not-italic mr-1">💡</span>
            {e.line}
          </p>
          <button
            type="button"
            onClick={onGenerate}
            className="text-[10px] uppercase tracking-wide text-muted-foreground hover:text-foreground shrink-0"
            title="Generar otra sugerencia"
          >
            ↻
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="mb-3 flex items-center gap-2">
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={onGenerate}
        className="h-7 text-xs"
      >
        💡 Sugerir línea
      </Button>
      {e.error && (
        <span className="text-[11px] text-red-600 dark:text-red-400">
          {e.error}
        </span>
      )}
    </div>
  )
}
