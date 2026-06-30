import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

// Cloud function URL — fill in post-deploy via env. Falls back to a
// localhost emulator path for dev.
const REGISTER_RITUAL_FROM_TIPTAP_URL =
  process.env.REGISTER_RITUAL_FROM_TIPTAP_URL ??
  'http://127.0.0.1:5001/arbor-2026/us-central1/registerRitualFromTiptap';

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  try {
    const res = await fetch(REGISTER_RITUAL_FROM_TIPTAP_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ritualDocId: id }),
    });
    const data = (await res.json().catch(() => ({}))) as { error?: string; ritualId?: string; firstCallAt?: string };
    if (!res.ok) {
      const message = data.error ?? `Seal failed (${res.status})`;
      return NextResponse.json({ error: message }, { status: res.status });
    }
    return NextResponse.json(data);
  } catch (err) {
    console.error('seal forward failed:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Seal failed' },
      { status: 500 },
    );
  }
}
