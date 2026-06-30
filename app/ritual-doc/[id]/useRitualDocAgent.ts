'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Room,
  RoomEvent,
  Track,
  type RemoteParticipant,
  type RemoteTrack,
  type RemoteTrackPublication,
} from 'livekit-client';
import type { TabKey } from '@/lib/ritual-doc/schema';

// LiveKit Room hook for the in-editor voice agent. Mirrors
// RitualCallExperience.tsx's wiring (state machine, audio sink, PTT,
// race-trap on deliberate disconnects) and adds the cross-tab handoff
// publish needed by /ritual-doc/[id]. Folds the DataChannel router in
// here too (one hook owns the Room ⇒ one place subscribes to events).

export type AgentPhase =
  | 'idle'
  | 'identifying'
  | 'connecting'
  | 'active'
  | 'handing-off'
  | 'disconnected'
  | 'error';

// Per-tab agent mapping — must match init-agent/route.ts's FLOW_FOR_TAB.
// Tabs absent from this set render the "no guide for this step" affordance.
export const TAB_HAS_AGENT: Record<string, boolean> = {
  beginning: true,
  ritualCall: true,
  ritual: true,
  possibleOrigins: true,
  behaviouralPicture: true,
};

interface InitResponse {
  token: string;
  wsUrl: string;
  roomName: string;
  flow: string;
}

// DataChannel events the worker may publish:
//   qualification:variable_update { name, value }
//     → Beginning tab: route name → H2, write value under that H2
//   ritual-doc:tiptap_update { tab, mode, heading?, text }
//     → route to editor for `tab`, apply mode (append/replace/edit)
export interface DataChannelEvent {
  type: string;
  // qualification:variable_update
  name?: string;
  value?: string;
  // ritual-doc:tiptap_update
  tab?: string;
  mode?: string;
  heading?: string;
  text?: string;
}

const HARD_CAP_MS = 25 * 60 * 1000;

export function useRitualDocAgent(args: {
  docId: string;
  onDataChannelEvent: (event: DataChannelEvent) => void;
}) {
  const { docId, onDataChannelEvent } = args;

  const [phase, setPhase] = useState<AgentPhase>('idle');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [micHot, setMicHot] = useState(false);
  const [activeTab, setActiveTab] = useState<TabKey | null>(null);

  const roomRef = useRef<Room | null>(null);
  const audioContainerRef = useRef<HTMLDivElement | null>(null);
  const startingRef = useRef(false);
  // Distinguishes a deliberate end (user clicked End, or tab change while
  // active triggered a handoff) from an involuntary drop. Set true BEFORE
  // calling room.disconnect(); the Disconnected listener checks it to
  // decide whether to surface a reconnect affordance.
  const deliberateRef = useRef(false);
  const hardCapTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Latest event-callback ref so the listener always invokes the freshest
  // closure without re-subscribing on every render.
  const onEventRef = useRef(onDataChannelEvent);
  useEffect(() => {
    onEventRef.current = onDataChannelEvent;
  }, [onDataChannelEvent]);

  // Unmount: tear down the room.
  useEffect(() => {
    return () => {
      deliberateRef.current = true;
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

  // Auto-mute when the tab is hidden — PTT-to-agent surface, so the
  // privacy contract from samwise-app-livekit-integration applies
  // ("mic off when the user is looking elsewhere"). NOT the video-call
  // anti-pattern: this surface IS push-to-talk by default, so the user
  // expects the mic off and re-engages by holding the button.
  useEffect(() => {
    if (phase !== 'active') return;
    const onVis = () => {
      if (document.visibilityState === 'hidden') void setMic(false);
    };
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, [phase, setMic]);

  // Spacebar PTT. Ignore repeats + skip when typing in an editable
  // surface (INPUT / TEXTAREA / [contenteditable] — Tiptap uses the
  // last one, so this is load-bearing on this surface).
  useEffect(() => {
    if (phase !== 'active') return;
    const isEditable = (el: EventTarget | null) =>
      el instanceof HTMLElement &&
      (/^(INPUT|TEXTAREA)$/.test(el.tagName) ||
        el.isContentEditable);
    const down = (e: KeyboardEvent) => {
      if (e.code !== 'Space' || e.repeat || isEditable(e.target)) return;
      e.preventDefault();
      void setMic(true);
    };
    const up = (e: KeyboardEvent) => {
      if (e.code !== 'Space' || isEditable(e.target)) return;
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

  const dispatch = useCallback(
    async (tab: TabKey) => {
      if (startingRef.current) return;
      if (!TAB_HAS_AGENT[tab]) return;
      startingRef.current = true;
      setErrorMsg(null);
      setPhase('identifying');
      setActiveTab(tab);

      let init: InitResponse;
      try {
        const res = await fetch(`/api/ritual-doc/${docId}/init-agent`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ tab }),
        });
        if (!res.ok) {
          const body = (await res.json().catch(() => ({}))) as {
            error?: string;
          };
          throw new Error(body.error ?? `Init failed (${res.status})`);
        }
        init = (await res.json()) as InitResponse;
      } catch (err) {
        setErrorMsg(
          err instanceof Error ? err.message : 'Could not start the guide.',
        );
        setPhase('error');
        startingRef.current = false;
        return;
      }

      setPhase('connecting');

      const room = new Room({ adaptiveStream: true, dynacast: true });
      roomRef.current = room;
      deliberateRef.current = false;

      const onAgentJoined = (p: RemoteParticipant) => {
        console.log('[ritual-doc-agent] participant joined:', p.identity);
        setPhase('active');
      };
      const onDisconnect = () => {
        setMicHot(false);
        // Handoff path: we already set 'handing-off' before publishing,
        // and we want the parent to dispatch the next tab — keep the
        // phase as 'handing-off' so it doesn't flicker to 'disconnected'.
        if (deliberateRef.current) {
          // 'idle' fits a deliberate end; the parent re-dispatches via
          // dispatch(nextTab) which moves to 'identifying'/'connecting'.
          if (phase !== 'handing-off') setPhase('idle');
        } else {
          setPhase('disconnected');
        }
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
      const onDataReceived = (payload: Uint8Array) => {
        let parsed: DataChannelEvent;
        try {
          parsed = JSON.parse(new TextDecoder().decode(payload)) as DataChannelEvent;
        } catch {
          return;
        }
        try {
          onEventRef.current(parsed);
        } catch (err) {
          console.error('[ritual-doc-agent] data event handler threw', err);
        }
      };

      room.on(RoomEvent.ParticipantConnected, onAgentJoined);
      room.on(RoomEvent.Disconnected, onDisconnect);
      room.on(RoomEvent.TrackSubscribed, onTrackSubscribed);
      room.on(RoomEvent.TrackUnsubscribed, onTrackUnsubscribed);
      room.on(RoomEvent.DataReceived, onDataReceived);

      try {
        await room.connect(init.wsUrl, init.token);
        await room.localParticipant.setMicrophoneEnabled(false);
        try {
          await room.startAudio();
        } catch {
          // Browser blocked autoplay despite gesture chain — the user
          // can press the mic button to re-trigger via another gesture.
        }

        // Arm the wall-clock hard cap ONCE per dispatch — survives the
        // session, cleared on disconnect.
        if (!hardCapTimerRef.current) {
          hardCapTimerRef.current = setTimeout(() => {
            console.warn('[ritual-doc-agent] hard cap reached, disconnecting');
            deliberateRef.current = true;
            room.removeAllListeners();
            void room.disconnect();
            roomRef.current = null;
            hardCapTimerRef.current = null;
            setPhase('disconnected');
          }, HARD_CAP_MS);
        }

        if (room.remoteParticipants.size > 0) setPhase('active');
      } catch (err) {
        console.error('[ritual-doc-agent] room.connect failed:', err);
        // Strip listeners BEFORE disconnect so the Disconnected event
        // doesn't race the error phase.
        room.removeAllListeners();
        setErrorMsg(
          err instanceof Error ? err.message : 'Could not connect.',
        );
        setPhase('error');
        void room.disconnect();
        roomRef.current = null;
      } finally {
        startingRef.current = false;
      }
    },
    [docId, phase],
  );

  const end = useCallback(() => {
    deliberateRef.current = true;
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
    setMicHot(false);
    setActiveTab(null);
    setPhase('idle');
  }, []);

  // Publish a handoff request over the DataChannel. Worker's
  // attachHandoffListener picks it up, fires a verbal farewell, then
  // calls ctx.shutdown('handoff'). Our Disconnected listener flips
  // back to 'idle' (deliberate path); the caller is responsible for
  // dispatching the next tab if appropriate.
  const publishHandoff = useCallback(
    async (toTab: TabKey | null) => {
      const room = roomRef.current;
      if (!room || room.state !== 'connected') return;
      setPhase('handing-off');
      deliberateRef.current = true;
      try {
        await room.localParticipant.publishData(
          new TextEncoder().encode(
            JSON.stringify({
              type: 'ritual-doc:handoff_request',
              to_tab: toTab ?? '',
              to_flow: toTab ?? '',
            }),
          ),
          { reliable: true },
        );
      } catch (err) {
        console.error('[ritual-doc-agent] publishHandoff failed:', err);
      }
    },
    [],
  );

  return {
    phase,
    activeTab,
    errorMsg,
    micHot,
    dispatch,
    end,
    publishHandoff,
    pttDown: () => void setMic(true),
    pttUp: () => void setMic(false),
    // The parent renders this once near the root; LiveKit appends
    // <audio> elements here so the agent's voice plays.
    audioContainerRef,
  };
}
