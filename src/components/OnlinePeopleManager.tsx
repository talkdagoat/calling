import React, { useMemo, useState } from 'react';
import { Users, Search, Phone, Video, Circle, WifiOff } from 'lucide-react';
import { Contact, CallType } from '../types';

type OnlineUser = {
  userId: string;
  deviceId?: string;
  deviceName?: string;
  name: string;
  avatar?: string;
  fingerprint?: string;
  inCall?: boolean;
};

interface Props {
  onlineUsers: OnlineUser[];
  currentUserId: string;
  onInitiateCall: (contact: Contact, type: CallType) => void;
}

export const OnlinePeopleManager: React.FC<Props> = ({ onlineUsers, currentUserId, onInitiateCall }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const people = useMemo(() => {
    const seen = new Set<string>();
    return onlineUsers.filter(user => user.userId !== currentUserId).filter(user => {
      const key = user.userId || user.name;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, [onlineUsers, currentUserId]);

  const filtered = people.filter(user => !searchQuery.trim() || user.name.toLowerCase().includes(searchQuery.trim().toLowerCase()));
  const contactFor = (user: OnlineUser): Contact => ({
    id: user.userId,
    name: user.name,
    phone: '', email: '', role: 'Temporary online user',
    avatar: user.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.name)}&background=059669&color=ffffff&bold=true`,
    status: user.inCall ? 'busy' : 'online',
    publicKeyFingerprint: user.fingerprint || '4E9A B7C2 91F0 33DA 8201',
    deviceList: [user.deviceName || 'Web Client'], notes: '', isFavorite: false, tags: [],
  });

  return <div className="w-full max-w-4xl mx-auto px-4 py-6">
    <div className="flex items-center gap-3 mb-6">
      <div className="p-2.5 bg-emerald-500/10 border border-emerald-500/30 rounded-2xl text-emerald-400"><Users className="w-6 h-6" /></div>
      <div><h1 className="text-xl font-bold text-white">People</h1><p className="text-xs text-zinc-400">Only people connected right now. Nothing is saved as a contact.</p></div>
      <div className="ml-auto flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-950/50 border border-emerald-500/30 text-emerald-300 text-xs font-semibold"><Circle className="w-2.5 h-2.5 fill-emerald-400" />{people.length} online</div>
    </div>
    <div className="mb-5 relative"><Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" /><input value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="Find someone who is online..." className="w-full bg-[#121216] border border-zinc-800 rounded-2xl pl-11 pr-4 py-3 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-emerald-500" /></div>
    {filtered.length === 0 ? <div className="rounded-3xl border border-dashed border-zinc-800 bg-[#101014] p-10 text-center"><WifiOff className="w-8 h-8 mx-auto text-zinc-600 mb-3" /><p className="text-sm font-semibold text-zinc-300">No other people are online</p><p className="text-xs text-zinc-500 mt-1">Open Talk on another device with a different name to test.</p></div> : <div className="space-y-3">{filtered.map(user => { const contact = contactFor(user); return <div key={user.userId} className="bg-[#121216] border border-zinc-800 rounded-2xl p-4 flex items-center gap-4">
      <div className="relative shrink-0"><img src={contact.avatar} alt={user.name} className="w-12 h-12 rounded-2xl object-cover" /><span className={`absolute -bottom-1 -right-1 w-3.5 h-3.5 rounded-full border-2 border-[#121216] ${user.inCall ? 'bg-amber-400' : 'bg-emerald-500'}`} /></div>
      <div className="min-w-0 flex-1"><p className="font-bold text-white truncate">{user.name}</p><p className="text-xs text-zinc-500 truncate">{user.inCall ? 'Already in a call' : 'Online • ready to chat or call'}</p></div>
      <div className="flex gap-2"><button disabled={Boolean(user.inCall)} onClick={() => onInitiateCall(contact, 'audio')} className="p-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white" title="Audio call"><Phone className="w-4 h-4" /></button><button disabled={Boolean(user.inCall)} onClick={() => onInitiateCall(contact, 'video')} className="p-3 rounded-xl bg-sky-600 hover:bg-sky-500 disabled:opacity-40 text-white" title="Video call"><Video className="w-4 h-4" /></button></div>
    </div>; })}</div>}
  </div>;
};
