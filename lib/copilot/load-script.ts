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
  scriptType: "demo" | "onboarding" | "call_design" | "unknown"
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
  phases: RawPhase[]
}

export async function loadCallScript(
  googleDocLink: string,
): Promise<LoadedScript> {
  const res = await fetch(LOAD_CALL_SCRIPT_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ googleDocLink }),
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
  return { scriptType: raw.scriptType, phases }
}
