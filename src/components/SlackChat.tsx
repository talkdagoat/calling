import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { MessageCircle, Phone, RefreshCw, Send, Video } from 'lucide-react';
import { Contact, UserIdentity } from '../types';

type SlackMessage = {
  id: string;
  ts: string;
  text: string;
  senderId?: string;
  senderName: string;
  avatar?: string;
  isMine: boolean;
  kind?: 'message' | 'call';
  callType?: 'audio' | 'video';
};

interface SlackChatProps {
  identity: UserIdentity;
  contacts: Contact[];
  onCall: (contact: Contact) => void;
  onVideoCall: (contact: Contact) => void;
}

export const SlackChat: React.FC<SlackChatProps> = ({ identity, contacts, onCall, onVideoCall }) => {
  const [messages, setMessages] = useState<SlackMessage[]>([]);
  const [text, setText] = useState('');
  const [selectedContactId, setSelectedContactId] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [startingCall, setStartingCall] = useState<string>('');
  const [error, setError] = useState('');
  const endRef = useRef<HTMLDivElement | null>(null);

  const selectedContact = useMemo(
    () => contacts.find((contact) => contact.id === selectedContactId),
    [contacts, selectedContactId]
  );

  const loadMessages = useCallback(async () => {
    try {
      const response = await fetch('/api/slack/messages');
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Unable to load Slack messages');
      const loaded = Array.isArray(data.messages) ? data.messages : [];
      setMessages(loaded.map((message: SlackMessage) => ({
        ...message,
        isMine: message.senderId === identity.id,
      })));
      setError('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load Slack chat');
    } finally {
      setLoading(false);
    }
  }, [identity.id]);

  const startCall = async (contact: Contact, callType: 'audio' | 'video') => {
    const key = `${callType}:${contact.id}`;
    if (startingCall) return;
    setStartingCall(key);
    try {
      const response = await fetch('/api/slack/calls', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          callType,
          sender: { id: identity.id, name: identity.name, avatar: identity.avatar },
          target: { id: contact.id, name: contact.name, avatar: contact.avatar },
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Unable to post call event to Slack');
      setError('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Slack call event failed; continuing with the call');
    } finally {
      setStartingCall('');
      if (callType === 'video') onVideoCall(contact);
      else onCall(contact);
    }
  };

  useEffect(() => {
    loadMessages();
    const timer = window.setInterval(loadMessages, 5000);
    return () => window.clearInterval(timer);
  }, [loadMessages]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  const sendMessage = async () => {
    const clean = text.trim();
    if (!clean || sending) return;

    setSending(true);
    try {
      const response = await fetch('/api/slack/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: clean,
          sender: {
            id: identity.id,
            name: identity.name,
            avatar: identity.avatar,
          },
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Unable to send Slack message');
      setText('');
      await loadMessages();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to send Slack message');
    } finally {
      setSending(false);
    }
  };

  return (
    <section className="h-[calc(100vh-4rem)] min-h-[520px] p-4 md:p-6 flex flex-col">
      <div className="max-w-6xl w-full mx-auto flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-[260px_1fr] gap-4">
        <aside className="rounded-3xl border border-zinc-800 bg-[#111116] p-4 overflow-y-auto">
          <div className="flex items-center gap-2 mb-4">
            <div className="p-2 rounded-xl bg-sky-500/10 border border-sky-500/20">
              <MessageCircle className="w-4 h-4 text-sky-400" />
            </div>
            <div>
              <div className="font-bold text-sm text-white">Temporary Chat</div>
              <div className="text-[11px] text-zinc-500">Slack-backed</div>
            </div>
          </div>

          <div className="text-[10px] uppercase tracking-wider text-zinc-500 mb-2">Call a contact</div>
          <div className="space-y-2">
            {contacts.length === 0 && (
              <div className="text-xs text-zinc-500 p-3 rounded-xl bg-zinc-900/60">Add contacts first.</div>
            )}
            {contacts.map((contact) => (
              <button
                key={contact.id}
                onClick={() => setSelectedContactId(contact.id)}
                className={`w-full flex items-center gap-2 p-2.5 rounded-xl text-left border transition-colors ${
                  selectedContactId === contact.id
                    ? 'bg-emerald-500/10 border-emerald-500/30'
                    : 'bg-zinc-900/40 border-zinc-800 hover:border-zinc-700'
                }`}
              >
                <img src={contact.avatar} alt="" className="w-8 h-8 rounded-lg object-cover" />
                <span className="min-w-0 flex-1">
                  <span className="block text-xs font-semibold text-zinc-200 truncate">{contact.name}</span>
                  <span className="block text-[10px] text-zinc-500 truncate">{contact.status || 'offline'}</span>
                </span>
              </button>
            ))}
          </div>

          {selectedContact && (
            <div className="mt-4 grid grid-cols-2 gap-2">
              <button
                onClick={() => startCall(selectedContact, 'audio')}
                disabled={startingCall !== ''}
                className="flex items-center justify-center gap-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white py-2 text-xs font-semibold"
              >
                <Phone className="w-3.5 h-3.5" /> {startingCall === `audio:${selectedContact.id}` ? 'Calling…' : 'Call'}
              </button>
              <button
                onClick={() => startCall(selectedContact, 'video')}
                disabled={startingCall !== ''}
                className="flex items-center justify-center gap-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white py-2 text-xs font-semibold"
              >
                <Video className="w-3.5 h-3.5" /> {startingCall === `video:${selectedContact.id}` ? 'Calling…' : 'Video'}
              </button>
            </div>
          )}
        </aside>

        <div className="rounded-3xl border border-zinc-800 bg-[#0f0f14] overflow-hidden flex flex-col min-h-0">
          <header className="px-5 py-4 border-b border-zinc-800 flex items-center justify-between">
            <div>
              <h1 className="text-sm font-bold text-white">Temporary team chat</h1>
              <p className="text-[11px] text-zinc-500">Messages are stored in the connected Slack channel.</p>
            </div>
            <button
              onClick={loadMessages}
              className="p-2 rounded-xl border border-zinc-800 hover:border-zinc-700 text-zinc-400 hover:text-white"
              title="Refresh"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </header>

          {error && (
            <div className="mx-5 mt-4 rounded-xl border border-amber-500/20 bg-amber-500/5 px-3 py-2 text-xs text-amber-300">
              {error}
            </div>
          )}

          <div className="flex-1 overflow-y-auto p-5 space-y-3">
            {loading && messages.length === 0 && (
              <div className="text-sm text-zinc-500 text-center py-12">Loading Slack chat…</div>
            )}
            {!loading && messages.length === 0 && !error && (
              <div className="text-sm text-zinc-500 text-center py-12">No messages yet. Send the first one.</div>
            )}
            {messages.map((message) => (
              <div key={message.id} className={`flex ${message.isMine ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[80%] rounded-2xl px-4 py-2.5 ${
                  message.kind === 'call'
                    ? 'bg-indigo-950/70 border border-indigo-500/30 text-indigo-100'
                    : message.isMine
                      ? 'bg-emerald-600 text-white rounded-br-md'
                      : 'bg-zinc-900 border border-zinc-800 text-zinc-100 rounded-bl-md'
                }`}>
                  <div className="flex items-center gap-2 text-[10px] font-semibold mb-1">
                    {message.kind === 'call' ? (message.callType === 'video' ? <Video className="w-3 h-3" /> : <Phone className="w-3 h-3" />) : null}
                    <span>{message.senderName}</span>
                  </div>
                  <div className="text-sm whitespace-pre-wrap break-words">{message.text}</div>
                  {message.kind === 'call' && (
                    <div className="mt-2 text-[10px] text-indigo-200/80">The actual audio/video call uses the app's WebRTC connection.</div>
                  )}
                  <div className="text-[9px] mt-1 text-zinc-500">
                    {new Date(Number(message.ts) * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </div>
                </div>
              </div>
            ))}
            <div ref={endRef} />
          </div>

          <div className="p-4 border-t border-zinc-800">
            <div className="flex items-end gap-2 bg-zinc-900/70 border border-zinc-800 rounded-2xl p-2">
              <textarea
                value={text}
                onChange={(event) => setText(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' && !event.shiftKey) {
                    event.preventDefault();
                    sendMessage();
                  }
                }}
                rows={1}
                placeholder="Message the temporary Slack chat…"
                className="flex-1 resize-none bg-transparent outline-none text-sm text-white placeholder:text-zinc-600 px-2 py-2"
              />
              <button
                onClick={sendMessage}
                disabled={!text.trim() || sending}
                className="p-2.5 rounded-xl bg-emerald-600 disabled:opacity-40 disabled:cursor-not-allowed text-white"
                title="Send"
              >
                <Send className="w-4 h-4" />
              </button>
            </div>
            <div className="text-[10px] text-zinc-600 mt-2 px-1">Enter to send · Shift+Enter for a new line</div>
          </div>
        </div>
      </div>
    </section>
  );
};
