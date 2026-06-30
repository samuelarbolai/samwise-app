'use client';

import { useCallback, useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';

export function NewRitualDocCard() {
  const router = useRouter();
  const [isCreating, setIsCreating] = useState(false);

  const onCreate = useCallback(async () => {
    setIsCreating(true);
    try {
      const res = await fetch('/api/ritual-doc/create', { method: 'POST' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const { id } = (await res.json()) as { id: string };
      // Use the still-fresh click gesture to enter browser fullscreen
      // BEFORE the route push. The fullscreen element is <html>, which
      // survives SPA navigation — so the doc page mounts inside the
      // fullscreen frame. Silent on failure (some browsers reject after
      // the awaited fetch; the editor still has the Immerse button as
      // a manual fallback).
      try {
        await document.documentElement.requestFullscreen({ navigationUI: 'hide' });
      } catch {
        // intentional: cold-load / refresh users can't auto-enter,
        // they tap "Immerse" on arrival
      }
      router.push(`/ritual-doc/${id}`);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error.';
      toast.error('Could not create ritual doc', { description: message });
      setIsCreating(false);
    }
  }, [router]);

  return (
    <div className="flex w-full max-w-md flex-col gap-4 p-6">
      <h1 className="text-2xl tracking-tight">Ritual doc</h1>
      <p className="text-sm text-muted-foreground">
        Open a fresh Samwise-native ritual doc. Replaces the Google-Docs paste-link flow.
      </p>
      <Button onClick={onCreate} disabled={isCreating}>
        {isCreating ? 'Creating…' : 'New ritual doc'}
      </Button>
    </div>
  );
}
