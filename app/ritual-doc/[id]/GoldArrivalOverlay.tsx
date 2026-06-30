'use client';

import { useEffect, useState } from 'react';

// Destination-side gold glow, anchored at the sidebar's collapsed
// FourPointStar position. The star sits at `left-4 top-1/2` with
// `p-2` padding and a 20px star inside — so its visual centre is at
// roughly (16 + 8 + 10) = 34px from the viewport left, vertically
// centred. We use that as BOTH the radial-gradient origin AND the
// scale transform-origin — the glow visibly emerges from the star,
// blooms to cover the viewport, then contracts back into it.
//
// Phases:
//   'fade-in'  — opacity 0 → 1, scale 0.05 → 1.4 (350ms ease-out)
//   'peak'     — hold at 1 / 1.4 (200ms) — gives the eye a moment to
//                read the gold before contraction
//   'fade-out' — opacity 1 → 0, scale 1.4 → 0.05 (350ms ease-in)
//   'done'     — return null
//
// Two modes:
//   'fade' — runs the full cycle then self-removes. Used by
//            /ritual-doc/[id] on arrival.
//   'hold' — fades in to peak, then HOLDS forever (no fade-out). Was
//            used by /start; currently no surface uses it but kept
//            for future bootstrap-window callers.
const STAR_X_PX = 34;
const STAR_Y_VH = 50;
const GRADIENT = `radial-gradient(circle at ${STAR_X_PX}px ${STAR_Y_VH}vh, #D4A85A 0%, rgba(212, 168, 90, 0.85) 14%, rgba(212, 168, 90, 0.55) 32%, rgba(212, 168, 90, 0.25) 55%, rgba(212, 168, 90, 0) 80%)`;
const TRANSFORM_ORIGIN = `${STAR_X_PX}px ${STAR_Y_VH}vh`;

const FADE_IN_MS = 350;
const PEAK_HOLD_MS = 200;
const FADE_OUT_MS = 350;

type Phase = 'init' | 'fade-in' | 'peak' | 'fade-out' | 'done';

export function GoldArrivalOverlay({ mode }: { mode: 'hold' | 'fade' }) {
  const [phase, setPhase] = useState<Phase>('init');

  useEffect(() => {
    // Two RAFs guarantee the browser commits the initial `init` paint
    // (opacity 0, scale 0.05) BEFORE we trigger the fade-in transition.
    // Without this, both states collapse into one paint and the
    // animation is skipped.
    let raf1 = 0;
    let raf2 = 0;
    const timers: number[] = [];

    raf1 = requestAnimationFrame(() => {
      raf2 = requestAnimationFrame(() => {
        setPhase('fade-in');
        timers.push(
          window.setTimeout(() => setPhase('peak'), FADE_IN_MS),
        );
        if (mode === 'fade') {
          timers.push(
            window.setTimeout(
              () => setPhase('fade-out'),
              FADE_IN_MS + PEAK_HOLD_MS,
            ),
          );
          timers.push(
            window.setTimeout(
              () => setPhase('done'),
              FADE_IN_MS + PEAK_HOLD_MS + FADE_OUT_MS + 100,
            ),
          );
        }
      });
    });

    return () => {
      cancelAnimationFrame(raf1);
      cancelAnimationFrame(raf2);
      for (const t of timers) window.clearTimeout(t);
    };
  }, [mode]);

  if (phase === 'done') return null;

  // Compute opacity + transform per phase. `init` is the pre-fade-in
  // resting state (invisible, tiny scale at the star). `fade-in` and
  // `fade-out` are mid-transition states; CSS transitions handle the
  // interpolation.
  let opacity = 0;
  let scale = 0.05;
  let transitionDur = 0;
  let easing = 'ease-out';
  switch (phase) {
    case 'init':
      opacity = 0;
      scale = 0.05;
      transitionDur = 0;
      break;
    case 'fade-in':
      opacity = 1;
      scale = 1.4;
      transitionDur = FADE_IN_MS;
      easing = 'ease-out';
      break;
    case 'peak':
      opacity = 1;
      scale = 1.4;
      transitionDur = 0;
      break;
    case 'fade-out':
      opacity = 0;
      scale = 0.05;
      transitionDur = FADE_OUT_MS;
      easing = 'ease-in';
      break;
  }

  return (
    <div
      aria-hidden
      style={{
        position: 'fixed',
        inset: 0,
        pointerEvents: 'none',
        zIndex: 9999,
        background: GRADIENT,
        // 40px instead of 80px — Chrome's Skia backend re-blurs the
        // full-viewport gradient every frame during the scale animation,
        // which was visibly laggy on memory-pressured Chrome. Halving
        // the blur radius is the cheapest possible win without changing
        // the visual; the gradient already has 5 soft stops doing the
        // heavy lifting on edge softness. Safari (Metal/Core Image)
        // handled 80px fine but matching for consistency.
        filter: 'blur(40px)',
        willChange: 'transform, opacity, filter',
        opacity,
        transform: `scale(${scale})`,
        transformOrigin: TRANSFORM_ORIGIN,
        transition:
          transitionDur > 0
            ? `transform ${transitionDur}ms ${easing}, opacity ${transitionDur}ms ${easing}`
            : 'none',
      }}
    />
  );
}
