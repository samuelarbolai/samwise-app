'use client';

import { Suspense, useEffect, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { readOrMintWorkspaceToken, RITUAL_WORKSPACE_KEY } from '@/lib/workspace-token';

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

function Loading() {
  return (
    <div className="brand-editorial flex min-h-screen items-center justify-center bg-background text-foreground">
      <p className="text-sm text-muted-foreground">Preparing your ritual…</p>
    </div>
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

  return (
    <div className="brand-editorial flex min-h-screen items-center justify-center bg-background text-foreground">
      {error ? (
        <div className="max-w-md text-center">
          <p className="mb-2 text-sm text-destructive">Could not start your ritual.</p>
          <p className="text-xs text-muted-foreground">{error}</p>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">Preparing your ritual…</p>
      )}
    </div>
  );
}
