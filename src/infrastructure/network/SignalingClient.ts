export interface PeerListEntry {
  peerId: string;
  playerName: string;
  dinoId: string;
  chunkX: number;
  chunkZ: number;
  renderDistance: number;
}

export class SignalingClient {
  private ws: WebSocket | null = null;
  private url: string;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private shouldReconnect = false;
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  private _peerId = '';

  onPeerList: ((peers: PeerListEntry[]) => void) | null = null;
  onPeerJoined: ((peer: PeerListEntry) => void) | null = null;
  onPeerLeft: ((peerId: string) => void) | null = null;
  onPeerChunkUpdate: ((peerId: string, cx: number, cz: number) => void) | null = null;
  onWelcome: ((peerId: string, count: number) => void) | null = null;
  onDisconnected: (() => void) | null = null;
  onError: ((error: string) => void) | null = null;

  constructor(url: string) {
    this.url = url;
  }

  get peerId(): string {
    return this._peerId;
  }

  async connect(): Promise<void> {
    this.shouldReconnect = true;

    return new Promise<void>((resolve, reject) => {
      try {
        this.ws = new WebSocket(this.url);

        this.ws.onopen = () => {
          this.reconnectAttempts = 0;
          resolve();
        };

        this.ws.onmessage = (event) => {
          try {
            const msg = JSON.parse(event.data);
            this.handleMessage(msg);
          } catch { /* noop */ }
        };

        this.ws.onclose = () => {
          this.stopHeartbeat();
          this.onDisconnected?.();
          if (this.shouldReconnect) {
            this.reconnect();
          }
        };

        this.ws.onerror = () => {
          this.onError?.('WebSocket connection error');
          reject(new Error('WebSocket connection error'));
        };
      } catch (err) {
        reject(err);
      }
    });
  }

  sendJoin(peerId: string, playerName: string, dinoId: string, colors: Record<string, string>, renderDistance = 2): void {
    this._peerId = peerId;
    this.send({
      type: 'join',
      peerId,
      playerName,
      dinoId,
      colors,
      renderDistance,
    });
  }

  sendChunkUpdate(cx: number, cz: number): void {
    this.send({ type: 'chunk_update', chunkX: cx, chunkZ: cz });
  }

  sendRenderDistanceUpdate(renderDistance: number): void {
    this.send({ type: 'render_distance_update', renderDistance });
  }

  sendLeave(): void {
    this.shouldReconnect = false;
    this.send({ type: 'leave' });
  }

  sendHeartbeat(chunkX: number, chunkZ: number): void {
    this.send({ type: 'heartbeat', chunkX, chunkZ });
  }

  disconnect(): void {
    this.shouldReconnect = false;
    this.stopHeartbeat();
    this.sendLeave();
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }

  private send(data: Record<string, unknown>): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      try {
        this.ws.send(JSON.stringify(data));
      } catch { /* noop */ }
    }
  }

  private handleMessage(msg: Record<string, unknown>): void {
    switch (msg.type) {
      case 'welcome':
        this._peerId = (msg.yourPeerId as string) || this._peerId;
        this.onWelcome?.(this._peerId, msg.onlineCount as number);
        this.startHeartbeat();
        break;
      case 'peer_list':
        this.onPeerList?.(msg.peers as PeerListEntry[]);
        break;
      case 'peer_joined':
        this.onPeerJoined?.(msg.peer as PeerListEntry);
        break;
      case 'peer_left':
        this.onPeerLeft?.(msg.peerId as string);
        break;
      case 'peer_chunk_update':
        this.onPeerChunkUpdate?.(msg.peerId as string, msg.chunkX as number, msg.chunkZ as number);
        break;
    }
  }

  private reconnect(): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) return;
    this.reconnectAttempts++;

    const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts - 1), 10000);
    setTimeout(() => {
      if (!this.shouldReconnect) return;
      this.connect().catch(() => {});
    }, delay);
  }

  private startHeartbeat(): void {
    this.stopHeartbeat();
    this.heartbeatTimer = setInterval(() => {
      this.sendHeartbeat(0, 0); // chunk coords updated separately
    }, 10000);
  }

  private stopHeartbeat(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }
}
