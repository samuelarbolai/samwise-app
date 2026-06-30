'use client';

import { useEffect, useState } from 'react';

// Destination-side replay of samwise-landing's gold-star transition.
// The landing's overlay is in samwise.life's document and is destroyed
// at cross-origin nav (~t=525ms, gold at peak). Without this component
// the user would see: gold expand on landing → abrupt white during
// cross-origin nav → editor fade-in. That gold→white cut is the
// "glitchy glow" the user reported. This component picks up where
// landing left off:
//
//   mode='hold'  — mount at peak gold, hold (no animation). Used by
//                  /start during the bootstrap window so the user
//                  keeps seeing gold while the workspace is created.
//   mode='fade'  — mount at peak gold, fade scale 1.4 → 0.05 +
//                  opacity 1 → 0 over 700ms. Used by /ritual-doc/[id]
//                  in sync with the editor's own 700ms fade-in beneath.
//                  Removes itself on completion.
//
// Same radial-gradient + blur values as the landing's overlay (verbatim
// from samwise-landing/app/page.tsx:357). Inline styles only — Turbopack
// silently drops CSS rules added to globals.css in this codebase
// (documented elsewhere in context-for-code-agent.md).
const PEAK_BG =
  'radial-gradient(circle at center, #D4A85A 0%, rgba(212, 168, 90, 0.85) 14%, rgba(212, 168, 90, 0.55) 32%, rgba(212, 168, 90, 0.25) 55%, rgba(212, 168, 90, 0) 80%)';
const FADE_MS = 700;

export function GoldArrivalOverlay({ mode }: { mode: 'hold' | 'fade' }) {
  // For 'fade' mode: mount at peak, then on next frame transition to
  // scale 0.05 / opacity 0 over 700ms. After the animation completes,
  // self-removes so it stops eating clicks (though pointer-events:none
  // means it doesn't eat clicks anyway — removing keeps the DOM clean).
  const [phase, setPhase] = useState<'peak' | 'fading' | 'done'>(
    mode === 'fade' ? 'peak' : 'peak',
  );

  useEffect(() => {
    if (mode !== 'fade') return;
    // Two RAFs: first commits the peak frame, second triggers the
    // transition to the end frame. Without the second RAF the browser
    // may collapse both states into one paint and skip the animation.
    let raf1 = 0;
    let raf2 = 0;
    raf1 = requestAnimationFrame(() => {
      raf2 = requestAnimationFrame(() => setPhase('fading'));
    });
    const t = window.setTimeout(() => setPhase('done'), FADE_MS + 100);
    return () => {
      cancelAnimationFrame(raf1);
      cancelAnimationFrame(raf2);
      window.clearTimeout(t);
    };
  }, [mode]);

  if (phase === 'done') return null;

  const isFading = mode === 'fade' && phase === 'fading';

  return (
    <div
      aria-hidden
      style={{
        position: 'fixed',
        inset: 0,
        pointerEvents: 'none',
        zIndex: 9999,
        background: PEAK_BG,
        filter: 'blur(80px)',
        willChange: 'transform, opacity',
        opacity: isFading ? 0 : 1,
        transform: isFading ? 'scale(0.05)' : 'scale(1.4)',
        transformOrigin: 'center center',
        transition: isFading
          ? `transform ${FADE_MS}ms ease-in-out, opacity ${FADE_MS}ms ease-in-out`
          : 'none',
      }}
    />
  );
}
