import type { JSONContent } from '@tiptap/react';

// The six TABS mirror the top-level sections of the Samwise Google Doc
// template. Order: Metadata first (so the user sees their wiring up
// front), then Ritual Call (the most actionable thing), then the rest
// in roughly the order they're filled in during a Samwise session.
//
// Sub-sections within each tab are NOT separate storage keys — they
// are H2/H3 headings pre-seeded inside that tab's Tiptap document
// (see TAB_TEMPLATES below). H2 = top-level subsection, H3 = a child
// belonging to the preceding H2. This matches the Google Doc
// structure and is what the agent's writeToDocTab targets today.
export const TAB_KEYS = [
  'beginning',
  'metadata',
  'ritualCall',
  'ritual',
  'lapseMap',
  'possibleOrigins',
  'behaviouralPicture',
] as const;

export type TabKey = (typeof TAB_KEYS)[number];

export const TAB_LABELS: Record<TabKey, string> = {
  beginning:          'Beginning',
  metadata:           'Your details',
  ritualCall:         'Ritual Call',
  ritual:             'Ritual',
  lapseMap:           'Lapse Map',
  possibleOrigins:    'Possible origins',
  behaviouralPicture: 'Behavioural picture',
};

type Subsection = {
  title: string;
  children?: string[];
  // If provided, these strings seed paragraphs UNDER the H2 (instead of
  // a single empty paragraph). Used by Call schedule to teach the user
  // a strict typed format (e.g. "Morning — 06:30") they overwrite.
  paragraphs?: string[];
};

// Sub-section structure pre-seeded in each tab. Top-level entries
// become H2 headings; `children` entries become H3 headings under
// their parent H2. This mirrors the example Google Doc:
// https://docs.google.com/document/d/1pDKjq-hyzqtwuod8eHJM8P8hfMrtSA5pXG--BsyOay8/edit
// Where the example uses bolded inline labels rather than explicit
// headings, the parent/child relationship comes from re-reading the
// content (e.g. "Helpers" is the list of people you call during the
// "Generación de bloqueador" routine, so Helpers is an H3 child of
// that H2). Ritual Call uses the post-2026-06-23 canonical beats
// (memory `reference_call_beat_rename_2026_06_23`).
const SUBSECTIONS: Record<TabKey, Subsection[]> = {
  // Beginning — the first tab in onboarding mode (added 2026-06-29
  // after user feedback that asking for data right away felt cold).
  // Holds the trimmed-qualification fields: what the user is here to
  // change + why it matters. Vocab-blacklist-safe (no "problem" /
  // "behaviour" / "recaída" / "terapia").
  beginning: [
    { title: "Behaviour I'd like to change" },
    { title: 'Core motivation' },
  ],
  // Metadata — second in onboarding. Now smaller: just the identity
  // wiring (Name / Language / Voice / Phone / Timezone) + the
  // technical hidden fields. Behaviour/motivation moved to Beginning;
  // Call schedule moved to Ritual (per user direction 2026-06-29 —
  // schedule belongs with the ritual itself, since it varies with
  // how the user wants to do the practice).
  metadata: [
    { title: 'Name' },
    { title: 'Language' },
    { title: 'Voice' },
    { title: 'Phone number' },
    { title: 'Timezone' },
    { title: 'userID' },
    { title: 'voiceID' },
  ],
  ritualCall: [
    { title: 'Exit from the day' },
    { title: 'Entry into the work' },
    { title: 'Intentions' },
    { title: 'The pact' },
  ],
  ritual: [
    { title: 'Mantras de desidentificación' },
    { title: 'Mantras de esperanza' },
    {
      title: 'Generación de bloqueador — ¿Siento que se viene un ataque?',
      children: ['Helpers', 'Procedure'],
    },
    {
      title: 'Construcción de nueva fe — actividad diaria',
      children: ['Surrender', 'Procedure'],
    },
    // Call schedule lives HERE (not under Metadata) so the times the
    // user picks belong to the same surface as the ritual itself.
    // Seeded with strict-format placeholders the user OVERWRITES; the
    // cloud function regex-parses HH:MM from these paragraphs.
    {
      title: 'Call schedule',
      paragraphs: ['Morning — 06:30', 'Evening — 20:00'],
    },
  ],
  lapseMap: [
    { title: 'Last episode reported' },
    { title: 'What has been tried' },
    { title: 'What life looks like now' },
    { title: 'Exploration of Last Episode' },
  ],
  possibleOrigins: [
    { title: 'Timeline of possible origins of behaviour to change' },
  ],
  behaviouralPicture: [
    { title: 'Problem', children: ['Self-destructive behaviour', 'Scary reality'] },
    { title: 'Solution', children: ['Enemy'] },
  ],
};

function heading(level: 2 | 3, text: string): JSONContent {
  return { type: 'heading', attrs: { level }, content: [{ type: 'text', text }] };
}

function paragraphNode(text?: string): JSONContent {
  return text
    ? { type: 'paragraph', content: [{ type: 'text', text }] }
    : { type: 'paragraph' };
}

function template(subsections: Subsection[]): JSONContent {
  // For each subsection: an H2 with the title, then either the seeded
  // paragraphs (e.g. "Morning — 06:30") or a single empty paragraph
  // (the "type here" slot). If the subsection has children, each child
  // is an H3 + empty paragraph nested under the H2. ProseMirror
  // requires every doc to end with a block node — the last trailing
  // paragraph satisfies that.
  const content: JSONContent[] = [];
  for (const sub of subsections) {
    content.push(heading(2, sub.title));
    if (sub.paragraphs && sub.paragraphs.length > 0) {
      for (const p of sub.paragraphs) content.push(paragraphNode(p));
    } else {
      content.push(paragraphNode());
    }
    if (sub.children) {
      for (const child of sub.children) {
        content.push(heading(3, child));
        content.push(paragraphNode());
      }
    }
  }
  return { type: 'doc', content };
}

export const TAB_TEMPLATES: Record<TabKey, JSONContent> = Object.fromEntries(
  TAB_KEYS.map((k) => [k, template(SUBSECTIONS[k])]),
) as Record<TabKey, JSONContent>;

export type Tab = { tiptap: JSONContent; updatedAt: Date };

export type RitualDoc = {
  id: string;
  createdAt: Date;
  updatedAt: Date;
  language: 'en' | 'es';
  tabs: Record<TabKey, Tab>;
};

export function emptyTabs(now: Date): Record<TabKey, Tab> {
  return Object.fromEntries(
    TAB_KEYS.map((k) => [k, { tiptap: TAB_TEMPLATES[k], updatedAt: now }]),
  ) as Record<TabKey, Tab>;
}

export function isTabKey(v: unknown): v is TabKey {
  return typeof v === 'string' && (TAB_KEYS as readonly string[]).includes(v);
}

// ── Onboarding extensions (added 2026-06-29 for inverted onboarding) ──

export type Gender = 'male' | 'female';

// Voice ID per (language, gender) — sourced from
// samwise-backend/ritual-agent/src/config/voiceIds.ts. Hand-synced —
// when voiceIds.ts changes, mirror here AND in the cloud function
// (registerRitualFromTiptap).
export const VOICE_ID_BY_LANG_GENDER: Record<'en' | 'es' | 'he', Record<Gender, string>> = {
  en: {
    male:   '5ee9feff-1265-424a-9d7f-8e4d431a12c7',
    female: '03496517-369a-4db1-8236-3d3ae459ddf7',
  },
  es: {
    male:   '13ff5deb-2591-42ad-a356-63a04e524411',
    female: 'f4d6bb07-f876-4464-ba70-cd48d8701890',
  },
  he: {
    male:   '921f4026-af53-4761-ac56-1c32e44856e8',
    female: 'd0be495c-5e23-4b88-b12d-bc42d38be9a5',
  },
};

// Extends the existing RitualDoc with workspace ownership + seal state.
// Backwards-compatible: existing docs simply don't have these fields.
export type RitualDocExtended = RitualDoc & {
  workspaceToken?: string;
  sealedAt?: Date | null;
  sealedRitualId?: string;
};
