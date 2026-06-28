// Client wrapper for the loadCallScript cloud function.
// Cross-origin call — CORS must be enabled on the cloud function side.

export type ScriptBlockKind = "say" | "note"

export interface ScriptBlock {
  kind: ScriptBlockKind
  text: string
}

export interface LoadedPhase {
  number: "pre-call" | "post-call" | number
  title: string
  blocks: ScriptBlock[]
}

export interface LoadedScript {
  scriptType: "demo" | "onboarding" | "call_design" | "custom" | "unknown"
  version?: string
  phases: LoadedPhase[]
}

// Update this constant after the first deploy if Firebase assigns a
// different hash. The other endpoints in app/page.tsx do the same.
export const LOAD_CALL_SCRIPT_URL =
  "https://loadcallscript-b6fhjlgejq-uc.a.run.app"

// Raw shape from the cloud function. Older deployments return
// { number, title, text }; newer ones return { number, title, blocks }.
// We normalize to the new shape before handing off to the renderer.
interface RawPhase {
  number: "pre-call" | "post-call" | number
  title: string
  blocks?: ScriptBlock[]
  text?: string
}

interface RawLoadedScript {
  scriptType: LoadedScript["scriptType"]
  version?: string
  phases: RawPhase[]
}

export async function loadCallScript(
  googleDocLink: string,
): Promise<LoadedScript> {
  return loadCallScriptFromBody({ googleDocLink })
}

/**
 * Load a therapist-built custom script from Firestore via the same
 * loadCallScript cloud function (extended 2026-06-28 to accept
 * customScriptId as an alternative to googleDocLink).
 */
export async function loadCustomScript(
  customScriptId: string,
): Promise<LoadedScript> {
  return loadCallScriptFromBody({ customScriptId })
}

async function loadCallScriptFromBody(
  body: { googleDocLink: string } | { customScriptId: string },
): Promise<LoadedScript> {
  // NEVER cache the script — it must always reflect the live source
  // (Doc or Firestore). Defeat every HTTP-cache layer at once.
  const bustUrl = `${LOAD_CALL_SCRIPT_URL}?_cb=${Date.now()}-${Math.round(
    Math.random() * 1e9,
  )}`
  const res = await fetch(bustUrl, {
    method: "POST",
    cache: "no-store",
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-cache",
      Pragma: "no-cache",
    },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error || `loadCallScript failed (${res.status})`)
  }
  const raw = (await res.json()) as RawLoadedScript
  const phases: LoadedPhase[] = (raw.phases ?? []).map((p) => {
    if (Array.isArray(p.blocks) && p.blocks.length > 0) {
      return { number: p.number, title: p.title, blocks: p.blocks }
    }
    // Back-compat: render legacy { text } as one big spoken block so
    // the rep at least sees something while the backend redeploys.
    if (typeof p.text === "string" && p.text.trim()) {
      return {
        number: p.number,
        title: p.title,
        blocks: [{ kind: "say", text: p.text }],
      }
    }
    return { number: p.number, title: p.title, blocks: [] }
  })
  return { scriptType: raw.scriptType, version: raw.version, phases }
}
