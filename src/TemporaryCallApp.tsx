import React, { useEffect, useRef, useState } from 'react';
import { Phone, Video, PhoneOff, Mic, MicOff, VideoOff, MonitorUp, Users, MessageCircle, Wifi, WifiOff } from 'lucide-react';
import { AccountSetupScreen } from './components/AccountSetupScreen';
import { SlackChat } from './components/SlackChat';
import { mediaManager } from './utils/webrtcManager';
import { ringEngine } from './utils/audioRingEngine';
import { notificationEngine } from './utils/notificationEngine';
import type { CallType, UserIdentity } from './types';

type OnlineUser = { userId:string; deviceId?:string; deviceName?:string; name:string; avatar?:string; inCall?:boolean; fingerprint?:string };
type Incoming = { callId:string; type:CallType; caller:UserIdentity; roomId:string };
type Active = { callId:string; type:CallType; peer:UserIdentity; roomId:string; outgoing:boolean };

const identityFor = (name:string):UserIdentity => {
  const clean=name.trim(); const id=Math.random().toString(36).slice(2,10);
  return { id:`session_${id}`, name:clean, email:`${clean.toLowerCase().replace(/[^a-z0-9]/g,'')}@temporary.talk`, phone:'', avatar:`https://ui-avatars.com/api/?name=${encodeURIComponent(clean)}&background=059669&color=fff&bold=true`, deviceId:`device_${id}`, deviceName:'Temporary browser session', publicKeyFingerprint:id.slice(0,4).toUpperCase()+' '+id.slice(4).toUpperCase() };
};
const avatar=(name:string)=>`https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=059669&color=fff&bold=true`;
function wsUrl(){ const u=new URL('/api/ws',window.location.origin); u.protocol=location.protocol==='https:'?'wss:':'ws:'; return u.toString(); }

export default function TemporaryCallApp(){
  const [identity,setIdentity]=useState<UserIdentity|null>(()=>{try{const x=sessionStorage.getItem('talk_temp_identity');return x?JSON.parse(x):null}catch{return null}});
  const [people,setPeople]=useState<OnlineUser[]>([]); const [tab,setTab]=useState<'people'|'chat'>('people');
  const [incoming,setIncoming]=useState<Incoming|null>(null); const [active,setActive]=useState<Active|null>(null); const [remote,setRemote]=useState<MediaStream|null>(null);
  const [muted,setMuted]=useState(false); const [videoOff,setVideoOff]=useState(false); const [sharing,setSharing]=useState(false); const [error,setError]=useState('');
  const wsRef=useRef<WebSocket|null>(null); const activeRef=useRef<Active|null>(null); const incomingRef=useRef<Incoming|null>(null);
  const localRef=useRef<HTMLVideoElement|null>(null); const remoteRef=useRef<HTMLVideoElement|null>(null); const audioRef=useRef<HTMLAudioElement|null>(null);
  const setActiveSafe=(v:Active|null)=>{activeRef.current=v;setActive(v)}; const setIncomingSafe=(v:Incoming|null)=>{incomingRef.current=v;setIncoming(v)};
  const send=(m:Record<string,unknown>)=>{const w=wsRef.current;if(w?.readyState===WebSocket.OPEN)w.send(JSON.stringify(m));};
  const cleanup=()=>{mediaManager.stopLocalMedia();setRemote(null);setActiveSafe(null);setIncomingSafe(null);setMuted(false);setVideoOff(false);setSharing(false);ringEngine.stopAll();};
  const startPeer=(callId:string,peer:UserIdentity)=>mediaManager.createPeerConnection(s=>setRemote(s),c=>send({type:'webrtc:ice',callId,roomId:`room_${callId}`,sender:identity,targetUserId:peer.id,targetUserName:peer.name,payload:{candidate:c}}),s=>{if(s==='connected')ringEngine.stopAll();if(s==='failed')setError('The media connection failed. Try the call again.');});

  useEffect(()=>{
    if(!identity)return; let closed=false;
    const connect=()=>{if(closed)return;const ws=new WebSocket(wsUrl());wsRef.current=ws;
      ws.onopen=()=>ws.send(JSON.stringify({type:'register',sender:identity}));
      ws.onmessage=e=>{try{const m=JSON.parse(e.data);
        if(m.type==='presence:update'){setPeople(Array.isArray(m.onlineUsers)?m.onlineUsers:[]);return;}
        if(m.type==='call:incoming'){if(activeRef.current||incomingRef.current)return;const x={callId:m.callId,type:m.callType==='video'?'video':'audio',caller:m.sender,roomId:m.roomId||`room_${m.callId}`};setIncomingSafe(x);ringEngine.unlockAudio();ringEngine.startIncomingRing('modern');notificationEngine.triggerIncomingCallAlert(x.caller?.name||'Incoming caller',x.type,x.callId);return;}
        if(m.type==='call:status'){if(activeRef.current?.callId===m.callId && m.targetDevicesFound>0)ringEngine.stopAll();return;}
        if(m.type==='call:accepted'){const a=activeRef.current;if(!a||a.callId!==m.callId)return;ringEngine.stopAll();mediaManager.createOffer().then(offer=>{if(offer)send({type:'webrtc:offer',callId:m.callId,roomId:m.roomId||a.roomId,sender:identity,targetUserId:m.sender?.id,targetUserName:m.sender?.name,payload:{sdp:offer}})}).catch(e=>setError(e instanceof Error?e.message:String(e)));return;}
        if(m.type==='webrtc:offer'){mediaManager.handleOffer(m.payload?.sdp).then(answer=>{if(answer)send({type:'webrtc:answer',callId:m.callId,roomId:m.roomId,sender:identity,targetUserId:m.sender?.id,targetUserName:m.sender?.name,payload:{sdp:answer}})}).catch(e=>setError(e instanceof Error?e.message:String(e)));return;}
        if(m.type==='webrtc:answer'){mediaManager.handleAnswer(m.payload?.sdp).catch(e=>setError(e instanceof Error?e.message:String(e)));return;}
        if(m.type==='webrtc:ice'){mediaManager.addIceCandidate(m.payload?.candidate).catch(()=>undefined);return;}
        if(m.type==='call:rejected'||m.type==='call:cancelled_elsewhere'){if(activeRef.current?.callId===m.callId||incomingRef.current?.callId===m.callId)cleanup();return;}
        if(m.type==='call:ended'){const a=activeRef.current,i=incomingRef.current;if(!m.callId||(a&&a.callId===m.callId)||(i&&i.callId===m.callId))cleanup();return;}
      }catch(err){console.warn('[Talk signaling]',err)}};
      ws.onerror=()=>setError('The calling connection could not reach Vercel.');
      ws.onclose=()=>{if(wsRef.current===ws)wsRef.current=null;if(!closed)setTimeout(connect,1000)};
    }; connect(); return()=>{closed=true;try{wsRef.current?.close()}catch{}wsRef.current=null;cleanup()};
  },[identity]);

  useEffect(()=>{if(localRef.current)localRef.current.srcObject=mediaManager.getLocalStream()},[active,videoOff,sharing]);
  useEffect(()=>{if(remoteRef.current){remoteRef.current.srcObject=remote;remoteRef.current.play().catch(()=>undefined)}if(audioRef.current)mediaManager.attachRemoteAudioSink(audioRef.current)},[remote]);

  if(!identity)return <AccountSetupScreen onCompleteSetup={name=>{const n=identityFor(name);sessionStorage.setItem('talk_temp_identity',JSON.stringify(n));setIdentity(n)}}/>;
  const startCall=async(u:OnlineUser,type:CallType)=>{if(activeRef.current||incomingRef.current||u.inCall)return;setError('');const peer:UserIdentity={id:u.userId,name:u.name,email:'',phone:'',avatar:u.avatar||avatar(u.name),deviceId:u.deviceId||'',deviceName:u.deviceName||'Web Client',publicKeyFingerprint:u.fingerprint||'TEMPORARY'};const callId=`call_${Date.now()}_${Math.random().toString(36).slice(2,7)}`;try{await mediaManager.getLocalMedia(type==='video',true);startPeer(callId,peer);setActiveSafe({callId,type,peer,roomId:`room_${callId}`,outgoing:true});ringEngine.startOutgoingRingback();send({type:'call:invite',callId,callType:type,sender:identity,targetUserId:peer.id,targetUserName:peer.name,roomId:`room_${callId}`})}catch(e){setError(e instanceof Error?e.message:String(e));cleanup()}};
  const answer=async()=>{const i=incomingRef.current;if(!i)return;try{await mediaManager.getLocalMedia(i.type==='video',true);startPeer(i.callId,i.caller);setActiveSafe({callId:i.callId,type:i.type,peer:i.caller,roomId:i.roomId,outgoing:false});setIncomingSafe(null);ringEngine.stopAll();notificationEngine.dismissIncomingCallAlert(i.callId);send({type:'call:accept',callId:i.callId,callType:i.type,sender:identity,targetUserId:i.caller.id,targetUserName:i.caller.name,roomId:i.roomId})}catch(e){setError(e instanceof Error?e.message:String(e))}};
  const decline=()=>{const i=incomingRef.current;if(!i)return;send({type:'call:reject',callId:i.callId,sender:identity,targetUserId:i.caller.id,targetUserName:i.caller.name,roomId:i.roomId});notificationEngine.dismissIncomingCallAlert(i.callId);ringEngine.stopAll();setIncomingSafe(null)};
  const hangup=()=>{const a=activeRef.current;if(!a)return;send({type:'call:end',callId:a.callId,roomId:a.roomId,sender:identity,targetUserId:a.peer.id,targetUserName:a.peer.name});cleanup()};
  const share=async()=>{try{if(sharing){await mediaManager.stopScreenShare();setSharing(false)}else{await mediaManager.startScreenShare();setSharing(true)}}catch(e){setError(e instanceof Error?e.message:String(e))}};
  return <div className="min-h-screen bg-[#09090b] text-zinc-100 flex flex-col"><header className="h-16 px-5 border-b border-zinc-800 bg-[#111116] flex items-center justify-between"><div><b className="text-lg">Talk <span className="text-emerald-400 text-xs">TEMP TEST</span></b><div className="text-[11px] text-zinc-500">Temporary names • no contacts • Firebase-free</div></div><span className="text-xs text-zinc-400">{identity.name} <span className="text-emerald-400 ml-2"><Wifi className="inline w-3 h-3"/> Live</span></span></header>
  {error&&<div className="mx-auto mt-3 w-[calc(100%-2rem)] max-w-5xl rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">{error}<button className="float-right" onClick={()=>setError('')}>×</button></div>}
  <nav className="px-5 pt-4 flex gap-2 max-w-5xl w-full mx-auto"><button onClick={()=>setTab('people')} className="px-4 py-2 rounded-xl text-sm bg-zinc-900"><Users className="inline w-4 h-4 mr-2"/>People</button><button onClick={()=>setTab('chat')} className="px-4 py-2 rounded-xl text-sm bg-zinc-900"><MessageCircle className="inline w-4 h-4 mr-2"/>Chat</button></nav>
  <main className="flex-1 max-w-5xl w-full mx-auto p-5">{tab==='people'&&<section className="rounded-3xl border border-zinc-800 bg-[#111116] p-5"><h1 className="text-xl font-bold">People online</h1><p className="text-xs text-zinc-500 mb-5">Only people connected right now appear here.</p>{people.filter(p=>p.userId!==identity.id).length===0?<div className="py-16 text-center text-zinc-500"><WifiOff className="mx-auto mb-3"/>No one else is connected yet.</div>:<div className="grid md:grid-cols-2 gap-3">{people.filter(p=>p.userId!==identity.id).map(u=><div key={u.userId} className="rounded-2xl border border-zinc-800 bg-zinc-950/50 p-4 flex items-center gap-3"><img src={u.avatar||avatar(u.name)} className="w-12 h-12 rounded-xl"/><div className="min-w-0 flex-1"><div className="font-semibold truncate">{u.name}</div><div className="text-xs text-zinc-500">{u.inCall?'In a call':'Online'}</div></div><button disabled={!!u.inCall} onClick={()=>startCall(u,'audio')} className="p-3 rounded-xl bg-emerald-600 disabled:opacity-30"><Phone className="w-4 h-4"/></button><button disabled={!!u.inCall} onClick={()=>startCall(u,'video')} className="p-3 rounded-xl bg-indigo-600 disabled:opacity-30"><Video className="w-4 h-4"/></button></div>)}</div>}</section>}{tab==='chat'&&<SlackChat identity={identity} onCall={u=>startCall({userId:u.id,name:u.name,avatar:u.avatar},'audio')} onVideoCall={u=>startCall({userId:u.id,name:u.name,avatar:u.avatar},'video')}/>}</main>
  {incoming&&<div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-5"><div className="w-full max-w-sm rounded-3xl bg-zinc-900 border border-zinc-700 p-6 text-center"><img src={incoming.caller.avatar||avatar(incoming.caller.name)} className="w-20 h-20 rounded-2xl mx-auto mb-4"/><h2 className="text-xl font-bold">{incoming.caller.name}</h2><p className="text-zinc-400 mb-6">Incoming {incoming.type} call</p><div className="flex justify-center gap-4"><button onClick={decline} className="w-14 h-14 rounded-full bg-red-600"><PhoneOff className="mx-auto"/></button><button onClick={answer} className="w-14 h-14 rounded-full bg-emerald-600"><Phone className="mx-auto"/></button></div></div></div>}
  {active&&<div className="fixed inset-0 z-40 bg-black flex flex-col"><div className="p-4 flex justify-between"><div><b>{active.peer.name}</b><div className="text-xs text-zinc-500">{active.type==='video'?'Video':'Audio'} call</div></div><button onClick={hangup} className="bg-red-600 rounded-full px-4 py-2"><PhoneOff className="inline w-4 h-4 mr-2"/>End</button></div><div className="flex-1 relative flex items-center justify-center bg-zinc-950">{active.type==='video'?<><video ref={remoteRef} autoPlay playsInline className="max-h-full max-w-full w-full h-full object-contain"/><video ref={localRef} autoPlay muted playsInline className="absolute right-4 bottom-4 w-36 h-24 object-cover rounded-xl border border-zinc-700"/></>:<div className="text-center"><img src={active.peer.avatar||avatar(active.peer.name)} className="w-28 h-28 rounded-3xl mx-auto"/><div className="mt-4 text-xl">{active.peer.name}</div><audio ref={audioRef} autoPlay playsInline /></div>}</div><div className="p-5 flex justify-center gap-3 bg-zinc-900"><button onClick={()=>{const n=!muted;setMuted(n);mediaManager.setAudioMuted(n)}} className="p-4 rounded-full bg-zinc-800">{muted?<MicOff/>:<Mic/>}</button>{active.type==='video'&&<><button onClick={()=>{const n=!videoOff;setVideoOff(n);mediaManager.setVideoOff(n)}} className="p-4 rounded-full bg-zinc-800">{videoOff?<VideoOff/>:<Video/>}</button><button onClick={share} className={`p-4 rounded-full ${sharing?'bg-emerald-600':'bg-zinc-800'}`}><MonitorUp/></button></>}<button onClick={hangup} className="p-4 rounded-full bg-red-600"><PhoneOff/></button></div></div>}
  </div>;
}
