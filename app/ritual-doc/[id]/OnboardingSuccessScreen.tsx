'use client';

import Link from 'next/link';

export function OnboardingSuccessScreen({
  docId,
  firstCallAt,
}: {
  docId: string;
  firstCallAt: string | null;
}) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-10 py-12 text-center">
      <h1
        className="mb-8 text-4xl tracking-tight"
        style={{ fontFamily: 'var(--app-fraunces, "Fraunces", serif)', fontStyle: 'italic' }}
      >
        Your ritual is alive.
      </h1>
      <p className="mb-3 max-w-md text-base text-foreground">
        {firstCallAt ? (
          <>
            Your first call is at{' '}
            <span style={{ fontFamily: 'var(--app-fraunces, "Fraunces", serif)', fontStyle: 'italic' }}>
              {firstCallAt}
            </span>
            .
          </>
        ) : (
          <>Your first call is set.</>
        )}
      </p>
      <p className="mb-10 max-w-md text-sm text-muted-foreground">
        Open it whenever you want to keep shaping.
      </p>
      <Link
        href={`/ritual-doc/${docId}`}
        className="inline-flex items-center gap-2 rounded-md border border-[var(--accent-gold)] px-6 py-3 text-sm text-foreground transition-colors hover:bg-[var(--accent-gold)]/10"
      >
        Open my ritual doc →
      </Link>
    </div>
  );
}
