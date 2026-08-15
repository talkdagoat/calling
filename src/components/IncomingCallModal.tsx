import React, { useEffect } from 'react';
import { Phone, Video, PhoneOff, ShieldCheck, Lock, Users, Volume2 } from 'lucide-react';
import { CallSession, CallType } from '../types';
import { ringEngine } from '../utils/audioRingEngine';

interface IncomingCallModalProps {
  call: CallSession | null;
  onAnswer: (type: CallType) => void;
  onDecline: () => void;
}

export const IncomingCallModal: React.FC<IncomingCallModalProps> = ({
  call,
  onAnswer,
  onDecline,
}) => {
  useEffect(() => {
    if (call && call.status === 'incoming') {
      // Ring the device immediately with audio & vibration
      ringEngine.startIncomingRing();
    }
    return () => {
      ringEngine.stopAll();
    };
  }, [call]);

  if (!call || call.status !== 'incoming') return null;

  const isGroup = call.type === 'group';
  const callerName = call.caller.name || 'Unknown Caller';
  const callerAvatar = call.caller.avatar;
  const callerDevice = call.caller.deviceName || 'Mobile Device';

  return (
    <div id="incoming-call-overlay" className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-xl animate-fade-in">
      <div 
        id="incoming-call-card"
        className="w-full max-w-md bg-[#121216] border border-emerald-500/40 rounded-3xl p-6 shadow-2xl shadow-black/80 text-zinc-100 relative overflow-hidden flex flex-col items-center text-center ring-1 ring-emerald-500/20"
      >
        {/* Glowing Animated Ring Wave Background */}
        <div className="absolute -top-24 -left-24 w-72 h-72 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none animate-pulse" />
        <div className="absolute -bottom-24 -right-24 w-72 h-72 bg-teal-500/10 rounded-full blur-3xl pointer-events-none animate-pulse" />

        {/* E2EE Badge Top */}
        <div className="flex items-center gap-1.5 px-3 py-1 bg-emerald-950/80 border border-emerald-500/40 rounded-full text-emerald-300 text-xs font-mono mb-6 shadow-xs">
          <Lock className="w-3.5 h-3.5" />
          <span>E2EE 256-bit Encrypted Incoming Call</span>
        </div>

        {/* Pulsating Avatar Container */}
        <div className="relative mb-6">
          {/* Ring sound wave animation ripples */}
          <div className="absolute inset-0 rounded-full bg-emerald-500/20 animate-ping opacity-75" />
          <div className="absolute -inset-3 rounded-full border-2 border-emerald-400/40 animate-pulse" />
          
          <img
            src={callerAvatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80'}
            alt={callerName}
            className="w-28 h-28 rounded-full object-cover border-4 border-emerald-500 shadow-2xl relative z-10"
          />

          <div className="absolute bottom-0 right-0 z-20 bg-emerald-600 p-2 rounded-full border-2 border-[#121216] shadow-md">
            {isGroup ? (
              <Users className="w-4 h-4 text-white" />
            ) : call.type === 'video' ? (
              <Video className="w-4 h-4 text-white" />
            ) : (
              <Volume2 className="w-4 h-4 text-white" />
            )}
          </div>
        </div>

        {/* Caller Info */}
        <h2 className="text-2xl font-bold tracking-tight text-white mb-1">
          {callerName}
        </h2>
        <p className="text-zinc-400 text-sm mb-4">
          {call.type === 'video' ? 'Incoming HD Video Call' : 'Incoming Encrypted Voice Call'}
        </p>

        {/* Audio Ringing Notice */}
        <div className="w-full bg-[#0c0c0e] rounded-xl p-2.5 mb-6 flex items-center justify-center gap-2 text-xs text-emerald-300 border border-zinc-800 shadow-inner">
          <Volume2 className="w-4 h-4 animate-bounce text-emerald-400" />
          <span>Device is ringing with synthesized telephony chime</span>
        </div>

        {/* Action Buttons */}
        <div className="grid grid-cols-3 gap-3 w-full pt-2">
          {/* Decline Button */}
          <button
            id="incoming-call-decline-btn"
            onClick={onDecline}
            className="flex flex-col items-center justify-center gap-1.5 py-3.5 px-2 bg-red-950/40 hover:bg-red-600 text-red-400 hover:text-white border border-red-500/30 hover:border-red-600 rounded-2xl transition-all duration-200 active:scale-95 group shadow-xs"
          >
            <div className="p-2.5 bg-red-600 rounded-full text-white shadow-lg group-hover:scale-110 transition-transform">
              <PhoneOff className="w-5 h-5" />
            </div>
            <span className="text-xs font-medium">Decline</span>
          </button>

          {/* Audio Answer Button */}
          <button
            id="incoming-call-answer-audio-btn"
            onClick={() => onAnswer('audio')}
            className="flex flex-col items-center justify-center gap-1.5 py-3.5 px-2 bg-[#1a1a20] hover:bg-[#25252c] text-zinc-200 hover:text-white border border-zinc-700/80 rounded-2xl transition-all duration-200 active:scale-95 group shadow-xs"
          >
            <div className="p-2.5 bg-teal-600 rounded-full text-white shadow-lg group-hover:scale-110 transition-transform">
              <Phone className="w-5 h-5" />
            </div>
            <span className="text-xs font-medium">Audio Only</span>
          </button>

          {/* Video Answer Button */}
          <button
            id="incoming-call-answer-video-btn"
            onClick={() => onAnswer(call.type === 'audio' ? 'audio' : 'video')}
            className="flex flex-col items-center justify-center gap-1.5 py-3.5 px-2 bg-emerald-600/20 hover:bg-emerald-600 text-emerald-300 hover:text-white border border-emerald-500/40 hover:border-emerald-600 rounded-2xl transition-all duration-200 active:scale-95 group shadow-xs"
          >
            <div className="p-2.5 bg-emerald-500 rounded-full text-white shadow-lg group-hover:scale-110 transition-transform">
              <Video className="w-5 h-5" />
            </div>
            <span className="text-xs font-bold">Answer</span>
          </button>
        </div>
      </div>
    </div>
  );
};
