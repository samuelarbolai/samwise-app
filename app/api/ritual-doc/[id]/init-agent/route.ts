import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getDb } from '@/lib/firebase-admin';
import {
  createAgentDispatch,
  getLiveKitWsUrl,
  mintRoomAccessToken,
} from '@/lib/livekit-dispatch';

export const runtime = 'nodejs';

// Mints a LiveKit token + dispatches the appropriate agent flow per the
// requested tab. Called whenever the user invokes the agent (manual click)
// or a tab change triggers a re-dispatch after a handoff.
//
// Per-tab agent mapping (the locked design):
//   beginning           → qualification          (WRITE — variable_update)
//   ritualCall          → ritual-call-design     (READ + guide)
//   ritual              → ritual-design          (READ + guide)
//   possibleOrigins     → behavioural-design     (WRITE — tiptap_update)
//   behaviouralPicture  → behavioural-design     (WRITE — tiptap_update)
//   metadata, lapseMap  → no agent

const FLOW_FOR_TAB: Record<string, string> = {
  beginning: 'qualification',
  ritualCall: 'ritual-call-design',
  ritual: 'ritual-design',
  possibleOrigins: 'behavioural-design',
  behaviouralPicture: 'behavioural-design',
};

const RequestSchema = z.object({
  tab: z.enum([
    'beginning',
    'ritualCall',
    'ritual',
    'possibleOrigins',
    'behaviouralPicture',
  ]),
});

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }
  const parsed = RequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid tab' }, { status: 400 });
  }
  const flow = FLOW_FOR_TAB[parsed.data.tab];
  if (!flow) {
    return NextResponse.json(
      { error: `No agent for tab: ${parsed.data.tab}` },
      { status: 400 },
    );
  }

  const db = getDb();
  const snap = await db.collection('ritualDocs').doc(id).get();
  if (!snap.exists) {
    return NextResponse.json({ error: 'ritualDoc not found' }, { status: 404 });
  }
  const data = snap.data() ?? {};
  const userID: string = data.workspaceToken ?? `anon-${Date.now()}`;
  const docLanguage = data.language === 'es' ? 'es' : 'en';

  // Encode tab in the room name for log-grepping; timestamp uniqueness
  // means rapid handoffs never collide on a stale room.
  const roomName = `ritual-doc-${id}-${parsed.data.tab}-${Date.now()}`;

  // Every flow accepts ritual_doc_id + language; flow-specific fields
  // stay empty/defaulted (the worker parser tolerates missing fields).
  // Prompts are unchanged across the fork — only tool execute handlers
  // branch on ritual_doc_id, per the no-prompt-changes constraint.
  await createAgentDispatch({
    agentName: 'ritual-agent',
    roomName,
    metadata: {
      flow,
      ritual_doc_id: id,
      language: docLanguage,
      // Qualification expects these two; harmless on the other flows.
      persona: 'nova',
      prospect_name: '',
      prospect_email: '',
      // Design flows expect these; harmless on qualification.
      ritual_id: '',
      google_doc_id: '',
      helpers_list: '',
      core_motivation: '',
      daily_activity_to_face_reality: '',
    },
  });

  const token = await mintRoomAccessToken({
    identity: userID,
    roomName,
  });

  return NextResponse.json({
    token,
    wsUrl: getLiveKitWsUrl(),
    roomName,
    flow,
  });
}
