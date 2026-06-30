'use client';

import { useEffect, useRef, useState } from 'react';

// Destination-side gold glow that emerges from and returns to the
// sidebar's collapsed FourPointStar.
//
// Uses the Web Animations API (Element.animate) — same primitive the
// landing's gold-star transition uses. Runs on the compositor thread,
// so it stays smooth even while React is mounting the editor tree +
// initializing Tiptap on the main thread. The earlier React-state /
// setTimeout phase machine fired phase changes from the main thread,
// which got delayed by the editor's mount work and read as stuttering
// "loading" between phases (per user feedback 2026-06-29 after deploy).
//
// Anchor point — exact centre of the closed sidebar's gold ✦
// (left-4 top-1/2 + p-2 + 10px half-star). Used for BOTH the
// radial-gradient origin AND the transform-origin so the gold visibly
// emerges from the star, blooms, and contracts back into it.

const STAR_X_PX = 34;
const STAR_Y_VH = 50;
const GRADIENT = `radial-gradient(circle at ${STAR_X_PX}px ${STAR_Y_VH}vh, #D4A85A 0%, rgba(212, 168, 90, 0.85) 14%, rgba(212, 168, 90, 0.55) 32%, rgba(212, 168, 90, 0.25) 55%, rgba(212, 168, 90, 0) 80%)`;
const TRANSFORM_ORIGIN = `${STAR_X_PX}px ${STAR_Y_VH}vh`;

// 900ms total: 39% expand · 22% peak hold · 39% contract.
// Mirrors the landing's leaving overlay timing (also 900ms) so the
// arrival reads as a continuation of the same gesture across origins.
const TOTAL_DURATION_MS = 900;
const HOLD_DURATION_MS = 350;

export function GoldArrivalOverlay({ mode }: { mode: 'hold' | 'fade' }) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [done, setDone] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    if (mode === 'fade') {
      // Full cycle — emerges from the star, peaks, contracts back into
      // the star. Same keyframe shape as samwise-landing/app/page.tsx's
      // leaving overlay so they read as one continuous gesture.
      const animation = el.animate(
        [
          { transform: 'scale(0.05)', opacity: 0, offset: 0 },
          { transform: 'scale(1.4)', opacity: 1, offset: 0.39 },
          { transform: 'scale(1.4)', opacity: 1, offset: 0.61 },
          { transform: 'scale(0.05)', opacity: 0, offset: 1 },
        ],
        { duration: TOTAL_DURATION_MS, easing: 'ease-in-out', fill: 'forwards' },
      );

      const finish = () => setDone(true);
      animation.finished.then(finish).catch(finish);
    } else {
      // 'hold' mode — fade in to peak and stay there. No 'done'
      // transition; the parent unmounts us when appropriate. (No
      // current caller — kept for future bootstrap-window use cases.)
      el.animate(
        [
          { transform: 'scale(0.05)', opacity: 0, offset: 0 },
          { transform: 'scale(1.4)', opacity: 1, offset: 1 },
        ],
        { duration: HOLD_DURATION_MS, easing: 'ease-out', fill: 'forwards' },
      );
    }
  }, [mode]);

  if (done) return null;

  return (
    <div
      ref={ref}
      aria-hidden
      style={{
        position: 'fixed',
        inset: 0,
        pointerEvents: 'none',
        zIndex: 9999,
        background: GRADIENT,
        // 40px instead of 80px — Chrome's Skia backend re-blurs the
        // full-viewport gradient every frame during the scale
        // animation. Halving the blur is the cheapest possible win
        // without changing the visual; the gradient already has 5
        // soft stops doing the heavy lifting on edge softness.
        filter: 'blur(40px)',
        willChange: 'transform, opacity, filter',
        transformOrigin: TRANSFORM_ORIGIN,
        // Initial state — the Web Animations API will override starting
        // at offset 0. Setting these here means even if the animation
        // is delayed a frame, the element starts invisible (no flash).
        opacity: 0,
        transform: 'scale(0.05)',
      }}
    />
  );
}
