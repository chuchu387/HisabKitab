"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { Phone, PhoneOff, Video, VideoOff, Mic, MicOff, X } from "lucide-react";
import { endCall, getCallEvents, respondToCall, sendSignal, startCall as startCallAction } from "@/actions/calls";
import { useRealtime } from "@/hooks/use-realtime";
import { startRingtone, stopRingtone } from "@/lib/ringtone";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

type CallMode = "audio" | "video";
type MyRole = "initiator" | "callee";

type ActiveCall = {
  callId: string;
  mode: CallMode;
  status: "ringing" | "active";
  role: MyRole;
  peerName: string;
  peerId?: string;
};

type IncomingCall = {
  callId: string;
  mode: CallMode;
  initiatorName: string;
};

const CallContext = createContext<{
  activeCall: ActiveCall | null;
  busy: boolean;
  startCall: (groupId: string, peerId: string, peerName: string, mode: CallMode) => Promise<void>;
}>({ activeCall: null, busy: false, startCall: async () => {} });

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

export function CallProvider({ userId, userName, children }: { userId: string; userName: string; children: React.ReactNode }) {
  const { calls } = useRealtime({ unreadCount: 0, notifications: [], chatGroups: [] });
  const [activeCall, setActiveCall] = useState<ActiveCall | null>(null);
  const [incoming, setIncoming] = useState<IncomingCall | null>(null);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [cameraOn, setCameraOn] = useState(true);
  const [micOn, setMicOn] = useState(true);

  const peerRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const remoteStreamRef = useRef<MediaStream | null>(null);
  const activeRef = useRef<ActiveCall | null>(null);
  const pendingCandidates = useRef<RTCIceCandidateInit[]>([]);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastEventId = useRef<string>("");
  const remoteDescriptionSet = useRef(false);
  const endedLocally = useRef(false);

  activeRef.current = activeCall;

  const cleanup = useCallback((toastMessage?: string) => {
    if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
    stopRingtone();
    peerRef.current?.close();
    peerRef.current = null;
    localStreamRef.current?.getTracks().forEach((track) => track.stop());
    localStreamRef.current = null;
    remoteStreamRef.current?.getTracks().forEach((track) => track.stop());
    remoteStreamRef.current = null;
    setLocalStream(null);
    setRemoteStream(null);
    setIncoming(null);
    setActiveCall(null);
    lastEventId.current = "";
    pendingCandidates.current = [];
    remoteDescriptionSet.current = false;
    if (toastMessage) toast.message(toastMessage);
  }, []);

  const createPeer = useCallback((mode: CallMode, stream: MediaStream | null) => {
    const peer = new RTCPeerConnection({ iceServers: getIceServers() });
    if (stream) stream.getTracks().forEach((track) => peer.addTrack(track, stream));
    peer.onicecandidate = (event) => {
      if (!event.candidate || !activeRef.current) return;
      const call = activeRef.current;
      if (call.peerId) {
        sendSignal(call.callId, call.peerId, "ice", { candidate: event.candidate.toJSON() }).catch(() => undefined);
      }
    };
    peer.ontrack = (event) => {
      const [stream] = event.streams;
      if (stream) {
        remoteStreamRef.current = stream;
        setRemoteStream(stream);
      }
    };
    peer.onconnectionstatechange = () => {
      if (["failed", "closed", "disconnected"].includes(peer.connectionState) && activeRef.current?.status === "active") {
        cleanup("Connection lost — call ended");
      }
    };
    peerRef.current = peer;
    return peer;
  }, [cleanup]);

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

  const processEvent = useCallback(async (event: { id: string; type: string; from: string; payload: any }, call: ActiveCall) => {
    const peer = peerRef.current;
    if (event.type === "accepted" && call.role === "initiator" && call.status === "ringing") {
      setActiveCall({ ...call, status: "active" });
      const stream = await setupLocalStream(call.mode);
      const created = createPeer(call.mode, stream);
      const offer = await created.createOffer();
      await created.setLocalDescription(offer);
      if (call.peerId) {
        await sendSignal(call.callId, call.peerId, "offer", { sdp: offer }).catch(() => undefined);
      }
      return;
    }
    if (event.type === "offer") {
      const created = peer ?? createPeer(call.mode, localStreamRef.current);
      await created.setRemoteDescription({ type: "offer", sdp: event.payload.sdp });
      remoteDescriptionSet.current = true;
      for (const candidate of pendingCandidates.current) {
        try { await created.addIceCandidate(candidate); } catch {}
      }
      pendingCandidates.current = [];
      const answer = await created.createAnswer();
      await created.setLocalDescription(answer);
      if (call.peerId) {
        await sendSignal(call.callId, call.peerId, "answer", { sdp: answer }).catch(() => undefined);
      }
      return;
    }
    if (event.type === "answer" && peer) {
      await peer.setRemoteDescription({ type: "answer", sdp: event.payload.sdp });
      remoteDescriptionSet.current = true;
      for (const candidate of pendingCandidates.current) {
        try { await peer.addIceCandidate(candidate); } catch {}
      }
      pendingCandidates.current = [];
      return;
    }
    if (event.type === "ice" && peer) {
      const candidate = event.payload.candidate as RTCIceCandidateInit;
      if (remoteDescriptionSet.current) {
        try { await peer.addIceCandidate(candidate); } catch {}
      } else {
        pendingCandidates.current.push(candidate);
      }
      return;
    }
    if (event.type === "declined") {
      cleanup(`${event.payload?.name ?? "The other user"} declined the call`);
      return;
    }
    if (event.type === "ended" || event.type === "left") {
      if (!endedLocally.current) cleanup("Call ended");
      return;
    }
  }, [cleanup, createPeer, setupLocalStream]);

  const startPolling = useCallback((call: ActiveCall) => {
    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = setInterval(async () => {
      const current = activeRef.current;
      if (!current) {
        if (pollRef.current) clearInterval(pollRef.current);
        return;
      }
      const result = await getCallEvents(current.callId, lastEventId.current || null).catch(() => null);
      if (!result?.ok) return;
      if (result.status === "ended" && current.status !== "active") {
        cleanup("Call ended");
        return;
      }
      if (result.status === "ended") {
        if (!endedLocally.current) cleanup("Call ended");
        return;
      }
      const events = result.events ?? [];
      for (const event of events) {
        lastEventId.current = event.id;
        if (event.type === "ended" || event.type === "declined" || event.type === "left") {
          if (!endedLocally.current) {
            cleanup(event.type === "declined" ? "Call declined" : "Call ended");
            return;
          }
        } else {
          await processEvent(event, current);
        }
      }
    }, POLL_MS);
  }, [cleanup, processEvent]);

  useEffect(() => {
    if (!activeCall) return;
    if (activeCall.status === "ringing" && activeCall.role === "initiator") {
      startRingtone();
    } else if (activeCall.status === "active") {
      stopRingtone();
    }
  }, [activeCall?.status, activeCall?.role, activeCall?.callId]);

  useEffect(() => {
    if (!incoming) return;
    startRingtone();
    return () => stopRingtone();
  }, [incoming]);

  useEffect(() => {
    if (!calls.length) return;
    for (const call of calls) {
      if (activeRef.current?.callId === call.callId) continue;
      if (incoming?.callId === call.callId) continue;
      if (String(call.initiatorId) === String(userId)) {
        continue;
      }
      if (call.myStatus === "invited" && call.status === "ringing") {
        setIncoming({ callId: call.callId, mode: call.mode, initiatorName: call.initiatorName || "A colleague" });
      }
    }
    if (activeRef.current && !calls.some((call) => call.callId === activeRef.current!.callId)) {
      cleanup("Call ended");
    }
  }, [calls, userId, incoming?.callId, cleanup]);

  const startCall = useCallback(async (groupId: string, peerId: string, peerName: string, mode: CallMode) => {
    if (activeRef.current) {
      toast.error("You are already in a call");
      return;
    }
    const result = await startCallAction(groupId, mode, peerId);
    if (!result.ok || !result.data) {
      toast.error(result.message ?? "Could not start call");
      return;
    }
    const call: ActiveCall = {
      callId: result.data.callId,
      mode,
      status: "ringing",
      role: "initiator",
      peerName,
      peerId
    };
    endedLocally.current = false;
    setActiveCall(call);
    startPolling(call);
  }, [startPolling]);

  const accept = useCallback(async (incomingCall: IncomingCall) => {
    const result = await respondToCall(incomingCall.callId, true);
    if (!result.ok) {
      toast.error(result.message ?? "Could not join call");
      return;
    }
    stopRingtone();
    setIncoming(null);
    const call: ActiveCall = {
      callId: incomingCall.callId,
      mode: incomingCall.mode,
      status: "ringing",
      role: "callee",
      peerName: incomingCall.initiatorName
    };
    endedLocally.current = false;
    setActiveCall(call);
    const stream = await setupLocalStream(call.mode);
    createPeer(call.mode, stream);
    startPolling(call);
  }, [createPeer, setupLocalStream, startPolling]);

  const decline = useCallback(async () => {
    if (!incoming) return;
    stopRingtone();
    await respondToCall(incoming.callId, false).catch(() => undefined);
    setIncoming(null);
  }, [incoming]);

  const hangUp = useCallback(async () => {
    const call = activeRef.current;
    if (!call) return;
    endedLocally.current = true;
    if (call.status === "active") {
      await sendSignal(call.callId, call.peerId ?? null, "ended", {}).catch(() => undefined);
    }
    await endCall(call.callId).catch(() => undefined);
    cleanup();
  }, [cleanup]);

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

  return (
    <CallContext.Provider value={{ activeCall: active, busy: !!active, startCall }}>
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
      {active && (
        <div className={cn("fixed inset-0 z-[200] flex flex-col bg-slate-950/95 text-white", active.mode !== "video" && "items-center justify-center")}>
          {active.mode === "video" && remoteStream ? (
            <video ref={(el) => { if (el) el.srcObject = remoteStream; }} autoPlay playsInline className="absolute inset-0 h-full w-full object-contain" />
          ) : active.mode === "video" ? (
            <div className="absolute inset-0 grid place-items-center">
              <div className="flex h-24 w-24 items-center justify-center rounded-full bg-primary/25 text-4xl font-bold">{active.peerName.charAt(0).toUpperCase()}</div>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-4 px-6">
              <div className="flex h-24 w-24 items-center justify-center rounded-full bg-primary/25 text-4xl font-bold">{active.peerName.charAt(0).toUpperCase()}</div>
              <p className="text-lg font-semibold">{active.peerName}</p>
              <p className="text-sm text-white/60">{active.status === "ringing" ? "Ringing..." : "In call"}</p>
            </div>
          )}
          {active.mode === "video" && localStream && (
            <video ref={(el) => { if (el) el.srcObject = localStream; }} autoPlay playsInline muted className="absolute right-4 top-4 h-36 w-28 rounded-xl border border-white/20 bg-black object-cover sm:h-44 sm:w-64" />
          )}
          <div className="relative z-10 mt-auto flex items-center justify-center gap-4 p-6">
            <button type="button" onClick={toggleMute} className={cn("flex h-12 w-12 items-center justify-center rounded-full transition", micOn ? "bg-white/10 hover:bg-white/20" : "bg-red-600 hover:bg-red-700")} aria-label="Toggle microphone">
              {micOn ? <Mic className="h-5 w-5" /> : <MicOff className="h-5 w-5" />}
            </button>
            {active.mode === "video" && (
              <button type="button" onClick={toggleCamera} className={cn("flex h-12 w-12 items-center justify-center rounded-full transition", cameraOn ? "bg-white/10 hover:bg-white/20" : "bg-red-600 hover:bg-red-700")} aria-label="Toggle camera">
                {cameraOn ? <Video className="h-5 w-5" /> : <VideoOff className="h-5 w-5" />}
              </button>
            )}
            <button type="button" onClick={hangUp} className="flex h-14 w-14 items-center justify-center rounded-full bg-red-600 text-white transition hover:bg-red-700" aria-label="End call">
              <PhoneOff className="h-6 w-6" />
            </button>
            <button type="button" onClick={hangUp} className="flex h-12 w-12 items-center justify-center rounded-full bg-white/10 transition hover:bg-white/20" aria-label="Close">
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>
      )}
    </CallContext.Provider>
  );
}
