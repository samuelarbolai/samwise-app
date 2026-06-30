'use client';

import { Suspense, useEffect, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { readOrMintWorkspaceToken, RITUAL_WORKSPACE_KEY } from '@/lib/workspace-token';
import { GoldArrivalOverlay } from '@/app/ritual-doc/[id]/GoldArrivalOverlay';

// Bootstrap route — destination of landing's Start Now CTA. Mints (or
// reads) a workspace token, ensures a ritualDoc exists for it, then
// replaces the URL with the editor's onboarding mode.
// `?from=transition` is passed through so the editor's first paint
// fades in (masks the cross-origin white flash from samwise.life).
//
// Wrapped in <Suspense> because useSearchParams() bails out static
// generation otherwise (Next.js 16 hard error during the prerender
// pass). The page has no SEO / static-render benefit — it's pure
// client bootstrap → redirect.
export default function StartPage() {
  return (
    <Suspense fallback={<Loading />}>
      <StartInner />
    </Suspense>
  );
}

// Empty white shell — NO text. The Suspense fallback renders during
// hydration BEFORE StartInner reads ?from=transition, so any visible
// content would flash briefly even when arriving via the gold-star
// transition. Empty fallback = invisible during hydration window.
function Loading() {
  return (
    <div className="brand-editorial min-h-screen bg-background" />
  );
}

function StartInner() {
  const router = useRouter();
  const params = useSearchParams();
  const fromTransition = params.get('from') === 'transition';
  const inFlightRef = useRef(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (inFlightRef.current) return;
    inFlightRef.current = true;

    (async () => {
      try {
        const token = readOrMintWorkspaceToken(RITUAL_WORKSPACE_KEY);
        const res = await fetch('/api/ritual-doc/create-for-workspace', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token }),
        });
        if (!res.ok) {
          const body = (await res.json().catch(() => ({}))) as { error?: string };
          throw new Error(body.error ?? `HTTP ${res.status}`);
        }
        const { id } = (await res.json()) as { id: string };
        const url = `/ritual-doc/${id}?mode=onboarding${fromTransition ? '&from=transition' : ''}`;
        router.replace(url);
      } catch (err) {
        console.error('start bootstrap failed:', err);
        setError(err instanceof Error ? err.message : 'Unknown error.');
      }
    })();
  }, [router, fromTransition]);

  // When arriving via the gold-star transition, /start renders fully
  // invisible (opacity 0 over white) so the bootstrap text doesn't
  // flicker. A gold overlay HELD at peak sits on top during the
  // bootstrap window so the cross-origin gap reads as continuation
  // of the landing's gold rather than a white flash. Errors break out
  // of the invisibility so the user can see what went wrong.
  const hideForTransition = fromTransition && !error;

  return (
    <div
      className="brand-editorial flex min-h-screen items-center justify-center bg-background text-foreground"
      style={{
        opacity: hideForTransition ? 0 : 1,
        transition: 'opacity 700ms ease-out',
      }}
    >
      {error ? (
        <div className="max-w-md text-center">
          <p className="mb-2 text-sm text-destructive">Could not start your ritual.</p>
          <p className="text-xs text-muted-foreground">{error}</p>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">Preparing your ritual…</p>
      )}
      {fromTransition && !error ? <GoldArrivalOverlay mode="hold" /> : null}
    </div>
  );
}
