'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Settings,
  PhoneCall,
  ScrollText,
  Activity,
  Compass,
  Eye,
  Sunrise,
} from 'lucide-react';
import type { Editor, JSONContent } from '@tiptap/react';
import { TAB_KEYS, TAB_LABELS, type TabKey } from '@/lib/ritual-doc/schema';
import {
  ONBOARDING_TAB_KEYS,
  ONBOARDING_VISIBLE_SUBSECTIONS,
  ONBOARDING_TAB_SUBTITLES,
  ONBOARDING_NEXT_LABELS,
  nextOnboardingTab,
} from '@/lib/ritual-doc/onboarding-mode';
import { SidebarNav, type SidebarNavItem } from '@/components/sidebar-nav';
import { EditorPane } from './EditorPane';
import { ImmerseToggle } from './ImmerseToggle';
import { VoicePillToggle } from './VoicePillToggle';
import { OnboardingSealButton } from './OnboardingSealButton';
import { OnboardingSuccessScreen } from './OnboardingSuccessScreen';
import { GoldArrivalOverlay } from './GoldArrivalOverlay';
import { RitualDocAgent } from './RitualDocAgent';
import {
  useRitualDocAgent,
  TAB_HAS_AGENT,
  type DataChannelEvent,
} from './useRitualDocAgent';
import {
  writeUnderH2,
  appendStructured,
  replaceAll,
  editEntryByHeading,
} from './tiptap-delta-apply';

// Beginning tab: which H2 holds each qualification variable. The
// qualification agent's setVariables tool fires DataChannel events
// like { type: 'qualification:variable_update', name: 'core_motivation',
// value: '…' }; the router below looks up the H2 here and writes the
// value into the paragraph immediately after that H2.
const BEGINNING_H2_FOR_VARIABLE: Record<string, string> = {
  behaviour_to_change: "Behaviour I'd like to change",
  core_motivation: 'Core motivation',
};

type SerializedDoc = {
  id: string;
  language: 'en' | 'es';
  tabs: Record<TabKey, { tiptap: JSONContent; updatedAt: string }>;
};

const TAB_ICONS: Record<TabKey, React.ComponentType<{ className?: string }>> = {
  beginning:          Sunrise,
  metadata:           Settings,
  ritualCall:         PhoneCall,
  ritual:             ScrollText,
  lapseMap:           Activity,
  possibleOrigins:    Compass,
  behaviouralPicture: Eye,
};

const FULL_NAV: readonly SidebarNavItem<TabKey>[] = TAB_KEYS.map((k) => ({
  id: k,
  label: TAB_LABELS[k],
  icon: TAB_ICONS[k],
}));

const ONBOARDING_NAV: readonly SidebarNavItem<TabKey>[] = ONBOARDING_TAB_KEYS.map((k) => ({
  id: k,
  label: TAB_LABELS[k],
  icon: TAB_ICONS[k],
}));

const FADE_MS = 300;
// Arrival fade — mirrors samwise-landing /qualify's 700ms ease-out
// register. Long enough that the eye reads it as a deliberate scene
// transition rather than a UI fade. Paired with the 2-RAF + failsafe
// pattern below for a stable, paint-aware reveal.
const ARRIVAL_FADE_MS = 700;
// Hard cap so the editor is never stuck invisible if the paint signal
// never lands (matches /qualify's 4s failsafe).
const ARRIVAL_FAILSAFE_MS = 4000;

export function RitualDocEditor({
  id,
  initial,
  mode = 'normal',
  sealed = false,
  firstCallAt = null,
  fromTransition = false,
}: {
  id: string;
  initial: SerializedDoc;
  mode?: 'normal' | 'onboarding';
  sealed?: boolean;
  firstCallAt?: string | null;
  fromTransition?: boolean;
}) {
  const onboarding = mode === 'onboarding';
  const tabKeys = onboarding ? ONBOARDING_TAB_KEYS : TAB_KEYS;
  const nav = onboarding ? ONBOARDING_NAV : FULL_NAV;

  const [active, setActive] = useState<TabKey>(tabKeys[0]);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [visible, setVisible] = useState(1);
  const clickInFlightRef = useRef(false);

  // Cross-origin arrival fade — bridges landing's gold-star transition
  // to the editor's first paint. Mirrors samwise-landing /qualify's
  // receiver pattern: start invisible, wait for actual paint readiness
  // (NOT just mount), then trigger a 700ms ease-out fade-in.
  //
  // The trigger uses TWO requestAnimationFrames instead of setTimeout:
  // first RAF guarantees React's render has committed to the DOM, the
  // second guarantees the browser has painted once. Only then do we
  // flip `arrived` true — so the fade always reveals real content,
  // never a mid-render flicker.
  //
  // 4-second failsafe (matches /qualify) so the editor is never stuck
  // invisible if something blocks the paint signal.
  const [arrived, setArrived] = useState(!fromTransition);
  useEffect(() => {
    if (!fromTransition || arrived) return;
    let raf1 = 0;
    let raf2 = 0;
    const failsafe = window.setTimeout(() => setArrived(true), ARRIVAL_FAILSAFE_MS);
    raf1 = requestAnimationFrame(() => {
      raf2 = requestAnimationFrame(() => setArrived(true));
    });
    return () => {
      cancelAnimationFrame(raf1);
      cancelAnimationFrame(raf2);
      window.clearTimeout(failsafe);
    };
  }, [fromTransition, arrived]);

  // Editor instance ref so the Voice pill toggle can write into the
  // doc via editor commands. Per-tab — reset when active tab changes.
  const [editorForActive, setEditorForActive] = useState<Editor | null>(null);
  useEffect(() => setEditorForActive(null), [active]);

  // Latest registered editor instance, keyed by tab. The DataChannel
  // router reads this when an event arrives so it can target the right
  // editor even if the active tab has just changed. EditorPane calls
  // onEditorReady when it mounts the Tiptap instance for that tab.
  const editorsByTabRef = useRef<Partial<Record<TabKey, Editor>>>({});

  const onDataChannelEvent = useCallback((ev: DataChannelEvent) => {
    if (ev.type === 'qualification:variable_update' && ev.name) {
      const h2 = BEGINNING_H2_FOR_VARIABLE[ev.name];
      if (!h2) return;
      const editor = editorsByTabRef.current.beginning;
      writeUnderH2(editor ?? null, h2, String(ev.value ?? ''));
      return;
    }
    if (ev.type === 'ritual-doc:tiptap_update' && ev.tab && ev.mode) {
      const editor = editorsByTabRef.current[ev.tab as TabKey] ?? null;
      const text = ev.text ?? '';
      if (ev.mode === 'append') appendStructured(editor, text);
      else if (ev.mode === 'replace') replaceAll(editor, text);
      else if (ev.mode === 'edit' && ev.heading) {
        editEntryByHeading(editor, ev.heading, text);
      }
    }
  }, []);

  const agent = useRitualDocAgent({ docId: id, onDataChannelEvent });

  // EditorPane calls this when it mounts/remounts its Tiptap instance.
  // We thread it back into BOTH `editorForActive` (so VoicePillToggle
  // works) and `editorsByTabRef` (so the agent's delta router can find
  // the editor for any tab that's currently mounted).
  const handleEditorReady = useCallback(
    (editor: Editor | null) => {
      setEditorForActive(editor);
      if (editor) editorsByTabRef.current[active] = editor;
      else delete editorsByTabRef.current[active];
    },
    [active],
  );

  // Auto-dispatch once on first onboarding arrival to the Beginning tab.
  // localStorage flag prevents re-dispatch on reload / re-mount. If the
  // dispatch fails, the user can click "Talk to your guide" to retry.
  useEffect(() => {
    if (!onboarding) return;
    if (active !== 'beginning') return;
    if (agent.phase !== 'idle') return;
    const key = `ritual-doc:agent-greeted:${id}`;
    try {
      if (window.localStorage.getItem(key)) return;
      window.localStorage.setItem(key, '1');
    } catch {
      /* private mode — degrade to always-auto */
    }
    void agent.dispatch('beginning');
    // Only react to mode/id/active; agent.phase/dispatch are stable
    // enough that re-running on them would risk a double-fire.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onboarding, active, id]);

  // Tab-change handoff orchestration. When the active tab changes while
  // an agent is connected:
  //   - target tab has an agent  → publishHandoff(target) → worker shuts
  //     down → our Disconnected listener flips phase to 'idle' →
  //     the second effect below catches that and dispatches the new tab
  //   - target tab is agent-less → publishHandoff(null) → farewell +
  //     shutdown → stay 'idle' (no re-dispatch)
  const prevTabRef = useRef(active);
  const pendingHandoffTabRef = useRef<TabKey | null>(null);
  useEffect(() => {
    if (prevTabRef.current === active) return;
    prevTabRef.current = active;
    if (agent.phase !== 'active') return;
    const next = TAB_HAS_AGENT[active] ? active : null;
    pendingHandoffTabRef.current = next;
    void agent.publishHandoff(next);
  }, [active, agent]);

  // Re-dispatch leg: when a handoff settles back to 'idle', if we have
  // a pending target tab, fire dispatch on it.
  useEffect(() => {
    if (agent.phase !== 'idle') return;
    const pending = pendingHandoffTabRef.current;
    if (!pending) return;
    pendingHandoffTabRef.current = null;
    void agent.dispatch(pending);
  }, [agent.phase, agent]);

  useEffect(() => {
    const onChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
      if (clickInFlightRef.current) return;
      setVisible(0);
      window.setTimeout(() => setVisible(1), FADE_MS);
    };
    document.addEventListener('fullscreenchange', onChange);
    return () => document.removeEventListener('fullscreenchange', onChange);
  }, []);

  const toggleFullscreen = useCallback(async () => {
    clickInFlightRef.current = true;
    try {
      setVisible(0);
      await new Promise((resolve) => setTimeout(resolve, FADE_MS));
      if (document.fullscreenElement) {
        await document.exitFullscreen();
      } else {
        await rootRef.current?.requestFullscreen({ navigationUI: 'hide' });
      }
      setVisible(1);
    } catch (err) {
      console.error('fullscreen toggle failed:', err);
      setVisible(1);
    } finally {
      window.setTimeout(() => {
        clickInFlightRef.current = false;
      }, FADE_MS);
    }
  }, []);

  // Successful seal — replace the whole shell with the success screen.
  // firstCallAt is not threaded through the URL today; we'll show a
  // generic "is set" message and let the user open the full editor.
  if (onboarding && sealed) {
    return <OnboardingSuccessScreen docId={id} firstCallAt={firstCallAt} />;
  }

  const visibleH2sForActive = onboarding ? ONBOARDING_VISIBLE_SUBSECTIONS[active] : undefined;

  return (
    <div
      ref={rootRef}
      // h-screen + overflow-y-auto so the editor scrolls INSIDE the
      // fullscreen element (without this, fullscreen mode capped the
      // scroll because the body/html scroll context doesn't exist
      // inside `:fullscreen`). Works in normal mode too — the page
      // scrolls inside this container instead of the window, visually
      // identical.
      className="relative h-screen overflow-y-auto bg-background text-foreground"
      style={{
        opacity: arrived ? 1 : 0,
        transition: `opacity ${ARRIVAL_FADE_MS}ms ease-out`,
      }}
    >
      {/* When arriving from the landing's gold-star transition, render
          a destination-side gold overlay that mounts at PEAK and
          fades to nothing over 700ms — picks up where the landing's
          overlay (destroyed by cross-origin nav) left off, bridges
          the gap, then reveals the editor beneath. Eliminates the
          gold→white→content "glitch" the user saw on the first pass.
          NOT gated on `arrived` (which flips in ~32ms) — the overlay
          self-removes via its own phase state machine at 700ms+100. */}
      {fromTransition ? <GoldArrivalOverlay mode="fade" /> : null}
      <div style={{ opacity: visible, transition: `opacity ${FADE_MS}ms ease-out` }}>
        <main className="min-h-screen py-12 pl-24 pr-10">
          <div key={active} className="beat-in mx-auto max-w-3xl">
            <h2 className="mb-1 text-2xl tracking-tight">{TAB_LABELS[active]}</h2>
            {onboarding && ONBOARDING_TAB_SUBTITLES[active] ? (
              <p
                className="mb-6 text-base text-muted-foreground"
                style={{
                  fontFamily: 'var(--app-fraunces, "Fraunces", serif)',
                  fontStyle: 'italic',
                }}
              >
                {ONBOARDING_TAB_SUBTITLES[active]}
              </p>
            ) : (
              <div className="mb-6" />
            )}
            {onboarding && active === 'metadata' ? (
              <VoicePillToggle editor={editorForActive} />
            ) : null}
            <EditorPane
              docId={id}
              tab={active}
              initialContent={initial.tabs[active].tiptap}
              visibleH2s={visibleH2sForActive}
              onEditorReady={handleEditorReady}
            />
            {onboarding && active === 'ritual' ? (
              <OnboardingSealButton docId={id} />
            ) : null}
            {onboarding && ONBOARDING_NEXT_LABELS[active] ? (
              <button
                type="button"
                onClick={() => {
                  const n = nextOnboardingTab(active);
                  if (n) setActive(n);
                }}
                className="mt-16 text-base text-muted-foreground transition-colors hover:text-foreground"
                style={{
                  fontFamily: 'var(--app-fraunces, "Fraunces", serif)',
                  fontStyle: 'italic',
                }}
              >
                {ONBOARDING_NEXT_LABELS[active]}
              </button>
            ) : null}
          </div>
        </main>

        <SidebarNav
          items={nav}
          active={active}
          onChange={setActive}
          wordmarkHref="/"
          footerSlot={
            <div className="flex flex-col gap-3">
              <RitualDocAgent
                phase={agent.phase}
                activeTab={active}
                errorMsg={agent.errorMsg}
                micHot={agent.micHot}
                onDispatch={(t) => void agent.dispatch(t)}
                onEnd={agent.end}
                onPttDown={agent.pttDown}
                onPttUp={agent.pttUp}
              />
              <ImmerseToggle isFullscreen={isFullscreen} onToggle={() => void toggleFullscreen()} />
            </div>
          }
        />
      </div>

      {/* Hidden audio sink — LiveKit appends <audio> elements here so
          the agent's voice plays through the user's speakers. Mounted
          at the root so it survives tab switches inside the editor. */}
      <div ref={agent.audioContainerRef} className="sr-only" aria-hidden />
    </div>
  );
}
