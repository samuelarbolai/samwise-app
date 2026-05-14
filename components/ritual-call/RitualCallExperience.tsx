'use client';

import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Room,
  RoomEvent,
  Track,
  type RemoteParticipant,
  type RemoteTrack,
  type RemoteTrackPublication,
} from 'livekit-client';

type Phase = 'idle' | 'identifying' | 'connecting' | 'active' | 'disconnected' | 'error';

interface InitResponse {
  token: string;
  wsUrl: string;
  roomName: string;
}

export function RitualCallExperience() {
  const [phase, setPhase] = useState<Phase>('idle');
  const [docLink, setDocLink] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [micHot, setMicHot] = useState(false);

  const roomRef = useRef<Room | null>(null);
  // Hidden DOM container for <audio> elements that play the agent's voice.
  // LiveKit hands us a track; we attach it to an HTMLAudioElement and append
  // it here so the browser actually routes it to the user's speakers.
  const audioContainerRef = useRef<HTMLDivElement | null>(null);
  // Re-entrancy guard: blocks a second start() from running while one is in
  // flight. Prevents double-dispatch if the user double-clicks, if a stray
  // re-render fires the handler, or if React StrictMode does anything unusual.
  const startingRef = useRef(false);

  // Lifecycle: tear down LiveKit room on unmount.
  useEffect(() => {
    return () => {
      void roomRef.current?.disconnect();
      roomRef.current = null;
    };
  }, []);

  const setMic = useCallback(async (on: boolean) => {
    const room = roomRef.current;
    if (!room || room.state !== 'connected') return;
    try {
      await room.localParticipant.setMicrophoneEnabled(on);
      setMicHot(on);
    } catch (err) {
      console.error('setMicrophoneEnabled failed:', err);
    }
  }, []);

  // Auto-mute when the tab is hidden (user switched to Docs / elsewhere).
  useEffect(() => {
    if (phase !== 'active') return;
    const onVis = () => {
      if (document.visibilityState === 'hidden') void setMic(false);
    };
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, [phase, setMic]);

  // Spacebar push-to-talk while the page is focused. Hold = mic on.
  useEffect(() => {
    if (phase !== 'active') return;
    const isTextField = (el: EventTarget | null) =>
      el instanceof HTMLElement && /^(INPUT|TEXTAREA)$/.test(el.tagName);
    const down = (e: KeyboardEvent) => {
      if (e.code !== 'Space' || e.repeat || isTextField(e.target)) return;
      e.preventDefault();
      void setMic(true);
    };
    const up = (e: KeyboardEvent) => {
      if (e.code !== 'Space' || isTextField(e.target)) return;
      e.preventDefault();
      void setMic(false);
    };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
    };
  }, [phase, setMic]);

  const start = useCallback(async () => {
    if (startingRef.current) return;
    startingRef.current = true;
    setErrorMsg(null);
    setPhase('identifying');

    let init: InitResponse;
    try {
      const res = await fetch('/api/ritual-call/init', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ googleDocLink: docLink }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? `Init failed (${res.status})`);
      }
      init = (await res.json()) as InitResponse;
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Could not start the call.');
      setPhase('error');
      startingRef.current = false;
      return;
    }

    setPhase('connecting');

    const room = new Room({
      adaptiveStream: true,
      dynacast: true,
    });
    roomRef.current = room;

    const onAgentJoined = (p: RemoteParticipant) => {
      console.log('participant joined:', p.identity);
      setPhase('active');
    };
    const onDisconnect = () => {
      setPhase('disconnected');
      setMicHot(false);
    };
    const onTrackSubscribed = (
      track: RemoteTrack,
      _pub: RemoteTrackPublication,
      participant: RemoteParticipant,
    ) => {
      if (track.kind !== Track.Kind.Audio) return;
      const el = track.attach() as HTMLAudioElement;
      el.autoplay = true;
      el.dataset.participant = participant.identity;
      audioContainerRef.current?.appendChild(el);
    };
    const onTrackUnsubscribed = (track: RemoteTrack) => {
      track.detach().forEach((el) => el.remove());
    };

    room.on(RoomEvent.ParticipantConnected, onAgentJoined);
    room.on(RoomEvent.Disconnected, onDisconnect);
    room.on(RoomEvent.TrackSubscribed, onTrackSubscribed);
    room.on(RoomEvent.TrackUnsubscribed, onTrackUnsubscribed);

    try {
      await room.connect(init.wsUrl, init.token);
      // Mic is published but starts muted; user holds the button to speak.
      await room.localParticipant.setMicrophoneEnabled(false);
      // Unblock audio playback. Safe to call without user gesture if the
      // browser already considers the page interacted-with (the form click
      // that triggered start() counts), and a no-op if it's already enabled.
      try {
        await room.startAudio();
      } catch {
        // Browser blocked autoplay despite the gesture chain — the user can
        // press the mic button to re-trigger via another gesture.
      }

      // If the agent already joined before we wired listeners, transition now.
      if (room.remoteParticipants.size > 0) {
        setPhase('active');
      }
    } catch (err) {
      console.error('room.connect failed:', err);
      setErrorMsg(err instanceof Error ? err.message : 'Could not connect to the room.');
      setPhase('error');
      void room.disconnect();
      roomRef.current = null;
    } finally {
      startingRef.current = false;
    }
  }, [docLink]);

  const reconnect = useCallback(() => {
    void roomRef.current?.disconnect();
    roomRef.current = null;
    void start();
  }, [start]);

  // End the conversation deliberately (vs. closing the tab). Drops the room
  // immediately so LiveKit minutes stop accruing, then resets back to the
  // paste-link form so the user can start another call from the same page.
  // Strip listeners first — otherwise the Disconnected event fires and
  // races us into the 'disconnected' phase instead of 'idle'.
  const endConversation = useCallback(() => {
    const room = roomRef.current;
    if (room) {
      room.removeAllListeners();
      void room.disconnect();
    }
    roomRef.current = null;
    setMicHot(false);
    setErrorMsg(null);
    setPhase('idle');
  }, []);

  const isHot = micHot && phase === 'active';

  return (
    <div
      className={`relative flex min-h-screen flex-col items-center justify-center bg-neutral-950 text-neutral-100 px-6 py-12 transition-shadow duration-200 ${
        isHot ? 'shadow-[inset_0_0_120px_24px_rgba(255,140,40,0.55)]' : ''
      }`}
    >
      {/* Persistent header — leaves the conversation and returns to the
          Samwise app shell. Always visible so the user has an exit at any
          phase without resorting to closing the tab. */}
      <header className="absolute left-0 right-0 top-0 flex items-center justify-between px-6 py-4">
        <Link
          href="/"
          onClick={() => {
            void roomRef.current?.disconnect();
            roomRef.current = null;
          }}
          className="inline-flex items-center gap-2 text-sm text-neutral-400 transition-colors hover:text-neutral-100"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Samwise
        </Link>
      </header>

      {phase === 'idle' || phase === 'error' ? (
        <PasteLinkForm
          docLink={docLink}
          onChange={setDocLink}
          onSubmit={start}
          errorMsg={errorMsg}
        />
      ) : null}

      {phase === 'identifying' || phase === 'connecting' ? (
        <Status
          title={phase === 'identifying' ? 'Finding your ritual…' : 'Connecting to the agent…'}
        />
      ) : null}

      {phase === 'active' ? (
        <ActiveControls
          onMicDown={() => void setMic(true)}
          onMicUp={() => void setMic(false)}
          onEnd={endConversation}
          hot={isHot}
        />
      ) : null}

      {phase === 'disconnected' ? <Disconnected onReconnect={reconnect} /> : null}

      {/* Hidden audio sink — LiveKit appends <audio> elements here so the
          agent's voice plays through the user's speakers. */}
      <div ref={audioContainerRef} className="sr-only" aria-hidden />
    </div>
  );
}

function PasteLinkForm({
  docLink,
  onChange,
  onSubmit,
  errorMsg,
}: {
  docLink: string;
  onChange: (v: string) => void;
  onSubmit: () => void;
  errorMsg: string | null;
}) {
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit();
      }}
      className="flex w-full max-w-xl flex-col gap-4"
    >
      <h1 className="text-3xl font-semibold tracking-tight">Ritual call</h1>
      <p className="text-neutral-400">
        Paste the link to your ritual document. The agent will guide you through filling it in.
      </p>
      <input
        autoFocus
        type="url"
        value={docLink}
        onChange={(e) => onChange(e.target.value)}
        placeholder="https://docs.google.com/document/d/…"
        className="w-full rounded-md border border-neutral-700 bg-neutral-900 px-4 py-3 text-base outline-none focus:border-neutral-300"
        required
      />
      <button
        type="submit"
        disabled={!docLink}
        className="w-full rounded-md bg-neutral-100 px-4 py-3 text-base font-medium text-neutral-950 disabled:opacity-40"
      >
        Start
      </button>
      {errorMsg ? <p className="text-sm text-red-400">{errorMsg}</p> : null}
    </form>
  );
}

function Status({ title }: { title: string }) {
  return (
    <div className="flex flex-col items-center gap-3 text-neutral-300">
      <div className="h-2 w-2 animate-pulse rounded-full bg-neutral-100" />
      <p className="text-lg">{title}</p>
    </div>
  );
}

function ActiveControls({
  onMicDown,
  onMicUp,
  onEnd,
  hot,
}: {
  onMicDown: () => void;
  onMicUp: () => void;
  onEnd: () => void;
  hot: boolean;
}) {
  return (
    <div className="flex flex-col items-center gap-6">
      <button
        type="button"
        onMouseDown={onMicDown}
        onMouseUp={onMicUp}
        onMouseLeave={onMicUp}
        onTouchStart={(e) => {
          e.preventDefault();
          onMicDown();
        }}
        onTouchEnd={(e) => {
          e.preventDefault();
          onMicUp();
        }}
        className={`flex h-44 w-44 select-none items-center justify-center rounded-full text-base font-medium transition-all ${
          hot
            ? 'scale-105 bg-orange-400 text-neutral-950 shadow-[0_0_60px_rgba(255,140,40,0.7)]'
            : 'bg-neutral-100 text-neutral-950 hover:bg-neutral-200'
        }`}
      >
        {hot ? 'Listening…' : 'Hold to talk'}
      </button>
      <p className="max-w-md text-center text-sm text-neutral-400">
        Hold the button or the spacebar while you speak. Switch tabs freely — the mic mutes itself
        when this page is hidden.
      </p>
      <button
        type="button"
        onClick={onEnd}
        className="rounded-md border border-neutral-700 px-4 py-2 text-sm text-neutral-300 transition-colors hover:border-neutral-500 hover:text-neutral-100"
      >
        End conversation
      </button>
    </div>
  );
}

function Disconnected({ onReconnect }: { onReconnect: () => void }) {
  return (
    <div className="flex flex-col items-center gap-4">
      <h2 className="text-xl font-semibold">The agent went to sleep.</h2>
      <p className="max-w-md text-center text-neutral-400">
        We disconnected after a long silence to save resources. Tap below to bring the agent back.
      </p>
      <button
        type="button"
        onClick={onReconnect}
        className="rounded-md bg-neutral-100 px-6 py-3 font-medium text-neutral-950"
      >
        Wake the agent
      </button>
    </div>
  );
}
