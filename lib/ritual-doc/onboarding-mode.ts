import type { TabKey } from './schema';

// Subset of tabs visible during onboarding mode. Order matters — it's
// also the order of the implicit nav (top to bottom in the sidebar).
// Beginning first so the user states why they're here BEFORE we ask
// for their data; Metadata second; ritual content tabs last (per user
// direction 2026-06-29).
export const ONBOARDING_TAB_KEYS: readonly TabKey[] = [
  'beginning',
  'metadata',
  'ritualCall',
  'ritual',
];

// Per tab, the H2 subsection titles VISIBLE in onboarding mode. Any
// H2 NOT in this list (within that tab) is hidden from the editor's
// view. Hidden subsections are PRESERVED in the saved doc as empty
// scaffolding (per user direction 2026-06-29 — "keep them in the doc")
// via the EditorPane's split-and-merge mechanism.
export const ONBOARDING_VISIBLE_SUBSECTIONS: Partial<Record<TabKey, readonly string[]>> = {
  beginning: [
    "Behaviour I'd like to change",
    'Core motivation',
  ],
  metadata: [
    'Name',
    'Language',
    'Voice',
    'Phone number',
    'Timezone',
    // hidden in onboarding mode: userID, voiceID
  ],
  ritualCall: [
    'Exit from the day',
    'Entry into the work',
    'Intentions',
    'The pact',
  ],
  ritual: [
    'Mantras de desidentificación',
    'Generación de bloqueador — ¿Siento que se viene un ataque?',
    'Call schedule',
    // hidden in onboarding: Mantras de esperanza, Construcción de
    // nueva fe — actividad diaria, Helpers, Procedure, Surrender, etc.
  ],
};

export function isOnboardingMode(mode: string | null | undefined): boolean {
  return mode === 'onboarding';
}

// Editorial subtitle shown under each tab heading in onboarding mode.
// Replaces the earlier "1 of 3 · …" step strip (felt programmatic).
// Each line names WHAT the tab is, not WHERE the user is in a sequence.
// Sidebar nav already shows order (top to bottom); the subtitle does
// the "why this tab" work, the bottom-cue does the "what's next" work.
export const ONBOARDING_TAB_SUBTITLES: Partial<Record<TabKey, string>> = {
  beginning:  'What you’re working on. Why it matters.',
  metadata:   'Your wiring, so the calls can reach you.',
  ritualCall: 'The few minutes that hold you, each call.',
  ritual:     'The practice itself, and when it happens.',
};

// Returns the next tab in onboarding order, or null if `active` is the
// last step (the Seal button takes over from there).
export function nextOnboardingTab(active: TabKey): TabKey | null {
  const i = ONBOARDING_TAB_KEYS.indexOf(active);
  if (i === -1 || i >= ONBOARDING_TAB_KEYS.length - 1) return null;
  return ONBOARDING_TAB_KEYS[i + 1];
}

// Human label for the "next →" cue at the bottom of a tab. Matches the
// register of the subtitles — Fraunces italic, named not numbered.
export const ONBOARDING_NEXT_LABELS: Partial<Record<TabKey, string>> = {
  beginning:  'When you’re ready, your details come next →',
  metadata:   'When you’re ready, your ritual call comes next →',
  ritualCall: 'When you’re ready, your ritual comes next →',
};
