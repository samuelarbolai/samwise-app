import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getDb } from '@/lib/firebase-admin';
import {
  createAgentDispatch,
  getLiveKitWsUrl,
  mintRoomAccessToken,
} from '@/lib/livekit-dispatch';

export const runtime = 'nodejs';

const RequestSchema = z.object({
  googleDocLink: z.string().min(1),
});

const SUPPORTED_LANGUAGES = ['en', 'es'] as const;
type Language = (typeof SUPPORTED_LANGUAGES)[number];

function parseDocId(link: string): string | null {
  const match = link.match(/\/d\/([a-zA-Z0-9-_]+)/);
  return match?.[1] ?? null;
}

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const parsed = RequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Missing googleDocLink' }, { status: 400 });
  }

  const docId = parseDocId(parsed.data.googleDocLink);
  if (!docId) {
    return NextResponse.json({ error: 'Invalid Google Doc link' }, { status: 400 });
  }

  const db = getDb();
  const ritualSnapshot = await db
    .collection('rituals')
    .where('googleDocId', '==', docId)
    .limit(1)
    .get();

  if (ritualSnapshot.empty) {
    return NextResponse.json(
      { error: 'No ritual found for this doc. Register the ritual first.' },
      { status: 404 },
    );
  }

  const ritualDoc = ritualSnapshot.docs[0];
  const ritualData = ritualDoc.data();
  const userId: string = ritualData.userID ?? '';
  const ritualLanguage = ritualData.agentConfig?.language as string | undefined;
  const language: Language = SUPPORTED_LANGUAGES.includes(ritualLanguage as Language)
    ? (ritualLanguage as Language)
    : 'en';

  const userSnapshot = await db.collection('users').doc(userId).get();
  const userData = userSnapshot.exists ? (userSnapshot.data() ?? {}) : {};

  const roomName = `lechatchila-${ritualDoc.id}-${Date.now()}`;

  await createAgentDispatch({
    agentName: 'ritual-agent',
    roomName,
    metadata: {
      flow: 'ritual-call-design-lechatchila',
      ritual_id: ritualDoc.id,
      google_doc_id: docId,
      language,
      helpers_list: String(userData.helpers_list ?? ''),
      core_motivation: String(userData.core_motivation ?? ''),
      daily_activity_to_face_reality: String(userData.daily_activity_to_face_reality ?? ''),
    },
  });

  const token = await mintRoomAccessToken({
    identity: userId || `anon-${Date.now()}`,
    roomName,
  });

  return NextResponse.json({
    token,
    wsUrl: getLiveKitWsUrl(),
    roomName,
  });
}
