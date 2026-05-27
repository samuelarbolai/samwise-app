import 'server-only';
import {
  AccessToken,
  AgentDispatchClient,
  EgressClient,
  EncodedFileOutput,
  EncodedFileType,
} from 'livekit-server-sdk';

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing required env var: ${name}`);
  return v;
}

// Mints a short-lived access token the browser uses to join `roomName`
// as the LiveKit participant `identity`. TTL is 10 minutes; the token is
// only needed for the initial WebRTC handshake.
export async function mintRoomAccessToken(args: {
  identity: string;
  roomName: string;
}): Promise<string> {
  const at = new AccessToken(requireEnv('LIVEKIT_API_KEY'), requireEnv('LIVEKIT_API_SECRET'), {
    identity: args.identity,
    ttl: '10m',
  });
  at.addGrant({
    room: args.roomName,
    roomJoin: true,
    canPublish: true,
    canSubscribe: true,
    canPublishData: true,
  });
  return at.toJwt();
}

// Creates an agent dispatch addressed to `agentName` with the given JSON
// metadata. The agent worker picks up the dispatch and joins `roomName`.
export async function createAgentDispatch(args: {
  agentName: string;
  roomName: string;
  metadata: Record<string, unknown>;
}): Promise<void> {
  const client = new AgentDispatchClient(
    requireEnv('LIVEKIT_URL'),
    requireEnv('LIVEKIT_API_KEY'),
    requireEnv('LIVEKIT_API_SECRET'),
  );
  await client.createDispatch(args.roomName, args.agentName, {
    metadata: JSON.stringify(args.metadata),
  });
}

export function getLiveKitWsUrl(): string {
  return requireEnv('LIVEKIT_URL');
}

// Starts a Composite Egress recording for the room. Returns the egress ID
// so callers can persist it on the booking doc for later playback. The
// recording renders one MP4 with all participants' video + audio composited
// into a single track. LiveKit auto-stops the egress when the room is empty.
//
// Storage backend: if the LiveKit Cloud project has managed-storage enabled
// at the project tier, leaving `output` unset on EncodedFileOutput causes
// LiveKit to write to the project's default storage. If BYO bucket is
// required, populate the `output` field with an S3Upload / GCPUpload (the
// branch below — wired via env vars). The deciding step happens at first
// deploy; see current-plan.md Step 0.2.
export async function startRoomCompositeEgress(args: {
  roomName: string;
  fileName: string;
}): Promise<string> {
  const client = new EgressClient(
    requireEnv('LIVEKIT_URL'),
    requireEnv('LIVEKIT_API_KEY'),
    requireEnv('LIVEKIT_API_SECRET'),
  );
  const output = new EncodedFileOutput({
    fileType: EncodedFileType.MP4,
    filepath: args.fileName,
    // output: undefined => use LiveKit project-default storage.
    // To switch to BYO bucket, populate here with:
    //   { case: 's3', value: new S3Upload({ ... }) }
    // or { case: 'gcp', value: new GCPUpload({ ... }) }
    // driven by env vars (EGRESS_STORAGE_* — see current-plan.md Step 0.2).
  });
  const info = await client.startRoomCompositeEgress(args.roomName, output, {
    audioOnly: false,
    videoOnly: false,
  });
  return info.egressId;
}
