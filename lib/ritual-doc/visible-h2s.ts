import type { JSONContent } from '@tiptap/react';

// Pure-JS helpers for filtering a Tiptap doc by which H2 headings
// should be visible (used by EditorPane in onboarding mode). Splits
// the doc into segments at every H2 boundary, then keeps only the
// segments whose H2 text matches one in `visibleH2s`. On save, merges
// the user's edited visible segments back into the original full doc
// so HIDDEN segments are preserved as empty scaffolding (per user
// direction 2026-06-29).

export type Segment = {
  /** The H2 heading node opening this segment. Null for the prelude
   *  (content before the first H2 — rare; defensive). */
  h2: JSONContent | null;
  /** The H2 text (lower-cased, trimmed) used as the dedup key. */
  h2Text: string;
  /** Every node BETWEEN this H2 and the next H2 (paragraphs, H3s,
   *  whatever). Does NOT include the H2 itself. */
  body: JSONContent[];
};

function getHeadingText(node: JSONContent): string {
  const parts = (node.content ?? []).map((c) => c.text ?? '');
  return parts.join('').trim();
}

export function splitByH2(doc: JSONContent): Segment[] {
  const segments: Segment[] = [];
  const content = doc.content ?? [];
  let current: Segment | null = null;
  let prelude: JSONContent[] = [];
  for (const node of content) {
    const isH2 = node.type === 'heading' && node.attrs?.level === 2;
    if (isH2) {
      if (current) segments.push(current);
      else if (prelude.length) {
        segments.push({ h2: null, h2Text: '', body: prelude });
        prelude = [];
      }
      current = { h2: node, h2Text: getHeadingText(node), body: [] };
    } else if (current) {
      current.body.push(node);
    } else {
      prelude.push(node);
    }
  }
  if (current) segments.push(current);
  else if (prelude.length) segments.push({ h2: null, h2Text: '', body: prelude });
  return segments;
}

export function rebuild(segments: Segment[]): JSONContent {
  const content: JSONContent[] = [];
  for (const seg of segments) {
    if (seg.h2) content.push(seg.h2);
    content.push(...seg.body);
  }
  // ProseMirror requires every doc to end with a block node. If the
  // filter produced an empty doc OR a doc ending with a bare heading,
  // append an empty paragraph as the trailing block.
  const last = content[content.length - 1];
  if (!last || last.type === 'heading') {
    content.push({ type: 'paragraph' });
  }
  return { type: 'doc', content };
}

/** Returns a new doc containing only segments whose H2 text matches
 *  one in `visibleH2s`. Prelude (no-H2 leading content) is dropped.
 *  H2 matching is case-insensitive + trimmed. */
export function filterVisible(doc: JSONContent, visibleH2s: readonly string[]): JSONContent {
  const wanted = new Set(visibleH2s.map((s) => s.toLowerCase().trim()));
  const segments = splitByH2(doc);
  const kept = segments.filter((s) => s.h2 !== null && wanted.has(s.h2Text.toLowerCase()));
  return rebuild(kept);
}

/** Merges the user's edited visible segments BACK into the original
 *  full doc. Walks the original segment order; for each segment whose
 *  H2 matches one in `visibleH2s`, replaces its body with the body
 *  from the corresponding segment in `editedVisible`. For all other
 *  segments, keeps the original body untouched. */
export function mergeBack(
  original: JSONContent,
  editedVisible: JSONContent,
  visibleH2s: readonly string[],
): JSONContent {
  const wanted = new Set(visibleH2s.map((s) => s.toLowerCase().trim()));
  const originalSegments = splitByH2(original);
  const editedSegments = splitByH2(editedVisible);
  const editedByText = new Map<string, Segment>();
  for (const s of editedSegments) {
    if (s.h2) editedByText.set(s.h2Text.toLowerCase(), s);
  }
  const merged = originalSegments.map((orig) => {
    if (!orig.h2) return orig;
    const isVisible = wanted.has(orig.h2Text.toLowerCase());
    if (!isVisible) return orig;
    const edited = editedByText.get(orig.h2Text.toLowerCase());
    if (!edited) return orig; // edited doc didn't have this H2 — keep original (defensive)
    return { ...orig, body: edited.body };
  });
  return rebuild(merged);
}
