import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Phone, Video, Mic, MicOff, VideoOff, MonitorUp, PhoneOff, MessageCircle, Users, Wifi, WifiOff } from 'lucide-react';
import { AccountSetupScreen } from './components/AccountSetupScreen';
import { SlackChat } from './components/SlackChat';
import { mediaManager } from './utils/webrtcManager';
import { ringEngine } from './utils/audioRingEngine';
import { notificationEngine } from './utils/notificationEngine';
import type { CallType, Contact, UserIdentity } from './types';

type OnlineUser = { userId: string; deviceId?: string; deviceName?: string; name: string; avatar?: string; inCall?: boolean; fingerprint?: string };
type Incoming = { callId: string; type: CallType; caller: UserIdentity; roomId: string; safetyNumber?: string };
type Active = { callId: string; type: CallType; peer: UserIdentity; roomId: string; outgoing: boolean };

const makeIdentity = (name: string): UserIdentity => {
  const clean = name.trim();
  const random = Math.random().toString(36).slice(2, 10);
  return {
    id: `session_${random}`,
    name: clean,
    email: `${clean.toLowerCase().replace(/[^a-z0-9]/g, '')}@temporary.talk`,
    phone: '',
    avatar: `https://ui-avatars.com/api/?name=${encodeURIComponent(clean)}&background=059669&color=ffffff&bold=true`,
    deviceId: `device_${random}`,
    deviceName: 'Temporary browser session',
    publicKeyFingerprint: `${random.slice(0, 4).toUpperCase()} ${random.slice(4).toUpperCase()}`,
  };
};

const toContact = (u: OnlineUser): Contact => ({
  id: u.userId,
  name: u.name,
  email: '',
  phone: '',
  role: 'Temporary online user',
  avatar: u.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(u.name)}&background=059669&color=ffffff&bold=true`,
  status: u.inCall ? 'busy' : 'online',
  publicKeyFingerprint: u.fingerprint || 'TEMPORARY',
  deviceList: [u.deviceName || 'Web Client'],
  notes: '',
  isFavorite: false,
  tags: [],
});

function socketUrl() {
  const url = new URL('/api/ws', window.location.origin);
  url.protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  return url.toString();
}

export default function TemporaryApp() {
  const [identity, setIdentity] = useState<UserIdentity | null>(() => {
    try {
      const raw = sessionStorage.getItem('talk_temp_identity');
      return raw ? JSON.parse(raw) : null;
    } catch { return null; }
  });
  const [tab, setTab] = useState<'people' | 'chat'>('people');
  const [onlineUsers, setOnlineUsers] = useState<OnlineUser[]>([]);
  const [incoming, setIncoming] = useState<Incoming | null>(null);
  const [active, setActive] = useState<Active | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [muted, setMuted] = useState(false);
  const [videoOff, setVideoOff] = useState(false);
  const [screenSharing, setScreenSharing] = useState(false);
  const [speakerOn, setSpeakerOn] = useState(true);
  const [error, setError] = useState('');
  const wsRef = useRef<WebSocket | null>(null);
  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const remoteVideoRef = useRef<HTMLVideoElement | null>(null);
  const remoteAudioRef = useRef<HTMLAudioElement | null>(null);

  const people = useMemo(() => {
    const seen = new Set<string>();
    return onlineUsers.filter(u => u.userId !== identity?.id).filter(u => {
      if (seen.has(u.userId)) return false;
      seen.add(u.userId);
      return true;
    });
  }, [onlineUsers, identity?.id]);

  const send = (message: Record<string, unknown>) => {
    const ws = wsRef.current;
    if (ws?.readyState === WebSocket.OPEN) ws.send(JSON.stringify(message));
  };

  const cleanupCall = () => {
    setRemoteStream(null);
    mediaManager.stopLocalMedia();
    setIncoming(null);
    setActive(null);
    setMuted(false);
    setVideoOff(false);
    setScreenSharing(false);
    ringEngine.stopAll();
  };

  const startPeer = (callId: string, peer: UserIdentity) => {
    mediaManager.createPeerConnection(
      stream => setRemoteStream(stream),
      candidate => send({
        type: 'webrtc:ice', callId, roomId: `room_${callId}`,
        sender: identity, targetUserId: peer.id, targetUserName: peer.name,
        payload: { candidate }, timestamp: Date.now(),
      }),
      state => {
        if (state === 'connected') ringEngine.stopAll();
        if (state === 'failed') setError('The media connection failed. Try the call again.');
      },
    );
  };

  useEffect(() => {
    if (!identity) return;
    let closed = false;
    const connect = () => {
      if (closed) return;
      const ws = new WebSocket(socketUrl());
      wsRef.current = ws;
      ws.onopen = () => {
        ws.send(JSON.stringify({ type: 'register', sender: identity }));
      };
      ws.onmessage = event => {
        try {
          const msg = JSON.parse(event.data);
          if (msg.type === 'registered') return;
          if (msg.type === 'presence:update') {
            setOnlineUsers(Array.isArray(msg.onlineUsers) ? msg.onlineUsers : []);
            return;
          }
          if (msg.type === 'call:incoming') {
            if (active) return;
            setIncoming({ callId: msg.callId, type: msg.callType || 'audio', caller: msg.sender, roomId: msg.roomId || `room_${msg.callId}`, safetyNumber: msg.payload?.safetyNumber });
            ringEngine.unlockAudio();
            ringEngine.startIncomingRing('modern');
            notificationEngine.triggerIncomingCallAlert(msg.sender?.name || 'Incoming caller', msg.callType || 'audio', msg.callId);
            return;
          }
          if (msg.type === 'call:accepted') {
            if (!active || active.callId !== msg.callId) return;
            mediaManager.createOffer().then(offer => {
              send({ type: 'webrtc:offer', callId: msg.callId, roomId: msg.roomId, sender: identity, targetUserId: msg.sender.id, targetUserName: msg.sender.name, payload: { sdp: offer }, timestamp: Date.now() });
            }).catch(err => setError(err instanceof Error ? err.message : String(err)));
            return;
          }
          if (msg.type === 'webrtc:offer') {
            mediaManager.handleOffer(msg.payload?.sdp).then(answer => {
              if (!answer) return;
              send({ type: 'webrtc:answer', callId: msg.callId, roomId: msg.roomId, sender: identity, targetUserId: msg.sender.id, targetUserName: msg.sender.name, payload: { sdp: answer }, timestamp: Date.now() });
            }).catch(err => setError(err instanceof Error ? err.message : String(err)));
            return;
          }
          if (msg.type === 'webrtc:answer') {
            mediaManager.handleAnswer(msg.payload?.sdp).catch(err => setError(err instanceof Error ? err.message : String(err)));
            return;
          }
          if (msg.type === 'webrtc:ice') {
            mediaManager.addIceCandidate(msg.payload?.candidate).catch(() => undefined);
            return;
          }
          if (msg.type === 'call:rejected' || msg.type === 'call:cancelled_elsewhere') {
            if (active?.callId === msg.callId) cleanupCall();
            if (incoming?.callId === msg.callId) setIncoming(null);
            return;
          }
          if (msg.type === 'call:ended') {
            if (active?.callId === msg.callId || incoming?.callId === msg.callId) cleanupCall();
          }
        } catch (err) {
          console.warn('[Talk signaling] invalid message', err);
        }
      };
      ws.onerror = () => setError('The calling connection could not reach Vercel.');
      ws.onclose = () => {
        if (wsRef.current === ws) wsRef.current = null;
        if (!closed) window.setTimeout(connect, 1000);
      };
    };
    connect();
    return () => {
      closed = true;
      try { wsRef.current?.close(); } catch {}
      wsRef.current = null;
    };
  }, [identity]);

  useEffect(() => {
    if (localVideoRef.current) localVideoRef.current.srcObject = mediaManager.getLocalStream();
  }, [active, videoOff, screenSharing]);

  useEffect(() => {
    if (remoteVideoRef.current) {
      remoteVideoRef.current.srcObject = remoteStream;
      remoteVideoRef.current.play().catch(() => undefined);
    }
    if (remoteAudioRef.current) mediaManager.attachRemoteAudioSink(remoteAudioRef.current);
  }, [remoteStream]);

  useEffect(() => {
    mediaManager.setSpeakerEnabled(speakerOn);
  }, [speakerOn]);

  if (!identity) {
    return <AccountSetupScreen onCompleteSetup={name => {
      const next = makeIdentity(name);
      sessionStorage.setItem('talk_temp_identity', JSON.stringify(next));
      setIdentity(next);
    }} />;
  }

  const startCall = async (user: OnlineUser, type: CallType) => {
    if (active || incoming || user.inCall) return;
    setError('');
    const peer = { ...toContact(user), id: user.userId } as UserIdentity;
    const callId = `call_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    try {
      await mediaManager.getLocalMedia(type === 'video', true);
      startPeer(callId, peer);
      setActive({ callId, type, peer, roomId: `room_${callId}`, outgoing: true });
      ringEngine.startOutgoingRingback();
      send({ type: 'call:invite', callId, callType: type, sender: identity, targetUserId: user.userId, targetUserName: user.name, roomId: `room_${callId}`, timestamp: Date.now() });
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      cleanupCall();
    }
  };

  const answerCall = async () => {
    if (!incoming) return;
    setError('');
    try {
      await mediaManager.getLocalMedia(incoming.type === 'video', true);
      startPeer(incoming.callId, incoming.caller);
      setActive({ callId: incoming.callId, type: incoming.type, peer: incoming.caller, roomId: incoming.roomId, outgoing: false });
      setIncoming(null);
      ringEngine.stopAll();
      notificationEngine.dismissIncomingCallAlert(incoming.callId);
      send({ type: 'call:accept', callId: incoming.callId, callType: incoming.type, sender: identity, targetUserId: incoming.caller.id, targetUserName: incoming.caller.name, roomId: incoming.roomId, timestamp: Date.now() });
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  const declineCall = () => {
    if (!incoming) return;
    send({ type: 'call:reject', callId: incoming.callId, sender: identity, targetUserId: incoming.caller.id, targetUserName: incoming.caller.name, roomId: incoming.roomId, timestamp: Date.now() });
    notificationEngine.dismissIncomingCallAlert(incoming.callId);
    ringEngine.stopAll();
    setIncoming(null);
  };

  const endCall = () => {
    if (!active) return;
    send({ type: 'call:end', callId: active.callId, roomId: active.roomId, sender: identity, targetUserId: active.peer.id, targetUserName: active.peer.name, timestamp: Date.now() });
    cleanupCall();
  };

  const toggleScreenShare = async () => {
    try {
      if (screenSharing) {
        await mediaManager.stopScreenShare();
        setScreenSharing(false);
      } else {
        await mediaManager.startScreenShare();
        setScreenSharing(true);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  return <div className="min-h-screen bg-[#09090b] text-zinc-100 flex flex-col">
    <header className="h-16 px-5 border-b border-zinc-800 bg-[#111116] flex items-center justify-between">
      <div><div className="font-extrabold text-lg">Talk <span className="text-emerald-400 text-xs">TEMP TEST</span></div><div className="text-[11px] text-zinc-500">Temporary names • no contacts • Firebase-free</div></div>
      <div className="flex items-center gap-2"><span className="text-xs text-zinc-400">{identity.name}</span><span className="flex items-center gap-1 text-[10px] text-emerald-400"><Wifi className="w-3 h-3"/> Live</span></div>
    </header>
    {error && <div className="mx-auto mt-3 w-[calc(100%-2rem)] max-w-5xl rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">{error}<button className="float-right" onClick={() => setError('')}>×</button></div>}
    <nav className="px-5 pt-4 flex gap-2 max-w-5xl w-full mx-auto"><button onClick={() => setTab('people')} className={`px-4 py-2 rounded-xl text-sm ${tab === 'people' ? 'bg-emerald-600 text-white' : 'bg-zinc-900 text-zinc-400'}`}><Users className="inline w-4 h-4 mr-2"/>People</button><button onClick={() => setTab('chat')} className={`px-4 py-2 rounded-xl text-sm ${tab === 'chat' ? 'bg-emerald-600 text-white' : 'bg-zinc-900 text-zinc-400'}`}><MessageCircle className="inline w-4 h-4 mr-2"/>Chat</button></nav>
    <main className="flex-1 max-w-5xl w-full mx-auto p-5">
      {tab === 'people' && <section className="rounded-3xl border border-zinc-800 bg-[#111116] p-5"><h1 className="text-xl font-bold mb-1">People online</h1><p className="text-xs text-zinc-500 mb-5">Only people connected right now appear here. Leaving the page removes the temporary session.</p>{people.length === 0 ? <div className="py-16 text-center text-zinc-500"><WifiOff className="mx-auto mb-3 w-8 h-8"/>No one else is connected yet.</div> : <div className="grid md:grid-cols-2 gap-3">{people.map(user => <div key={user.userId} className="rounded-2xl border border-zinc-800 bg-zinc-950/50 p-4 flex items-center gap-3"><img src={user.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.name)}`} className="w-12 h-12 rounded-xl"/><div className="min-w-0 flex-1"><div className="font-semibold truncate">{user.name}</div><div className="text-xs text-zinc-500">{user.inCall ? 'In a call' : 'Online'}</div></div><button disabled={!!user.inCall} onClick={() => startCall(user, 'audio')} className="p-3 rounded-xl bg-emerald-600 disabled:opacity-30"><Phone className="w-4 h-4"/></button><button disabled={!!user.inCall} onClick={() => startCall(user, 'video')} className="p-3 rounded-xl bg-indigo-600 disabled:opacity-30"><Video className="w-4 h-4"/></button></div>)}</div>}</section>}
      {tab === 'chat' && <SlackChat identity={identity} onCall={user => startCall({ userId: user.id, name: user.name, avatar: user.avatar, fingerprint: user.publicKeyFingerprint }, 'audio')} onVideoCall={user => startCall({ userId: user.id, name: user.name, avatar: user.avatar, fingerprint: user.publicKeyFingerprint }, 'video')} />}
    </main>

    {incoming && !active && <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-5"><div className="w-full max-w-sm rounded-3xl border border-zinc-700 bg-[#151519] p-7 text-center"><img src={incoming.caller.avatar} className="w-24 h-24 rounded-full mx-auto mb-4"/><h2 className="text-xl font-bold">{incoming.caller.name}</h2><p className="text-sm text-zinc-500 mb-7">Incoming {incoming.type === 'video' ? 'video' : 'audio'} call</p><div className="grid grid-cols-2 gap-3"><button onClick={declineCall} className="py-3 rounded-2xl bg-red-600 font-semibold">Decline</button><button onClick={answerCall} className="py-3 rounded-2xl bg-emerald-600 font-semibold">Answer</button></div></div></div>}

    {active && <div className="fixed inset-0 z-40 bg-black flex flex-col"><div className="h-16 px-4 border-b border-zinc-800 bg-[#111116] flex items-center justify-between"><div><div className="font-bold">{active.peer.name}</div><div className="text-xs text-zinc-500">{active.outgoing ? 'Ringing…' : active.type === 'video' ? 'Video call' : 'Audio call'}</div></div><button onClick={endCall} className="p-3 rounded-xl bg-red-600"><PhoneOff className="w-5 h-5"/></button></div><div className="flex-1 relative bg-[#050505] flex items-center justify-center p-3">{active.type === 'video' ? <><video ref={remoteVideoRef} autoPlay playsInline className="w-full h-full object-contain rounded-2xl bg-zinc-950"/><video ref={localVideoRef} autoPlay muted playsInline className="absolute right-6 top-6 w-36 md:w-56 aspect-video object-cover rounded-2xl border border-zinc-700 bg-zinc-900"/></> : <><div className="text-center"><img src={active.peer.avatar} className="w-32 h-32 rounded-full mx-auto mb-4"/><div className="text-xl font-bold">{active.peer.name}</div><div className="text-sm text-emerald-400 mt-1">{active.outgoing ? 'Ringing…' : 'Connected'}</div></div><video ref={localVideoRef} autoPlay muted playsInline className="hidden"/></>}<audio ref={remoteAudioRef} autoPlay playsInline className="hidden"/></div><div className="h-24 bg-[#111116] flex items-center justify-center gap-3"><button onClick={() => { const next=!muted; mediaManager.setAudioMuted(next); setMuted(next); }} className={`p-4 rounded-2xl ${muted ? 'bg-red-600' : 'bg-zinc-800'}`}>{muted ? <MicOff/> : <Mic/>}</button>{active.type === 'video' && <button onClick={() => { const next=!videoOff; mediaManager.setVideoOff(next); setVideoOff(next); }} className={`p-4 rounded-2xl ${videoOff ? 'bg-red-600' : 'bg-zinc-800'}`}>{videoOff ? <VideoOff/> : <Video/>}</button>}{active.type === 'video' && <button onClick={toggleScreenShare} className={`p-4 rounded-2xl ${screenSharing ? 'bg-emerald-600' : 'bg-zinc-800'}`}><MonitorUp/></button>}<button onClick={() => setSpeakerOn(v => !v)} className={`p-4 rounded-2xl ${speakerOn ? 'bg-zinc-800' : 'bg-red-600'}`}>🔊</button></div></div>}
  </div>;
}
