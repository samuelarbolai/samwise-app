'use client';

export type SaveState = 'idle' | 'saving' | 'saved' | 'error';

const LABEL: Record<SaveState, string> = {
  idle:   '',
  saving: 'Saving…',
  saved:  'Saved',
  error:  'Save failed — try again',
};

export function SaveStatus({ state, className }: { state: SaveState; className?: string }) {
  if (state === 'idle') return null;
  return (
    <span
      className={`text-xs ${state === 'error' ? 'text-destructive' : 'text-muted-foreground'} ${className ?? ''}`}
      role="status"
      aria-live="polite"
    >
      {LABEL[state]}
    </span>
  );
}
