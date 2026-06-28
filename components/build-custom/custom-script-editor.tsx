"use client"

import { useEffect, useRef, useState } from "react"
import { EditorState } from "@codemirror/state"
import { EditorView, keymap, lineNumbers, highlightActiveLine } from "@codemirror/view"
import { defaultKeymap, history, historyKeymap } from "@codemirror/commands"
import {
  Decoration,
  type DecorationSet,
  MatchDecorator,
  ViewPlugin,
  type ViewUpdate,
} from "@codemirror/view"
import { Button } from "@/components/ui/button"

const AUTOSAVE_DEBOUNCE_MS = 1500

/**
 * Highlights Samwise marker syntax: [SAY] / [/SAY], {{variable}}, phase
 * headers, [CONDITION:...]/[/CONDITION], [AUTHOR:...], [END], [TYPE:...],
 * [VERSION:...]. Pure visual aid — does not modify the source text.
 */
function markerHighlighter() {
  const decos: Array<{ re: RegExp; cls: string }> = [
    { re: /\[\/?SAY\]/g, cls: "cm-marker-say" },
    { re: /\[\/?CONDITION(?::[^\]]*)?\]/g, cls: "cm-marker-condition" },
    { re: /\[AUTHOR:[^\]]*\]/g, cls: "cm-marker-author" },
    { re: /\[TYPE:[^\]]*\]/g, cls: "cm-marker-type" },
    { re: /\[VERSION:[^\]]*\]/g, cls: "cm-marker-type" },
    { re: /\[END\]/g, cls: "cm-marker-end" },
    { re: /\{\{[a-z_][a-z0-9_]*\}\}/g, cls: "cm-marker-variable" },
    { re: /^(?:#{1,6}\s.*|Phase\s+[\w.-]+\s+[—–-]\s.*)$/gm, cls: "cm-marker-phase" },
  ]
  const matchers = decos.map(
    ({ re, cls }) =>
      new MatchDecorator({
        regexp: re,
        decoration: Decoration.mark({ class: cls }),
      })
  )
  return ViewPlugin.fromClass(
    class {
      decos: DecorationSet
      constructor(view: EditorView) {
        this.decos = this.build(view)
      }
      update(u: ViewUpdate) {
        if (u.docChanged || u.viewportChanged) {
          this.decos = this.build(u.view)
        }
      }
      build(view: EditorView): DecorationSet {
        const ranges: Array<{ from: number; to: number; deco: Decoration }> = []
        for (const m of matchers) {
          const set = m.createDeco(view)
          const cursor = set.iter()
          while (cursor.value) {
            ranges.push({ from: cursor.from, to: cursor.to, deco: cursor.value })
            cursor.next()
          }
        }
        ranges.sort((a, b) => a.from - b.from || a.to - b.to)
        return Decoration.set(
          ranges.map((r) => r.deco.range(r.from, r.to)),
          true
        )
      }
    },
    { decorations: (v) => v.decos }
  )
}

const editorTheme = EditorView.theme({
  "&": {
    fontSize: "13px",
    fontFamily:
      "ui-monospace, SFMono-Regular, 'SF Mono', Menlo, Monaco, 'Cascadia Mono', 'Roboto Mono', Consolas, 'Courier New', monospace",
    height: "100%",
  },
  ".cm-scroller": { lineHeight: "1.6" },
  ".cm-content": { padding: "12px 0" },
  ".cm-marker-say": { color: "#b45309", fontWeight: "700" },
  ".cm-marker-variable": {
    color: "#1d4ed8",
    backgroundColor: "#dbeafe",
    borderRadius: "2px",
    padding: "0 2px",
  },
  ".cm-marker-condition": { color: "#7c3aed", fontWeight: "600" },
  ".cm-marker-author": { color: "#059669", fontStyle: "italic" },
  ".cm-marker-type": { color: "#6b7280", fontStyle: "italic" },
  ".cm-marker-end": { color: "#dc2626", fontWeight: "700" },
  ".cm-marker-phase": { color: "#0f172a", fontWeight: "700" },
})

type SaveState = "clean" | "saving" | "saved" | "error"

export function CustomScriptEditor({
  scriptId,
  initialContent,
  onClose,
  onLoadInCopilot,
}: {
  scriptId: string
  initialContent: string
  onClose?: () => void
  onLoadInCopilot?: () => void
}) {
  const hostRef = useRef<HTMLDivElement | null>(null)
  const viewRef = useRef<EditorView | null>(null)
  const [saveState, setSaveState] = useState<SaveState>("clean")
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const latestContent = useRef(initialContent)

  async function save(content: string) {
    setSaveState("saving")
    setErrorMsg(null)
    try {
      const r = await fetch(`/api/build-custom/script/${scriptId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content }),
      })
      if (!r.ok) {
        const j = await r.json().catch(() => ({}))
        throw new Error(j.error || `HTTP ${r.status}`)
      }
      setSaveState("saved")
    } catch (e) {
      setSaveState("error")
      setErrorMsg(e instanceof Error ? e.message : "Save failed")
    }
  }

  useEffect(() => {
    if (!hostRef.current) return
    const view = new EditorView({
      state: EditorState.create({
        doc: initialContent,
        extensions: [
          history(),
          lineNumbers(),
          highlightActiveLine(),
          keymap.of([...defaultKeymap, ...historyKeymap]),
          EditorView.lineWrapping,
          markerHighlighter(),
          editorTheme,
          EditorView.updateListener.of((u) => {
            if (!u.docChanged) return
            const content = u.state.doc.toString()
            latestContent.current = content
            setSaveState("clean")
            if (debounceTimer.current) clearTimeout(debounceTimer.current)
            debounceTimer.current = setTimeout(
              () => save(content),
              AUTOSAVE_DEBOUNCE_MS
            )
          }),
        ],
      }),
      parent: hostRef.current,
    })
    viewRef.current = view
    return () => {
      if (debounceTimer.current) clearTimeout(debounceTimer.current)
      view.destroy()
      viewRef.current = null
    }
    // initialContent intentionally not in deps: changes are handled
    // by remounting via key= from the parent.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scriptId])

  function handleSaveNow() {
    if (debounceTimer.current) clearTimeout(debounceTimer.current)
    save(latestContent.current)
  }

  const statusLabel = (() => {
    switch (saveState) {
      case "saving":
        return "Saving…"
      case "saved":
        return "All changes saved"
      case "error":
        return `Save failed: ${errorMsg ?? "unknown"}`
      case "clean":
      default:
        return "Edits autosave 1.5s after you stop typing"
    }
  })()

  return (
    <div className="flex flex-col h-[600px] border rounded-md overflow-hidden">
      <div className="flex items-center justify-between px-3 py-2 border-b bg-muted/40 text-xs">
        <span
          className={
            saveState === "error"
              ? "text-destructive"
              : saveState === "saved"
                ? "text-green-700"
                : "text-muted-foreground"
          }
        >
          {statusLabel}
        </span>
        <div className="flex gap-2">
          <Button size="sm" variant="ghost" onClick={handleSaveNow}>
            Save now
          </Button>
          {onLoadInCopilot && (
            <Button size="sm" variant="outline" onClick={onLoadInCopilot}>
              Load in Copilot to test
            </Button>
          )}
          {onClose && (
            <Button size="sm" variant="ghost" onClick={onClose}>
              Close
            </Button>
          )}
        </div>
      </div>
      <div ref={hostRef} className="flex-1 overflow-auto" />
    </div>
  )
}
