import { NextResponse } from 'next/server';
import { z } from 'zod';
import { notifySamuelOfQualifyStart } from '@/lib/notify/samuel';

export const runtime = 'nodejs';

const RequestSchema = z.object({
  name: z.string().min(1).max(120),
  email: z.string().email().max(200),
  language: z.enum(['en', 'es']),
});

const ALLOWED_ORIGINS = [
  'https://samwise.life',
  'https://www.samwise.life',
  'http://localhost:3000',
  'http://localhost:3001',
];

function corsHeaders(origin: string | null): Record<string, string> {
  const allowed = origin && ALLOWED_ORIGINS.includes(origin) ? origin : '';
  return {
    'Access-Control-Allow-Origin': allowed,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    Vary: 'Origin',
  };
}

export async function OPTIONS(req: Request) {
  return new NextResponse(null, {
    status: 204,
    headers: corsHeaders(req.headers.get('origin')),
  });
}

export async function POST(req: Request) {
  const cors = corsHeaders(req.headers.get('origin'));

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400, headers: cors });
  }
  const parsed = RequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400, headers: cors });
  }

  // Best-effort: a failed notification must never surface to the
  // prospect's session. Log and still return ok.
  try {
    await notifySamuelOfQualifyStart(parsed.data);
  } catch (err) {
    console.error('[notify/qualify-start] mail dispatch failed', err);
  }
  return NextResponse.json({ ok: true }, { headers: cors });
}
