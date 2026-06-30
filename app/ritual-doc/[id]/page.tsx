import { notFound } from 'next/navigation';
import { getRitualDoc } from '@/lib/ritual-doc/storage';
import { RitualDocEditor } from './RitualDocEditor';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export const metadata = { title: 'Ritual Doc — Samwise' };

export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ mode?: string; sealed?: string; from?: string; at?: string }>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const doc = await getRitualDoc(id);
  if (!doc) notFound();
  // Serialize Dates → ISO so the client component receives plain JSON.
  const serializable = {
    id: doc.id,
    language: doc.language,
    tabs: Object.fromEntries(
      Object.entries(doc.tabs).map(([k, t]) => [
        k,
        { tiptap: t.tiptap, updatedAt: t.updatedAt.toISOString() },
      ]),
    ),
  };
  return (
    <RitualDocEditor
      id={id}
      initial={serializable as never}
      mode={sp.mode === 'onboarding' ? 'onboarding' : 'normal'}
      sealed={sp.sealed === '1'}
      firstCallAt={sp.at ?? null}
      fromTransition={sp.from === 'transition'}
    />
  );
}
