import type { IncomingMessage } from "node:http";
import { WebSocketServer, WebSocket } from "ws";

type Peer = {
  ws: WebSocket;
  name: string;
  room: string;
};

const peers = new Map<WebSocket, Peer>();
const wss = new WebSocketServer({ noServer: true });

function send(ws: WebSocket, message: Record<string, unknown>) {
  if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(message));
}

function broadcastRoom(room: string, except: WebSocket | null, message: Record<string, unknown>) {
  for (const [ws, peer] of peers) {
    if (peer.room === room && ws !== except) send(ws, message);
  }
}

wss.on("connection", (ws) => {
  ws.on("message", (raw) => {
    try {
      const data = JSON.parse(raw.toString()) as Record<string, any>;

      if (data.type === "join") {
        const room = typeof data.room === "string" && data.room.trim() ? data.room.trim() : "goat-default";
        const name = typeof data.name === "string" && data.name.trim() ? data.name.trim() : "iPhone/iPad";

        peers.set(ws, { ws, name, room });

        const existing = [...peers.values()]
          .filter((p) => p.ws !== ws && p.room === room)
          .map((p) => ({ name: p.name }));

        send(ws, { type: "joined", room, name, peers: existing });

        broadcastRoom(room, ws, { type: "peer", name });
        for (const p of existing) {
          send(ws, { type: "peer", name: p.name });
        }
        return;
      }

      const sender = peers.get(ws);
      if (!sender) {
        send(ws, { type: "error", message: "Join the room first." });
        return;
      }

      if (data.type === "leave") {
        ws.close();
        return;
      }

      if (["start", "offer", "answer", "ice", "hangup"].includes(data.type)) {
        broadcastRoom(sender.room, ws, {
          ...data,
          from: sender.name,
        });
      }
    } catch {
      send(ws, { type: "error", message: "Invalid signaling message." });
    }
  });

  ws.on("close", () => {
    const sender = peers.get(ws);
    peers.delete(ws);
    if (sender) broadcastRoom(sender.room, null, { type: "peer-left", name: sender.name });
  });
});

export default function handler(req: IncomingMessage, res: any) {
  const upgrade = String(req.headers.upgrade || "").toLowerCase();

  if (upgrade === "websocket") {
    const socket = (req as any).socket;
    const server = socket?.server;

    if (!server) {
      res.statusCode = 500;
      res.end("WebSocket server unavailable");
      return;
    }

    if (!(server as any).__goatCallsWebSocketReady) {
      (server as any).__goatCallsWebSocketReady = true;
      server.on("upgrade", (request: IncomingMessage, rawSocket: any, head: Buffer) => {
        if (!request.url?.startsWith("/api/ws")) return;
        wss.handleUpgrade(request, rawSocket, head, (client) => {
          wss.emit("connection", client, request);
        });
      });
    }

    res.statusCode = 200;
    res.end();
    return;
  }

  res.statusCode = 200;
  res.setHeader("content-type", "application/json");
  res.end(JSON.stringify({
    ok: true,
    service: "goat-calls-signaling",
    websocket: "/api/ws"
  }));
}
