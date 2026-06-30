'use client';

import { useCallback } from 'react';
import type { Editor } from '@tiptap/react';

// The ONE non-Tiptap UI element in onboarding mode. A tiny two-pill
// toggle (Male | Female) rendered above the editor on the Metadata
// tab. Click sets the paragraph immediately after the "Voice" H2 to
// "male" or "female" via Tiptap commands. Autosave picks it up like
// any other edit. The editor IS the source of truth — no separate
// React state.
export function VoicePillToggle({ editor }: { editor: Editor | null }) {
  const setValue = useCallback(
    (value: 'male' | 'female') => {
      if (!editor) return;
      writeVoiceValue(editor, value);
    },
    [editor],
  );

  if (!editor) return null;

  const currentValue = readVoiceValue(editor);

  return (
    <div className="mb-4 flex items-center gap-2 text-xs text-muted-foreground">
      <span>Voice:</span>
      <Pill active={currentValue === 'male'} onClick={() => setValue('male')}>
        Male
      </Pill>
      <Pill active={currentValue === 'female'} onClick={() => setValue('female')}>
        Female
      </Pill>
    </div>
  );
}

function Pill({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full border px-3 py-1 text-xs transition-colors ${
        active
          ? 'border-[var(--accent-gold)] bg-[var(--accent-gold)]/15 text-foreground'
          : 'border-border text-muted-foreground hover:border-foreground hover:text-foreground'
      }`}
    >
      {children}
    </button>
  );
}

// Walks the editor's JSON looking for the H2 "Voice" + the paragraph
// immediately after; returns the paragraph's text trimmed-lowercased.
function readVoiceValue(editor: Editor): 'male' | 'female' | null {
  const json = editor.getJSON();
  const content = json.content ?? [];
  for (let i = 0; i < content.length - 1; i++) {
    const node = content[i];
    if (node.type === 'heading' && node.attrs?.level === 2) {
      const text = (node.content ?? []).map((c) => c.text ?? '').join('').trim();
      if (text === 'Voice') {
        const next = content[i + 1];
        if (next?.type === 'paragraph') {
          const v = (next.content ?? []).map((c) => c.text ?? '').join('').trim().toLowerCase();
          if (v === 'male' || v === 'female') return v;
        }
        return null;
      }
    }
  }
  return null;
}

// Finds the paragraph after the Voice H2 and replaces its content with
// the chosen value. Uses ProseMirror positions (via editor.state.doc)
// to locate the target node, then deletes its range and inserts the new
// paragraph in its place. Defensive: no-ops if the Voice H2 isn't
// present (the schema seeds it, but a user could have deleted it).
function writeVoiceValue(editor: Editor, value: 'male' | 'female') {
  const { doc } = editor.state;
  let voiceHeadingEnd: number | null = null;
  let nextParagraphRange: { from: number; to: number } | null = null;
  let foundVoice = false;

  doc.descendants((node, pos) => {
    if (foundVoice && nextParagraphRange) return false;
    if (node.type.name === 'heading' && node.attrs.level === 2) {
      const text = node.textContent.trim();
      if (text === 'Voice') {
        foundVoice = true;
        voiceHeadingEnd = pos + node.nodeSize;
        return false; // stop descending into the heading itself
      }
    }
    if (foundVoice && node.type.name === 'paragraph' && voiceHeadingEnd !== null && pos >= voiceHeadingEnd) {
      nextParagraphRange = { from: pos, to: pos + node.nodeSize };
      return false;
    }
    return true;
  });

  if (!nextParagraphRange) return;
  editor
    .chain()
    .focus()
    .deleteRange(nextParagraphRange)
    .insertContentAt(nextParagraphRange.from, {
      type: 'paragraph',
      content: [{ type: 'text', text: value }],
    })
    .run();
}
