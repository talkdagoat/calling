import express from 'express';
import http from 'http';
import path from 'path';
import { WebSocketServer, WebSocket } from 'ws';
import dotenv from 'dotenv';
import { createServer as createViteServer } from 'vite';
import { 
  initSQLDatabase, 
  registerUserSQL, 
  getAllUsersSQL, 
  findUserByNameSQL, 
  addContactSQL, 
  getContactsForUserSQL, 
  deleteContactSQL, 
  resetAllSQL 
} from './server/sqlDb.js';

dotenv.config();

const app = express();
const server = http.createServer(app);
const PORT = 3000;

app.use(express.json({ limit: '10mb' }));

// Initialize SQL Database
initSQLDatabase().then(() => {
  console.log('SQLite SQL Database initialized with relational schemas.');
}).catch((err) => {
  console.error('Failed to initialize SQLite Database:', err);
});

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

// Helper to match target user across connected devices by ID, display name, sanitized username or device
function matchesTargetClient(clientInfo: ConnectedClient, targetUserId?: string, targetUserName?: string, targetDeviceId?: string): boolean {
  if (!clientInfo) return false;
  
  if (targetDeviceId && clientInfo.deviceId === targetDeviceId) {
    return true;
  }
  
  const idClean = (targetUserId || '').trim().toLowerCase();
  const nameClean = (targetUserName || '').trim().toLowerCase();
  const clientUserIdClean = (clientInfo.userId || '').trim().toLowerCase();
  const clientNameClean = (clientInfo.name || '').trim().toLowerCase();

  // If targetUserId is provided
  if (idClean) {
    if (clientUserIdClean === idClean) return true;
    if (clientNameClean === idClean) return true;
    
    // Strip user_ prefixes and trailing timestamps for safe comparison
    const safeTargetId = idClean.replace(/^user_/, '').replace(/_[0-9]+$/, '').replace(/[^a-z0-9]/g, '');
    const safeClientId = clientUserIdClean.replace(/^user_/, '').replace(/_[0-9]+$/, '').replace(/[^a-z0-9]/g, '');
    const safeClientName = clientNameClean.replace(/[^a-z0-9]/g, '');
    
    if (safeTargetId && safeClientId && safeTargetId === safeClientId) return true;
    if (safeTargetId && safeClientName && safeTargetId === safeClientName) return true;
  }

  // If targetUserName is provided
  if (nameClean) {
    if (clientNameClean === nameClean) return true;
    if (clientUserIdClean === nameClean) return true;
    
    const safeTargetName = nameClean.replace(/[^a-z0-9]/g, '');
    const safeClientName = clientNameClean.replace(/[^a-z0-9]/g, '');
    const safeClientId = clientUserIdClean.replace(/^user_/, '').replace(/_[0-9]+$/, '').replace(/[^a-z0-9]/g, '');
    
    if (safeTargetName && safeClientName && safeClientName === safeTargetName) return true;
    if (safeTargetName && safeClientId && safeClientId === safeTargetName) return true;
  }

  return false;
}

wss.on('connection', (ws: WebSocket) => {
  ws.on('message', (raw) => {
    try {
      const data = JSON.parse(raw.toString());
      const { type, sender, targetUserId, targetUserName, targetDeviceId, roomId, callId, callType, payload } = data;

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

          // Ensure user is registered in the SQL users table
          try {
            registerUserSQL(sender.name, sender.avatar, sender.publicKeyFingerprint);
          } catch (e) {
            console.error('SQL user registration error in WS:', e);
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
          const targetName = targetUserName || payload?.targetUserName || payload?.roomName || '';
          let targetDevicesFound = 0;

          for (const [clientWs, clientInfo] of clients.entries()) {
            if (clientWs !== ws && matchesTargetClient(clientInfo, targetUserId, targetName, targetDeviceId)) {
              targetDevicesFound++;
              if (clientWs.readyState === WebSocket.OPEN) {
                clientWs.send(JSON.stringify({
                  type: 'call:incoming',
                  callId,
                  callType,
                  sender,
                  roomId: roomId || `room_${callId}`,
                  payload: {
                    ...payload,
                    callerName: sender.name,
                    callerAvatar: sender.avatar,
                    roomName: targetName || sender.name,
                  },
                  timestamp: Date.now(),
                }));
              }
            }
          }

          ws.send(JSON.stringify({
            type: 'call:status',
            callId,
            targetDevicesFound,
            message: targetDevicesFound > 0 ? `Ringing ${targetName || targetUserId}...` : `User is currently offline`,
            timestamp: Date.now(),
          }));
          break;
        }

        case 'call:accept': {
          const senderInfo = clients.get(ws);
          if (senderInfo) {
            senderInfo.inCallWith = targetUserId;
          }

          const targetName = targetUserName || payload?.targetUserName || '';
          for (const [clientWs, clientInfo] of clients.entries()) {
            if (clientWs !== ws && matchesTargetClient(clientInfo, targetUserId, targetName, targetDeviceId)) {
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
          const targetName = targetUserName || payload?.targetUserName || '';
          for (const [clientWs, clientInfo] of clients.entries()) {
            if (clientWs !== ws && matchesTargetClient(clientInfo, targetUserId, targetName, targetDeviceId)) {
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

          const targetName = targetUserName || payload?.targetUserName || '';
          for (const [clientWs, clientInfo] of clients.entries()) {
            if (clientWs !== ws) {
              if (
                matchesTargetClient(clientInfo, targetUserId, targetName, targetDeviceId) ||
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
          let routed = false;
          // Exact targetUserId matching guarantees points-to-point delivery
          for (const [clientWs, clientInfo] of clients.entries()) {
            if (clientWs !== ws && targetUserId && clientInfo.userId === targetUserId) {
              if (clientWs.readyState === WebSocket.OPEN) {
                clientWs.send(JSON.stringify({
                  type,
                  callId,
                  roomId,
                  sender,
                  payload,
                  timestamp: Date.now(),
                }));
                routed = true;
              }
            }
          }
          
          if (!routed) {
            console.warn(`[WebRTC] Failed to route ${type} to targetUserId: ${targetUserId}`);
          }
          break;
        }

        case 'room:join': {
          const senderInfo = clients.get(ws);
          if (senderInfo) {
            senderInfo.roomId = roomId;
          }
          for (const [clientWs, clientInfo] of clients.entries()) {
            if (clientWs !== ws && clientInfo.roomId === roomId) {
              if (clientWs.readyState === WebSocket.OPEN) {
                clientWs.send(JSON.stringify({
                  type: 'room:joined',
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

        case 'room:chat': {
          for (const [clientWs, clientInfo] of clients.entries()) {
            if (clientWs !== ws) {
              if (
                (roomId && clientInfo.roomId === roomId) ||
                matchesTargetClient(clientInfo, targetUserId, targetUserName, targetDeviceId)
              ) {
                if (clientWs.readyState === WebSocket.OPEN) {
                  clientWs.send(JSON.stringify({
                    type: 'room:chat',
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

// REST API Routes using SQL Database

// Health Check
app.get('/api/health', (req, res) => {
  const users = getAllUsersSQL();
  res.json({ 
    status: 'ok', 
    app: 'Talk',
    database: 'SQLite (Relational SQL)',
    onlineDevices: clients.size, 
    registeredUsersCount: users.length,
    timestamp: new Date().toISOString() 
  });
});

// Register User Account in SQL
app.post('/api/users/register', (req, res) => {
  try {
    const { name, avatar, publicKeyFingerprint } = req.body;
    if (!name || typeof name !== 'string' || !name.trim()) {
      return res.status(400).json({ error: 'Name is required' });
    }

    const user = registerUserSQL(name, avatar, publicKeyFingerprint);
    res.json({ success: true, user });
  } catch (err) {
    console.error('SQL user registration error:', err);
    res.status(500).json({ error: 'Failed to register user in SQL database' });
  }
});

// Get All Registered Users from SQL
app.get('/api/users', (req, res) => {
  try {
    const users = getAllUsersSQL();
    res.json({ users });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch users from SQL database' });
  }
});

// Check if a User Exists by Name in SQL
app.get('/api/users/check', (req, res) => {
  try {
    const queryName = (req.query.name as string || '').trim();
    if (!queryName) {
      return res.json({ exists: false });
    }

    const user = findUserByNameSQL(queryName);
    if (user) {
      return res.json({ exists: true, user });
    }
    return res.json({ exists: false });
  } catch (err) {
    res.status(500).json({ error: 'Failed to check user in SQL database' });
  }
});

// Get Contacts for a User from SQL
app.get('/api/contacts/:userId', (req, res) => {
  try {
    const { userId } = req.params;
    const contacts = getContactsForUserSQL(userId);
    res.json({ contacts });
  } catch (err) {
    res.status(500).json({ error: 'Failed to load contacts from SQL database' });
  }
});

// Add Contact to User's List in SQL (STRICT CONSTRAINT: ONLY IF USER IS ON TALK!)
app.post('/api/contacts/add', (req, res) => {
  try {
    const { userId, targetName, role, notes } = req.body;
    if (!userId || !targetName || typeof targetName !== 'string' || !targetName.trim()) {
      return res.status(400).json({ error: 'User ID and Target Name are required' });
    }

    const result = addContactSQL(userId, targetName.trim(), role, notes);
    if (!result.success) {
      return res.status(400).json({ error: result.error });
    }

    res.json({ success: true, contact: result.contact });
  } catch (err) {
    console.error('Add contact SQL error:', err);
    res.status(500).json({ error: 'Failed to add contact in SQL database' });
  }
});

// Delete Contact from SQL
app.delete('/api/contacts/:userId/:targetId', (req, res) => {
  try {
    const { userId, targetId } = req.params;
    deleteContactSQL(userId, targetId);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete contact from SQL database' });
  }
});

// Get user contacts and history
app.get('/api/data/:userId', (req, res) => {
  try {
    const { userId } = req.params;
    const contacts = getContactsForUserSQL(userId);
    res.json({ contacts, callHistory: [] });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch user data', contacts: [], callHistory: [] });
  }
});

// Legacy Sync Endpoint (Backed by SQL)
app.post('/api/data/sync', (req, res) => {
  try {
    const { userId, contacts } = req.body;
    if (userId && Array.isArray(contacts)) {
      for (const c of contacts) {
        if (c.name) {
          addContactSQL(userId, c.name, c.role, c.notes);
        }
      }
    }
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to sync data' });
  }
});

// Reset All SQL Tables
app.post('/api/reset-all', (req, res) => {
  try {
    resetAllSQL();
    res.json({ success: true, message: 'All SQL database tables have been reset clean.' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to reset SQL database' });
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
