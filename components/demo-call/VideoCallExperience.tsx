'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Room,
  RoomEvent,
  Track,
  createLocalTracks,
  type LocalTrack,
  type RemoteParticipant,
  type RemoteTrack,
  type RemoteTrackPublication,
} from 'livekit-client';

type Phase =
  | 'connecting'
  | 'active'
  | 'peer-waiting'
  | 'reconnecting'
  | 'dropped'
  | 'ended'
  | 'error';

// Delay before the first auto-reconnect attempt after an involuntary drop.
const RECONNECT_DELAY_MS = 2000;

export interface VideoCallInit {
  token: string;
  wsUrl: string;
  roomName: string;
}

export interface VideoCallExperienceProps {
  init: VideoCallInit;
  /** Subtle peer-context line shown in the status overlay during
   * connecting/peer-waiting. e.g. "Joining Samuel's room…" */
  peerLabel?: string;
  /** Listener for DataChannel JSON messages from the other participant.
   * The user-side variables panel uses this to receive
   * `demo-call:variable_update` events. */
  onDataMessage?: (msg: unknown) => void;
  /** Handed the Room instance once connected. The therapist side uses
   * this to wire a DataChannel broadcaster against the Room. */
  onRoomReady?: (room: Room) => void;
  /** Wall-clock hard cap after which the client force-disconnects. With
   * BOTH sides enforcing this independently AND LiveKit's emptyTimeout
   * (default 30s) closing the room when both clients leave, the room
   * cannot leak. Default 75 min (45-min slot + 30-min overrun buffer). */
  hardCapMs?: number;
  /** Called when the user clicks "End call" OR the cap fires. */
  onEnded?: () => void;
}

// Canonical client wiring for a two-human LiveKit video room. Mirrors the
// hard-earned lessons in RitualCallExperience (deliberate-disconnect
// listener-strip, re-entrancy guard, visibility-hidden auto-mute,
// audio-sink-as-DOM-children), and adds: camera publish, self-view PiP,
// remote video attach, mic toggle (NOT push-to-talk — this is human-to-
// human, not human-to-agent), and the hard wall-clock cap that replaces
// the agent worker's `ctx.shutdown` (no agent here to enforce it).
export function VideoCallExperience(props: VideoCallExperienceProps) {
  const { init, peerLabel, onDataMessage, onRoomReady, onEnded } = props;
  const hardCapMs = props.hardCapMs ?? 75 * 60 * 1000;

  const [phase, setPhase] = useState<Phase>('connecting');
  const [micOn, setMicOn] = useState(true);
  const [camOn, setCamOn] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  // iOS Safari blocks audio autoplay until a user gesture, AND suspends
  // playback when the tab is backgrounded / the phone locks. When that
  // happens `room.canPlaybackAudio` flips false; we surface a tap-to-enable
  // affordance that re-runs startAudio() from inside the tap (the only thing
  // iOS accepts). Covers both the initial autoplay block and post-background
  // resume — the inbound twin of the mic auto-mute bug.
  const [audioBlocked, setAudioBlocked] = useState(false);

  const roomRef = useRef<Room | null>(null);
  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const remoteContainerRef = useRef<HTMLDivElement | null>(null);
  const startingRef = useRef(false);
  const hardCapTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Ref-mirror the callbacks + init so the connect closure always sees
  // the latest values WITHOUT re-binding `start`. Without this, the
  // parent (WalkInShell) recreates `init` and `onRoomReady` on every
  // render — and a render fires on every keystroke in the variables
  // table — so `start` would change identity, the connect effect would
  // re-run, and the room would tear down + reconnect on each keystroke.
  const onDataMessageRef = useRef(onDataMessage);
  useEffect(() => {
    onDataMessageRef.current = onDataMessage;
  }, [onDataMessage]);
  const onRoomReadyRef = useRef(onRoomReady);
  useEffect(() => {
    onRoomReadyRef.current = onRoomReady;
  }, [onRoomReady]);
  const initRef = useRef(init);
  useEffect(() => {
    initRef.current = init;
  }, [init]);

  // Reconnect state. deliberateRef tells an involuntary drop apart from a
  // user-driven exit (End call / cap / unmount). reconnectTimerRef holds the
  // pending auto-retry. connectRoomRef lets the listener closures + the Rejoin
  // button re-enter connectRoom without re-binding it.
  const deliberateRef = useRef(false);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const connectRoomRef = useRef<() => Promise<void>>(async () => {});
  const clearReconnectTimer = () => {
    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }
  };

  // Lifecycle: tear down room + timers on unmount. Strip listeners FIRST
  // so the Disconnected event during teardown doesn't race us into the
  // 'ended' phase from inside an unmounting component.
  useEffect(() => {
    return () => {
      deliberateRef.current = true;
      clearReconnectTimer();
      const r = roomRef.current;
      if (r) {
        r.removeAllListeners();
        void r.disconnect();
      }
      roomRef.current = null;
      if (hardCapTimerRef.current) clearTimeout(hardCapTimerRef.current);
    };
  }, []);

  // NOTE: we deliberately do NOT auto-mute on tab-hidden. The prior handler
  // muted on `visibilitychange → hidden` with no restore on `visible`, so any
  // backgrounding — switching windows, or on mobile locking the screen /
  // switching apps — silently killed the mic for the rest of the call. On a
  // 50–70 min demo that meant audio "lost in the middle". The mic stays under
  // explicit user control via the Mute button only.

  const endCall = useCallback(() => {
    deliberateRef.current = true;
    clearReconnectTimer();
    const room = roomRef.current;
    if (room) {
      room.removeAllListeners();
      void room.disconnect();
    }
    roomRef.current = null;
    if (hardCapTimerRef.current) {
      clearTimeout(hardCapTimerRef.current);
      hardCapTimerRef.current = null;
    }
    setPhase('ended');
    onEnded?.();
  }, [onEnded]);

  // Connect — or RECONNECT — to the SAME room using the still-valid token
  // (3h TTL). Creates a fresh Room, wires listeners, publishes local tracks,
  // and re-fires onRoomReady so a parent broadcaster rebinds to the new Room.
  // On failure it strips its own listeners (so a hard error can't spin the
  // reconnect path) and rethrows for the caller to surface.
  const connectRoom = useCallback(async () => {
    clearReconnectTimer();
    const sink = remoteContainerRef.current;
    if (sink) while (sink.firstChild) sink.removeChild(sink.firstChild);

    const room = new Room({ adaptiveStream: true, dynacast: true });
    roomRef.current = room;

    const onTrackSubscribed = (
      track: RemoteTrack,
      _pub: RemoteTrackPublication,
      participant: RemoteParticipant,
    ) => {
      const el = track.attach() as HTMLMediaElement;
      el.autoplay = true;
      if (track.kind === Track.Kind.Video) {
        const v = el as HTMLVideoElement;
        v.playsInline = true;
        v.dataset.role = 'remote-video';
      } else if (track.kind === Track.Kind.Audio) {
        el.dataset.role = 'remote-audio';
      }
      el.dataset.participant = participant.identity;
      remoteContainerRef.current?.appendChild(el);
    };
    const onTrackUnsubscribed = (track: RemoteTrack) => {
      track.detach().forEach((el) => el.remove());
    };
    // Count only HUMAN remotes for the call's presence state — a silent scribe
    // (or any agent) joins as a participant but is NOT the person you're
    // meeting, so it must not flip "waiting" → "active" or hide "peer left".
    const hasHumanPeer = () =>
      [...room.remoteParticipants.values()].some((p) => !p.isAgent);
    const onParticipantConnected = () => {
      if (hasHumanPeer()) setPhase('active');
    };
    const onParticipantDisconnected = () => {
      // Peer left — stay connected so a quick rejoin doesn't require re-init.
      // If no human remains, LiveKit's emptyTimeout closes the room and we'll
      // get Disconnected here next.
      if (!hasHumanPeer()) setPhase('peer-waiting');
    };
    // Involuntary drop ONLY — deliberate teardowns (End call / cap / unmount)
    // strip listeners first, so this never fires on a user-driven exit. Show a
    // reconnecting state and auto-retry once after a short beat; if that fails,
    // surface a manual Rejoin ('dropped'). The room is usually still alive with
    // the peer, so reconnecting lands the user right back in the same session.
    const onDisconnect = () => {
      if (deliberateRef.current) return;
      setPhase('reconnecting');
      clearReconnectTimer();
      reconnectTimerRef.current = setTimeout(() => {
        connectRoomRef.current().catch(() => setPhase('dropped'));
      }, RECONNECT_DELAY_MS);
    };
    const onData = (payload: Uint8Array) => {
      try {
        const text = new TextDecoder().decode(payload);
        const parsed: unknown = JSON.parse(text);
        onDataMessageRef.current?.(parsed);
      } catch {
        // Bad payload — ignore.
      }
    };

    const onAudioPlaybackChanged = () => setAudioBlocked(!room.canPlaybackAudio);

    room.on(RoomEvent.TrackSubscribed, onTrackSubscribed);
    room.on(RoomEvent.TrackUnsubscribed, onTrackUnsubscribed);
    room.on(RoomEvent.ParticipantConnected, onParticipantConnected);
    room.on(RoomEvent.ParticipantDisconnected, onParticipantDisconnected);
    room.on(RoomEvent.Disconnected, onDisconnect);
    room.on(RoomEvent.DataReceived, onData);
    room.on(RoomEvent.AudioPlaybackStatusChanged, onAudioPlaybackChanged);

    try {
      await room.connect(initRef.current.wsUrl, initRef.current.token);
      
      // Mic is required; camera is best-effort. Requesting both together
      // means a missing/denied camera (webcam-less desktop, camera in use)
      // fails BOTH and kills the voice call. Acquire audio first, then try
      // video separately and tolerate its failure → call still works audio-only.
      const localTracks: LocalTrack[] = await createLocalTracks({
        audio: true,
        video: false,
      })
      try {
        const [videoTrack] = await createLocalTracks({
          audio: false,
          video: true,
        })
        if (videoTrack) {
          localTracks.push(videoTrack)
          setCamOn(true)
        }
      } catch {
        // No camera / camera denied → audio-only. Reflect it in the control.
        setCamOn(false)
      }
      await Promise.all(
        localTracks.map((t) => room.localParticipant.publishTrack(t)),
      )
      const localVideo = localTracks.find((t) => t.kind === Track.Kind.Video)
      if (localVideo && localVideoRef.current) {
        localVideo.attach(localVideoRef.current)
      }

      // Browser autoplay unblock. Safe to call after a user gesture chain
      // (the "Join" button click that mounted this component counts).
      try {
        await room.startAudio();
      } catch {
        // Autoplay still blocked (the live gesture was lost across the
        // connect await) — the tap-to-enable affordance recovers it.
      }
      setAudioBlocked(!room.canPlaybackAudio);

      if (hasHumanPeer()) setPhase('active');
      else setPhase('peer-waiting');

      onRoomReadyRef.current?.(room);
    } catch (err) {
      // Strip BEFORE disconnect so the Disconnected event can't drive the
      // reconnect path (or the 'ended' race) on a hard error like a denied
      // camera permission. Rethrow — the caller decides how to surface it.
      room.removeAllListeners();
      void room.disconnect();
      roomRef.current = null;
      throw err;
    }
  }, []);
  // Stable ref to connectRoom so listener closures + the Rejoin button can
  // re-enter it without re-binding connectRoom itself.
  useEffect(() => {
    connectRoomRef.current = connectRoom;
  }, [connectRoom]);

  // Manual Rejoin from the 'dropped' overlay — tries the same room again.
  const rejoin = useCallback(() => {
    setPhase('reconnecting');
    connectRoomRef.current().catch(() => setPhase('dropped'));
  }, []);

  const start = useCallback(async () => {
    if (startingRef.current) return;
    startingRef.current = true;
    try {
      await connectRoom();
      // Arm the wall-clock cap ONCE; it measures total session time from the
      // first connect and must survive reconnects (don't re-arm per connect).
      if (!hardCapTimerRef.current) {
        hardCapTimerRef.current = setTimeout(() => {
          console.warn('[demo-call] wall-clock cap reached, ending call');
          endCall();
        }, hardCapMs);
      }
    } catch (err) {
      console.error('[demo-call] connect failed', err);
      const sig = err instanceof Error ? `${err.name} ${err.message}` : '';
      let copy: string;
      if (/NotAllowed|Permission|denied/i.test(sig)) {
        // The browser has a stored "no" for the mic — reloading will NOT
        // re-prompt. Point the user at the per-site permission UI instead.
        copy =
          'Your microphone is blocked. Open this site’s permissions — ' +
          'the lock/camera icon in the address bar (on iPhone, tap ' +
          '“ᴀA” → Website Settings) — set Microphone to ' +
          'Allow, then reload.';
      } else if (/NotFound|NotReadable|Overconstrained|Devices/i.test(sig)) {
        copy =
          'We couldn’t reach a microphone. Check that one is connected ' +
          'and not in use by another app, then reload.';
      } else {
        copy = err instanceof Error ? err.message : 'Could not connect.';
      }
      setErrorMsg(copy);
      setPhase('error');
    } finally {
      startingRef.current = false;
    }
  }, [connectRoom, endCall, hardCapMs]);

  useEffect(() => {
    void start();
  }, [start]);

  // Re-run the autoplay unblock from inside a real user tap. iOS only honours
  // startAudio() within a gesture, so this is wired to a visible affordance,
  // not called automatically. Clears the affordance once playback resumes.
  const enableAudio = useCallback(async () => {
    const room = roomRef.current;
    if (!room) return;
    try {
      await room.startAudio();
    } catch {
      // Still blocked — the affordance stays until playback actually resumes.
    }
    setAudioBlocked(!room.canPlaybackAudio);
  }, []);

  const toggleMic = useCallback(async () => {
    const room = roomRef.current;
    if (!room) return;
    const next = !micOn;
    await room.localParticipant.setMicrophoneEnabled(next);
    setMicOn(next);
  }, [micOn]);

  const toggleCam = useCallback(async () => {
    const room = roomRef.current;
    if (!room) return;
    const next = !camOn;
    await room.localParticipant.setCameraEnabled(next);
    setCamOn(next);
  }, [camOn]);

  return (
    <div className="relative flex h-full w-full flex-col bg-neutral-950 text-neutral-100">
      {/* Remote track sink. CSS makes attached <video> elements fill the
          tile. <audio> elements are sr-only — they still play, they're
          just not visible. */}
      <div
        ref={remoteContainerRef}
        className="relative flex-1 overflow-hidden [&_video]:absolute [&_video]:inset-0 [&_video]:h-full [&_video]:w-full [&_video]:object-cover [&_audio]:sr-only"
      />

      {/* Self-view PiP. Muted (we never want to hear ourselves). */}
      <div className="pointer-events-none absolute right-4 top-4 z-10 h-32 w-44 overflow-hidden rounded-md border border-neutral-800 bg-black shadow-lg">
        <video
          ref={localVideoRef}
          autoPlay
          muted
          playsInline
          className="h-full w-full object-cover"
        />
      </div>

      {/* iOS audio recovery: the whole tile becomes a tap target when the
          browser is blocking playback (autoplay block, or suspension after
          backgrounding / screen-lock). One tap re-runs startAudio(). */}
      {phase === 'active' && audioBlocked && (
        <button
          type="button"
          onClick={() => void enableAudio()}
          className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-1 bg-black/50 text-neutral-100"
          aria-live="polite"
        >
          <span className="text-sm font-medium">Tap to enable sound</span>
          <span className="text-xs text-neutral-300">
            Your device paused the call&rsquo;s audio.
          </span>
        </button>
      )}

      {/* Status overlay covers the remote area when nobody's there yet
          or the call is over. */}
      {phase !== 'active' && (
        <div className="pointer-events-none absolute inset-0 z-0 flex flex-col items-center justify-center gap-3 bg-black/60">
          <p className="text-sm text-neutral-300">
            {phase === 'connecting' && (peerLabel ?? 'Connecting…')}
            {phase === 'peer-waiting' &&
              (peerLabel
                ? `Waiting for ${peerLabel}…`
                : 'Waiting for the other side to join…')}
            {phase === 'reconnecting' && 'Reconnecting…'}
            {phase === 'dropped' &&
              'Connection lost. Your session is still open.'}
            {phase === 'ended' && 'Call ended.'}
            {phase === 'error' && (errorMsg ?? 'Something went wrong.')}
          </p>
          {phase === 'dropped' && (
            <button
              type="button"
              onClick={rejoin}
              className="pointer-events-auto rounded-full bg-neutral-100 px-4 py-2 text-sm font-medium text-neutral-900 hover:bg-white"
            >
              Rejoin
            </button>
          )}
        </div>
      )}

      {/* Controls. */}
      <div className="z-10 flex items-center justify-center gap-3 bg-neutral-900/95 px-4 py-3">
        <button
          type="button"
          onClick={() => void toggleMic()}
          className="rounded-full bg-neutral-800 px-4 py-2 text-sm hover:bg-neutral-700"
        >
          {micOn ? 'Mute' : 'Unmute'}
        </button>
        <button
          type="button"
          onClick={() => void toggleCam()}
          className="rounded-full bg-neutral-800 px-4 py-2 text-sm hover:bg-neutral-700"
        >
          {camOn ? 'Camera off' : 'Camera on'}
        </button>
        <button
          type="button"
          onClick={endCall}
          className="rounded-full bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-500"
        >
          End call
        </button>
      </div>
    </div>
  );
}
