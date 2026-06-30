'use client';

import { Mic } from 'lucide-react';
import type { TabKey } from '@/lib/ritual-doc/schema';
import { TAB_HAS_AGENT, type AgentPhase } from './useRitualDocAgent';

// Sidebar-footer agent affordance. Renders based on phase + whether
// the active tab has an associated agent flow. Editorial register
// (Manrope small caps + gold hairline accent) — mirrors the
// OnboardingSealButton's brand language.

export function RitualDocAgent({
  phase,
  activeTab,
  errorMsg,
  micHot,
  onDispatch,
  onEnd,
  onPttDown,
  onPttUp,
}: {
  phase: AgentPhase;
  activeTab: TabKey;
  errorMsg: string | null;
  micHot: boolean;
  onDispatch: (tab: TabKey) => void;
  onEnd: () => void;
  onPttDown: () => void;
  onPttUp: () => void;
}) {
  const hasAgent = TAB_HAS_AGENT[activeTab];

  if (!hasAgent) {
    return (
      <div
        className="px-3 py-2 text-[10px] tracking-[0.22em] text-muted-foreground/60"
        style={{
          fontFamily: 'var(--app-manrope, "Manrope", system-ui)',
          textTransform: 'uppercase',
        }}
        title="No guide for this step"
      >
        No guide here
      </div>
    );
  }

  if (phase === 'idle' || phase === 'error') {
    return (
      <div className="flex flex-col gap-2">
        <button
          type="button"
          onClick={() => onDispatch(activeTab)}
          className="flex items-center gap-2 rounded-md border border-input px-3 py-2 text-[11px] tracking-[0.22em] text-muted-foreground transition-colors hover:border-[var(--accent-gold)] hover:text-foreground"
          style={{
            fontFamily: 'var(--app-manrope, "Manrope", system-ui)',
            textTransform: 'uppercase',
          }}
        >
          <Mic className="h-3.5 w-3.5" />
          <span>Talk to your guide</span>
        </button>
        {phase === 'error' && errorMsg ? (
          <p className="px-1 text-[10px] text-destructive">{errorMsg}</p>
        ) : null}
      </div>
    );
  }

  if (phase === 'identifying' || phase === 'connecting') {
    return (
      <div className="flex items-center gap-2 px-3 py-2 text-[11px] tracking-[0.22em] text-muted-foreground">
        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[var(--accent-gold)]" />
        <span
          style={{
            fontFamily: 'var(--app-manrope, "Manrope", system-ui)',
            textTransform: 'uppercase',
          }}
        >
          {phase === 'identifying' ? 'Calling…' : 'Connecting…'}
        </span>
      </div>
    );
  }

  if (phase === 'active') {
    return (
      <div className="flex flex-col gap-2">
        <button
          type="button"
          onMouseDown={onPttDown}
          onMouseUp={onPttUp}
          onMouseLeave={onPttUp}
          onTouchStart={(e) => {
            e.preventDefault();
            onPttDown();
          }}
          onTouchEnd={(e) => {
            e.preventDefault();
            onPttUp();
          }}
          className={`flex select-none items-center gap-2 rounded-md px-3 py-2 text-[11px] tracking-[0.22em] transition-all ${
            micHot
              ? 'bg-[var(--accent-gold)] text-[#1A1A1A] shadow-[0_0_24px_rgba(212,168,90,0.55)]'
              : 'border border-input text-muted-foreground hover:border-foreground hover:text-foreground'
          }`}
          style={{
            fontFamily: 'var(--app-manrope, "Manrope", system-ui)',
            textTransform: 'uppercase',
          }}
        >
          <Mic className="h-3.5 w-3.5" />
          <span>{micHot ? 'Listening' : 'Hold to talk'}</span>
        </button>
        <button
          type="button"
          onClick={onEnd}
          className="px-3 text-[10px] tracking-[0.22em] text-muted-foreground/70 transition-colors hover:text-foreground"
          style={{
            fontFamily: 'var(--app-manrope, "Manrope", system-ui)',
            textTransform: 'uppercase',
          }}
        >
          End
        </button>
      </div>
    );
  }

  if (phase === 'handing-off') {
    return (
      <div className="flex items-center gap-2 px-3 py-2 text-[11px] tracking-[0.22em] text-muted-foreground">
        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[var(--accent-gold)]" />
        <span
          style={{
            fontFamily: 'var(--app-manrope, "Manrope", system-ui)',
            textTransform: 'uppercase',
          }}
        >
          Handing over…
        </span>
      </div>
    );
  }

  // 'disconnected'
  return (
    <button
      type="button"
      onClick={() => onDispatch(activeTab)}
      className="flex items-center gap-2 rounded-md border border-input px-3 py-2 text-[11px] tracking-[0.22em] text-muted-foreground transition-colors hover:border-[var(--accent-gold)] hover:text-foreground"
      style={{
        fontFamily: 'var(--app-manrope, "Manrope", system-ui)',
        textTransform: 'uppercase',
      }}
    >
      <Mic className="h-3.5 w-3.5" />
      <span>Reconnect</span>
    </button>
  );
}
