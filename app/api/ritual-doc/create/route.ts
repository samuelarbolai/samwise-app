import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createRitualDoc } from '@/lib/ritual-doc/storage';

export const runtime = 'nodejs';

const Body = z.object({
  language: z.enum(['en', 'es']).optional(),
});

export async function POST(req: Request) {
  let body: unknown = {};
  try {
    body = await req.json();
  } catch {
    // Empty body is acceptable — defaults below.
  }
  const parsed = Body.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid body' }, { status: 400 });
  }
  try {
    const { id } = await createRitualDoc(parsed.data.language ?? 'en');
    return NextResponse.json({ id });
  } catch (err) {
    console.error('createRitualDoc failed:', err);
    return NextResponse.json({ error: 'Create failed' }, { status: 500 });
  }
}
