export type SignalingEvent = {
  id?: string;
  type: string;
  sender?: any;
  targetUserId?: string;
  targetUserName?: string;
  targetDeviceId?: string;
  callId?: string;
  roomId?: string;
  callType?: string;
  payload?: any;
  timestamp: number;
};

type Listener = (event: SignalingEvent) => void;

let socket: WebSocket | null = null;
let currentUserId = '';
let currentIdentity: any = null;
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
let reconnectDelay = 1000;
const listeners = new Set<Listener>();
const pending: string[] = [];

function socketUrl() {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${protocol}//${window.location.host}/api/ws`;
}

function connect() {
  if (!currentUserId || typeof window === 'undefined') return;
  if (socket && (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING)) return;

  try {
    socket = new WebSocket(socketUrl());
  } catch (error) {
    console.error('[Signaling] WebSocket creation failed:', error);
    scheduleReconnect();
    return;
  }

  socket.onopen = () => {
    reconnectDelay = 1000;
    socket?.send(JSON.stringify({
      type: 'register',
      sender: currentIdentity || { id: currentUserId, name: currentUserId, deviceId: `web_${currentUserId}` },
      timestamp: Date.now(),
    }));
    while (pending.length && socket.readyState === WebSocket.OPEN) socket.send(pending.shift()!);
  };

  socket.onmessage = event => {
    try {
      const message = JSON.parse(event.data) as SignalingEvent;
      for (const listener of listeners) listener(message);
    } catch (error) {
      console.error('[Signaling] Invalid server message:', error);
    }
  };

  socket.onclose = () => {
    socket = null;
    if (listeners.size) scheduleReconnect();
  };

  socket.onerror = () => {
    try { socket?.close(); } catch {}
  };
}

function scheduleReconnect() {
  if (reconnectTimer || !currentUserId) return;
  reconnectTimer = setTimeout(() => {
    reconnectTimer = null;
    connect();
    reconnectDelay = Math.min(reconnectDelay * 2, 15000);
  }, reconnectDelay);
}

function normalizeOutgoing(event: SignalingEvent): SignalingEvent {
  const typeMap: Record<string, string> = {
    'call:incoming': 'call:invite',
    'call:accepted': 'call:accept',
    'call:rejected': 'call:reject',
    'call:ended': 'call:end',
  };
  return { ...event, type: typeMap[event.type] || event.type, timestamp: event.timestamp || Date.now() };
}

export async function sendSignalingEvent(targetUserId: string, event: Omit<SignalingEvent, 'id'>) {
  if (!targetUserId) return;
  currentUserId = event.sender?.id || currentUserId || targetUserId;
  if (event.sender) currentIdentity = event.sender;
  connect();
  const message = JSON.stringify(normalizeOutgoing({ ...event, targetUserId }));
  if (socket?.readyState === WebSocket.OPEN) socket.send(message);
  else pending.push(message);
}

export function subscribeToSignaling(userId: string, onEvent: Listener): () => void {
  if (!userId) return () => undefined;
  currentUserId = userId;
  listeners.add(onEvent);
  connect();

  return () => {
    listeners.delete(onEvent);
    if (!listeners.size) {
      if (reconnectTimer) clearTimeout(reconnectTimer);
      reconnectTimer = null;
      try { socket?.close(); } catch {}
      socket = null;
      currentIdentity = null;
    }
  };
}
