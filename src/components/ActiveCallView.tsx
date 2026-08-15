import React, { useState, useEffect, useRef } from 'react';
import { 
  Phone, PhoneOff, Mic, MicOff, Video, VideoOff, ScreenShare, ShieldCheck, 
  MessageSquare, Users, Hand, Smile, Disc, Volume2, VolumeX, 
  Maximize2, Minimize2, Settings, Lock, CheckCircle2, ChevronRight, X, Send 
} from 'lucide-react';
import { CallSession, InCallMessage, Participant } from '../types';
import { mediaManager } from '../utils/webrtcManager';
import { ringEngine } from '../utils/audioRingEngine';
import { E2EESafetyModal } from './E2EESafetyModal';

interface ActiveCallViewProps {
  call: CallSession;
  onEndCall: () => void;
  onToggleMute: () => void;
  onToggleVideo: () => void;
  onToggleScreenShare: () => void;
  onSendMessage: (text: string) => void;
  messages: InCallMessage[];
  onRaiseHand: () => void;
  onSendReaction: (emoji: string) => void;
}

export const ActiveCallView: React.FC<ActiveCallViewProps> = ({
  call,
  onEndCall,
  onToggleMute,
  onToggleVideo,
  onToggleScreenShare,
  onSendMessage,
  messages,
  onRaiseHand,
  onSendReaction,
}) => {
  const [activeTab, setActiveTab] = useState<'none' | 'chat' | 'participants'>('none');
  const [chatInput, setChatInput] = useState('');
  const [isSafetyModalOpen, setIsSafetyModalOpen] = useState(false);
  const [isVerified, setIsVerified] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [mediaRecorder, setMediaRecorder] = useState<MediaRecorder | null>(null);
  const [recordedChunks, setRecordedChunks] = useState<Blob[]>([]);
  const [reactions, setReactions] = useState<Array<{ id: number; emoji: string; x: number }>>([]);
  const [audioWaves, setAudioWaves] = useState<number[]>([15, 25, 45, 80, 50, 30, 65, 40, 20, 55, 75, 30]);

  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const screenVideoRef = useRef<HTMLVideoElement>(null);

  // Format call duration
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Animate acoustic soundwaves based on live audio level
  useEffect(() => {
    let animId: number;
    const updateWaves = () => {
      const vol = mediaManager.getAudioVolume();
      const multiplier = call.isMuted ? 0.05 : Math.max(0.15, vol / 100);
      setAudioWaves([
        Math.min(100, Math.floor(20 * multiplier + Math.random() * 25 * multiplier)),
        Math.min(100, Math.floor(40 * multiplier + Math.random() * 40 * multiplier)),
        Math.min(100, Math.floor(70 * multiplier + Math.random() * 30 * multiplier)),
        Math.min(100, Math.floor(90 * multiplier + Math.random() * 10 * multiplier)),
        Math.min(100, Math.floor(60 * multiplier + Math.random() * 40 * multiplier)),
        Math.min(100, Math.floor(35 * multiplier + Math.random() * 30 * multiplier)),
        Math.min(100, Math.floor(80 * multiplier + Math.random() * 20 * multiplier)),
        Math.min(100, Math.floor(55 * multiplier + Math.random() * 35 * multiplier)),
        Math.min(100, Math.floor(30 * multiplier + Math.random() * 25 * multiplier)),
        Math.min(100, Math.floor(85 * multiplier + Math.random() * 15 * multiplier)),
        Math.min(100, Math.floor(45 * multiplier + Math.random() * 35 * multiplier)),
        Math.min(100, Math.floor(25 * multiplier + Math.random() * 20 * multiplier)),
      ]);
      animId = requestAnimationFrame(updateWaves);
    };
    animId = requestAnimationFrame(updateWaves);
    return () => cancelAnimationFrame(animId);
  }, [call.isMuted]);

  // Hook up video streams to HTML elements
  useEffect(() => {
    const setupStreams = async () => {
      if (call.type !== 'audio' || call.isScreenSharing) {
        const stream = await mediaManager.getLocalMedia(!call.isVideoOff, !call.isMuted);
        if (localVideoRef.current && stream) {
          localVideoRef.current.srcObject = stream;
        }
      }
    };
    setupStreams();
  }, [call.isVideoOff, call.isMuted, call.type, call.isScreenSharing]);

  // Recording toggle
  const handleToggleRecording = () => {
    if (isRecording) {
      if (mediaRecorder && mediaRecorder.state !== 'inactive') {
        mediaRecorder.stop();
      }
      setIsRecording(false);
    } else {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = 640;
        canvas.height = 480;
        const ctx = canvas.getContext('2d')!;
        ctx.fillStyle = '#000';
        ctx.fillRect(0, 0, 640, 480);
        const stream = canvas.captureStream(10);
        const rec = new MediaRecorder(stream, { mimeType: 'video/webm' });
        const chunks: Blob[] = [];
        rec.ondataavailable = (e) => {
          if (e.data.size > 0) chunks.push(e.data);
        };
        rec.onstop = () => {
          const blob = new Blob(chunks, { type: 'video/webm' });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `ciphercall_${call.type}_${Date.now()}.webm`;
          a.click();
        };
        rec.start();
        setMediaRecorder(rec);
        setIsRecording(true);
      } catch (e) {
        console.warn('Recording error:', e);
      }
    }
  };

  const handleSendChat = (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim()) return;
    onSendMessage(chatInput.trim());
    setChatInput('');
  };

  const triggerReaction = (emoji: string) => {
    const id = Date.now() + Math.random();
    setReactions(prev => [...prev, { id, emoji, x: Math.random() * 60 + 20 }]);
    onSendReaction(emoji);
    setTimeout(() => {
      setReactions(prev => prev.filter(r => r.id !== id));
    }, 2500);
  };

  const isAudioOnly = call.type === 'audio';
  const targetName = call.targetContact?.name || call.roomName || 'Confidential Call';
  const targetAvatar = call.targetContact?.avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80';

  return (
    <div id="active-call-viewport" className="fixed inset-0 z-40 bg-[#09090b] flex flex-col overflow-hidden select-none">
      {/* Floating Reaction Emojis Overlay */}
      <div className="absolute inset-0 pointer-events-none z-50 overflow-hidden">
        {reactions.map((r) => (
          <div
            key={r.id}
            className="absolute bottom-24 text-4xl animate-float-up opacity-90 drop-shadow-lg"
            style={{ left: `${r.x}%` }}
          >
            {r.emoji}
          </div>
        ))}
      </div>

      {/* Top Navigation HUD */}
      <div className="h-16 px-6 bg-[#121216]/95 border-b border-zinc-800/80 flex items-center justify-between z-20 backdrop-blur-xl shadow-md shadow-black/20">
        {/* Left: Call Title & E2EE Verified Badge */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => setIsSafetyModalOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-950/80 hover:bg-emerald-900/80 border border-emerald-500/40 rounded-xl text-emerald-300 text-xs font-mono transition-colors shadow-xs"
            title="Click to verify 20-digit Safety Number"
          >
            <Lock className="w-3.5 h-3.5 text-emerald-400" />
            <span className="font-semibold">E2EE 256-Bit</span>
            {isVerified && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />}
          </button>

          <div>
            <h2 className="text-sm font-bold text-zinc-100 flex items-center gap-2">
              {targetName}
            </h2>
            <span className="text-[11px] text-zinc-400 font-medium">
              {call.type === 'video' ? 'HD Video Call' : 'Encrypted Audio Call'}
            </span>
          </div>
        </div>

        {/* Center: Timer & Recording status */}
        <div className="flex items-center gap-2">
          {isRecording && (
            <div className="flex items-center gap-1.5 px-2.5 py-1 bg-red-950/80 border border-red-500/40 text-red-400 text-xs font-mono rounded-full animate-pulse shadow-xs">
              <span className="w-2 h-2 rounded-full bg-red-500" />
              <span>REC</span>
            </div>
          )}

          <div className="px-4 py-1.5 bg-[#0c0c0e] border border-zinc-800 rounded-xl text-xs font-mono font-bold text-emerald-300 shadow-inner">
            {formatTime(call.duration)}
          </div>
        </div>

        {/* Right: Quick Action Drawers */}
        <div className="flex items-center gap-2">
          {/* Chat Toggle */}
          <button
            onClick={() => setActiveTab(activeTab === 'chat' ? 'none' : 'chat')}
            className={`p-2 rounded-xl text-xs font-medium border transition-colors relative shadow-xs ${
              activeTab === 'chat'
                ? 'bg-emerald-600 text-white border-emerald-500'
                : 'bg-[#18181d] text-zinc-300 border-zinc-800 hover:text-white hover:bg-[#222228]'
            }`}
            title="Encrypted In-Call Chat"
          >
            <MessageSquare className="w-4 h-4" />
            {messages.length > 0 && (
              <span className="absolute -top-1 -right-1 w-4 h-4 bg-emerald-500 text-[10px] font-bold rounded-full flex items-center justify-center text-white">
                {messages.length}
              </span>
            )}
          </button>

          {/* Participants Toggle */}
          <button
            onClick={() => setActiveTab(activeTab === 'participants' ? 'none' : 'participants')}
            className={`p-2 rounded-xl text-xs font-medium border transition-colors shadow-xs ${
              activeTab === 'participants'
                ? 'bg-emerald-600 text-white border-emerald-500'
                : 'bg-[#18181d] text-zinc-300 border-zinc-800 hover:text-white hover:bg-[#222228]'
            }`}
            title="Participants"
          >
            <Users className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Main Call Stage */}
      <div className="flex-1 relative flex overflow-hidden">
        {/* Central Stage View */}
        <div className="flex-1 relative flex items-center justify-center p-4">
          {isAudioOnly ? (
            /* 1-to-1 Audio Calling View */
            <div id="audio-call-stage" className="flex flex-col items-center justify-center text-center max-w-md w-full">
              {/* Pulsating Audio Avatar */}
              <div className="relative mb-8">
                <div className="absolute -inset-6 rounded-full bg-emerald-500/10 animate-ping opacity-60 pointer-events-none" />
                <div className="absolute -inset-3 rounded-full border-2 border-emerald-500/30 animate-pulse pointer-events-none" />
                <img
                  src={targetAvatar}
                  alt={targetName}
                  className="w-36 h-36 rounded-full object-cover border-4 border-emerald-500 shadow-2xl relative z-10"
                />
                <div className="absolute bottom-1 right-1 z-20 p-2 bg-emerald-600 rounded-full border-2 border-[#121216] shadow-md">
                  <Lock className="w-4 h-4 text-white" />
                </div>
              </div>

              <h1 className="text-2xl font-bold text-zinc-100 mb-1 tracking-tight">
                {targetName}
              </h1>
              <p className="text-xs text-zinc-400 font-medium mb-6">
                Direct End-to-End Encrypted Voice Channel
              </p>

              {/* Dynamic Soundwave Spectrum Visualizer */}
              <div className="flex items-center justify-center gap-1.5 h-16 w-full px-8 mb-6 bg-[#121216]/80 rounded-2xl border border-zinc-800/80 p-3 shadow-inner">
                {audioWaves.map((height, i) => (
                  <div
                    key={i}
                    className="flex-1 bg-gradient-to-t from-emerald-600 to-teal-300 rounded-full transition-all duration-75"
                    style={{ height: `${Math.max(8, height)}%` }}
                  />
                ))}
              </div>

              {/* Safety Number Quick Banner */}
              <button
                onClick={() => setIsSafetyModalOpen(true)}
                className="px-4 py-2 bg-[#121216] hover:bg-[#18181d] border border-emerald-500/30 rounded-2xl text-xs text-zinc-300 flex items-center gap-2 transition-all shadow-md shadow-black/30"
              >
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
                <span>Safety Number: <strong className="font-mono text-emerald-300">{call.safetyNumber}</strong></span>
              </button>
            </div>
          ) : (
            /* Group Video & HD Video Stage */
            <div id="video-conference-stage" className="w-full h-full grid grid-cols-1 md:grid-cols-2 gap-4 max-w-6xl mx-auto">
              {/* Participant Tile 1 (Remote Peer / Main Speaker) */}
              <div className="relative bg-[#121216] border border-zinc-800/80 rounded-3xl overflow-hidden shadow-2xl shadow-black/50 flex items-center justify-center group">
                <img
                  src={targetAvatar}
                  alt={targetName}
                  className="w-full h-full object-cover"
                />
                
                {/* Active speaker border indicator */}
                <div className="absolute inset-0 border-2 border-emerald-500/60 pointer-events-none rounded-3xl" />

                {/* Name tag */}
                <div className="absolute bottom-4 left-4 flex items-center gap-2 px-3 py-1.5 bg-black/75 backdrop-blur-md rounded-xl text-xs font-medium text-white border border-white/10 shadow-md">
                  <span>{targetName}</span>
                  <Lock className="w-3 h-3 text-emerald-400" />
                </div>
              </div>

              {/* Participant Tile 2 (Local Self Camera or Secondary Participant) */}
              <div className="relative bg-[#121216] border border-zinc-800/80 rounded-3xl overflow-hidden shadow-2xl shadow-black/50 flex items-center justify-center">
                {call.isVideoOff ? (
                  <div className="flex flex-col items-center justify-center text-center p-6">
                    <div className="w-20 h-20 rounded-full bg-[#18181d] flex items-center justify-center text-zinc-400 mb-3 border border-zinc-800">
                      <VideoOff className="w-8 h-8" />
                    </div>
                    <span className="text-sm font-bold text-white">{call.caller.name} (You)</span>
                    <span className="text-xs text-zinc-500">Camera is muted</span>
                  </div>
                ) : (
                  <video
                    ref={localVideoRef}
                    autoPlay
                    playsInline
                    muted
                    className="w-full h-full object-cover transform -scale-x-100"
                  />
                )}

                {/* Name tag */}
                <div className="absolute bottom-4 left-4 flex items-center gap-2 px-3 py-1.5 bg-black/75 backdrop-blur-md rounded-xl text-xs font-medium text-white border border-white/10 shadow-md">
                  <span>{call.caller.name} (You)</span>
                  {call.isMuted && <MicOff className="w-3 h-3 text-red-400" />}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Right Side Drawer: In-Call Encrypted Chat */}
        {activeTab === 'chat' && (
          <div className="w-80 bg-[#121216]/95 border-l border-zinc-800 flex flex-col h-full z-20 backdrop-blur-xl animate-fade-in shadow-2xl shadow-black/50">
            <div className="p-4 border-b border-zinc-800 flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs font-bold text-white">
                <MessageSquare className="w-4 h-4 text-emerald-400" />
                <span>Encrypted In-Call Chat</span>
              </div>
              <button onClick={() => setActiveTab('none')} className="text-zinc-400 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex-1 p-4 overflow-y-auto space-y-3">
              {messages.length === 0 ? (
                <div className="text-center py-10 text-xs text-zinc-500">
                  Messages are encrypted with the active AES-GCM session key and deleted after the call.
                </div>
              ) : (
                messages.map((m) => (
                  <div
                    key={m.id}
                    className={`p-3 rounded-2xl text-xs ${
                      m.senderId === call.caller.id
                        ? 'bg-emerald-600 text-white ml-6 rounded-tr-none'
                        : 'bg-[#18181d] border border-zinc-800 text-zinc-200 mr-6 rounded-tl-none'
                    }`}
                  >
                    <div className="text-[10px] font-bold opacity-75 mb-0.5">{m.senderName}</div>
                    <div>{m.text}</div>
                    <div className="text-[9px] opacity-60 text-right mt-1 font-mono">{m.timestamp}</div>
                  </div>
                ))
              )}
            </div>

            <form onSubmit={handleSendChat} className="p-3 border-t border-zinc-800 flex gap-2">
              <input
                type="text"
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                placeholder="Type encrypted message..."
                className="flex-1 bg-[#0c0c0e] border border-zinc-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500 shadow-inner"
              />
              <button
                type="submit"
                className="p-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl transition-colors shadow-xs"
              >
                <Send className="w-4 h-4" />
              </button>
            </form>
          </div>
        )}

        {/* Right Side Drawer: Participants List */}
        {activeTab === 'participants' && (
          <div className="w-80 bg-[#121216]/95 border-l border-zinc-800 flex flex-col h-full z-20 backdrop-blur-xl animate-fade-in shadow-2xl shadow-black/50">
            <div className="p-4 border-b border-zinc-800 flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs font-bold text-white">
                <Users className="w-4 h-4 text-emerald-400" />
                <span>Conference Participants</span>
              </div>
              <button onClick={() => setActiveTab('none')} className="text-zinc-400 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4 space-y-2 flex-1 overflow-y-auto">
              <div className="flex items-center justify-between p-2.5 bg-[#0c0c0e] rounded-xl border border-zinc-800/90 shadow-inner">
                <div className="flex items-center gap-2.5">
                  <img
                    src={call.caller.avatar}
                    alt={call.caller.name}
                    className="w-8 h-8 rounded-full object-cover border border-zinc-700/80"
                  />
                  <div>
                    <div className="text-xs font-bold text-white">{call.caller.name} (You)</div>
                    <div className="text-[10px] text-zinc-400 font-mono">Host • {call.caller.deviceName}</div>
                  </div>
                </div>
                {call.isMuted ? <MicOff className="w-3.5 h-3.5 text-red-400" /> : <Mic className="w-3.5 h-3.5 text-emerald-400" />}
              </div>

              {call.targetContact && (
                <div className="flex items-center justify-between p-2.5 bg-[#0c0c0e] rounded-xl border border-zinc-800/90 shadow-inner">
                  <div className="flex items-center gap-2.5">
                    <img
                      src={call.targetContact.avatar}
                      alt={call.targetContact.name}
                      className="w-8 h-8 rounded-full object-cover border border-zinc-700/80"
                    />
                    <div>
                      <div className="text-xs font-bold text-white">{call.targetContact.name}</div>
                      <div className="text-[10px] text-emerald-400 font-mono">E2EE Connected</div>
                    </div>
                  </div>
                  <Mic className="w-3.5 h-3.5 text-emerald-400" />
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Bottom Floating Control Dock */}
      <div className="h-20 bg-[#121216]/95 border-t border-zinc-800/80 flex items-center justify-center gap-3 px-6 z-20 backdrop-blur-xl shadow-2xl shadow-black/60">
        {/* Mute Mic */}
        <button
          id="active-call-toggle-mic-btn"
          onClick={onToggleMute}
          className={`p-3.5 rounded-2xl border transition-all active:scale-95 shadow-xs ${
            call.isMuted
              ? 'bg-red-600/20 text-red-400 border-red-500/40 hover:bg-red-600 hover:text-white'
              : 'bg-[#18181d] text-zinc-200 border-zinc-800 hover:bg-[#222228] hover:text-white'
          }`}
          title={call.isMuted ? 'Unmute Microphone' : 'Mute Microphone'}
        >
          {call.isMuted ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
        </button>

        {/* Toggle Video */}
        {call.type !== 'audio' && (
          <button
            id="active-call-toggle-video-btn"
            onClick={onToggleVideo}
            className={`p-3.5 rounded-2xl border transition-all active:scale-95 shadow-xs ${
              call.isVideoOff
                ? 'bg-red-600/20 text-red-400 border-red-500/40 hover:bg-red-600 hover:text-white'
                : 'bg-[#18181d] text-zinc-200 border-zinc-800 hover:bg-[#222228] hover:text-white'
            }`}
            title={call.isVideoOff ? 'Start Camera' : 'Stop Camera'}
          >
            {call.isVideoOff ? <VideoOff className="w-5 h-5" /> : <Video className="w-5 h-5" />}
          </button>
        )}

        {/* Screen Share */}
        {call.type !== 'audio' && (
          <button
            id="active-call-toggle-screen-btn"
            onClick={onToggleScreenShare}
            className={`p-3.5 rounded-2xl border transition-all active:scale-95 shadow-xs ${
              call.isScreenSharing
                ? 'bg-indigo-600 text-white border-indigo-500'
                : 'bg-[#18181d] text-zinc-200 border-zinc-800 hover:bg-[#222228] hover:text-white'
            }`}
            title="Share Screen"
          >
            <ScreenShare className="w-5 h-5" />
          </button>
        )}

        {/* Raise Hand */}
        <button
          onClick={onRaiseHand}
          className="p-3.5 bg-[#18181d] hover:bg-[#222228] text-zinc-200 border border-zinc-800 rounded-2xl transition-all active:scale-95 shadow-xs"
          title="Raise Hand"
        >
          <Hand className="w-5 h-5 text-amber-400" />
        </button>

        {/* Quick Reactions */}
        <div className="hidden sm:flex items-center gap-1 bg-[#0c0c0e] p-1 rounded-2xl border border-zinc-800 shadow-inner">
          {['👍', '❤️', '👏', '🎉', '🚀'].map((emoji) => (
            <button
              key={emoji}
              onClick={() => triggerReaction(emoji)}
              className="p-2 hover:bg-[#18181d] rounded-xl text-sm transition-transform hover:scale-125"
            >
              {emoji}
            </button>
          ))}
        </div>

        {/* Recording Toggle */}
        <button
          id="active-call-toggle-rec-btn"
          onClick={handleToggleRecording}
          className={`p-3.5 rounded-2xl border transition-all active:scale-95 shadow-xs ${
            isRecording
              ? 'bg-red-600 text-white border-red-500 animate-pulse'
              : 'bg-[#18181d] text-zinc-200 border-zinc-800 hover:bg-[#222228] hover:text-white'
          }`}
          title={isRecording ? 'Stop Recording' : 'Record Session'}
        >
          <Disc className="w-5 h-5 text-red-400" />
        </button>

        {/* End Call (Red Button) */}
        <button
          id="active-call-hangup-btn"
          onClick={onEndCall}
          className="p-3.5 bg-red-600 hover:bg-red-500 text-white rounded-2xl shadow-xl shadow-red-950/60 transition-all active:scale-95 ml-2"
          title="End Call"
        >
          <PhoneOff className="w-5 h-5" />
        </button>
      </div>

      {/* Safety Number Verification Modal */}
      <E2EESafetyModal
        isOpen={isSafetyModalOpen}
        onClose={() => setIsSafetyModalOpen(false)}
        localIdentity={call.caller}
        remoteName={targetName}
        remoteFingerprint={call.targetContact?.publicKeyFingerprint || '99DA F102 77B4 4920 18EA'}
        safetyNumber={call.safetyNumber}
        isVerified={isVerified}
        onToggleVerified={(v) => {
          setIsVerified(v);
          if (v) ringEngine.playVerifiedChime();
        }}
      />
    </div>
  );
};
