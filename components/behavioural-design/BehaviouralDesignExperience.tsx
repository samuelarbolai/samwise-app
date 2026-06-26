'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import {
  Room,
  RoomEvent,
  Track,
  type RemoteParticipant,
  type RemoteTrack,
  type RemoteTrackPublication,
} from 'livekit-client';

type Phase =
  | 'idle'
  | 'identifying'
  | 'connecting'
  | 'active'
  | 'disconnected'
  | 'ended'
  | 'error';

interface InitResponse {
  token: string;
  wsUrl: string;
  roomName: string;
}

// Distinct from ritual-call/ritual-creation storage keys so the three
// pages don't fight over the same slot.
const DOC_LINK_STORAGE_KEY = 'behavioural-design:docLink';
const REGISTER_RITUAL_URL =
  'https://registernewritual-b6fhjlgejq-uc.a.run.app';

export function BehaviouralDesignExperience() {
  const [phase, setPhase] = useState<Phase>('idle');
  const [docLink, setDocLink] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [micHot, setMicHot] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [sealed, setSealed] = useState(false);
  const [sealError, setSealError] = useState<string | null>(null);

  const roomRef = useRef<Room | null>(null);
  const audioContainerRef = useRef<HTMLDivElement | null>(null);
  const startingRef = useRef(false);

  useEffect(() => {
    return () => {
      void roomRef.current?.disconnect();
      roomRef.current = null;
    };
  }, []);

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(DOC_LINK_STORAGE_KEY);
      if (saved) setDocLink(saved);
    } catch {
      // localStorage can be unavailable (private mode, blocked storage);
      // fall through to the blank form — the user can still paste manually.
    }
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

  useEffect(() => {
    if (phase !== 'active') return;
    const onVis = () => {
      if (document.visibilityState === 'hidden') void setMic(false);
    };
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, [phase, setMic]);

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
    setSealed(false);
    setSealError(null);
    setPhase('identifying');
    try { window.localStorage.setItem(DOC_LINK_STORAGE_KEY, docLink); } catch {}

    let init: InitResponse;
    try {
      const res = await fetch('/api/behavioural-design/init', {
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
      await room.localParticipant.setMicrophoneEnabled(false);
      try {
        await room.startAudio();
      } catch {
        // Browser blocked autoplay despite the gesture chain — the user can
        // press the mic button to re-trigger via another gesture.
      }
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

  const updateRitual = useCallback(async () => {
    if (!docLink || isUpdating) return;
    setIsUpdating(true);
    setSealError(null);
    try {
      const res = await fetch(REGISTER_RITUAL_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ googleDocLink: docLink }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(data.error ?? `Failed (${res.status})`);
      setSealed(true);
      toast.success('Ritual sealed');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error.';
      setSealError(message);
      toast.error('Could not seal ritual', { description: message });
    } finally {
      setIsUpdating(false);
    }
  }, [docLink, isUpdating]);

  const endConversation = useCallback(() => {
    const room = roomRef.current;
    if (room) {
      room.removeAllListeners();
      void room.disconnect();
    }
    roomRef.current = null;
    setMicHot(false);
    setErrorMsg(null);
    setSealed(false);
    setSealError(null);
    setPhase('ended');
  }, []);

  const restart = useCallback(() => {
    setSealed(false);
    setSealError(null);
    setErrorMsg(null);
    setPhase('idle');
  }, []);

  const isHot = micHot && phase === 'active';

  return (
    <div
      className={`relative flex min-h-screen flex-col items-center justify-center bg-background text-foreground px-6 py-12 transition-shadow duration-200 ${
        isHot ? 'shadow-[inset_0_0_120px_24px_rgba(212,168,90,0.30)]' : ''
      }`}
    >
      <button
        type="button"
        onClick={() => void updateRitual()}
        disabled={!docLink || isUpdating}
        className="absolute right-6 top-6 rounded-md border border-input px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:border-foreground hover:text-foreground disabled:opacity-40"
        title={!docLink ? 'Paste your Doc link first' : 'Seal the ritual now without ending the conversation'}
      >
        {isUpdating ? 'Sealing…' : 'Seal my ritual'}
      </button>

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

      {phase === 'ended' ? (
        <EndedBeat
          onSeal={() => void updateRitual()}
          onRestart={restart}
          sealing={isUpdating}
          sealed={sealed}
          errorMsg={sealError}
        />
      ) : null}

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
      <h1 className="text-3xl tracking-tight">Build your behavioural picture</h1>
      <p className="text-muted-foreground">
        Paste the link to your ritual document. The clinician will walk you back through the moments
        where the loop turned on, write the timeline for you, and then synthesise the picture
        together — the behaviour, the enemy, what feeds it. You do not have to type. Just talk.
      </p>
      <input
        autoFocus
        type="url"
        value={docLink}
        onChange={(e) => onChange(e.target.value)}
        placeholder="https://docs.google.com/document/d/…"
        className="w-full rounded-md border border-input bg-transparent px-4 py-3 text-base outline-none transition-[color,box-shadow] focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
        required
      />
      <button
        type="submit"
        disabled={!docLink}
        className="w-full rounded-md bg-primary px-4 py-3 text-base font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-40"
      >
        Start
      </button>
      {errorMsg ? <p className="text-sm text-destructive">{errorMsg}</p> : null}
    </form>
  );
}

function Status({ title }: { title: string }) {
  return (
    <div className="flex flex-col items-center gap-3 text-muted-foreground">
      <div className="h-2 w-2 animate-pulse rounded-full bg-[var(--accent-gold)]" />
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
            ? 'scale-105 bg-[var(--accent-gold)] text-[#1A1A1A] shadow-[0_0_60px_rgba(212,168,90,0.6)]'
            : 'bg-primary text-primary-foreground hover:bg-primary/90'
        }`}
      >
        {hot ? 'Listening…' : 'Hold to talk'}
      </button>
      <p className="max-w-md text-center text-sm text-muted-foreground">
        Hold the button or the spacebar while you speak. Switch tabs freely — the mic mutes itself
        when this page is hidden.
      </p>
      <button
        type="button"
        onClick={onEnd}
        className="rounded-md border border-input px-4 py-2 text-sm text-muted-foreground transition-colors hover:border-foreground hover:text-foreground"
      >
        I'm done — seal my ritual
      </button>
    </div>
  );
}

function Disconnected({ onReconnect }: { onReconnect: () => void }) {
  return (
    <div className="flex flex-col items-center gap-4">
      <h2 className="text-xl">The agent went to sleep.</h2>
      <p className="max-w-md text-center text-muted-foreground">
        We disconnected after a long silence to save resources. Tap below to bring the agent back.
      </p>
      <button
        type="button"
        onClick={onReconnect}
        className="rounded-md bg-primary px-6 py-3 font-medium text-primary-foreground transition-colors hover:bg-primary/90"
      >
        Wake the agent
      </button>
    </div>
  );
}

function EndedBeat({
  onSeal,
  onRestart,
  sealing,
  sealed,
  errorMsg,
}: {
  onSeal: () => void;
  onRestart: () => void;
  sealing: boolean;
  sealed: boolean;
  errorMsg: string | null;
}) {
  if (sealed) {
    return (
      <div className="flex max-w-md flex-col items-center gap-5 text-center">
        <h1 className="text-3xl tracking-tight">Sealed.</h1>
        <p className="text-muted-foreground">
          Your ritual is set. I&apos;ll call you when your times come.
        </p>
        <button
          type="button"
          onClick={onRestart}
          className="text-sm text-muted-foreground underline-offset-4 transition-colors hover:text-foreground hover:underline"
        >
          talk to me again
        </button>
      </div>
    );
  }

  return (
    <div className="flex w-full max-w-md flex-col items-center gap-6 text-center">
      <h1 className="text-3xl tracking-tight">Almost there.</h1>
      <p className="text-muted-foreground">
        We just mapped your behavioural picture together. Seal it so I can call you at your set times.
      </p>
      <button
        type="button"
        onClick={onSeal}
        disabled={sealing}
        className="w-full rounded-md bg-primary px-4 py-3 text-base font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-40"
      >
        {sealing ? 'Sealing…' : 'Seal my ritual'}
      </button>
      {errorMsg ? <p className="text-sm text-destructive">{errorMsg}</p> : null}
      <button
        type="button"
        onClick={onRestart}
        className="text-sm text-muted-foreground underline-offset-4 transition-colors hover:text-foreground hover:underline"
      >
        not done yet? talk to me again
      </button>
    </div>
  );
}
