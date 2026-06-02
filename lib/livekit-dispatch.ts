import 'server-only';
import { AccessToken, AgentDispatchClient } from 'livekit-server-sdk';

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing required env var: ${name}`);
  return v;
}

// Mints an access token the browser uses to join `roomName` as the
// LiveKit participant `identity`. TTL must outlive the ENTIRE session,
// not just the initial handshake: livekit-client reuses this same token
// for automatic reconnection (signal drop, ICE restart, room cycling via
// emptyTimeout). A short TTL meant any reconnect after it expired failed
// with `invalid token` / 401. 3h comfortably covers the longest session
// here (the demo/walk-in call's 75-min wall-clock hard cap) plus buffer.
export async function mintRoomAccessToken(args: {
  identity: string;
  roomName: string;
}): Promise<string> {
  const at = new AccessToken(requireEnv('LIVEKIT_API_KEY'), requireEnv('LIVEKIT_API_SECRET'), {
    identity: args.identity,
    ttl: '3h',
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

// Returns true if `roomName` already has at least one agent dispatch. Keeps
// autonomous dispatch idempotent across rejoins/reloads — re-joining a live
// room must NOT spawn a second agent. Best-effort: on a lookup failure it
// returns false (proceed to dispatch) so a transient error never leaves an
// autonomous call with no agent at all.
export async function hasAgentDispatch(roomName: string): Promise<boolean> {
  try {
    const client = new AgentDispatchClient(
      requireEnv('LIVEKIT_URL'),
      requireEnv('LIVEKIT_API_KEY'),
      requireEnv('LIVEKIT_API_SECRET'),
    );
    const dispatches = await client.listDispatch(roomName);
    return dispatches.length > 0;
  } catch (err) {
    console.error('[livekit] listDispatch failed; assuming no dispatch', err);
    return false;
  }
}

export function getLiveKitWsUrl(): string {
  return requireEnv('LIVEKIT_URL');
}
