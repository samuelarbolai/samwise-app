import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createRitualDocForWorkspace } from '@/lib/ritual-doc/storage';
import { isValidWorkspaceToken } from '@/lib/workspace-token';

export const runtime = 'nodejs';

const Body = z.object({
  token: z.string().refine(isValidWorkspaceToken, { message: 'Invalid workspace token' }),
  language: z.enum(['en', 'es']).optional(),
});

export async function POST(req: Request) {
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
    const { id, created } = await createRitualDocForWorkspace(
      parsed.data.token,
      parsed.data.language ?? 'en',
    );
    if (created) {
      // Best-effort Samuel notification on a NEW doc creation only —
      // don't spam on idempotent returns. Awaited before route returns
      // because un-awaited fetches get dropped in Vercel's serverless
      // runtime (per memory `reference_landing_no_firestore_admin_notify`).
      try {
        const { notifySamuelOfOnboardingStart } = await import('@/lib/notify/samuel');
        await notifySamuelOfOnboardingStart({
          ritualDocId: id,
          workspaceToken: parsed.data.token,
        });
      } catch (err) {
        console.warn('notifySamuelOfOnboardingStart failed (non-blocking):', err);
      }
    }
    return NextResponse.json({ id, created });
  } catch (err) {
    console.error('createRitualDocForWorkspace failed:', err);
    return NextResponse.json({ error: 'Create failed' }, { status: 500 });
  }
}
