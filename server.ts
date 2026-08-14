import express from 'express';
import http from 'http';
import path from 'path';
import { WebSocketServer, WebSocket } from 'ws';
import dotenv from 'dotenv';
import { createServer as createViteServer } from 'vite';

dotenv.config();

const app = express();
const server = http.createServer(app);
const PORT = 3000;

app.use(express.json({ limit: '10mb' }));

// WebSocket Signaling Server for Multi-Device E2EE Calling
const wss = new WebSocketServer({ server, path: '/ws/signaling' });

interface ConnectedClient {
  ws: WebSocket;
  userId: string;
  deviceId: string;
  deviceName: string;
  name: string;
  avatar: string;
  publicKeyFingerprint: string;
  roomId?: string;
  inCallWith?: string;
}

const clients = new Map<WebSocket, ConnectedClient>();

function broadcastPresence() {
  const onlineUsers = Array.from(clients.values()).map(c => ({
    userId: c.userId,
    deviceId: c.deviceId,
    deviceName: c.deviceName,
    name: c.name,
    avatar: c.avatar,
    fingerprint: c.publicKeyFingerprint,
    inCall: !!c.inCallWith || !!c.roomId,
  }));

  const message = JSON.stringify({
    type: 'presence:update',
    onlineUsers,
    totalDevices: clients.size,
    timestamp: Date.now(),
  });

  for (const client of clients.keys()) {
    if (client.readyState === WebSocket.OPEN) {
      client.send(message);
    }
  }
}

wss.on('connection', (ws: WebSocket) => {
  ws.on('message', (raw) => {
    try {
      const data = JSON.parse(raw.toString());
      const { type, sender, targetUserId, targetDeviceId, roomId, callId, callType, payload } = data;

      switch (type) {
        case 'register': {
          clients.set(ws, {
            ws,
            userId: sender.id,
            deviceId: sender.deviceId,
            deviceName: sender.deviceName || 'Web Client',
            name: sender.name,
            avatar: sender.avatar,
            publicKeyFingerprint: sender.publicKeyFingerprint,
          });
          broadcastPresence();
          // Send back registration confirmation
          ws.send(JSON.stringify({
            type: 'registered',
            deviceId: sender.deviceId,
            activeConnectedDevices: clients.size,
            timestamp: Date.now(),
          }));
          break;
        }

        case 'call:invite': {
          // Broadcast incoming call to ALL devices of the target user or specific device
          let targetDevicesFound = 0;
          for (const [clientWs, clientInfo] of clients.entries()) {
            if (clientWs !== ws && clientInfo.userId === targetUserId) {
              if (!targetDeviceId || clientInfo.deviceId === targetDeviceId) {
                targetDevicesFound++;
                if (clientWs.readyState === WebSocket.OPEN) {
                  clientWs.send(JSON.stringify({
                    type: 'call:incoming',
                    callId,
                    callType,
                    sender,
                    roomId,
                    payload,
                    timestamp: Date.now(),
                  }));
                }
              }
            }
          }

          // If no remote devices online, echo back ringback so the single user can test local mock / echo simulation smoothly
          ws.send(JSON.stringify({
            type: 'call:status',
            callId,
            targetDevicesFound,
            message: targetDevicesFound > 0 ? 'Ringing target devices...' : 'Contact devices offline or simulator active',
            timestamp: Date.now(),
          }));
          break;
        }

        case 'call:accept': {
          const senderInfo = clients.get(ws);
          if (senderInfo) {
            senderInfo.inCallWith = targetUserId;
          }

          // Notify caller that call was accepted
          for (const [clientWs, clientInfo] of clients.entries()) {
            if (clientInfo.userId === targetUserId) {
              if (clientWs.readyState === WebSocket.OPEN) {
                clientWs.send(JSON.stringify({
                  type: 'call:accepted',
                  callId,
                  callType,
                  sender,
                  roomId,
                  payload,
                  timestamp: Date.now(),
                }));
              }
            }
          }

          // Stop ringing on all other devices of this user
          for (const [clientWs, clientInfo] of clients.entries()) {
            if (clientWs !== ws && clientInfo.userId === sender.id) {
              if (clientWs.readyState === WebSocket.OPEN) {
                clientWs.send(JSON.stringify({
                  type: 'call:cancelled_elsewhere',
                  callId,
                  acceptedDeviceId: sender.deviceId,
                  timestamp: Date.now(),
                }));
              }
            }
          }
          broadcastPresence();
          break;
        }

        case 'call:reject': {
          // Notify caller
          for (const [clientWs, clientInfo] of clients.entries()) {
            if (clientInfo.userId === targetUserId) {
              if (clientWs.readyState === WebSocket.OPEN) {
                clientWs.send(JSON.stringify({
                  type: 'call:rejected',
                  callId,
                  sender,
                  reason: payload?.reason || 'declined',
                  timestamp: Date.now(),
                }));
              }
            }
          }

          // Cancel ringing on all other devices of the responder
          for (const [clientWs, clientInfo] of clients.entries()) {
            if (clientWs !== ws && clientInfo.userId === sender.id) {
              if (clientWs.readyState === WebSocket.OPEN) {
                clientWs.send(JSON.stringify({
                  type: 'call:cancelled_elsewhere',
                  callId,
                  timestamp: Date.now(),
                }));
              }
            }
          }
          break;
        }

        case 'call:end': {
          const senderInfo = clients.get(ws);
          if (senderInfo) {
            senderInfo.inCallWith = undefined;
            senderInfo.roomId = undefined;
          }

          // Broadcast call end to target or room
          for (const [clientWs, clientInfo] of clients.entries()) {
            if (clientWs !== ws) {
              if (
                (targetUserId && clientInfo.userId === targetUserId) ||
                (roomId && clientInfo.roomId === roomId)
              ) {
                if (clientWs.readyState === WebSocket.OPEN) {
                  clientWs.send(JSON.stringify({
                    type: 'call:ended',
                    callId,
                    roomId,
                    sender,
                    timestamp: Date.now(),
                  }));
                }
              }
            }
          }
          broadcastPresence();
          break;
        }

        // WebRTC Signaling Relay (Offer, Answer, ICE Candidate)
        case 'webrtc:offer':
        case 'webrtc:answer':
        case 'webrtc:ice': {
          for (const [clientWs, clientInfo] of clients.entries()) {
            if (clientWs !== ws) {
              if (
                (targetUserId && clientInfo.userId === targetUserId) ||
                (targetDeviceId && clientInfo.deviceId === targetDeviceId) ||
                (roomId && clientInfo.roomId === roomId)
              ) {
                if (clientWs.readyState === WebSocket.OPEN) {
                  clientWs.send(JSON.stringify({
                    type,
                    callId,
                    roomId,
                    sender,
                    payload,
                    timestamp: Date.now(),
                  }));
                }
              }
            }
          }
          break;
        }

        // Group Conference Room Management
        case 'room:join': {
          const clientInfo = clients.get(ws);
          if (clientInfo) {
            clientInfo.roomId = roomId;
          }

          // Broadcast to all members of room
          for (const [clientWs, otherInfo] of clients.entries()) {
            if (clientWs !== ws && otherInfo.roomId === roomId) {
              if (clientWs.readyState === WebSocket.OPEN) {
                clientWs.send(JSON.stringify({
                  type: 'room:user_joined',
                  roomId,
                  sender,
                  payload,
                  timestamp: Date.now(),
                }));
              }
            }
          }
          break;
        }

        case 'room:chat':
        case 'room:reaction':
        case 'room:hand_raise':
        case 'room:state_update': {
          for (const [clientWs, otherInfo] of clients.entries()) {
            if (clientWs !== ws && (!roomId || otherInfo.roomId === roomId)) {
              if (clientWs.readyState === WebSocket.OPEN) {
                clientWs.send(JSON.stringify({
                  type,
                  roomId,
                  sender,
                  payload,
                  timestamp: Date.now(),
                }));
              }
            }
          }
          break;
        }
      }
    } catch (err) {
      console.error('Signaling message error:', err);
    }
  });

  ws.on('close', () => {
    clients.delete(ws);
    broadcastPresence();
  });
});

// API Routes
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    app: 'Talk',
    onlineDevices: clients.size, 
    timestamp: new Date().toISOString() 
  });
});

// Setup Vite middleware for development or serve dist in production
async function setupVite() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`Talk Secure Server running on http://localhost:${PORT}`);
  });
}

setupVite();
