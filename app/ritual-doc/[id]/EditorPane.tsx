'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useEditor, EditorContent, type JSONContent, type Editor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import type { TabKey } from '@/lib/ritual-doc/schema';
import { filterVisible, mergeBack } from '@/lib/ritual-doc/visible-h2s';
import { SaveStatus, type SaveState } from './SaveStatus';

const AUTOSAVE_DEBOUNCE_MS = 800;

export function EditorPane({
  docId,
  tab,
  initialContent,
  visibleH2s,
  onEditorReady,
}: {
  docId: string;
  tab: TabKey;
  initialContent: JSONContent;
  // When provided (onboarding mode), the editor only shows H2 subsections
  // whose text matches one of these (case-insensitive, trimmed). Hidden
  // subsections are PRESERVED in the saved doc as empty scaffolding via
  // a split-and-merge on every save (per user direction 2026-06-29:
  // "keep them in the doc as empty scaffolding").
  visibleH2s?: readonly string[];
  // Lets the parent grab a handle to the editor instance — used by the
  // Voice pill toggle to write the chosen word into the doc via editor
  // commands (no separate state, no form).
  onEditorReady?: (editor: Editor) => void;
}) {
  const [saveState, setSaveState] = useState<SaveState>('idle');
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inflightRef = useRef<AbortController | null>(null);
  // When filtering is active, hold the ORIGINAL full content so on save
  // we can merge the user's edits back into it (preserving hidden H2s).
  // Ref so the merge doesn't trigger re-renders.
  const originalContentRef = useRef<JSONContent>(initialContent);

  const filteredContent =
    visibleH2s && visibleH2s.length > 0 ? filterVisible(initialContent, visibleH2s) : initialContent;

  const save = useCallback(
    async (tiptap: JSONContent) => {
      // If we're in filter mode, merge edits back into the original
      // before sending to the server. The result is the FULL doc (all
      // H2s, hidden ones unchanged) — that's what gets persisted.
      const payload =
        visibleH2s && visibleH2s.length > 0
          ? mergeBack(originalContentRef.current, tiptap, visibleH2s)
          : tiptap;

      inflightRef.current?.abort();
      const controller = new AbortController();
      inflightRef.current = controller;
      setSaveState('saving');
      try {
        const res = await fetch(`/api/ritual-doc/${docId}/save`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ tab, tiptap: payload }),
          signal: controller.signal,
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        if (inflightRef.current === controller) setSaveState('saved');
        // Update originalContentRef to the just-saved full doc so the
        // NEXT save's merge starts from the freshest baseline.
        originalContentRef.current = payload;
      } catch (err) {
        if ((err as Error).name === 'AbortError') return;
        console.error('autosave failed:', err);
        if (inflightRef.current === controller) setSaveState('error');
      }
    },
    [docId, tab, visibleH2s],
  );

  const editor = useEditor({
    extensions: [StarterKit],
    content: filteredContent,
    immediatelyRender: false, // Next.js SSR — see tiptap-docs/getting-started/install/nextjs.mdx
    editorProps: {
      attributes: {
        class: [
          'prose prose-sm max-w-none focus:outline-none min-h-[400px]',
          '[&_p]:my-2',
          '[&_h2]:mt-10 [&_h2]:mb-2 [&_h2]:text-xl [&_h2]:font-semibold [&_h2:first-child]:mt-0',
          '[&_h2:has(+_p_+_h3)]:mb-1',
          '[&_h3]:mt-5 [&_h3]:mb-1 [&_h3]:text-sm [&_h3]:font-medium [&_h3]:uppercase [&_h3]:tracking-wider [&_h3]:text-muted-foreground',
          '[&_h3]:pl-3 [&_h3]:border-l-2 [&_h3]:border-border',
          '[&_h3+p]:pl-3 [&_h3+p]:border-l-2 [&_h3+p]:border-border/40',
        ].join(' '),
      },
    },
    onUpdate: ({ editor }) => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => void save(editor.getJSON()), AUTOSAVE_DEBOUNCE_MS);
    },
  });

  useEffect(() => {
    if (editor && onEditorReady) onEditorReady(editor);
  }, [editor, onEditorReady]);

  useEffect(() => {
    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
        if (editor) void save(editor.getJSON());
      }
      inflightRef.current?.abort();
    };
  }, [editor, save]);

  if (!editor) return <div className="text-sm text-muted-foreground">Loading editor…</div>;

  return (
    <div className="relative">
      <EditorContent editor={editor} />
      <SaveStatus state={saveState} className="absolute right-0 top-[-2rem]" />
    </div>
  );
}
