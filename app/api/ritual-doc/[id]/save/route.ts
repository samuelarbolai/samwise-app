import { NextResponse } from 'next/server';
import { z } from 'zod';
import { TAB_KEYS, isTabKey, type TabKey } from '@/lib/ritual-doc/schema';
import { saveTab } from '@/lib/ritual-doc/storage';

export const runtime = 'nodejs';

// We don't validate the Tiptap JSON shape beyond "is an object" — the
// client is the source of truth, and a deep schema check would drift
// from Tiptap's extension set every time we add one. Firestore's
// payload limit (~1MB per write) is the real backstop.
const Body = z.object({
  tab: z.string().refine(isTabKey, {
    message: `tab must be one of ${TAB_KEYS.join(' | ')}`,
  }),
  tiptap: z.record(z.unknown()),
});

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  if (!id) {
    return NextResponse.json({ error: 'Missing id' }, { status: 400 });
  }
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }
  const parsed = Body.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? 'Invalid body' },
      { status: 400 },
    );
  }
  try {
    await saveTab(id, parsed.data.tab as TabKey, parsed.data.tiptap);
  } catch (err) {
    console.error('saveTab failed:', err);
    return NextResponse.json({ error: 'Save failed' }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
