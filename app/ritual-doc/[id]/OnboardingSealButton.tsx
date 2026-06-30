'use client';

import { useCallback, useState } from 'react';
import { useRouter } from 'next/navigation';

// Bottom-of-Ritual-tab CTA. Mirrors samwise-landing's canonical
// .cta--primary pattern — Manrope small-caps text flanked by 18px
// gold hairline dashes that collapse inward on hover, with a gold
// underline that expands from center beneath the text on hover. No
// filled rectangle (per the landing skill's anti-pattern list).
//
// Implemented inline (Tailwind + React hover state) rather than via
// a globals.css class because Turbopack's CSS HMR was silently
// dropping the rules. Explicit <span> dashes instead of ::before/
// ::after pseudo-elements — no CSS file dependency.
//
// A single Fraunces italic preamble — "When you're ready." — sits
// above the CTA. Echoes the editorial next-cue pattern from the
// previous tabs ("When you're ready, your ritual call comes next →")
// and gives the seal moment a small beat of ceremony before the
// commit.
//
// Always enabled until in-flight. Validation lives in the cloud
// function (returns specific 400 with the missing field name,
// surfaced inline below the CTA).
const DASH_PX = 18;
const TRANS_MS = 350;
const GOLD = 'var(--accent-gold)';

export function OnboardingSealButton({ docId }: { docId: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hover, setHover] = useState(false);
  const active = hover && !pending;

  const onClick = useCallback(async () => {
    setPending(true);
    setError(null);
    try {
      const res = await fetch(`/api/ritual-doc/${docId}/seal`, { method: 'POST' });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? `Seal failed (${res.status})`);
      }
      const data = (await res.json().catch(() => ({}))) as { firstCallAt?: string };
      // Thread the CF's firstCallAt through the redirect so the
      // success screen can show the actual time ("Your first call is
      // at Tomorrow 6:30 AM") instead of the generic "is set" fallback.
      const sp = new URLSearchParams({ mode: 'onboarding', sealed: '1' });
      if (data.firstCallAt) sp.set('at', data.firstCallAt);
      router.replace(`/ritual-doc/${docId}?${sp.toString()}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Seal failed');
      setPending(false);
    }
  }, [docId, router]);

  const dashStyle: React.CSSProperties = {
    display: 'block',
    height: 1,
    background: GOLD,
    width: active ? 0 : DASH_PX,
    transition: `width ${TRANS_MS}ms ease`,
  };

  const buttonStyle: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 14,
    fontFamily: 'Manrope, sans-serif',
    fontWeight: 600,
    fontSize: 13,
    letterSpacing: '0.12em',
    textTransform: 'uppercase',
    color: 'var(--foreground)',
    background: 'transparent',
    border: 'none',
    padding: '14px 0',
    cursor: pending ? 'default' : 'pointer',
    opacity: pending ? 0.4 : 1,
    transition: `opacity ${TRANS_MS}ms ease`,
  };

  return (
    <div className="mt-16 flex flex-col items-start gap-4">
      <p
        className="text-base text-muted-foreground"
        style={{
          fontFamily: 'var(--app-fraunces, "Fraunces", serif)',
          fontStyle: 'italic',
        }}
      >
        When you’re ready.
      </p>
      <button
        type="button"
        onClick={() => void onClick()}
        onMouseEnter={() => setHover(true)}
        onMouseLeave={() => setHover(false)}
        disabled={pending}
        style={buttonStyle}
      >
        <span style={dashStyle} aria-hidden />
        <span style={{ position: 'relative', display: 'inline-block' }}>
          <span>{pending ? 'Sealing…' : 'Seal my ritual'}</span>
          <span
            aria-hidden
            style={{
              position: 'absolute',
              left: '50%',
              bottom: -4,
              height: 1,
              background: GOLD,
              width: active ? '100%' : 0,
              transform: 'translateX(-50%)',
              transition: `width ${TRANS_MS}ms ease`,
            }}
          />
        </span>
        <span style={dashStyle} aria-hidden />
      </button>
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
    </div>
  );
}
