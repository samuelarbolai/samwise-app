import type {
  DemoCallVariable,
} from "@/app/copilot/demo-call-config"
import type { LoadedScript } from "./load-script"

export const CLEAN_VARIABLE_URL =
  "https://cleanvariable-b6fhjlgejq-uc.a.run.app"

interface CleanRequest {
  name: string
  rawValue: string
  frameworkSemantics?: string
  scriptContexts: string[]
  // Other captured variables for cross-context disambiguation. The
  // cleaner uses these to resolve ambiguity in the rep's raw note but
  // does NOT pull content into the output for this variable.
  otherVariables?: Record<string, string>
}

interface CleanResponse {
  cleaned: string
}

const DEBOUNCE_MS = 1500
const MAX_CONTEXTS = 6
const CONTEXT_RADIUS = 140

// In-flight + result cache, both keyed by `${name}::${rawValue}`.
// Cache is module-scoped (per browser tab). A page reload clears it,
// which is what we want when the user switches scripts.
const inFlight = new Map<string, AbortController>()
const resultCache = new Map<string, string>()
const debouncers = new Map<string, ReturnType<typeof setTimeout>>()

/**
 * Walk the loaded script and extract every spoken-block snippet where
 * the named variable appears, with ~CONTEXT_RADIUS chars of surrounding
 * text on each side. Used to give the cleaner the grammatical/voice
 * context it needs to produce a script-ready substitution.
 *
 * Only `say` blocks contribute contexts — `note` blocks (capture
 * instructions, ☞ guidance) aren't read aloud, so substitutions there
 * don't need to match a spoken voice.
 */
export function extractScriptContexts(
  script: LoadedScript,
  varName: string,
): string[] {
  const contexts: string[] = []
  const seen = new Set<string>()
  for (const phase of script.phases) {
    // Fallback for legacy { text } shape — treat the whole phase text
    // as one say block if blocks is missing/empty.
    const legacyText = (phase as unknown as { text?: string }).text
    const blocks =
      phase.blocks && phase.blocks.length > 0
        ? phase.blocks
        : legacyText
          ? [{ kind: "say" as const, text: legacyText }]
          : []
    for (const block of blocks) {
      if (block.kind !== "say") continue
      const text = block.text
      const pattern = new RegExp(`\\{\\{${varName}\\}\\}`, "g")
      let m: RegExpExecArray | null
      while ((m = pattern.exec(text)) !== null) {
        const start = Math.max(0, m.index - CONTEXT_RADIUS)
        const end = Math.min(
          text.length,
          m.index + m[0].length + CONTEXT_RADIUS,
        )
        let snippet = text.slice(start, end).trim()
        if (start > 0) snippet = "…" + snippet
        if (end < text.length) snippet = snippet + "…"
        if (!seen.has(snippet)) {
          seen.add(snippet)
          contexts.push(snippet)
        }
        if (contexts.length >= MAX_CONTEXTS) return contexts
      }
    }
  }
  return contexts
}

export function cleanVariableDebounced(
  variable: DemoCallVariable,
  rawValue: string,
  script: LoadedScript,
  otherVariables: Record<string, string>,
  onResult: (cleaned: string) => void,
) {
  // Include otherVariables (filtered to non-empty) in the cache key so a
  // change in context invalidates a stale cleaning. Without this, a
  // cell that was cleaned early in the call would keep its first
  // cleaning even after surrounding context filled in.
  const ctxKey = Object.entries(otherVariables ?? {})
    .filter(([k, v]) => k !== variable.name && typeof v === "string" && v.trim())
    .map(([k, v]) => `${k}=${v}`)
    .sort()
    .join("|")
  const key = `${variable.name}::${rawValue}::${ctxKey}`

  const cached = resultCache.get(key)
  if (cached !== undefined) {
    onResult(cached)
    return
  }

  // When the rep hasn't typed anything for a cleanable variable AND
  // the prefill didn't fill it either, emit an explicit placeholder so
  // the rep can SEE the gap in the substituted script ("Has trabajado
  // en Not filled by user") instead of an invisible blank that reads
  // as broken grammar. The rep types over the placeholder when they
  // capture the value live.
  if (!rawValue.trim()) {
    const placeholder = "Not filled by user"
    resultCache.set(key, placeholder)
    onResult(placeholder)
    return
  }

  const existingTimer = debouncers.get(variable.name)
  if (existingTimer) clearTimeout(existingTimer)

  const existingReq = inFlight.get(variable.name)
  if (existingReq) existingReq.abort()

  const scriptContexts = extractScriptContexts(script, variable.name)

  const timer = setTimeout(async () => {
    const controller = new AbortController()
    inFlight.set(variable.name, controller)
    try {
      const res = await fetch(CLEAN_VARIABLE_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: variable.name,
          rawValue,
          frameworkSemantics: variable.frameworkSemantics,
          scriptContexts,
          otherVariables,
        } satisfies CleanRequest),
        signal: controller.signal,
      })
      if (!res.ok) throw new Error(`cleanVariable ${res.status}`)
      const data = (await res.json()) as CleanResponse
      resultCache.set(key, data.cleaned)
      onResult(data.cleaned)
    } catch (err) {
      if ((err as Error).name !== "AbortError") {
        resultCache.set(key, rawValue)
        onResult(rawValue)
      }
    } finally {
      inFlight.delete(variable.name)
      debouncers.delete(variable.name)
    }
  }, DEBOUNCE_MS)

  debouncers.set(variable.name, timer)
}
