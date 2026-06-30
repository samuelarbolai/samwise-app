import type { Editor } from '@tiptap/react';

// Pure delta-apply helpers for the in-editor voice agent integration.
// Generalizes VoicePillToggle.tsx's writeVoiceValue pattern to cover
// the three write modes the worker's writeToDocTab tool supports:
//
//   append  — add a new paragraph at the end of the editor
//   replace — clear the editor and write fresh content
//   edit    — find an H2 paragraph by its leading text and replace
//             the H2 + everything until the next H2 (or end of doc)
//
// Plus a tab-specific helper for the qualification variable_update
// path, which writes a value into the paragraph immediately AFTER a
// named H2 (used for "Behaviour I'd like to change" / "Core motivation"
// under the Beginning tab).
//
// All helpers are defensive: a missing H2 / empty editor produces a
// silent no-op rather than throwing. The editor instance may be null
// (e.g. tab not currently mounted) — callers can pass null and the
// helper returns false to signal "delta wasn't applied."

export function writeUnderH2(
  editor: Editor | null,
  h2Text: string,
  text: string,
): boolean {
  if (!editor) return false;
  const target = h2Text.trim();

  const { doc } = editor.state;
  let foundH2 = false;
  let h2End: number | null = null;
  let nextParagraphRange: { from: number; to: number } | null = null;

  doc.descendants((node, pos) => {
    if (foundH2 && nextParagraphRange) return false;
    if (node.type.name === 'heading' && node.attrs.level === 2) {
      const headingText = node.textContent.trim();
      if (headingText === target) {
        foundH2 = true;
        h2End = pos + node.nodeSize;
        return false;
      }
    }
    if (
      foundH2 &&
      node.type.name === 'paragraph' &&
      h2End !== null &&
      pos >= h2End
    ) {
      nextParagraphRange = { from: pos, to: pos + node.nodeSize };
      return false;
    }
    return true;
  });

  const range: { from: number; to: number } | null = nextParagraphRange;
  if (!range) return false;
  editor
    .chain()
    .focus()
    .deleteRange(range)
    .insertContentAt(range.from, {
      type: 'paragraph',
      content: text ? [{ type: 'text', text }] : [],
    })
    .run();
  return true;
}

export function appendParagraph(
  editor: Editor | null,
  text: string,
): boolean {
  if (!editor || !text) return false;
  const endPos = editor.state.doc.content.size;
  editor
    .chain()
    .focus()
    .insertContentAt(endPos, [
      { type: 'paragraph', content: [{ type: 'text', text }] },
    ])
    .run();
  return true;
}

// Append a multi-paragraph block. Used when the worker's append mode
// sends an entry with its own structure (e.g. a Possible origins entry
// formatted as "## heading\n**Life context:** ...\n**What I did:** ..."
// — the markdown is converted to Tiptap nodes here).
export function appendStructured(
  editor: Editor | null,
  text: string,
): boolean {
  if (!editor || !text) return false;
  const nodes = markdownToTiptapNodes(text);
  if (!nodes.length) return false;
  const endPos = editor.state.doc.content.size;
  editor.chain().focus().insertContentAt(endPos, nodes).run();
  return true;
}

// Replace the entire editor content with markdown text (parsed into
// Tiptap nodes). Used for the Behavioural picture synthesis, which is
// fully rewritten on each refinement.
export function replaceAll(editor: Editor | null, text: string): boolean {
  if (!editor) return false;
  const nodes = text ? markdownToTiptapNodes(text) : [];
  editor
    .chain()
    .focus()
    .setContent({ type: 'doc', content: nodes })
    .run();
  return true;
}

// Find an H2 by its leading text (prefix match after "## ") and replace
// the H2 + everything up to the next H2 (or end of doc) with the new
// markdown text. Used for the Possible origins edit mode.
export function editEntryByHeading(
  editor: Editor | null,
  headingPrefix: string,
  newMarkdown: string,
): boolean {
  if (!editor || !headingPrefix) return false;
  const target = headingPrefix.trim().toLowerCase();

  const { doc } = editor.state;
  let entryStart: number | null = null;
  let entryEnd: number | null = null;

  doc.descendants((node, pos) => {
    if (entryEnd !== null) return false;
    if (node.type.name === 'heading' && node.attrs.level === 2) {
      const headingText = node.textContent.trim().toLowerCase();
      if (entryStart === null && headingText.startsWith(target)) {
        entryStart = pos;
        return false;
      }
      if (entryStart !== null) {
        entryEnd = pos;
        return false;
      }
    }
    return true;
  });

  if (entryStart === null) return false;
  const finalEnd = entryEnd ?? editor.state.doc.content.size;
  const nodes = markdownToTiptapNodes(newMarkdown);
  editor
    .chain()
    .focus()
    .deleteRange({ from: entryStart, to: finalEnd })
    .insertContentAt(entryStart, nodes)
    .run();
  return true;
}

// Lightweight markdown → Tiptap node converter. Handles the subset the
// agent emits: H2 (## …), paragraphs, **bold** runs. NOT a general
// markdown parser; the agent's prompt is constrained to this subset.
function markdownToTiptapNodes(markdown: string): Array<Record<string, unknown>> {
  const lines = markdown.split('\n');
  const nodes: Array<Record<string, unknown>> = [];
  for (const raw of lines) {
    const line = raw.trim();
    if (!line) continue;
    if (line.startsWith('## ')) {
      const headingText = line.slice(3).trim();
      nodes.push({
        type: 'heading',
        attrs: { level: 2 },
        content: [{ type: 'text', text: headingText }],
      });
      continue;
    }
    nodes.push({
      type: 'paragraph',
      content: parseInlineWithBold(line),
    });
  }
  return nodes;
}

// Parse **bold** markers into bold text runs. Anything else is plain.
function parseInlineWithBold(line: string): Array<Record<string, unknown>> {
  const runs: Array<Record<string, unknown>> = [];
  const re = /\*\*([^*]+)\*\*/g;
  let lastIdx = 0;
  let match: RegExpExecArray | null;
  while ((match = re.exec(line)) !== null) {
    if (match.index > lastIdx) {
      runs.push({ type: 'text', text: line.slice(lastIdx, match.index) });
    }
    runs.push({
      type: 'text',
      marks: [{ type: 'bold' }],
      text: match[1],
    });
    lastIdx = re.lastIndex;
  }
  if (lastIdx < line.length) {
    runs.push({ type: 'text', text: line.slice(lastIdx) });
  }
  return runs.length ? runs : [{ type: 'text', text: line }];
}
