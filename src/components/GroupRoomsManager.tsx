import React, { useState } from 'react';
import { Users, Plus, Video, Copy, Check, Shield, Sparkles, Hash, ArrowRight, Lock, Radio } from 'lucide-react';
import { CallType, Contact } from '../types';

interface GroupRoomsManagerProps {
  onStartGroupCall: (roomId: string, roomName: string) => void;
  contacts: Contact[];
}

interface TeamRoom {
  id: string;
  name: string;
  topic: string;
  category: string;
  activeCount: number;
  maxParticipants: number;
  encrypted: boolean;
  avatar: string;
}

export const GroupRoomsManager: React.FC<GroupRoomsManagerProps> = ({
  onStartGroupCall,
  contacts,
}) => {
  const [customRoomId, setCustomRoomId] = useState('');
  const [customRoomName, setCustomRoomName] = useState('');
  const [copiedRoomId, setCopiedRoomId] = useState<string | null>(null);

  const predefinedRooms: TeamRoom[] = [
    {
      id: 'room_zk_core',
      name: 'Zero-Knowledge Security Hall',
      topic: 'Lattice cryptography & post-quantum key exchange research',
      category: 'Research',
      activeCount: 3,
      maxParticipants: 16,
      encrypted: true,
      avatar: 'https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?w=150&auto=format&fit=crop&q=80',
    },
    {
      id: 'room_engineering_sync',
      name: 'High-Throughput WebRTC Stage',
      topic: 'Mesh routing, Opus 128kbps stereo audio & simulcast video testing',
      category: 'Engineering',
      activeCount: 2,
      maxParticipants: 24,
      encrypted: true,
      avatar: 'https://images.unsplash.com/photo-1531482615713-2afd69097998?w=150&auto=format&fit=crop&q=80',
    },
    {
      id: 'room_executive_brief',
      name: 'Confidential Executive Chamber',
      topic: 'Private board briefing with hardware-authenticated E2EE keys',
      category: 'Executive',
      activeCount: 1,
      maxParticipants: 10,
      encrypted: true,
      avatar: 'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?w=150&auto=format&fit=crop&q=80',
    },
    {
      id: 'room_open_lounge',
      name: 'Cipher Lounge & Watercooler',
      topic: 'Casual team audio drop-in & spontaneous pairing sessions',
      category: 'Social',
      activeCount: 4,
      maxParticipants: 32,
      encrypted: true,
      avatar: 'https://images.unsplash.com/photo-1522071820081-009f0129c71c?w=150&auto=format&fit=crop&q=80',
    },
  ];

  const handleCreateInstantRoom = (e: React.FormEvent) => {
    e.preventDefault();
    const id = customRoomId.trim() || `CIPHER-${Math.floor(100 + Math.random() * 900)}-SEC`;
    const name = customRoomName.trim() || 'Encrypted Video Conference';
    onStartGroupCall(id, name);
  };

  const handleCopyLink = (roomId: string) => {
    const link = `${window.location.origin}/#room=${roomId}`;
    navigator.clipboard.writeText(link);
    setCopiedRoomId(roomId);
    setTimeout(() => setCopiedRoomId(null), 2000);
  };

  return (
    <div id="group-rooms-view" className="w-full max-w-7xl mx-auto px-4 py-6">
      {/* Top Banner */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 mb-8">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-emerald-400">
              <Users className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-zinc-100 tracking-tight">
                Encrypted Group Video Conferencing
              </h1>
              <p className="text-xs text-zinc-400">
                Multi-peer HD video, screen sharing, stereo audio, and zero-knowledge room encryption.
              </p>
            </div>
          </div>
        </div>

        {/* E2EE Guarantee Badge */}
        <div className="flex items-center gap-2 px-3 py-1.5 bg-[#121216] border border-emerald-500/30 rounded-xl text-xs text-emerald-300 font-mono shadow-xs">
          <Lock className="w-3.5 h-3.5 text-emerald-400" />
          <span>Full Mesh 256-bit AES-GCM Encrypted</span>
        </div>
      </div>

      {/* Create / Join Room Card */}
      <div className="bg-gradient-to-br from-[#121216] via-[#121216] to-emerald-950/20 border border-zinc-800/80 rounded-3xl p-6 mb-8 shadow-xl shadow-black/30">
        <h2 className="text-base font-bold text-zinc-100 mb-2 flex items-center gap-2">
          <Radio className="w-4 h-4 text-emerald-400" />
          <span>Launch or Join a Room</span>
        </h2>
        <p className="text-xs text-zinc-400 mb-5">
          Enter a room code or topic to spin up an instant high-quality video conference room.
        </p>

        <form onSubmit={handleCreateInstantRoom} className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="md:col-span-1">
            <label className="text-[11px] text-zinc-400 block mb-1">Room Code / ID</label>
            <div className="relative">
              <Hash className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
              <input
                type="text"
                value={customRoomId}
                onChange={(e) => setCustomRoomId(e.target.value)}
                placeholder="e.g. CIPHER-SEC-901"
                className="w-full bg-[#0c0c0e] border border-zinc-800 rounded-xl pl-9 pr-3 py-2.5 text-xs font-mono text-emerald-300 focus:outline-none focus:border-emerald-500 transition-colors shadow-inner"
              />
            </div>
          </div>

          <div className="md:col-span-1">
            <label className="text-[11px] text-zinc-400 block mb-1">Room Topic / Name</label>
            <input
              type="text"
              value={customRoomName}
              onChange={(e) => setCustomRoomName(e.target.value)}
              placeholder="e.g. Cryptography Sprint Demo"
              className="w-full bg-[#0c0c0e] border border-zinc-800 rounded-xl px-3 py-2.5 text-xs text-zinc-100 focus:outline-none focus:border-emerald-500 transition-colors shadow-inner"
            />
          </div>

          <div className="md:col-span-1 flex items-end">
            <button
              id="start-instant-group-call-btn"
              type="submit"
              className="w-full py-2.5 px-4 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold shadow-lg shadow-emerald-950/50 flex items-center justify-center gap-2 transition-all duration-200 active:scale-98"
            >
              <Video className="w-4 h-4" />
              <span>Launch Video Conference</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </form>
      </div>

      {/* Preconfigured Team Rooms */}
      <div className="mb-4">
        <h2 className="text-base font-bold text-zinc-100 mb-1">Active Team Rooms</h2>
        <p className="text-xs text-zinc-400">Join continuous secure collaboration rooms in 1-click.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {predefinedRooms.map((room) => (
          <div
            key={room.id}
            id={`room-card-${room.id}`}
            className="bg-[#121216] border border-zinc-800/80 hover:border-emerald-500/40 rounded-2xl p-5 shadow-lg shadow-black/30 flex flex-col justify-between transition-all duration-200 hover:-translate-y-0.5"
          >
            <div>
              <div className="flex items-start justify-between gap-3 mb-3">
                <div className="flex items-center gap-3">
                  <img
                    src={room.avatar}
                    alt={room.name}
                    className="w-12 h-12 rounded-xl object-cover border border-zinc-700/80 shadow-md"
                  />
                  <div>
                    <span className="px-2 py-0.5 bg-[#18181d] border border-zinc-800 text-zinc-400 rounded-md text-[10px] font-medium uppercase tracking-wider">
                      {room.category}
                    </span>
                    <h3 className="text-base font-bold text-zinc-100 mt-1">{room.name}</h3>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 px-2.5 py-1 bg-emerald-950/70 border border-emerald-500/30 rounded-lg text-emerald-400 text-xs font-mono shadow-xs">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  <span>{room.activeCount} Online</span>
                </div>
              </div>

              <p className="text-xs text-zinc-400 mb-4">{room.topic}</p>

              {/* Security info */}
              <div className="flex items-center justify-between text-[11px] text-zinc-500 font-mono bg-[#0c0c0e] p-2.5 rounded-xl border border-zinc-800/90 mb-4 shadow-inner">
                <span className="flex items-center gap-1 text-emerald-400 font-semibold">
                  <Shield className="w-3 h-3" /> E2EE Room Key Exchange
                </span>
                <span>Code: #{room.id}</span>
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2 pt-2 border-t border-zinc-800/80">
              <button
                onClick={() => handleCopyLink(room.id)}
                className="px-3 py-2 bg-[#18181d] hover:bg-[#222228] text-zinc-300 hover:text-white border border-zinc-800 rounded-xl text-xs font-medium flex items-center gap-1.5 transition-colors shadow-xs"
                title="Copy Invite Link"
              >
                {copiedRoomId === room.id ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Copied!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    <span>Invite</span>
                  </>
                )}
              </button>

              <button
                id={`join-room-${room.id}`}
                onClick={() => onStartGroupCall(room.id, room.name)}
                className="flex-1 py-2 px-4 bg-emerald-600/20 hover:bg-emerald-600 text-emerald-300 hover:text-white border border-emerald-500/40 hover:border-emerald-600 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all active:scale-95 shadow-xs"
              >
                <Video className="w-3.5 h-3.5" />
                <span>Join Conference</span>
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
