import express from 'express';
import { createServer } from 'node:http';
import { WebSocketServer, WebSocket } from 'ws';

const app = express();
const server = createServer(app);
const wss = new WebSocketServer({ server });

type Client = {
  ws: WebSocket;
  userId: string;
  deviceId: string;
  deviceName: string;
  name: string;
  avatar: string;
  publicKeyFingerprint: string;
  roomId?: string;
  inCallWith?: string;
};

const clients = new Map<WebSocket, Client>();
const clean = (value: unknown) => String(value ?? '').trim().toLowerCase();
const safe = (value: unknown) => clean(value).replace(/^user_/, '').replace(/_[0-9]+$/, '').replace(/[^a-z0-9]/g, '');

function matchesTarget(client: Client, targetUserId?: string, targetUserName?: string, targetDeviceId?: string) {
  if (targetDeviceId && client.deviceId === targetDeviceId) return true;
  const ids = [clean(targetUserId), clean(targetUserName)].filter(Boolean);
  const clientValues = [clean(client.userId), clean(client.name), clean(client.deviceId)].filter(Boolean);
  if (ids.some(id => clientValues.includes(id))) return true;
  const targetSafe = ids.map(safe).filter(Boolean);
  const clientSafe = clientValues.map(safe).filter(Boolean);
  return targetSafe.some(id => clientSafe.includes(id));
}

function send(ws: WebSocket, message: unknown) {
  if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(message));
}

function broadcastPresence() {
  const onlineUsers = Array.from(clients.values()).map(client => ({
    userId: client.userId,
    deviceId: client.deviceId,
    deviceName: client.deviceName,
    name: client.name,
    avatar: client.avatar,
    fingerprint: client.publicKeyFingerprint,
    inCall: Boolean(client.inCallWith),
  }));
  const message = { type: 'presence:update', onlineUsers, totalDevices: clients.size, timestamp: Date.now() };
  for (const ws of clients.keys()) send(ws, message);
}

function notifyCallEnded(disconnected: Client) {
  if (!disconnected.inCallWith) return;
  for (const [peer, peerInfo] of clients.entries()) {
    if (peerInfo.userId === disconnected.inCallWith || peerInfo.name.toLowerCase() === disconnected.inCallWith.toLowerCase()) {
      send(peer, { type: 'call:ended', callId: undefined, sender: { id: disconnected.userId, name: disconnected.name }, reason: 'peer_disconnected', timestamp: Date.now() });
      peerInfo.inCallWith = undefined;
    }
  }
}

wss.on('connection', ws => {
  ws.on('message', raw => {
    try {
      const data = JSON.parse(raw.toString());
      const { type, sender, targetUserId, targetUserName, targetDeviceId, roomId, callId, callType, payload } = data;

      if (type === 'register') {
        const identity = sender || {};
        clients.set(ws, {
          ws,
          userId: String(identity.id || '').trim(),
          deviceId: String(identity.deviceId || `web_${Date.now()}`).trim(),
          deviceName: String(identity.deviceName || 'Web Client'),
          name: String(identity.name || identity.id || 'Talk User'),
          avatar: String(identity.avatar || ''),
          publicKeyFingerprint: String(identity.publicKeyFingerprint || ''),
        });
        send(ws, { type: 'registered', deviceId: clients.get(ws)?.deviceId, activeConnectedDevices: clients.size, timestamp: Date.now() });
        broadcastPresence();
        return;
      }

      const senderInfo = clients.get(ws);
      if (!senderInfo) return;

      if (type === 'call:invite') {
        senderInfo.inCallWith = targetUserId || targetUserName;
        let found = 0;
        for (const [peer, peerInfo] of clients.entries()) {
          if (peer !== ws && matchesTarget(peerInfo, targetUserId, targetUserName, targetDeviceId)) {
            found++;
            send(peer, { type: 'call:incoming', callId, callType, sender, roomId: roomId || `room_${callId}`, payload: { ...(payload || {}), callerName: sender?.name, callerAvatar: sender?.avatar }, timestamp: Date.now() });
          }
        }
        if (!found) senderInfo.inCallWith = undefined;
        send(ws, { type: 'call:status', callId, targetDevicesFound: found, targetUserId, targetUserName, timestamp: Date.now() });
        broadcastPresence();
        return;
      }

      if (type === 'call:accept' || type === 'call:reject' || type === 'call:end') {
        if (type === 'call:accept') senderInfo.inCallWith = targetUserId || targetUserName;
        const mappedType = type === 'call:accept' ? 'call:accepted' : type === 'call:reject' ? 'call:rejected' : 'call:ended';
        for (const [peer, peerInfo] of clients.entries()) {
          if (peer !== ws && matchesTarget(peerInfo, targetUserId, targetUserName, targetDeviceId)) {
            send(peer, { type: mappedType, callId, callType, sender, roomId, payload, timestamp: Date.now() });
            if (type === 'call:end' || type === 'call:reject') peerInfo.inCallWith = undefined;
          }
        }
        senderInfo.inCallWith = type === 'call:accept' ? senderInfo.inCallWith : undefined;
        broadcastPresence();
        return;
      }

      if (type === 'webrtc:offer' || type === 'webrtc:answer' || type === 'webrtc:ice') {
        for (const [peer, peerInfo] of clients.entries()) {
          if (peer !== ws && matchesTarget(peerInfo, targetUserId, targetUserName, targetDeviceId)) {
            send(peer, { type, callId, roomId, sender, payload, timestamp: Date.now() });
          }
        }
        return;
      }

      if (type === 'room:chat') {
        for (const [peer, peerInfo] of clients.entries()) {
          if (peer !== ws && ((roomId && peerInfo.roomId === roomId) || matchesTarget(peerInfo, targetUserId, targetUserName, targetDeviceId))) {
            send(peer, { type: 'room:chat', roomId, sender, payload, timestamp: Date.now() });
          }
        }
      }
    } catch (error) {
      console.error('[WS] Invalid message:', error);
    }
  });

  ws.on('close', () => {
    const disconnected = clients.get(ws);
    if (disconnected) notifyCallEnded(disconnected);
    clients.delete(ws);
    broadcastPresence();
  });
  ws.on('error', () => {
    const disconnected = clients.get(ws);
    if (disconnected) notifyCallEnded(disconnected);
    clients.delete(ws);
    broadcastPresence();
  });
});

export default server;
