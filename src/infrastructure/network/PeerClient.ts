import Peer from 'peerjs';
import type { DataConnection } from 'peerjs';
import type { ServerMessage, JoinMessage, InputMessage, LeaveMessage } from './messages';

export type ConnectionStatus = 'disconnected' | 'connecting' | 'connected';

export class PeerClient {
  private peer: Peer | null = null;
  private connection: DataConnection | null = null;
  private sessionCode: string;
  private _status: ConnectionStatus = 'disconnected';
  private _clientId: string | null = null;
  private _worldSeed: number = 12345;
  private onMessage: ((msg: ServerMessage) => void) | null = null;
  private onStatusChange: ((status: ConnectionStatus) => void) | null = null;
  private onError: ((error: string) => void) | null = null;
  private onDisconnected: (() => void) | null = null;
  private _retainPeerOnDisconnect = false; // Se true, não destrói o peer ao desconectar

  constructor(sessionCode: string) {
    this.sessionCode = sessionCode;
  }

  setOnDisconnected(cb: (() => void) | null): void {
    this.onDisconnected = cb;
  }

  /**
   * Se true, o PeerJS não será destruído ao desconectar (útil para host transfer).
   */
  setRetainPeerOnDisconnect(v: boolean): void {
    this._retainPeerOnDisconnect = v;
  }

  getStatus(): ConnectionStatus {
    return this._status;
  }

  getClientId(): string | null {
    return this._clientId;
  }

  getWorldSeed(): number {
    return this._worldSeed;
  }

  setOnMessage(cb: (msg: ServerMessage) => void): void {
    this.onMessage = cb;
  }

  setOnStatusChange(cb: (status: ConnectionStatus) => void): void {
    this.onStatusChange = cb;
  }

  setOnError(cb: (error: string) => void): void {
    this.onError = cb;
  }

  async connect(): Promise<void> {
    this.setStatus('connecting');

    return new Promise((resolve, reject) => {
      try {
        this.peer = new Peer({ debug: 0 });

        this.peer.on('open', () => {
          if (!this.peer) return;
          const conn = this.peer.connect(this.sessionCode, { reliable: true });
          this.connection = conn;

          conn.on('open', () => {
            this.setStatus('connected');
            resolve();
          });

          conn.on('data', (raw) => {
            const data = raw as ServerMessage;

            if (data.type === 'join_ack') {
              this._clientId = data.clientId;
              this._worldSeed = data.worldSeed;
            }

            this.onMessage?.(data);
          });

          conn.on('close', () => {
            this.setStatus('disconnected');
            this.onDisconnected?.();
          });

          conn.on('error', (err) => {
            this.onError?.(err.message);
            this.setStatus('disconnected');
            this.onDisconnected?.();
          });
        });

        this.peer.on('error', (err) => {
          this.onError?.(err.message);
          this.setStatus('disconnected');
          reject(err);
        });
      } catch (err) {
        this.setStatus('disconnected');
        reject(err);
      }
    });
  }

  send(msg: JoinMessage | InputMessage | LeaveMessage): void {
    if (this.connection?.open) {
      try {
        this.connection.send(msg);
      } catch {
        // noop
      }
    }
  }

  disconnect(): void {
    this.send({ type: 'leave' });
    this.connection?.close();
    if (!this._retainPeerOnDisconnect) {
      this.peer?.destroy();
      this.peer = null;
    }
    this.connection = null;
    this.setStatus('disconnected');
  }

  /** Força atualização do sessionCode e reconecta (para host transfer) */
  async reconnectToSession(newSessionCode: string): Promise<void> {
    this.sessionCode = newSessionCode;
    if (this.peer) {
      this.peer.destroy();
      this.peer = null;
    }
    this._retainPeerOnDisconnect = false;
    await this.connect();
  }

  private setStatus(status: ConnectionStatus): void {
    this._status = status;
    this.onStatusChange?.(status);
  }
}
