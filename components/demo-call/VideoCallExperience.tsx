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

type Phase = 'connecting' | 'active' | 'peer-waiting' | 'ended' | 'error';

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

  // Lifecycle: tear down room + timers on unmount. Strip listeners FIRST
  // so the Disconnected event during teardown doesn't race us into the
  // 'ended' phase from inside an unmounting component.
  useEffect(() => {
    return () => {
      const r = roomRef.current;
      if (r) {
        r.removeAllListeners();
        void r.disconnect();
      }
      roomRef.current = null;
      if (hardCapTimerRef.current) clearTimeout(hardCapTimerRef.current);
    };
  }, []);

  // Auto-mute when tab hidden — privacy contract, same shape as
  // RitualCallExperience. The user may be reading something private; we
  // don't want a hot mic broadcasting it.
  useEffect(() => {
    if (phase !== 'active' && phase !== 'peer-waiting') return;
    const onVis = () => {
      if (document.visibilityState === 'hidden') {
        const room = roomRef.current;
        if (!room) return;
        void room.localParticipant.setMicrophoneEnabled(false);
        setMicOn(false);
      }
    };
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, [phase]);

  const endCall = useCallback(() => {
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

  const start = useCallback(async () => {
    if (startingRef.current) return;
    startingRef.current = true;

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
    const onParticipantConnected = () => setPhase('active');
    const onParticipantDisconnected = () => {
      // Peer left — stay connected so a quick rejoin doesn't require
      // re-init. If both sides are gone, LiveKit's emptyTimeout closes
      // the room on its own and we'll get Disconnected here next.
      if (room.remoteParticipants.size === 0) setPhase('peer-waiting');
    };
    const onDisconnect = () => setPhase('ended');
    const onData = (payload: Uint8Array) => {
      try {
        const text = new TextDecoder().decode(payload);
        const parsed: unknown = JSON.parse(text);
        onDataMessageRef.current?.(parsed);
      } catch {
        // Bad payload — ignore.
      }
    };

    room.on(RoomEvent.TrackSubscribed, onTrackSubscribed);
    room.on(RoomEvent.TrackUnsubscribed, onTrackUnsubscribed);
    room.on(RoomEvent.ParticipantConnected, onParticipantConnected);
    room.on(RoomEvent.ParticipantDisconnected, onParticipantDisconnected);
    room.on(RoomEvent.Disconnected, onDisconnect);
    room.on(RoomEvent.DataReceived, onData);

    try {
      await room.connect(initRef.current.wsUrl, initRef.current.token);

      // Publish camera + mic together. createLocalTracks gives us the
      // local video reference for the self-view PiP without a second
      // getUserMedia call.
      const localTracks: LocalTrack[] = await createLocalTracks({
        audio: true,
        video: true,
      });
      await Promise.all(
        localTracks.map((t) => room.localParticipant.publishTrack(t)),
      );
      const localVideo = localTracks.find((t) => t.kind === Track.Kind.Video);
      if (localVideo && localVideoRef.current) {
        localVideo.attach(localVideoRef.current);
      }

      // Browser autoplay unblock. Safe to call after a user gesture chain
      // (the "Join" button click that mounted this component counts).
      try {
        await room.startAudio();
      } catch {
        // If the browser still refuses, the user can press the mic
        // button later to re-trigger via another gesture.
      }

      hardCapTimerRef.current = setTimeout(() => {
        console.warn('[demo-call] wall-clock cap reached, ending call');
        endCall();
      }, hardCapMs);

      if (room.remoteParticipants.size > 0) setPhase('active');
      else setPhase('peer-waiting');

      onRoomReadyRef.current?.(room);
    } catch (err) {
      console.error('[demo-call] connect failed', err);
      // STRIP LISTENERS BEFORE disconnect — otherwise the Disconnected
      // event fires and our onDisconnect handler overwrites this
      // 'error' phase with 'ended', so the user sees "The meeting
      // has ended" instead of the actual error (e.g. denied camera
      // permission on mobile Safari). Real bug observed in prod.
      room.removeAllListeners();
      const isMediaErr =
        err instanceof Error &&
        /Permission|NotAllowed|NotReadable|denied/i.test(
          `${err.name} ${err.message}`,
        );
      setErrorMsg(
        isMediaErr
          ? "We couldn't access your camera or microphone. Grant permission and reload the page."
          : err instanceof Error
            ? err.message
            : 'Could not connect.',
      );
      setPhase('error');
      void room.disconnect();
      roomRef.current = null;
    } finally {
      startingRef.current = false;
    }
    // `init` + `onRoomReady` are read via refs (above), so they are
    // intentionally NOT deps — the room must connect once, not on every
    // parent re-render. `hardCapMs` is a value-stable primitive and
    // `endCall` is stable (memoized on the stable `onEnded`).
  }, [hardCapMs, endCall]);

  useEffect(() => {
    void start();
  }, [start]);

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

      {/* Status overlay covers the remote area when nobody's there yet
          or the call is over. */}
      {phase !== 'active' && (
        <div className="pointer-events-none absolute inset-0 z-0 flex items-center justify-center bg-black/60">
          <p className="text-sm text-neutral-300">
            {phase === 'connecting' && (peerLabel ?? 'Connecting…')}
            {phase === 'peer-waiting' &&
              (peerLabel
                ? `Waiting for ${peerLabel}…`
                : 'Waiting for the other side to join…')}
            {phase === 'ended' && 'Call ended.'}
            {phase === 'error' && (errorMsg ?? 'Something went wrong.')}
          </p>
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
