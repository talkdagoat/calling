import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { MessageCircle, Phone, RefreshCw, Send, Video, Circle, WifiOff } from 'lucide-react';
import { Contact, UserIdentity } from '../types';

type SlackMessage = { id: string; ts: string; text: string; senderId?: string; senderName: string; avatar?: string; isMine: boolean; kind?: 'message' | 'call'; callType?: 'audio' | 'video' };
type OnlineUser = { userId: string; deviceId?: string; deviceName?: string; name: string; avatar?: string; inCall?: boolean; fingerprint?: string };

interface SlackChatProps { identity: UserIdentity; contacts?: Contact[]; onCall: (contact: Contact) => void; onVideoCall: (contact: Contact) => void; }

// Build API URLs explicitly. Safari can throw the very generic
// "The string did not match the expected pattern" when URL parsing fails.
function apiUrl(path: string) {
  if (typeof window === 'undefined') return path;
  return new URL(path, window.location.origin).toString();
}

async function readApiResponse(response: Response) {
  const text = await response.text();
  let data: any = {};
  try { data = text ? JSON.parse(text) : {}; } catch { data = { raw: text }; }
  if (!response.ok) {
    throw new Error(String(data.error || data.raw || `Request failed (${response.status})`));
  }
  return data;
}

export const SlackChat: React.FC<SlackChatProps> = ({ identity, onCall, onVideoCall }) => {
  const [messages, setMessages] = useState<SlackMessage[]>([]);
  const [onlineUsers, setOnlineUsers] = useState<OnlineUser[]>([]);
  const [selectedUserId, setSelectedUserId] = useState('');
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const endRef = useRef<HTMLDivElement | null>(null);

  const people = useMemo(() => {
    const seen = new Set<string>();
    return onlineUsers.filter(u => u.userId !== identity.id).filter(u => { if (seen.has(u.userId)) return false; seen.add(u.userId); return true; });
  }, [onlineUsers, identity.id]);
  const selected = people.find(u => u.userId === selectedUserId);
  const toContact = (u: OnlineUser): Contact => ({ id: u.userId, name: u.name, phone: '', email: '', role: 'Temporary online user', avatar: u.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(u.name)}&background=059669&color=ffffff&bold=true`, status: u.inCall ? 'busy' : 'online', publicKeyFingerprint: u.fingerprint || '4E9A B7C2 91F0 33DA 8201', deviceList: [u.deviceName || 'Web Client'], notes: '', isFavorite: false, tags: [] });

  const loadMessages = useCallback(async () => {
    try {
      const url = apiUrl('/api/slack/messages');
      const response = await fetch(url, { cache: 'no-store', headers: { Accept: 'application/json' } });
      const data = await readApiResponse(response);
      const loaded = Array.isArray(data.messages) ? data.messages : [];
      setMessages(loaded.map((m: SlackMessage) => ({ ...m, isMine: m.senderId === identity.id })));
      setError('');
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error('[SlackChat][loadMessages]', message, err);
      setError(`[chat] ${message}`);
    } finally { setLoading(false); }
  }, [identity.id]);

  useEffect(() => { loadMessages(); const timer = window.setInterval(loadMessages, 5000); return () => window.clearInterval(timer); }, [loadMessages]);

  useEffect(() => {
    try {
      const url = new URL('/api/ws', window.location.origin);
      url.protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const ws = new WebSocket(url.toString());
      ws.onopen = () => ws.send(JSON.stringify({ type: 'register', sender: identity }));
      ws.onmessage = event => { try { const msg = JSON.parse(event.data); if (msg.type === 'presence:update' && Array.isArray(msg.onlineUsers)) setOnlineUsers(msg.onlineUsers); } catch {} };
      ws.onerror = event => console.warn('[SlackChat][WebSocket]', event);
      return () => { try { ws.close(); } catch {} };
    } catch (err) {
      console.error('[SlackChat][WebSocket setup]', err);
    }
  }, [identity]);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages.length]);

  const startCall = async (user: OnlineUser, type: 'audio' | 'video') => {
    const contact = toContact(user);
    try {
      const response = await fetch(apiUrl('/api/slack/calls'), { method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' }, body: JSON.stringify({ callType: type, sender: { id: identity.id, name: identity.name, avatar: identity.avatar }, target: { id: contact.id, name: contact.name, avatar: contact.avatar } }) });
      await readApiResponse(response);
    } catch (err) { setError(`[call signaling] ${err instanceof Error ? err.message : String(err)}`); }
    if (type === 'video') onVideoCall(contact); else onCall(contact);
  };

  const sendMessage = async () => {
    const clean = text.trim(); if (!clean || sending) return;
    setSending(true);
    try {
      const response = await fetch(apiUrl('/api/slack/messages'), { method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' }, body: JSON.stringify({ text: clean, sender: { id: identity.id, name: identity.name, avatar: identity.avatar }, target: selected ? { id: selected.userId, name: selected.name } : null }) });
      await readApiResponse(response);
      setText('');
      await loadMessages();
    } catch (err) { setError(`[send message] ${err instanceof Error ? err.message : String(err)}`); }
    finally { setSending(false); }
  };

  return <section className="h-[calc(100vh-4rem)] min-h-[520px] p-4 md:p-6 flex flex-col"><div className="max-w-6xl w-full mx-auto flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-[260px_1fr] gap-4">
    <aside className="rounded-3xl border border-zinc-800 bg-[#111116] p-4 overflow-y-auto"><div className="flex items-center gap-2 mb-4"><div className="p-2 rounded-xl bg-sky-500/10 border border-sky-500/20"><MessageCircle className="w-4 h-4 text-sky-400" /></div><div><div className="font-bold text-sm text-white">Temporary Chat</div><div className="text-[11px] text-zinc-500">Slack-backed</div></div></div>
      <div className="text-[10px] uppercase tracking-wider text-zinc-500 mb-2">People online</div>
      {people.length === 0 ? <div className="text-xs text-zinc-500 p-3 rounded-xl bg-zinc-900/60 flex items-center gap-2"><WifiOff className="w-3.5 h-3.5" />No one else is connected.</div> : <div className="space-y-2">{people.map(user => <button key={user.userId} onClick={() => setSelectedUserId(user.userId)} className={`w-full flex items-center gap-2 p-2.5 rounded-xl text-left border ${selectedUserId === user.userId ? 'bg-emerald-500/10 border-emerald-500/30' : 'bg-zinc-900/40 border-zinc-800 hover:border-zinc-700'}`}><div className="relative"><img src={user.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.name)}`} alt="" className="w-8 h-8 rounded-lg object-cover" /><Circle className={`absolute -bottom-1 -right-1 w-3 h-3 border-2 border-[#111116] rounded-full ${user.inCall ? 'text-amber-400 fill-amber-400' : 'text-emerald-400 fill-emerald-400'}`} /></div><span className="min-w-0 flex-1"><span className="block text-xs font-semibold text-zinc-200 truncate">{user.name}</span><span className="block text-[10px] text-zinc-500">{user.inCall ? 'In a call' : 'Online'}</span></span></button>)}</div>}
      {selected && <div className="mt-4 grid grid-cols-2 gap-2"><button disabled={selected.inCall} onClick={() => startCall(selected, 'audio')} className="flex items-center justify-center gap-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white py-2 text-xs font-semibold"><Phone className="w-3.5 h-3.5" />Call</button><button disabled={selected.inCall} onClick={() => startCall(selected, 'video')} className="flex items-center justify-center gap-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white py-2 text-xs font-semibold"><Video className="w-3.5 h-3.5" />Video</button></div>}
    </aside>
    <div className="rounded-3xl border border-zinc-800 bg-[#0f0f14] overflow-hidden flex flex-col min-h-0"><header className="px-5 py-4 border-b border-zinc-800 flex items-center justify-between"><div><h1 className="text-sm font-bold text-white">Temporary team chat</h1><p className="text-[11px] text-zinc-500">Slack-backed messages • no saved Talk contacts</p></div><button onClick={loadMessages} className="p-2 rounded-xl border border-zinc-800 text-zinc-400 hover:text-white"><RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /></button></header>
      {error && <div className="mx-5 mt-4 rounded-xl border border-amber-500/20 bg-amber-500/5 px-3 py-2 text-xs text-amber-300">{error}</div>}
      <div className="flex-1 overflow-y-auto p-5 space-y-3">{loading && messages.length === 0 && <div className="text-sm text-zinc-500 text-center py-12">Loading Slack chat…</div>}{!loading && messages.length === 0 && !error && <div className="text-sm text-zinc-500 text-center py-12">No messages yet. Send the first one.</div>}{messages.map(m => <div key={m.id} className={`flex ${m.isMine ? 'justify-end' : 'justify-start'}`}><div className={`max-w-[80%] rounded-2xl px-4 py-2.5 ${m.isMine ? 'bg-emerald-600 text-white rounded-br-md' : 'bg-zinc-900 border border-zinc-800 text-zinc-100 rounded-bl-md'}`}><div className="text-[10px] font-semibold mb-1">{m.senderName}</div><div className="text-sm whitespace-pre-wrap">{m.text}</div><div className="text-[9px] opacity-60 mt-1">{m.ts}</div></div></div>)}<div ref={endRef} /></div>
      <div className="p-4 border-t border-zinc-800 flex gap-2"><input value={text} onChange={e => setText(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') sendMessage(); }} placeholder={selected ? `Message ${selected.name}...` : 'Message everyone...'} className="flex-1 bg-zinc-900 border border-zinc-800 rounded-2xl px-4 py-3 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-emerald-500" /><button onClick={sendMessage} disabled={sending || !text.trim()} className="px-4 rounded-2xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white"><Send className="w-4 h-4" /></button></div>
    </div>
  </div></section>;
};
