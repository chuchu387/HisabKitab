"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { Phone, PhoneOff, Video, VideoOff, Mic, MicOff, MonitorUp, MonitorOff, X } from "lucide-react";
import { endCall, getCallEvents, joinCall as joinCallAction, respondToCall, sendSignal, startCall as startCallAction } from "@/actions/calls";
import { useRealtime, type RealtimeCall } from "@/hooks/use-realtime";
import { startRingtone, stopRingtone, unlockAudio } from "@/lib/ringtone";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

type CallMode = "audio" | "video";
type MyRole = "initiator" | "callee" | "member";

type CallParticipant = { userId: string; name: string; status: string };

type ActiveCall = {
  callId: string;
  mode: CallMode;
  status: "ringing" | "active";
  role: MyRole;
  peerName: string;
};

type IncomingCall = {
  callId: string;
  mode: CallMode;
  initiatorName: string;
  initiatorId: string;
};

type PeerHandle = {
  peer: RTCPeerConnection;
  targetId: string;
  remoteDescriptionSet: boolean;
  pendingCandidates: RTCIceCandidateInit[];
};

const CallContext = createContext<{
  activeCall: ActiveCall | null;
  busy: boolean;
  joinableCalls: RealtimeCall[];
  startCall: (groupId: string, target: string, targetName: string, mode: CallMode) => Promise<void>;
  joinCall: (callId: string) => Promise<void>;
}>({ activeCall: null, busy: false, joinableCalls: [], startCall: async () => {}, joinCall: async () => {} });

export function useCalls() {
  return useContext(CallContext);
}

function getIceServers() {
  try {
    const configured = process.env.NEXT_PUBLIC_ICE_SERVERS;
    if (configured) {
      const parsed = JSON.parse(configured);
      if (Array.isArray(parsed) && parsed.length) return parsed;
    }
  } catch {}
  return [{ urls: "stun:stun.l.google.com:19302" }];
}

const POLL_MS = 800;
const RING_TIMEOUT_MS = 90000;

export function CallProvider({ userId, userName, children }: { userId: string; userName: string; children: React.ReactNode }) {
  const { calls } = useRealtime({ unreadCount: 0, notifications: [], chatGroups: [] });
  const [activeCall, setActiveCall] = useState<ActiveCall | null>(null);
  const [incoming, setIncoming] = useState<IncomingCall | null>(null);
  const [participants, setParticipants] = useState<CallParticipant[]>([]);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStreams, setRemoteStreams] = useState<Map<string, MediaStream>>(new Map());
  const [cameraOn, setCameraOn] = useState(true);
  const [micOn, setMicOn] = useState(true);
  const [sharing, setSharing] = useState(false);
  const [sharedStream, setSharedStream] = useState<MediaStream | null>(null);
  const [joinBanner, setJoinBanner] = useState<{ callId: string; groupName: string; initiatorName: string; mode: CallMode } | null>(null);

  const peersRef = useRef<Map<string, PeerHandle>>(new Map());
  const orphanCandidatesRef = useRef<Map<string, RTCIceCandidateInit[]>>(new Map());
  const localStreamRef = useRef<MediaStream | null>(null);
  const remoteStreamsRef = useRef<Map<string, MediaStream>>(new Map());
  const screenStreamRef = useRef<MediaStream | null>(null);
  const activeRef = useRef<ActiveCall | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastEventId = useRef<string>("");
  const endedLocally = useRef(false);
  const acceptedCallIds = useRef(new Set<string>());
  const startedAtRef = useRef(0);
  const dismissedJoinCalls = useRef(new Set<string>());
  const acceptingRef = useRef(false);

  activeRef.current = activeCall;

  useEffect(() => {
    const unlock = () => unlockAudio();
    window.addEventListener("pointerdown", unlock);
    window.addEventListener("keydown", unlock);
    return () => {
      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("keydown", unlock);
    };
  }, []);

  const dispose = useCallback(() => {
    if (pollRef.current) { clearTimeout(pollRef.current); pollRef.current = null; }
    stopRingtone();
    for (const handle of peersRef.current.values()) {
      try { handle.peer.close(); } catch {}
    }
    peersRef.current.clear();
    orphanCandidatesRef.current.clear();
    localStreamRef.current?.getTracks().forEach((track) => track.stop());
    localStreamRef.current = null;
    screenStreamRef.current?.getTracks().forEach((track) => track.stop());
    screenStreamRef.current = null;
    for (const stream of remoteStreamsRef.current.values()) {
      stream.getTracks().forEach((track) => track.stop());
    }
    remoteStreamsRef.current.clear();
    lastEventId.current = "";
    startedAtRef.current = 0;
  }, []);

  const cleanup = useCallback((toastMessage?: string) => {
    dispose();
    setLocalStream(null);
    setRemoteStreams(new Map());
    setParticipants([]);
    setIncoming(null);
    setActiveCall(null);
    setSharing(false);
    setSharedStream(null);
    if (toastMessage) toast.message(toastMessage);
  }, [dispose]);

  useEffect(() => {
    return () => dispose();
  }, [dispose]);

  const sendTo = useCallback((callId: string, targetId: string | null, type: string, payload: unknown) => {
    return sendSignal(callId, targetId, type, payload).catch(() => undefined);
  }, []);

  const createPeer = useCallback((callId: string, targetId: string, stream: MediaStream | null): PeerHandle => {
    const peer = new RTCPeerConnection({ iceServers: getIceServers() });
    if (stream) stream.getTracks().forEach((track) => peer.addTrack(track, stream));
    peer.onicecandidate = (event) => {
      if (!event.candidate) return;
      sendTo(callId, targetId, "ice", { candidate: event.candidate.toJSON() });
    };
    peer.ontrack = (event) => {
      const stream = event.streams[0];
      if (stream) {
        remoteStreamsRef.current.set(targetId, stream);
        setRemoteStreams(new Map(remoteStreamsRef.current));
      } else if (event.track.kind === "audio" || event.track.kind === "video") {
        const merged = remoteStreamsRef.current.get(targetId) ?? new MediaStream();
        merged.addTrack(event.track);
        remoteStreamsRef.current.set(targetId, merged);
        setRemoteStreams(new Map(remoteStreamsRef.current));
      }
    };
    peer.onconnectionstatechange = () => {
      if (["failed", "closed"].includes(peer.connectionState)) {
        peersRef.current.delete(targetId);
        try { peer.close(); } catch {}
        const stream = remoteStreamsRef.current.get(targetId);
        if (stream) {
          stream.getTracks().forEach((track) => track.stop());
          remoteStreamsRef.current.delete(targetId);
          setRemoteStreams(new Map(remoteStreamsRef.current));
        }
      }
    };
    const handle: PeerHandle = { peer, targetId, remoteDescriptionSet: false, pendingCandidates: [] };
    peersRef.current.set(targetId, handle);
    return handle;
  }, [sendTo]);

  const getOrCreatePeer = useCallback((callId: string, targetId: string) => {
    return peersRef.current.get(targetId) ?? createPeer(callId, targetId, localStreamRef.current);
  }, [createPeer]);

  const flushCandidates = useCallback(async (handle: PeerHandle, targetId: string) => {
    const orphans = orphanCandidatesRef.current.get(targetId) ?? [];
    orphanCandidatesRef.current.delete(targetId);
    const all = [...orphans, ...handle.pendingCandidates];
    handle.pendingCandidates = [];
    for (const candidate of all) {
      try { await handle.peer.addIceCandidate(candidate); } catch {}
    }
  }, []);

  const offerTo = useCallback(async (callId: string, targetId: string) => {
    if (peersRef.current.has(targetId)) return;
    const handle = createPeer(callId, targetId, localStreamRef.current);
    try {
      const offer = await handle.peer.createOffer();
      await handle.peer.setLocalDescription(offer);
      sendTo(callId, targetId, "offer", { sdp: offer.sdp });
    } catch {}
  }, [createPeer, sendTo]);

  const setupLocalStream = useCallback(async (mode: CallMode) => {
    const constraints: MediaStreamConstraints = { audio: true, video: mode === "video" };
    try {
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      localStreamRef.current = stream;
      setLocalStream(stream);
      setCameraOn(mode === "video");
      setMicOn(true);
      return stream;
    } catch {
      if (mode === "video") {
        try {
          const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
          localStreamRef.current = stream;
          setLocalStream(stream);
          setCameraOn(false);
          setMicOn(true);
          return stream;
        } catch {
          return null;
        }
      }
      return null;
    }
  }, []);

  const replaceVideoTrackOnPeers = useCallback((track: MediaStreamTrack | null) => {
    for (const handle of peersRef.current.values()) {
      const sender = handle.peer.getSenders().find((s) => s.track?.kind === "video");
      if (sender) {
        try { sender.replaceTrack(track); } catch {}
      }
    }
  }, []);

  const stopShare = useCallback(() => {
    const screenTrack = screenStreamRef.current?.getVideoTracks()[0] ?? null;
    const cameraTrack = localStreamRef.current?.getVideoTracks()[0] ?? null;
    if (screenTrack) replaceVideoTrackOnPeers(cameraTrack);
    screenStreamRef.current?.getTracks().forEach((track) => track.stop());
    screenStreamRef.current = null;
    setSharing(false);
    setSharedStream(null);
  }, [replaceVideoTrackOnPeers]);

  const startShare = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: false });
      screenStreamRef.current = stream;
      const screenTrack = stream.getVideoTracks()[0];
      if (!screenTrack) {
        stream.getTracks().forEach((track) => track.stop());
        screenStreamRef.current = null;
        return;
      }
      screenTrack.onended = () => stopShare();
      replaceVideoTrackOnPeers(screenTrack);
      setSharing(true);
      setSharedStream(stream);
    } catch {
      toast.error("Screen share unavailable");
    }
  }, [replaceVideoTrackOnPeers, stopShare]);

  const hangUp = useCallback(async () => {
    const call = activeRef.current;
    if (!call) return;
    endedLocally.current = true;
    await endCall(call.callId).catch(() => undefined);
    cleanup();
  }, [cleanup]);

  const processEvent = useCallback(async (event: { id: string; type: string; from: string; payload: any }) => {
    const call = activeRef.current;
    if (!call) return;
    if (event.type === "accepted") {
      if (call.role === "initiator" && call.status === "ringing") {
        setActiveCall({ ...call, status: "active" });
      }
      const stream = localStreamRef.current ?? (await setupLocalStream(call.mode).catch(() => null));
      if (!stream) {
        toast.error("Microphone access required");
        hangUp();
        return;
      }
      await offerTo(call.callId, event.from);
      return;
    }
    if (event.type === "joined") {
      if (event.from === String(userId)) return;
      const stream = localStreamRef.current ?? (await setupLocalStream(call.mode).catch(() => null));
      if (!stream) {
        toast.error("Microphone access required");
        hangUp();
        return;
      }
      await offerTo(call.callId, event.from);
      return;
    }
    if (event.type === "offer") {
      const handle = getOrCreatePeer(call.callId, event.from);
      if (handle.remoteDescriptionSet || handle.peer.signalingState !== "stable") return;
      await handle.peer.setRemoteDescription({ type: "offer", sdp: event.payload.sdp });
      handle.remoteDescriptionSet = true;
      await flushCandidates(handle, event.from);
      const answer = await handle.peer.createAnswer();
      await handle.peer.setLocalDescription(answer);
      sendTo(call.callId, event.from, "answer", { sdp: answer.sdp });
      return;
    }
    if (event.type === "answer") {
      const handle = getOrCreatePeer(call.callId, event.from);
      if (handle.remoteDescriptionSet || handle.peer.signalingState !== "have-local-offer") return;
      await handle.peer.setRemoteDescription({ type: "answer", sdp: event.payload.sdp });
      handle.remoteDescriptionSet = true;
      await flushCandidates(handle, event.from);
      return;
    }
    if (event.type === "ice") {
      const candidate = event.payload.candidate as RTCIceCandidateInit;
      const handle = peersRef.current.get(event.from);
      if (!handle) {
        const queue = orphanCandidatesRef.current.get(event.from) ?? [];
        queue.push(candidate);
        orphanCandidatesRef.current.set(event.from, queue);
        return;
      }
      if (handle.remoteDescriptionSet) {
        try { await handle.peer.addIceCandidate(candidate); } catch {}
      } else {
        handle.pendingCandidates.push(candidate);
      }
      return;
    }
    if (event.type === "declined") {
      if (call.role === "initiator") {
        cleanup(`${event.payload?.name ?? "The other user"} declined the call`);
      }
      return;
    }
    if (event.type === "left") {
      const handle = peersRef.current.get(event.from);
      if (handle) {
        peersRef.current.delete(event.from);
        try { handle.peer.close(); } catch {}
      }
      const stream = remoteStreamsRef.current.get(event.from);
      if (stream) {
        stream.getTracks().forEach((track) => track.stop());
        remoteStreamsRef.current.delete(event.from);
        setRemoteStreams(new Map(remoteStreamsRef.current));
      }
      return;
    }
    if (event.type === "ended") {
      if (!endedLocally.current) cleanup("Call ended");
      return;
    }
  }, [cleanup, flushCandidates, getOrCreatePeer, hangUp, offerTo, sendTo, setupLocalStream, userId]);

  const startPolling = useCallback((call: ActiveCall) => {
    if (pollRef.current) { clearTimeout(pollRef.current); pollRef.current = null; }
    const tick = async () => {
      const current = activeRef.current;
      if (!current) {
        if (pollRef.current) { clearTimeout(pollRef.current); pollRef.current = null; }
        return;
      }
      try {
        if (current.status === "ringing" && Date.now() - startedAtRef.current > RING_TIMEOUT_MS) {
          toast.message("No answer — call ended");
          hangUp();
          return;
        }
        const result = await getCallEvents(current.callId, lastEventId.current || null).catch(() => null);
        if (!result?.ok) return;
        if (Array.isArray(result.participants)) setParticipants(result.participants);
        const events = result.events ?? [];
        for (const event of events) {
          lastEventId.current = event.id;
          if (event.type === "ended") {
            if (!endedLocally.current) cleanup("Call ended");
            return;
          }
          if (event.type === "declined") {
            if (current.role === "initiator") {
              cleanup(`${event.payload?.name ?? "The other user"} declined the call`);
              return;
            }
            continue;
          }
          try {
            await processEvent(event);
          } catch (error) {
            console.error("call event processing failed", event.type, error);
          }
        }
        if (!activeRef.current) return;
        if (result.status === "ended") {
          if (!endedLocally.current) cleanup("Call ended");
          return;
        }
      } catch {}
      if (activeRef.current) {
        pollRef.current = setTimeout(tick, POLL_MS);
      }
    };
    pollRef.current = setTimeout(tick, 0);
  }, [cleanup, hangUp, processEvent]);

  useEffect(() => {
    if (!activeCall) return;
    if (activeCall.status === "ringing" && activeCall.role === "initiator") {
      startRingtone();
    } else if (activeCall.status === "active") {
      stopRingtone();
    }
  }, [activeCall?.status, activeCall?.role, activeCall?.callId]);

  useEffect(() => {
    if (!incoming || activeRef.current) return;
    startRingtone();
    return () => stopRingtone();
  }, [incoming]);

  useEffect(() => {
    for (const call of calls) {
      if (activeRef.current) continue;
      if (incoming?.callId === call.callId) continue;
      if (acceptedCallIds.current.has(call.callId)) continue;
      if (String(call.initiatorId) === String(userId)) continue;
      if (call.myStatus === "invited" && call.status === "ringing") {
        setIncoming({ callId: call.callId, mode: call.mode, initiatorName: call.initiatorName || "A colleague", initiatorId: String(call.initiatorId) });
      }
    }
    if (incoming && !calls.some((call) => call.callId === incoming.callId)) {
      stopRingtone();
      setIncoming(null);
      toast.message("Call ended");
    }
    if (activeRef.current && !calls.some((call) => call.callId === activeRef.current!.callId)) {
      cleanup(endedLocally.current ? undefined : "Call ended");
    }
  }, [calls, userId, incoming?.callId, cleanup]);

  useEffect(() => {
    if (activeRef.current || incoming) {
      setJoinBanner(null);
      return;
    }
    const joinable = calls
      .filter(
        (call) =>
          (call.myStatus === "none" || call.myStatus === "ended") &&
          String(call.initiatorId) !== String(userId) &&
          (call.status === "ringing" || call.status === "active") &&
          !dismissedJoinCalls.current.has(call.callId)
      )
      .sort((a, b) => (b.createdAt ?? "").localeCompare(a.createdAt ?? ""))[0];
    if (joinable) {
      setJoinBanner((prev) =>
        prev?.callId === joinable.callId
          ? prev
          : { callId: joinable.callId, groupName: joinable.groupName || "your group", initiatorName: joinable.initiatorName || "Someone", mode: joinable.mode }
      );
    } else {
      setJoinBanner(null);
    }
  }, [calls, userId, incoming, activeCall]);

  useEffect(() => {
    if (joinBanner && !incoming && !activeCall) {
      startRingtone();
      return () => stopRingtone();
    }
  }, [joinBanner, incoming, activeCall]);

  const dismissJoinBanner = useCallback(() => {
    if (joinBanner) dismissedJoinCalls.current.add(joinBanner.callId);
    setJoinBanner(null);
  }, [joinBanner]);

  const joinableCalls = useMemo(() => {
    if (activeCall) return [];
    return calls.filter(
      (call) =>
        (call.myStatus === "none" || call.myStatus === "ended" || call.myStatus === "invited") &&
        String(call.initiatorId) !== String(userId) &&
        (call.status === "ringing" || call.status === "active")
    );
  }, [calls, userId, activeCall]);

  const startCall = useCallback(async (groupId: string, target: string, targetName: string, mode: CallMode) => {
    if (activeRef.current) {
      toast.error("You are already in a call");
      return;
    }
    const result = await startCallAction(groupId, mode, target);
    if (!result.ok || !result.data) {
      toast.error(result.message ?? "Could not start call");
      return;
    }
    const stream = await setupLocalStream(mode);
    if (!stream) {
      await endCall(result.data.callId).catch(() => undefined);
      toast.error("Microphone access is required to call");
      return;
    }
    const call: ActiveCall = {
      callId: result.data.callId,
      mode,
      status: "ringing",
      role: "initiator",
      peerName: targetName
    };
    endedLocally.current = false;
    startedAtRef.current = Date.now();
    setActiveCall(call);
    setParticipants(result.data.participants);
    startPolling(call);
  }, [setupLocalStream, startPolling]);

  const accept = useCallback(async (incomingCall: IncomingCall) => {
    if (acceptingRef.current) return;
    acceptingRef.current = true;
    const callId = incomingCall.callId;
    stopRingtone();
    setIncoming(null);
    try {
      const result = await respondToCall(callId, true).catch((error: unknown) => ({
        ok: false,
        message: error instanceof Error ? error.message : "Could not join call"
      }));
      if (!result.ok) {
        toast.error(result.message ?? "Could not join call");
        return;
      }
      acceptedCallIds.current.add(callId);
      const stream = await setupLocalStream(incomingCall.mode);
      if (!stream) {
        await endCall(callId).catch(() => undefined);
        toast.error("Microphone access required — call declined");
        cleanup();
        return;
      }
      const call: ActiveCall = {
        callId,
        mode: incomingCall.mode,
        status: "active",
        role: "callee",
        peerName: incomingCall.initiatorName
      };
      endedLocally.current = false;
      startedAtRef.current = Date.now();
      setActiveCall(call);
      setParticipants([
        { userId: incomingCall.initiatorId, name: incomingCall.initiatorName, status: "accepted" },
        { userId, name: userName, status: "accepted" }
      ]);
      startPolling(call);
    } catch (error) {
      console.error("accept call failed", error);
      toast.error(error instanceof Error ? error.message : "Could not join the call");
      cleanup();
    } finally {
      acceptingRef.current = false;
    }
  }, [cleanup, setupLocalStream, startPolling, userId, userName]);

  const joinCall = useCallback(async (callId: string) => {
    if (activeRef.current) {
      toast.error("You are already in a call");
      return;
    }
    if (acceptingRef.current) return;
    acceptingRef.current = true;
    dismissedJoinCalls.current.add(callId);
    try {
      const callInfo = calls.find((c) => c.callId === callId);
      const result = await joinCallAction(callId).catch((error: unknown) => ({
        ok: false,
        message: error instanceof Error ? error.message : "Could not join call"
      }));
      if (!result.ok || !("data" in result) || !result.data) {
        toast.error(result.message ?? "Could not join call");
        return;
      }
      const mode = callInfo?.mode ?? "audio";
      const stream = await setupLocalStream(mode);
      if (!stream) {
        await endCall(callId).catch(() => undefined);
        toast.error("Microphone access required");
        cleanup();
        return;
      }
      const call: ActiveCall = {
        callId,
        mode,
        status: "active",
        role: "member",
        peerName: ""
      };
      endedLocally.current = false;
      setActiveCall(call);
      setParticipants(result.data.participants);
      startPolling(call);
    } catch (error) {
      console.error("join call failed", error);
      toast.error(error instanceof Error ? error.message : "Could not join the call");
      cleanup();
    } finally {
      acceptingRef.current = false;
    }
  }, [calls, cleanup, setupLocalStream, startPolling]);

  const decline = useCallback(async () => {
    if (!incoming || acceptingRef.current) return;
    stopRingtone();
    setIncoming(null);
    try {
      await respondToCall(incoming.callId, false);
    } catch (error) {
      console.error("decline call failed", error);
    }
  }, [incoming]);

  const toggleMute = useCallback(() => {
    const stream = localStreamRef.current;
    if (!stream) return;
    const enabled = !micOn;
    stream.getAudioTracks().forEach((track) => (track.enabled = enabled));
    setMicOn(enabled);
  }, [micOn]);

  const toggleCamera = useCallback(() => {
    const stream = localStreamRef.current;
    if (!stream) return;
    const enabled = !cameraOn;
    stream.getVideoTracks().forEach((track) => (track.enabled = enabled));
    setCameraOn(enabled);
  }, [cameraOn]);

  const active = activeCall;
  const showIncoming = incoming && !active;

  const visibleParticipants = useMemo(() => {
    return participants.filter((p) => p.status === "accepted" || p.status === "invited");
  }, [participants]);

  const tiles = useMemo(() => {
    if (!active || active.mode !== "video") return [];
    const others = visibleParticipants.filter((p) => p.userId !== userId);
    const tiles = [{ userId, name: userName, stream: sharing && sharedStream ? sharedStream : localStream, isMe: true }];
    for (const p of others) {
      tiles.push({ userId: p.userId, name: p.name, stream: remoteStreams.get(p.userId) ?? null, isMe: false });
    }
    return tiles;
  }, [active, visibleParticipants, remoteStreams, localStream, sharing, sharedStream, userId, userName]);

  return (
    <CallContext.Provider value={{ activeCall: active, busy: !!active, joinableCalls, startCall, joinCall }}>
      {children}
      {showIncoming && (
        <div className="fixed inset-0 z-[200] flex flex-col items-center justify-center gap-6 bg-slate-950/95 px-6 text-white">
          <div className="flex h-24 w-24 items-center justify-center rounded-full bg-primary/25 text-3xl font-bold">{incoming.initiatorName.charAt(0).toUpperCase()}</div>
          <div className="text-center">
            <p className="text-xl font-semibold">{incoming.initiatorName}</p>
            <p className="mt-1 text-sm text-white/60">{incoming.mode === "video" ? "Incoming video call" : "Incoming audio call"}</p>
          </div>
          <div className="flex items-center gap-4">
            <button type="button" onClick={decline} className="flex h-14 w-14 items-center justify-center rounded-full bg-red-600 text-white transition hover:bg-red-700" aria-label="Decline call">
              <PhoneOff className="h-6 w-6" />
            </button>
            <button type="button" onClick={() => accept(incoming)} className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-600 text-white transition hover:bg-emerald-700" aria-label="Accept call">
              <Phone className="h-6 w-6" />
            </button>
          </div>
        </div>
      )}
      {joinBanner && (
        <div className="fixed left-1/2 top-4 z-[250] w-[min(94vw,380px)] -translate-x-1/2 rounded-xl border bg-card p-3 shadow-xl">
          <div className="flex items-center gap-3">
            <span className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/15">
              <Phone className="h-4 w-4 animate-pulse text-primary" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold">{joinBanner.initiatorName} started a {joinBanner.mode} call</p>
              <p className="truncate text-xs text-muted-foreground">in {joinBanner.groupName}</p>
            </div>
          </div>
          <div className="mt-2 flex items-center gap-2">
            <button type="button" onClick={() => joinCall(joinBanner.callId)} className="flex h-8 flex-1 items-center justify-center gap-1.5 rounded-lg bg-primary text-xs font-semibold text-primary-foreground transition hover:bg-primary/90">
              <Phone className="h-3.5 w-3.5" /> Join now
            </button>
            <button type="button" onClick={dismissJoinBanner} className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-secondary/40" aria-label="Dismiss">
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
      {active && (
        <div className="fixed inset-0 z-[200] flex flex-col bg-slate-950/95 text-white">
          <div className="flex min-h-0 flex-1 p-3 sm:p-4">
            {active.mode === "video" ? (
              <div className="grid h-full w-full grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {tiles.map((tile) => (
                  <div key={tile.userId} className="relative min-h-0 overflow-hidden rounded-xl border border-white/10 bg-black">
                    {tile.stream ? (
                      <video
                        autoPlay
                        playsInline
                        muted={tile.isMe}
                        className="absolute inset-0 h-full w-full object-contain"
                        ref={(el) => { if (el && el.srcObject !== tile.stream) el.srcObject = tile.stream; }}
                      />
                    ) : (
                      <div className="absolute inset-0 flex flex-col items-center justify-center gap-2">
                        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/25 text-2xl font-bold">{tile.name.charAt(0).toUpperCase()}</div>
                        <p className="text-xs text-white/60">{tile.name}</p>
                      </div>
                    )}
                    <p className="absolute bottom-2 left-2 rounded bg-black/50 px-2 py-0.5 text-[10px] text-white/80">{tile.isMe ? "You" : tile.name}</p>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex flex-1 flex-col items-center justify-center gap-4 px-6 text-center">
                {Array.from(remoteStreams.entries()).map(([remoteId, stream]) => (
                  <audio
                    key={remoteId}
                    autoPlay
                    playsInline
                    className="hidden"
                    ref={(el) => { if (el && el.srcObject !== stream) el.srcObject = stream; }}
                  />
                ))}
                <div className="flex h-24 w-24 items-center justify-center rounded-full bg-primary/25 text-4xl font-bold">{(active.peerName || "G").charAt(0).toUpperCase()}</div>
                <div>
                  <p className="text-lg font-semibold">{active.peerName || "Group call"}</p>
                  <p className="text-sm text-white/60">{active.status === "ringing" ? "Ringing..." : `${visibleParticipants.length} in call`}</p>
                </div>
                {visibleParticipants.length > 1 && (
                  <div className="flex max-w-md flex-wrap items-center justify-center gap-2">
                    {visibleParticipants.map((p) => (
                      <span key={p.userId} className="flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 text-xs">
                        <span className="flex h-4 w-4 items-center justify-center rounded-full bg-primary/30 text-[8px] font-bold">{p.name.charAt(0).toUpperCase()}</span>
                        {p.name}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
          <div className="flex items-center justify-center gap-4 p-4 sm:p-6">
            <button type="button" onClick={toggleMute} className={cn("flex h-12 w-12 items-center justify-center rounded-full transition", micOn ? "bg-white/10 hover:bg-white/20" : "bg-red-600 hover:bg-red-700")} aria-label="Toggle microphone">
              {micOn ? <Mic className="h-5 w-5" /> : <MicOff className="h-5 w-5" />}
            </button>
            {active.mode === "video" && (
              <>
                <button type="button" onClick={sharing ? stopShare : startShare} className={cn("flex h-12 w-12 items-center justify-center rounded-full transition", sharing ? "bg-emerald-600 hover:bg-emerald-700" : "bg-white/10 hover:bg-white/20")} aria-label={sharing ? "Stop sharing screen" : "Share screen"}>
                  {sharing ? <MonitorOff className="h-5 w-5" /> : <MonitorUp className="h-5 w-5" />}
                </button>
                <button type="button" onClick={toggleCamera} disabled={sharing} className={cn("flex h-12 w-12 items-center justify-center rounded-full transition disabled:opacity-40", cameraOn ? "bg-white/10 hover:bg-white/20" : "bg-red-600 hover:bg-red-700")} aria-label="Toggle camera">
                  {cameraOn ? <Video className="h-5 w-5" /> : <VideoOff className="h-5 w-5" />}
                </button>
              </>
            )}
            <button type="button" onClick={hangUp} className="flex h-14 w-14 items-center justify-center rounded-full bg-red-600 text-white transition hover:bg-red-700" aria-label="End call">
              <PhoneOff className="h-6 w-6" />
            </button>
          </div>
        </div>
      )}
    </CallContext.Provider>
  );
}
