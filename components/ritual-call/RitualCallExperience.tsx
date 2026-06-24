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

const DOC_LINK_STORAGE_KEY = 'ritual-call:docLink';
const REGISTER_RITUAL_URL =
  'https://registernewritual-b6fhjlgejq-uc.a.run.app';

export function RitualCallExperience() {
  const [phase, setPhase] = useState<Phase>('idle');
  const [docLink, setDocLink] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [micHot, setMicHot] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [sealed, setSealed] = useState(false);
  const [sealError, setSealError] = useState<string | null>(null);

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

  // Hydrate the doc link from localStorage on first mount so a returning
  // user does not have to paste their link again. Cold visits stay blank.
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
    setSealed(false);
    setSealError(null);
    setPhase('identifying');
    try { window.localStorage.setItem(DOC_LINK_STORAGE_KEY, docLink); } catch {}

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

  // POST the cached docLink to the same cloud function the operator console
  // uses. Does NOT disconnect the room — user keeps talking and ends the
  // conversation deliberately when ready. Flips `sealed` on success so the
  // EndedBeat (and the corner button) can reflect the new state.
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

  // End the conversation deliberately (vs. closing the tab). Drops the room
  // immediately so LiveKit minutes stop accruing, then lands the user on the
  // 'ended' beat — the storytelling pivot where they seal what they just
  // shaped. Strip listeners first — otherwise the Disconnected event fires
  // and races us into the 'disconnected' phase instead of 'ended'.
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

  // Leave the post-call beat and return to the paste form so the user can
  // start another conversation from scratch (or seal again with a different
  // Doc link).
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
      {/* Persistent fallback — available at every phase for power users who
          want to seal mid-conversation or without ever calling the agent.
          Kept small and secondary on purpose: the storytelling pivot lives
          in the 'ended' beat below, not here. */}
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
      <h1 className="text-3xl tracking-tight">Ritual call</h1>
      <p className="text-muted-foreground">
        Paste the link to your ritual document. The agent will guide you through filling it in.
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
          Your ritual is set. I'll call you when your times come.
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
        We just shaped your ritual together. Seal it so I can call you at your set times.
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
