import { WebSocketServer, WebSocket } from 'ws';

const PORT = parseInt(process.env.PORT || '3001', 10);
const MAX_PEERS = 100;
const HEARTBEAT_TIMEOUT_MS = 30000;
const CHUNK_UPDATE_THROTTLE_MS = 500;

interface ConnectedPeer {
  peerId: string;
  playerName: string;
  dinoId: string;
  colors: Record<string, string>;
  chunkX: number;
  chunkZ: number;
  renderDistance: number;
  lastSeen: number;
  connectedAt: number;
  ws: WebSocket;
}

const peers = new Map<string, ConnectedPeer>();
let connectionCounter = 0;

type WSServerMessage =
  | { type: 'welcome'; yourPeerId: string; onlineCount: number }
  | { type: 'peer_list'; peers: Array<{ peerId: string; playerName: string; dinoId: string; chunkX: number; chunkZ: number; renderDistance: number }> }
  | { type: 'peer_joined'; peer: { peerId: string; playerName: string; dinoId: string; chunkX: number; chunkZ: number; renderDistance: number } }
  | { type: 'peer_left'; peerId: string }
  | { type: 'peer_chunk_update'; peerId: string; chunkX: number; chunkZ: number };

function broadcast(msg: WSServerMessage, excludePeerId?: string): void {
  const data = JSON.stringify(msg);
  for (const [pid, peer] of peers) {
    if (pid === excludePeerId) continue;
    if (peer.ws.readyState === WebSocket.OPEN) {
      try {
        peer.ws.send(data);
      } catch { /* noop */ }
    }
  }
}

function sendTo(peer: ConnectedPeer, msg: WSServerMessage): void {
  if (peer.ws.readyState === WebSocket.OPEN) {
    try {
      peer.ws.send(JSON.stringify(msg));
    } catch { /* noop */ }
  }
}

const wss = new WebSocketServer({ port: PORT });

console.log(`[signaling-server] started on port ${PORT}`);

wss.on('connection', (ws) => {
  const connectionId = ++connectionCounter;
  let peerId = `peer_${connectionId}_${Date.now().toString(36)}`;

  ws.on('message', (raw) => {
    try {
      const msg = JSON.parse(raw.toString());

      switch (msg.type) {
        case 'join': {
          peerId = msg.peerId || peerId;

          if (peers.size >= MAX_PEERS) {
            sendTo(peerWithWs(ws), { type: 'welcome', yourPeerId: '', onlineCount: peers.size });
            ws.close(1013, 'Server full');
            return;
          }

          const peer: ConnectedPeer = {
            peerId,
            playerName: msg.playerName || 'Unknown',
            dinoId: msg.dinoId || 'Velociraptor',
            colors: msg.colors || {},
            chunkX: msg.chunkX ?? 0,
            chunkZ: msg.chunkZ ?? 0,
            renderDistance: msg.renderDistance ?? 2,
            lastSeen: Date.now(),
            connectedAt: Date.now(),
            ws,
          };

          peers.set(peerId, peer);

          sendTo(peer, { type: 'welcome', yourPeerId: peerId, onlineCount: peers.size });

          const peerList = Array.from(peers.values())
            .filter(p => p.peerId !== peerId)
            .map(p => ({
              peerId: p.peerId,
              playerName: p.playerName,
              dinoId: p.dinoId,
              chunkX: p.chunkX,
              chunkZ: p.chunkZ,
              renderDistance: p.renderDistance,
            }));

          sendTo(peer, { type: 'peer_list', peers: peerList });

          broadcast({
            type: 'peer_joined',
            peer: {
              peerId,
              playerName: peer.playerName,
              dinoId: peer.dinoId,
              chunkX: peer.chunkX,
              chunkZ: peer.chunkZ,
              renderDistance: peer.renderDistance,
            },
          }, peerId);

          console.log(`[join] ${peerId} (${peer.playerName}) — ${peers.size} online`);
          break;
        }

        case 'chunk_update': {
          const peer = peers.get(peerId);
          if (!peer) return;

          const now = Date.now();
          if (now - peer.lastSeen < CHUNK_UPDATE_THROTTLE_MS) return;

          peer.chunkX = msg.chunkX ?? peer.chunkX;
          peer.chunkZ = msg.chunkZ ?? peer.chunkZ;
          peer.lastSeen = now;

          broadcast({
            type: 'peer_chunk_update',
            peerId,
            chunkX: peer.chunkX,
            chunkZ: peer.chunkZ,
          }, peerId);
          break;
        }

        case 'render_distance_update': {
          const peer = peers.get(peerId);
          if (!peer) return;
          peer.renderDistance = msg.renderDistance ?? peer.renderDistance;
          break;
        }

        case 'heartbeat': {
          const peer = peers.get(peerId);
          if (!peer) return;
          peer.chunkX = msg.chunkX ?? peer.chunkX;
          peer.chunkZ = msg.chunkZ ?? peer.chunkZ;
          peer.lastSeen = Date.now();
          break;
        }

        case 'leave': {
          removePeer(peerId);
          break;
        }
      }
    } catch (err) {
      console.error(`[error] message from ${peerId}:`, err);
    }
  });

  ws.on('close', () => {
    removePeer(peerId);
  });

  ws.on('error', () => {
    removePeer(peerId);
  });
});

// Heartbeat interval: check for stale peers every 15s
const heartbeatInterval = setInterval(() => {
  const now = Date.now();
  for (const [pid, peer] of peers) {
    if (now - peer.lastSeen > HEARTBEAT_TIMEOUT_MS) {
      console.log(`[timeout] ${pid} — removing stale peer`);
      removePeer(pid);
    }
  }

}, 15000);

function removePeer(peerId: string): void {
  const peer = peers.get(peerId);
  if (!peer) return;

  peers.delete(peerId);
  broadcast({ type: 'peer_left', peerId });
  console.log(`[leave] ${peerId} — ${peers.size} online`);

  try { peer.ws.close(); } catch { /* noop */ }
}

function peerWithWs(ws: WebSocket): ConnectedPeer {
  for (const [, p] of peers) {
    if (p.ws === ws) return p;
  }
  return { peerId: '', playerName: '', dinoId: '', colors: {}, chunkX: 0, chunkZ: 0, renderDistance: 2, lastSeen: 0, connectedAt: 0, ws };
}

wss.on('error', (err) => {
  console.error('[error] server:', err);
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n[shutdown] closing server...');
  clearInterval(heartbeatInterval);
  wss.close(() => process.exit(0));
});

process.on('SIGTERM', () => {
  clearInterval(heartbeatInterval);
  wss.close(() => process.exit(0));
});
