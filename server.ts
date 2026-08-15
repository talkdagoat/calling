import express from 'express';
import http from 'http';
import path from 'path';
import fs from 'fs';
import { WebSocketServer, WebSocket } from 'ws';
import dotenv from 'dotenv';
import { createServer as createViteServer } from 'vite';

dotenv.config();

const app = express();
const server = http.createServer(app);
const PORT = 3000;

app.use(express.json({ limit: '10mb' }));

// Persistent Data File
const DATA_FILE = path.join(process.cwd(), 'talk_central_store.json');

interface RegisteredUser {
  id: string;
  name: string;
  avatar: string;
  createdAt: string;
  publicKeyFingerprint: string;
}

interface ServerStore {
  registeredUsers: Record<string, RegisteredUser>; // lowercase name -> user
  userContacts: Record<string, any[]>; // userId -> contacts
  callHistory: Record<string, any[]>; // userId -> history
}

function loadStore(): ServerStore {
  try {
    if (fs.existsSync(DATA_FILE)) {
      const raw = fs.readFileSync(DATA_FILE, 'utf-8');
      return JSON.parse(raw);
    }
  } catch (e) {
    console.error('Failed to read central data file:', e);
  }
  return {
    registeredUsers: {},
    userContacts: {},
    callHistory: {},
  };
}

function saveStore(store: ServerStore) {
  try {
    fs.writeFileSync(DATA_FILE, JSON.stringify(store, null, 2), 'utf-8');
  } catch (e) {
    console.error('Failed to save central data file:', e);
  }
}

let centralStore = loadStore();

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

          // Ensure user is in central registered store
          const key = sender.name.trim().toLowerCase();
          if (!centralStore.registeredUsers[key]) {
            centralStore.registeredUsers[key] = {
              id: sender.id,
              name: sender.name.trim(),
              avatar: sender.avatar,
              createdAt: new Date().toISOString(),
              publicKeyFingerprint: sender.publicKeyFingerprint,
            };
            saveStore(centralStore);
          }

          broadcastPresence();
          ws.send(JSON.stringify({
            type: 'registered',
            deviceId: sender.deviceId,
            activeConnectedDevices: clients.size,
            timestamp: Date.now(),
          }));
          break;
        }

        case 'call:invite': {
          let targetDevicesFound = 0;
          for (const [clientWs, clientInfo] of clients.entries()) {
            if (clientWs !== ws && (clientInfo.userId === targetUserId || clientInfo.name.toLowerCase() === targetUserId.toLowerCase())) {
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

          ws.send(JSON.stringify({
            type: 'call:status',
            callId,
            targetDevicesFound,
            message: targetDevicesFound > 0 ? 'Ringing target user...' : 'User is currently offline',
            timestamp: Date.now(),
          }));
          break;
        }

        case 'call:accept': {
          const senderInfo = clients.get(ws);
          if (senderInfo) {
            senderInfo.inCallWith = targetUserId;
          }

          for (const [clientWs, clientInfo] of clients.entries()) {
            if (clientInfo.userId === targetUserId || clientInfo.name.toLowerCase() === targetUserId?.toLowerCase()) {
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
          for (const [clientWs, clientInfo] of clients.entries()) {
            if (clientInfo.userId === targetUserId || clientInfo.name.toLowerCase() === targetUserId?.toLowerCase()) {
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

          for (const [clientWs, clientInfo] of clients.entries()) {
            if (clientWs !== ws) {
              if (
                (targetUserId && (clientInfo.userId === targetUserId || clientInfo.name.toLowerCase() === targetUserId?.toLowerCase())) ||
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

        case 'webrtc:offer':
        case 'webrtc:answer':
        case 'webrtc:ice': {
          for (const [clientWs, clientInfo] of clients.entries()) {
            if (clientWs !== ws) {
              if (
                (targetUserId && (clientInfo.userId === targetUserId || clientInfo.name.toLowerCase() === targetUserId?.toLowerCase())) ||
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

// REST API Routes

// Health Check
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    app: 'Talk',
    onlineDevices: clients.size, 
    registeredUsersCount: Object.keys(centralStore.registeredUsers).length,
    timestamp: new Date().toISOString() 
  });
});

// Register User Account
app.post('/api/users/register', (req, res) => {
  try {
    const { name, avatar, publicKeyFingerprint } = req.body;
    if (!name || typeof name !== 'string' || !name.trim()) {
      return res.status(400).json({ error: 'Name is required' });
    }

    const cleanName = name.trim();
    const key = cleanName.toLowerCase();

    if (!centralStore.registeredUsers[key]) {
      centralStore.registeredUsers[key] = {
        id: `user_${key.replace(/[^a-z0-9]/g, '_')}_${Date.now()}`,
        name: cleanName,
        avatar: avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(cleanName)}&background=059669&color=ffffff&bold=true`,
        createdAt: new Date().toISOString(),
        publicKeyFingerprint: publicKeyFingerprint || '4E9A B7C2 91F0 33DA 8201',
      };
      saveStore(centralStore);
    }

    const user = centralStore.registeredUsers[key];
    res.json({ success: true, user });
  } catch (err) {
    res.status(500).json({ error: 'Failed to register user' });
  }
});

// Get All Registered Users
app.get('/api/users', (req, res) => {
  const users = Object.values(centralStore.registeredUsers);
  res.json({ users });
});

// Check if a User Exists by Name
app.get('/api/users/check', (req, res) => {
  const queryName = (req.query.name as string || '').trim().toLowerCase();
  if (!queryName) {
    return res.json({ exists: false });
  }

  const user = centralStore.registeredUsers[queryName];
  if (user) {
    return res.json({ exists: true, user });
  }

  // Partial match check
  const found = Object.values(centralStore.registeredUsers).find(
    u => u.name.toLowerCase() === queryName
  );

  if (found) {
    return res.json({ exists: true, user: found });
  }

  return res.json({ exists: false });
});

// Get User Contacts and Call History
app.get('/api/data/:userId', (req, res) => {
  const { userId } = req.params;
  res.json({
    contacts: centralStore.userContacts[userId] || [],
    callHistory: centralStore.callHistory[userId] || [],
  });
});

// Sync User Contacts & Call History
app.post('/api/data/sync', (req, res) => {
  try {
    const { userId, contacts, callHistory } = req.body;
    if (!userId) {
      return res.status(400).json({ error: 'userId is required' });
    }

    if (Array.isArray(contacts)) {
      centralStore.userContacts[userId] = contacts;
    }
    if (Array.isArray(callHistory)) {
      centralStore.callHistory[userId] = callHistory;
    }

    saveStore(centralStore);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to sync data' });
  }
});

// Reset All Accounts & Data
app.post('/api/reset-all', (req, res) => {
  try {
    centralStore = {
      registeredUsers: {},
      userContacts: {},
      callHistory: {},
    };
    saveStore(centralStore);
    res.json({ success: true, message: 'All accounts and history have been wiped clean.' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to reset data' });
  }
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
    console.log(`Talk Central Storage & Server running on port ${PORT}`);
  });
}

setupVite();
