# Plano de Desenvolvimento: Chomp 3D Web

Este documento serve como guia dos próximos passos após a configuração do projeto base. 

## Backlog técnico executável (arquitetura e correções)

Para executar as correções prioritárias com foco em arquitetura, SOLID, Strategy Pattern e prontidão para PeerJS, use o backlog detalhado em:

- [BACKLOG_EXECUTAVEL_ARQUITETURA.md](./BACKLOG_EXECUTAVEL_ARQUITETURA.md)

Esse backlog já está organizado por prioridade, com:
- arquivos a alterar por etapa,
- o que alterar em cada arquivo,
- critério de aceite por tarefa,
- ordem sugerida de execução por sprint.

Recomendação: concluir E0, E1 e E2 antes de iniciar a camada de rede (E5).

## Fase 1: O Protótipo Solitário (Single Player)
- [OK] **Assets e Modelos**: Utilizar Meshy.ai/Tripo3D para gerar dois modelos 3D simples (.glb/.gltf) texturizados e otimizados: um predador e uma presa.
- [OK] **Integração de Animações**: Usar Mixamo para importar animações (Andar, Correr, Morder, Idle) para os modelos.
- [OK] **Controles**: Implementar a movimentação básica (W, A, S, D, Shift, Space - pular) do jogador no cenário 3D.
- [OK] **Mecânicas de Combate**: Implementar mecânicas de ataque e colisão simples (Raycaster ou Sphere Collider).
- [OK] **Consumo e Pontuação**: Implementar sistema onde comer carne/plantas aumenta a pontuação, o que refletirá no aumento do tamanho (`scale`) do modelo.

## Fase 2: O Mundo Infinito
- [OK] **Gerador de Ruído**: Implementar o algoritmo de Perlin Noise / Simplex Noise com uma Seed numérica.
- [OK] **Chunks**: Desenvolver o sistema de carregamento de mapas baseados em "Chunks", renderizando o terreno e recursos próximos, e destruindo da memória o que ficou longe, garantindo a boa performance no navegador.

## Fase 3: Inteligência Artificial (NPCs)
- [OK] **State Machine Base**: Implementar uma Máquina de Estados Finita para controlar o comportamento da IA.
  - `Vagando`: Andando de forma aleatória em um raio específico. Herbívoros ficam próximos ao bando. Filhotes seguem adultos da mesma espécie.
  - `Fugindo`: Se movendo para o vetor oposto a um carnívoro maior identificado no raio de visão (com desvio para não fugir em linha reta).
  - `Caçando/Comendo`: Carnívoros perseguem presas menores (NPCs e jogador). Herbívoros caminham até plantas. Ao chegar na comida, executam animação de comer.
  - `Atacando`: Ao encostar no alvo (colisão de bounding spheres), executa animação de ataque e calcula dano baseado na Força × Fator de Nível. Alvo pisca vermelho.
  - `Morte`: Ao zerar HP, executa animação de morte e fica no chão por 10s antes de despawnar.
- [OK] **Injeção de Estratégias**: Utilizar Design Pattern Strategy para injetar regras diferentes baseadas na espécie (Carnívoro, Herbívoro).
- [OK] **Sistema de Combate**: Dano baseado em Força × Nível (mesma curva de crescimento do tamanho: filhote → adulto → logarítmico). Flash vermelho ao levar dano. Cooldown de 1.2s entre ataques.
- [OK] **Geração de NPCs por Chunk**: Spawn determinístico por seed — Herbívoros em grupos (2-4) perto de árvores, Carnívoros solitários e raros. Garantia de 1 carnívoro por área 5×5 chunks. Nível baseado na distância do centro.
- [OK] **Arquitetura Host-Ready**: NPCManager é Singleton puro JS (sem React state). No futuro modo online, apenas o Host roda update() e envia snapshots via PeerJS.

## Fase Pré-4: Ajustes finos antes da implementação [OK]
- [OK] **Visão dos NPCs**: Quando um dinossauro esta atacando outro, se durante a animação das costas você se mover para as costas dele, ele perde você de vista e não ataca mais. Adicionar um estado de perdeu de vista aonde ele tenta girar 360 graus a redor dele para ver se o dino que ele atacou ainda esta ao redor dele. Aumente também o code de visão para ser um pouco mais largo (deve permitir uma visão lateral e não somente frontal). Implementado em 2026-05-13: estado `Searching` na FSM, rotação 360° em ~2.5s, FOV ampliado (carnívoros 150°, herbívoros 165°).
- [OK] **Desempenho**: Verifique possível problemas que causem drop de FPS, algum cache, ou trechos de código desnecessários, ou até mesmo problemas com recursos assíncronos. Garanta que o jogo esteja flúido e não tenha "engasgos". Implementado em 2026-05-13: módulo `WorldTime.ts` compartilhado com cache de 100ms, eliminando 2 chamadas de `Date.now()` por frame.

## Fase 4: A Conexão P2P (Multiplayer) [OK]
- [OK] **Integração WebRTC**: Classes de rede baseadas no PeerJS criadas em `infrastructure/network/` (PeerHost, PeerClient, PeerSession, messages). PeerJS já estava nas dependências do projeto.
- [OK] **Sessão (Bandos)**: UI para criar sala (host) ou inserir "Código de Bando" (Session ID) de 4 caracteres. Tela `SessionSelectScreen` para escolha do papel, `CharacterSelectionMenu` exibe código para host.
- [OK] **Sincronização**: Snapshot de NPCs e estados de jogadores enviados do host para clients a cada 3 ticks de simulação. Client interpola posições de NPCs via `NpcSnapshotInterpolator`.
- [OK] **Arquitetura Host-Client**: NPCManager roda apenas no host (`setAuthority(true)`). Client desliga simulação (`setAuthority(false)`) e recebe snapshots interpolados. Componente `RemotePlayers` renderiza outros jogadores 3D com nome.

## Fase 5: Progressão e Evolução
- [ ] **Árvore de Evolução**: Implementar o menu que aparece ao ganhar XP suficiente, permitindo trocar o modelo 3D atual para o de um dinossauro maior.
- [ ] **HUD Premium**: Finalizar as interfaces de jogo adicionando barras de vida, stamina, painel de estatísticas, preservando a estética de animações e modernidade vista no Menu Inicial.

---

## Fase 6: Verdadeiro P2P + Modo Global 🌐

### ⚠️ Pré-requisitos
- Fase 4 completa (PeerHost/PeerClient/PeerSession funcionando)
- Fase 5 completa (opcional — pode ser feito em paralelo)
- Compreensão sólida de: `NPCManager.ts`, `NPCFsmSystem.ts`, `PeerHost.ts`, `PeerClient.ts`, `PeerSession.ts`, `SeededRandomProvider.ts`, `messages.ts`, `useAppStore.ts`
- Leitura obrigatória: `specs/4-npc-ai-behavior.md` (FSM, percepção, dano)

---

### 6.0 — Motivação & Arquitetura Conceitual

**Problema atual**: Arquitetura Host-Client onde apenas o host simula NPCs. Clientes são "espectadores" que recebem snapshots. O host é um gargalo de CPU, e se ele cai, todos sofrem. NPCs não existem de verdade nos clients — só sombras interpoladas.

**Solução**: Peer-to-Peer verdadeiro, onde **todo peer é autoritativo para sua própria simulação de NPCs**. O mundo é determinístico (`WORLD_SEED=12345`). Se todos os peers usam a mesma semente + tick, as simulações convergem para o mesmo estado — a menos que ocorra um **evento de interação** (ataque, comer, morte). Esses eventos são a ÚNICA coisa que precisa ser replicada pela rede.

**Analogia**: Cada peer roda uma "cópia local" do mundo que é idêntica por construção. Quando um jogador arranca uma folha de uma árvore, ele grita "parei a folha X no tick 5000!" e todos os peers na vizinhança aplicam essa mudança localmente. O mundo permanece sincronizado sem snapshots periódicos.

```
┌─────────────────────────────────────────────────────────┐
│                    ARQUITETURA P2P                      │
│                                                         │
│  Peer A (chunk 5,3)        Peer B (chunk 5,4)          │
│  ┌──────────────────┐     ┌──────────────────┐          │
│  │ NPCManager local │◄───►│ NPCManager local │          │
│  │ EventBus         │     │ EventBus         │          │
│  │ ChunkInterestMgr │     │ ChunkInterestMgr │          │
│  │ PeerMesh         │◄───►│ PeerMesh         │          │
│  └────────┬─────────┘     └────────┬─────────┘          │
│           │                       │                     │
│           └───────────┬───────────┘                     │
│                       │  (só conectados se chunks       │
│                       │   estiverem a distância ≤ 1)    │
│              ┌────────▼────────┐                        │
│              │  Peer C (chunk  │                        │
│              │  5,3)           │                        │
│              │  conectado c/ A │                        │
│              └─────────────────┘                        │
│                                                         │
│   EVENTOS TRAFEGADOS (NUNCA snapshots de NPCs):         │
│   • attack_npc(npcId, dano, tick)                       │
│   • npc_died(npcId, tick)                               │
│   • food_consumed(foodId, tick)                         │
│   • player_chunk(peerId, cx, cz)                        │
│   • player_state(pos, rot, hp, animação) ← só para     │
│     renderização remota, não afeta simulação            │
└─────────────────────────────────────────────────────────┘
```

**Modo Global**: Um servidor WebSocket leve (~200 linhas) funciona como "lobby" — mantém a lista de peers conectados e seus chunks. Quando um peer entra, recebe a lista completa. Cada peer então estabelece DataChannels PeerJS diretamente com peers em chunks vizinhos. Não há código de sessão — todos no site estão no mesmo "shard".

**3 Modos de Jogo**:
| Modo | Rede | Signaling | Conexões | Código |
|------|------|-----------|----------|--------|
| 🌍 Global | P2P mesh parcial | WebSocket custom | Só peers no mesmo chunk | Nenhum |
| 🦕 Party | P2P mesh completo | PeerJS cloud (`0.peerjs.com`) | Todos conectados | 4-char |
| 🏠 Single | Offline | N/A | N/A | N/A |

---

### 6.1 — NPCManager Determinístico + EventBus

**O quê**: Tornar a simulação de NPCs completamente determinística, de modo que dois peers com a mesma semente + mesmos eventos externos produzam estado idêntico. Introduzir um `EventBus` para registrar e reproduzir eventos de interação jogador-mundo.

**Por quê**: É a fundação de todo o P2P. Sem determinismo, precisamos de snapshots periódicos (como hoje). Com determinismo, só eventos cabem na rede.

| Arquivo | Ação | Descrição |
|---------|------|-----------|
| `src/infrastructure/network/EventBus.ts` | **CRIAR** | Fila global de eventos de jogo |
| `src/useCases/game/NPCManager.ts` | MODIFICAR | Integrar EventBus, remover `isAuthority` |
| `src/useCases/game/systems/NPCFsmSystem.ts` | MODIFICAR | Decisões baseadas em chunk, não posição exata |
| `src/useCases/game/CombatSystem.ts` | MODIFICAR | Gerar eventos ao invés de aplicar dano direto |
| `src/infrastructure/random/SeededRandomProvider.ts` | REVISAR | Garantir consistência cross-platform |
| `src/domain/interfaces/INPCManager.ts` | CRIAR | Interface para NPCManager |

#### 6.1.1 — EventBus.ts (NOVO)

```
src/infrastructure/network/EventBus.ts
```

**Interface**:
```typescript
type GameEventType =
  | 'npc_attack'       // Jogador atacou NPC → dano
  | 'npc_died'         // NPC morreu (HP ≤ 0)
  | 'food_consumed'    // Jogador consumiu comida (planta/carcaça)
  | 'player_chunk'     // Jogador entrou/saiu de chunk
  | 'npc_state_sync'   // [Fallback] Correção periódica de estado NPC

interface GameEvent {
  id: string;                  // hash(tick + originPeerId + type + seq)
  type: GameEventType;
  tick: number;                // Simulation tick when event occurred
  originPeerId: string;        // Quem gerou o evento
  data: Record<string, unknown>;
}

class EventBus {
  push(event: GameEvent): void
  consume(maxTick: number): GameEvent[]       // Returns sorted events up to maxTick
  getHistory(sinceTick: number): GameEvent[]  // For late joiners / reconnection
  prune(upToTick: number): void               // Remove events older than N ticks
  clear(): void
}
```

**Regras de ordenação**: Eventos são ordenados por `tick` (crescente). Empates são desfeitos por `originPeerId` (hash determinístico). Isso garante que todos os peers processem eventos na mesma ordem.

**Política de retenção**: Manter últimos 10.000 ticks de eventos (~5 minutos a 30 ticks/s). Eventos mais velhos que `currentTick - MAX_HISTORY` são podados. Isso limita o replay para late joiners.

**Broadcast automático**: `EventBus.push()` também chama `PeerMesh.broadcastEvent(event)` — o push local já dispara a replicação.

#### 6.1.2 — NPCManager.ts — Mudanças

**Antes**:
- `isAuthority: boolean` — host simula, client não
- `setNPCsFromNetwork()` — override por snapshot do host
- `processClientAttack()` — lida com ataque de client remoto
- `processClientEat()` — lida com comer de client remoto
- `setRemotePlayers()` — informa NPCManager sobre posição de players remotos

**Depois**:
- `isAuthority` **removido** — todo peer sempre roda simulação completa
- `setNPCsFromNetwork()` **removido** — não há mais snapshots de NPC
- `processClientAttack()` **substituído** por `EventBus.push(NpcAttackEvent)`
- `processClientEat()` **substituído** por `EventBus.push(FoodConsumedEvent)`
- `setRemotePlayers()` **substituído** por `ChunkInterestManager.getPeersInChunk()` — NPCManager consulta o ChunkInterestManager para saber quais chunks têm players predadores/presa
- `update()` modificado: antes de simular, consome eventos do EventBus até o tick atual
- `_clientHuntingMap` e `_playerCarcass` mantidos, mas alimentados por eventos ao invés de remote player list

**Fluxo de update**:
```
NPCManager.update(dt, playerX, playerZ, ...):
  1. ChunkInterestManager.getPeersInChunk() → peer presence map
  2. EventBus.consume(currentTick) → eventos para aplicar neste tick
     - npc_attack: reduz HP do NPC no tick correto
     - npc_died: marca NPC como morto, inicia timer de 10s
     - food_consumed: marca comida como consumida
     - player_chunk: atualiza peer presence map
  3. Para cada NPC:
     a. NPC já estava morto? Skip.
     b. Aplica dano pendente de eventos recebidos
     c. Roda FSM (que decide wander/flee/hunt baseado em seed + peer presence)
     d. Aplica movimento
     e. Se NPC-ataca-player: calcula dano contra o player LOCAL (sempre autoritativo)
     f. Se player-ataca-NPC: gera NpcAttackEvent (já foi gerado no frame anterior)
  4. Spawn/despawn normal (determinístico por seed + tick)
```

**IMPORTANTE**: NPCs nunca atacam players remotos diretamente. Cada peer calcula o dano que NPCs causam ao **seu próprio player**. Isso significa que se o NPC `rex_123` está em modo Hunting e há um player no chunk, cada peer naquele chunk decide independentemente se o NPC ataca ou não — usando seeded random. Como a seed é a mesma, todos decidem igual.

Exceto: se o NPC atacou o player A (evento gerado), o NPC entra em cooldown de ataque. O cooldown também é determinístico (seed + tick). Então o peer B não precisa ser avisado — ele vê o mesmo cooldown.

#### 6.1.3 — NPCFsmSystem.ts — Decisões por Chunk

**Mudança crítica**: A FSM atualmente usa `playerX, playerZ` (posição exata) para:
1. Avaliar ameaça (predador perto?)
2. Encontrar comida (presa perto?)
3. Fugir/caçar baseado em distância

**Novo comportamento**:
- Substituir `playerX, playerZ` por `peerPresenceInChunk: Map<string, Set<string>>` — mapeia `chunkCoord → Set<peerId>`
- A FSM pergunta: "Existe um player carnívoro nivel ≥ X no meu chunk ou adjacente?"
- Se sim, NPC pode entrar em Fleeing ou Hunting (decidido por seeded random, não por distância exata)
- Wander continua determinístico (seed + tick)
- **Exceção**: Ataque corpo-a-corpo (NPC mordendo player) — usa bounding sphere collision contra o player LOCAL, que é a mesma em qualquer peer porque o player local está na mesma posição

**Perception system**: Os buffers de `visibleNpcsBuffer` e `visibleEdiblesBuffer` são preenchidos normalmente, mas apenas com NPCs locais (que são idênticos entre peers). A detecção de player para ameaça usa chunk presence em vez de raycasting contra o player.

#### 6.1.4 — SeededRandomProvider — Consistência Cross-Platform

**Problema potencial**: Operações de ponto flutuante em JavaScript podem diferir entre engines (V8 vs JSC vs SpiderMonkey) para os mesmos inputs. O `Math.random()` é substituído pelo `SeededRandomProvider.next()`, mas se a matemática interna do Three.js/Cannon-es diferir, podemos ter divergência.

**Mitigação**:
1. Toda decisão da FSM que envolve ângulos, distâncias e alvos deve usar `SeededRandomProvider.next()` para tomar a decisão, mesmo que isso abstraia a física real
2. Exemplo: ao invés de "qual presa está mais próxima?" (física-dependente), usar "qual presa no chunk o RNG escolheu?" (determinístico)
3. Adicionar um `deterministicMode` flag no `NPCManager` que, quando true, usa seleção por seed ao invés de nearest-neighbor físico
4. Em Party/Global mode: `NPCManager.setDeterministicMode(true)`. Em Single Player: `false` (pode usar nearest-neighbor real para melhor comportamento)

**Teste de determinismo**: Dois navegadores diferentes carregando o mesmo seed + tick devem produzir o mesmo array `NPCManager.getActiveNPCs()` (mesmos IDs nas mesmas posições). Verificar periodicamente com hash checksum do estado dos NPCs.

---

### 6.2 — ChunkInterestManager

**O quê**: Gerenciar quais peers são relevantes para o jogador baseado em chunks do mapa. Determina conexões P2P e filtragem de eventos.

**Por quê**: Em uma mesh global, não podemos nos conectar a todos. Só peers no mesmo chunk ou adjacente (distância máxima 1 chunk = 50 unidades) são relevantes para sincronização.

| Arquivo | Ação |
|---------|------|
| `src/infrastructure/network/ChunkInterestManager.ts` | **CRIAR** |
| `src/infrastructure/network/ChunkInterestManager.test.ts` | OPCIONAL |

```
src/infrastructure/network/ChunkInterestManager.ts
```

**Interface**:
```typescript
interface ChunkPos { x: number; z: number; }

class ChunkInterestManager {
  private _playerChunk: ChunkPos;
  private _interestRadius: number;  // default: 1 (chunks adjacentes)
  private _peerChunks: Map<string, ChunkPos>;  // peerId → chunk

  setPlayerPosition(worldX: number, worldZ: number): ChunkPos
  // Retorna o chunk atual (atualiza se mudou)

  updatePeerChunk(peerId: string, cx: number, cz: number): boolean
  // Atualiza chunk de um peer conhecido. Retorna true se mudou.

  removePeer(peerId: string): void

  getPeersInInterestZone(): string[]
  // Todos os peers com |cx - pcx| <= radius && |cz - pcz| <= radius

  getPeersInExactChunk(cx: number, cz: number): string[]
  // Apenas peers no chunk exato

  isPeerInInterest(peerId: string): boolean

  onChunkChanged: ((oldPos: ChunkPos, newPos: ChunkPos) => void) | null
  // Callback disparado quando o jogador muda de chunk →
  // PeerMesh deve reconectar
}
```

**Integração com PeerMesh**:
- A cada frame (ou a cada N frames), `PlayerPositionRef` é lido e convertido para chunk coord via `MapGenerator.worldToChunk()`
- Se o chunk mudou: `ChunkInterestManager.setPlayerPosition()` → dispara `onChunkChanged`
- PeerMesh escuta `onChunkChanged` para:
  1. Desconectar de peers que saíram do interest zone
  2. Conectar a novos peers que entraram no interest zone
  3. Enviar `player_chunk` event para peers ainda conectados

**Interesse radial**: `interestRadius = 1` significa que consideramos 9 chunks (3×3 centrado no jogador). Para chunks de 50 unidades, isso cobre 150×150 unidades de área de interesse. Ajustável via configuração.

**Eficiência**: Operações O(1) para `updatePeerChunk` e `getPeersInInterestZone` (usa hash maps). A lista de peers no interest zone é pequena (tipicamente 0-5 peers).

---

### 6.3 — PeerMesh (Substitui PeerHost + PeerClient + PeerSession)

**O quê**: Nova classe que gerencia múltiplas conexões DataChannel simultâneas com peers remotos. Substitui completamente `PeerHost`, `PeerClient`, `PeerSession`.

**Por quê**: No P2P verdadeiro, cada peer tem N conexões (não uma só). A lógica de host/client é substituída por uma mesh simétrica.

| Arquivo | Ação |
|---------|------|
| `src/infrastructure/network/PeerMesh.ts` | **CRIAR** |
| `src/infrastructure/network/PeerHost.ts` | **REMOVER** (após migração) |
| `src/infrastructure/network/PeerClient.ts` | **REMOVER** (após migração) |
| `src/infrastructure/network/PeerSession.ts` | **REMOVER** (após migração) |

```
src/infrastructure/network/PeerMesh.ts
```

**Interface**:
```typescript
type MeshMode = 'party' | 'global';

interface PeerInfo {
  id: string;
  playerName: string;
  dinoId: string;
  colors: Record<string, string>;
  chunkX: number;
  chunkZ: number;
  connectedAt: number;
}

class PeerMesh {
  private _ownPeer: Peer;
  private _connections: Map<string, DataConnection>;  // peerId → DataConnection
  private _peerInfo: Map<string, PeerInfo>;            // peerId → info
  private _chunkInterest: ChunkInterestManager;
  private _eventBus: EventBus;
  private _mode: MeshMode;
  private _sessionCode: string | null;
  private _ownPeerId: string;
  private _signalingClient: SignalingClient | null;    // só em global mode
  private _heartbeatInterval: number;

  // ── Lifecycle ──
  async startParty(sessionCode?: string): Promise<void>
  // Modo Party: usa PeerJS cloud broker, gera/cria sessão
  // Todos no party formam mesh completo (full mesh)

  async startGlobal(playerName: string, dinoId: string): Promise<void>
  // Modo Global: conecta ao WebSocket signaling, descobre peers
  // Mesh parcial (só peers no interest zone)

  async destroy(): Promise<void>
  // Desconecta de tudo, limpa estado

  // ── Conexões ──
  private async connectToPeer(peerId: string): Promise<DataConnection>
  private disconnectFromPeer(peerId: string): void
  private onPeerDisconnected(peerId: string): void

  // ── Envio de mensagens ──
  broadcastEvent(event: GameEvent): void
  // Envia evento para TODOS os peers conectados

  sendEventToPeers(event: GameEvent, peerIds: string[]): void
  // Envio seletivo (ex: só peers no mesmo chunk)

  sendPlayerState(state: PlayerStateMessage): void
  // Posição/rotação/animação para renderização (throttled)

  private handleIncomingMessage(peerId: string, msg: unknown): void
  // Roteia mensagens recebidas: eventos → EventBus, estado → store

  // ── Consulta ──
  getPeersInChunk(cx: number, cz: number): PeerInfo[]
  getConnectedPeers(): PeerInfo[]
  getOwnPeerId(): string
  getMode(): MeshMode
}
```

**Protocolo de mensagens** (em `messages.ts` expandido):
```typescript
// Qualquer direção (simétrico)
type PeerMeshMessage =
  | { type: 'event'; event: GameEvent }
  | { type: 'player_state'; peerId: string; posX, posY, posZ, rotY, health, maxHealth, isDead, animationIntent, level, scale }
  | { type: 'peer_handshake'; playerName, dinoId, colors, chunkX, chunkZ, tick }
  | { type: 'peer_handshake_ack'; playerName, dinoId, colors, chunkX, chunkZ, tick }
  | { type: 'heartbeat'; chunkX, chunkZ, tick }
  | { type: 'event_history_request'; sinceTick: number }
  | { type: 'event_history_response'; events: GameEvent[] }
```

**Heartbeat**: A cada 5 segundos, cada peer envia `heartbeat` para todos os conectados. Se um peer não enviar heartbeat por 15 segundos, é considerado desconectado.

**Reconexão**: Se um peer cai, o `ChunkInterestManager` o remove. Se ele voltar (novo chunk no interest zone), `PeerMesh.connectToPeer()` é chamado novamente. O peer que retorna envia `event_history_request` para recuperar eventos perdidos.

**Modo Party (full mesh)**:
- Usa PeerJS cloud broker (`0.peerjs.com`) como signaling
- Código de sessão vira PeerJS ID (igual hoje)
- Mas ao invés de host/client, TODOS se conectam entre si
- Primeiro peer a criar a sala: `startParty()` → `new Peer(sessionCode)`
- Peers seguintes: `startParty()` → `new Peer()` → `peer.connect(sessionCode)` → recebe `peer_list` do primeiro peer → conecta a todos
- Em Party, o interest radius é efetivamente infinito — todos estão conectados

**Modo Global (mesh parcial)**:
- Usa `SignalingClient` (WebSocket) para descoberta
- `startGlobal()` → conecta WebSocket → recebe peer list → filtra por interest zone → conecta
- A cada mudança de chunk, notifica signaling server
- Quando novo peer aparece no interest zone: connect
- Quando peer sai do interest zone: disconnect

#### 6.3.1 — PeerMesh — Chunk Interest Integration

```
PeerMesh._chunkInterest.onChunkChanged = (oldPos, newPos) => {
  // 1. Disconnect de peers que não estão mais no interest zone
  for (const [peerId, conn] of this._connections) {
    if (!this._chunkInterest.isPeerInInterest(peerId)) {
      this.disconnectFromPeer(peerId);
    }
  }

  // 2. Notificar peers ainda conectados sobre mudança de chunk
  const event: GameEvent = {
    id: generateEventId(),
    type: 'player_chunk',
    tick: NPCManager.getSimulationTick(),
    originPeerId: this._ownPeerId,
    data: { chunkX: newPos.x, chunkZ: newPos.z, peerId: this._ownPeerId },
  };
  this.broadcastEvent(event);

  // 3. Connectar a novos peers no interest zone (se global mode)
  if (this._mode === 'global') {
    const newPeers = this._chunkInterest
      .getPeersInInterestZone()
      .filter(pid => !this._connections.has(pid));
    for (const pid of newPeers) {
      this.connectToPeer(pid);
    }
  }
};
```

---

### 6.4 — Signaling Server (WebSocket — Modo Global)

**O quê**: Servidor Node.js leve que mantém a lista de peers conectados no mundo global e seus chunks atuais. Usa WebSocket para comunicação bidirecional.

**Por quê**: PeerJS cloud broker (`0.peerjs.com`) não suporta "salas" ou descoberta de peers. Precisamos de um servidor que saiba quem está online e onde.

| Arquivo | Ação |
|---------|------|
| `server/signaling-server.ts` | **CRIAR** |
| `server/package.json` | **CRIAR** |
| `server/tsconfig.json` | **CRIAR** |
| `src/infrastructure/network/SignalingClient.ts` | **CRIAR** |

```
server/signaling-server.ts
```

**Tecnologia**: `uWebSockets.js` (mais leve/performático que `ws`) ou `ws` (mais simples). `uWebSockets.js` recomendado pelo perfil de desempenho.

**Dependências**:
- `uWebSockets.js` ou `ws`
- `uuid` (para IDs de sessão de conexão, não expostos ao cliente)

**Estado do servidor**:
```typescript
interface ConnectedPeer {
  peerId: string;           // ID do PeerJS (ex: "chomp-global-a1b2c3")
  playerName: string;
  dinoId: string;
  chunkX: number;
  chunkZ: number;
  lastSeen: number;         // timestamp do último heartbeat/chunk update
  connectedAt: number;
  ws: WebSocket;            // referência para enviar mensagens
}

const globalPeers = new Map<string, ConnectedPeer>();
```

**Mensagens WebSocket (cliente → servidor)**:
```typescript
type WSClientMessage =
  | { type: 'join'; peerId: string; playerName: string; dinoId: string; colors: Record<string, string> }
  | { type: 'leave' }
  | { type: 'chunk_update'; chunkX: number; chunkZ: number }
  | { type: 'heartbeat'; chunkX: number; chunkZ: number }
```

**Mensagens WebSocket (servidor → cliente)**:
```typescript
type WSServerMessage =
  | { type: 'peer_list'; peers: Array<{ peerId, playerName, dinoId, chunkX, chunkZ }> }
  | { type: 'peer_joined'; peer: { peerId, playerName, dinoId, chunkX, chunkZ } }
  | { type: 'peer_left'; peerId: string }
  | { type: 'peer_chunk_update'; peerId: string; chunkX: number; chunkZ: number }
  | { type: 'welcome'; yourPeerId: string; onlineCount: number }
```

**Fluxo**:
```
1. Cliente WebSocket conecta ao servidor
2. Servidor: { type: 'welcome', yourPeerId, onlineCount }
3. Cliente: { type: 'join', peerId, playerName, dinoId, colors }
4. Servidor: armazena peer, broadcast { type: 'peer_joined', ... } para todos
5. Servidor: { type: 'peer_list', peers: [...] } para o novo peer (lista completa)
6. Cliente: começa a enviar { type: 'chunk_update' } quando muda de chunk
7. Servidor: broadcast { type: 'peer_chunk_update', ... } para todos
8. Cliente: envia { type: 'heartbeat' } a cada 10s
9. Servidor: se um peer não envia heartbeat por 30s, remove e broadcast peer_left
10. Cliente: { type: 'leave' } → servidor remove e broadcast
```

**Rate limiting**:
- Máximo 100 peers simultâneos por instância do servidor
- Heartbeat a cada 10s (timeout 30s)
- Chunk update no máximo a cada 500ms (throttle)

**Escalabilidade futura**:
- Múltiplas "shards" baseadas em hash do peerId
- Shard 0: peerId hash termina em 0-3, Shard 1: 4-7, etc.
- Servidor de "lobby" principal redireciona para shard específico
- Shards independentes = mundos paralelos

**Deploy**:
- Railway, Render, ou Fly.io (free tier suficiente para centenas de peers)
- Dockerfile opcional (Node.js Alpine)
- URL configurável via `VITE_SIGNALING_URL` no frontend
- Fallback: se servidor offline, Modo Global mostra "Servidor indisponível" e desabilita o botão

**SignalingClient.ts** (frontend WebSocket wrapper):
```typescript
class SignalingClient {
  private ws: WebSocket | null = null;
  private url: string;
  private onPeerList: ((peers: PeerListEntry[]) => void) | null = null;
  private onPeerJoined: ((peer: PeerListEntry) => void) | null = null;
  private onPeerLeft: ((peerId: string) => void) | null = null;
  private onPeerChunkUpdate: ((peerId: string, cx: number, cz: number) => void) | null = null;
  private onWelcome: ((peerId: string, count: number) => void) | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;

  async connect(): Promise<void>
  sendJoin(peerId: string, playerName: string, dinoId: string, colors: Record<string, string>): void
  sendChunkUpdate(cx: number, cz: number): void
  sendLeave(): void
  sendHeartbeat(): void  // chamado internamente via setInterval
  disconnect(): void
  private reconnect(): void  // backoff exponencial
}
```

---

### 6.5 — EventReplicator

**O quê**: Camada entre `EventBus` e `PeerMesh` que gerencia a replicação confiável de eventos entre peers. Garante que eventos cheguem na ordem correta e que peers desconectados possam recuperar eventos perdidos.

**Por quê**: Eventos são a espinha dorsal da sincronização P2P. Perder um evento = divergência permanente do estado do NPC.

| Arquivo | Ação |
|---------|------|
| `src/infrastructure/network/EventReplicator.ts` | **CRIAR** |

```
src/infrastructure/network/EventReplicator.ts
```

**Responsabilidades**:
1. **Envio**: Quando `EventBus.push()` é chamado, `EventReplicator` serializa e envia via `PeerMesh.broadcastEvent()` ou `PeerMesh.sendEventToPeers()` (se for evento específico de chunk)
2. **Recebimento**: Quando `PeerMesh` recebe um evento remoto, `EventReplicator` valida e insere no `EventBus` local
3. **Deduplicação**: Eventos têm ID único (hash de tick + originPeerId + type + seq). Se um evento chega duas vezes (ex: broadcast + history replay), é ignorado.
4. **History Request**: Quando um peer se conecta a outro, envia `event_history_request` com `sinceTick`. O peer remoto responde com eventos do seu `EventBus.getHistory(sinceTick)`.
5. **Gap Detection**: Se um peer recebe evento com tick = 5100 mas o último foi tick 5098, sabe que perdeu tick 5099. Pede `event_history_request` para tick 5099.

**Integração com NPCManager**:
```typescript
// No NPCManager.update(), antes de simular NPCs:
const events = EventBus.consume(currentTick);
for (const event of events) {
  switch (event.type) {
    case 'npc_attack': {
      const npc = this._npcs.get(event.data.npcId as string);
      if (npc && npc.hp > 0) {
        npc.hp -= event.data.damage as number;
        if (npc.hp <= 0) {
          this.handleNpcDeath(npc, event.tick);
          EventBus.push({ type: 'npc_died', tick: event.tick, originPeerId: event.originPeerId, data: { npcId: npc.id } });
        }
      }
      break;
    }
    case 'npc_died': {
      // Marca NPC como morto se ainda não foi (pode já ter sido processado
      // localmente pelo npc_attack que causou a morte)
      // (deduplicação via id do evento)
      break;
    }
    case 'food_consumed': {
      this._edibleManager?.consume(event.data.foodId as string);
      break;
    }
    case 'player_chunk': {
      this._chunkInterest.updatePeerChunk(
        event.data.peerId as string,
        event.data.chunkX as number,
        event.data.chunkZ as number
      );
      break;
    }
  }
}
```

---

### 6.6 — Player Sync (Renderização Remota)

**O quê**: Apesar de NPCs serem simulados localmente, a posição/rotação/health dos jogadores REMOTOS precisa ser compartilhada para renderização.

**Por quê**: O corpo do jogador (dinossauro) não é determinístico — ele é controlado por input humano. Precisamos saber onde os outros estão para renderizá-los.

| Arquivo | Ação |
|---------|------|
| `src/presentation/canvas/RemotePlayers.tsx` | MODIFICAR |
| `src/presentation/canvas/PlayerDinosaur.tsx` | MODIFICAR |
| `src/store/useAppStore.ts` | MODIFICAR |

**Protocolo**: `PlayerStateMessage` (enviado a cada 100ms via `PeerMesh.sendPlayerState()`):
```typescript
{
  type: 'player_state',
  peerId: string,
  posX, posY, posZ: number,
  rotY: number,
  health: number,
  maxHealth: number,
  isDead: boolean,
  animationIntent: string,
  level: number,
  scale: number,
}
```

**Recebimento**: `PeerMesh.handleIncomingMessage()` roteia para o store:
```typescript
// store
remotePlayerStates: Map<string, PlayerStateMessage>;
// ação
setRemotePlayerState(peerId, state): void;
```

**RemotePlayers.tsx**: Lê `remotePlayerStates` do store e renderiza cada peer remoto como um dinossauro (igual ao comportamento atual, mas alimentado pelo mesh em vez de snapshots do host).

**Renderização**:
- Usar `PlayerStateMessage` diretamente (source of truth = o próprio peer)
- Interpolação linear com `lerpPosition` (speed 12× delta, igual hoje)
- Animação baseada em `animationIntent` (Attack/Eat/Death one-shot, resto looping)
- Nome do jogador via `name` do `PeerInfo`

---

### 6.7 — UI de Seleção dos 3 Modos

**O quê**: Reformular tela inicial para oferecer 3 modos de jogo com visual distinto.

**Por quê**: O jogador precisa escolher entre Single Player, Party Local, e Global.

| Arquivo | Ação |
|---------|------|
| `src/presentation/screens/SessionSelectScreen.tsx` | REESCREVER |
| `src/presentation/screens/CharacterSelectionMenu.tsx` | MODIFICAR |
| `src/presentation/screens/BandPanel.tsx` | MODIFICAR |
| `src/presentation/screens/GameScreen.tsx` | MODIFICAR |
| `src/store/useAppStore.ts` | MODIFICAR |

#### 6.7.1 — SessionSelectScreen.tsx

**Novo layout**: 3 cards grandes com ícones:

```
┌──────────────────────────────────────────────────┐
│           ESCOLHA SEU MODO DE JOGO               │
│                                                   │
│  ┌──────────────────────────────────────────┐    │
│  │  🌍  MUNDO GLOBAL                        │    │
│  │  Entre no mundo compartilhado com        │    │
│  │  todos os jogadores do Chomp 3D!         │    │
│  │                                 [30 online]│    │
│  │           [ENTRAR NO MUNDO]              │    │
│  └──────────────────────────────────────────┘    │
│                                                   │
│  ┌──────────────────────────────────────────┐    │
│  │  🦕  PARTY LOCAL                        │    │
│  │  Crie ou entre em uma sessão privada    │    │
│  │  com amigos usando código de 4 letras   │    │
│  │                                           │    │
│  │     [CRIAR SALA]  [ENTRAR COM CÓDIGO]   │    │
│  └──────────────────────────────────────────┘    │
│                                                   │
│  ┌──────────────────────────────────────────┐    │
│  │  🏠  SINGLE PLAYER                       │    │
│  │  Jogue offline sozinho no mundo          │    │
│  │  sem conexão com outros jogadores        │    │
│  │                                           │    │
│  │           [JOGAR SOZINHO]                │    │
│  └──────────────────────────────────────────┘    │
│                                                   │
│  [Status: Servidor Global Online ▼]               │
└──────────────────────────────────────────────────┘
```

**Mudanças de estado no store**:
```typescript
// Novos campos
gameMode: 'single' | 'party' | 'global';
globalPlayerCount: number;
signalingStatus: 'online' | 'offline' | 'checking';

// onlineRole removido (substituído por gameMode)
// sessionCode mantido (para party)
// connectionStatus expandido:
connectionStatus: 'disconnected' | 'connecting' | 'connected';
```

**Fluxo de cada modo**:
| Modo | Botão | Transição |
|------|-------|-----------|
| Global | "ENTRAR NO MUNDO" | → `gameMode='global'` → CharacterSelectionMenu |
| Party Cria | "CRIAR SALA" | → `gameMode='party'`, gera código → CharacterSelectionMenu |
| Party Entra | "ENTRAR COM CÓDIGO" | → input de código → `gameMode='party'`, `sessionCode='XXXX'` → CharacterSelectionMenu |
| Single | "JOGAR SOZINHO" | → `gameMode='single'` → CharacterSelectionMenu |

#### 6.7.2 — CharacterSelectionMenu.tsx

- Indicar modo atual: "🌍 Modo Global" / "🦕 Party: Código XXXX" / "🏠 Single Player"
- Botão "INICIAR PARTIDA" chama:
  - Global: `peerMesh.startGlobal(playerName, dinoId, colors)`
  - Party: `peerMesh.startParty(sessionCode)`
  - Single: navega direto para o jogo (sem rede)
- Ao clicar iniciar em Global: mostrar overlay "Conectando ao mundo global..." até `connectionStatus === 'connected'`

#### 6.7.3 — BandPanel.tsx

- Em **Modo Global**:
  - Título: "🌍 Global — X jogadores online"
  - Lista de peers NO MESMO CHUNK destacada
  - Lista completa de todos os peers (com chunk indicado)
  - Status de conexão: "Conectado ao servidor global"
- Em **Modo Party** (mantém atual melhorado):
  - Título: "🦕 Party — Código: XXXX"
  - Lista de membros do party
  - Botão copiar código
- Em **Single**: oculto (como hoje)

#### 6.7.4 — GameScreen.tsx

- Remover lógica de `handleLeaveGame` com `transferHostToNextInLine()` (não existe mais host)
- Em Global: `handleLeaveGame` apenas chama `peerMesh.destroy()` + `signalingClient.sendLeave()`
- Em Party: `peerMesh.destroy()` (mesmo)
- Em Single: sem mudanças

---

### 6.8 — Limpeza do Store (Zustand)

**Mudanças finais em `useAppStore.ts`**:

```typescript
// ── Network State (novo) ──
gameMode: 'single' | 'party' | 'global';
signalingStatus: 'online' | 'offline' | 'checking';
globalPlayerCount: number;
connectedPeers: PeerInfo[];           // todos os peers conhecidos (via signaling)
peersInChunk: PeerInfo[];             // peers no mesmo chunk (para highlight)
remotePlayerStates: Record<string, PlayerStateMessage>;  // posições para render

connectionStatus: ConnectionStatus;   // 'disconnected' | 'connecting' | 'connected'
sessionCode: string;                  // apenas para party
connectedPlayers: string[];           // IDs dos peers conectados (para BandPanel)

// ── Removido ──
// onlineRole: OnlineRole              ← substituído por gameMode
// networkNPCs: unknown[]              ← NPCs são locais agora
// networkPlayers: unknown[]           ← substituído por remotePlayerStates
// networkTick: number                 ← NPCManager gerencia tick local
```

**Ações**:
```typescript
setGameMode(mode: 'single' | 'party' | 'global'): void;
setGlobalPlayerCount(count: number): void;
setConnectedPeers(peers: PeerInfo[]): void;
setRemotePlayerState(peerId: string, state: PlayerStateMessage): void;
removeRemotePlayer(peerId: string): void;

// Mantidas: setSessionCode, setConnectionStatus, setConnectedPlayers
// Removidas: setOnlineRole, setNetworkData
```

---

### 6.9 — Arquivos a Remover (após migração completa)

| Arquivo | Razão |
|---------|-------|
| `src/infrastructure/network/PeerHost.ts` | Substituído por PeerMesh |
| `src/infrastructure/network/PeerClient.ts` | Substituído por PeerMesh |
| `src/infrastructure/network/PeerSession.ts` | Substituído por PeerMesh |
| `src/useCases/game/network/NpcSnapshotInterpolator.ts` | NPCs são locais, sem snapshots |
| `src/infrastructure/network/messages.ts` | Reescrever com novas mensagens P2P |

**Após remover, atualizar imports** em:
- `src/presentation/canvas/NPCDinosaurs.tsx`
- `src/presentation/canvas/PlayerDinosaur.tsx`
- `src/presentation/canvas/RemotePlayers.tsx`
- `src/presentation/screens/GameScreen.tsx`
- `src/presentation/screens/CharacterSelectionMenu.tsx`
- `src/presentation/screens/BandPanel.tsx`
- `src/App.tsx` (se referenciar peerSession direto)

---

### 6.10 — Ordem de Implementação (Sprints)

**Dependências entre tarefas**:
```
6.1 (NPCManager determinístico)
  ├── 6.1.1 EventBus
  ├── 6.1.2 NPCManager refactor
  └── 6.1.3 NPCFsmSystem deterministic decisions

6.2 ChunkInterestManager (independente, paralelo a 6.1)
  └── usado por 6.3 e 6.5

6.3 PeerMesh (depende de 6.1 e 6.2)
  ├── 6.3.1 Party mode
  └── 6.3.2 Global mode (depende de 6.4)

6.4 Signaling Server (independente, paralelo a 6.1/6.2/6.3)

6.5 EventReplicator (depende de 6.1 e 6.3)

6.6 Player Sync (depende de 6.3)

6.7 UI (depende de 6.3, parcialmente independente)

6.8 Store cleanup (feito durante 6.7, mas planejado antes)

6.9 Remover arquivos legados (final)
```

**Sprint 1 — Fundação**:
1. `EventBus.ts` — estrutura pura, sem dependências de rede
2. `NPCManager.ts` — refatorar para consumir EventBus
3. `NPCFsmSystem.ts` — converter decisões de player-relative para chunk-relative
4. `ChunkInterestManager.ts` — módulo puro, sem dependências de rede
5. Testar: single player continua funcionando (modo determinístico desligado)

**Sprint 2 — PeerMesh (Modo Party)**:
1. `PeerMesh.ts` — estrutura básica com `startParty()`
2. Conexão entre múltiplos peers no mesmo party
3. Heartbeat + detecção de desconexão
4. `EventReplicator.ts` — replicação de eventos entre peers do party
5. Testar: 2 peers no party, NPCs sincronizados via eventos

**Sprint 3 — Signaling Server + Modo Global**:
1. `server/signaling-server.ts` — WebSocket server básico
2. `SignalingClient.ts` — cliente WebSocket
3. `PeerMesh.startGlobal()` — mesh parcial
4. Integração ChunkInterest → PeerMesh (conexão seletiva)
5. Testar: 3 peers em chunks diferentes → só conectam quando entram no mesmo chunk

**Sprint 4 — UI + Finalização**:
1. `SessionSelectScreen.tsx` — 3 modos
2. `CharacterSelectionMenu.tsx` — modo-aware
3. `BandPanel.tsx` — global/party info
4. `GameScreen.tsx` — remover host transfer
5. `useAppStore.ts` — novo estado de rede
6. Remover arquivos legados
7. Testar: todos os 3 modos funcionando em integração

---

### 6.11 — Riscos e Mitigações

| Risco | Probabilidade | Impacto | Mitigação |
|-------|:---:|:---:|-----------|
| Divergência de simulação entre browsers diferentes | Média | Alto | `deterministicMode` flag + testes de checksum cross-browser. Arredondar ângulos e posições para 4 casas decimais. |
| Perda de evento → NPC divergence | Baixa | Alto | EventReplicator com gap detection + history request. Heartbeat inclui tick atual para detecção de gap. |
| Peer malicioso forja eventos de ataque | Média | Médio | Em Party: HMAC signing com chave compartilhada na criação da sessão. Em Global: aceitar para jogo casual, adicionar server-side validation depois. |
| Signaling server offline | Baixa | Alto (Global) | Fallback: desabilitar botão Global, mostrar mensagem. Cache local de última lista de peers para reconexão rápida. |
| Muitos peers no mesmo chunk (10+) | Baixa | Médio | Sub-host temporário ou relay para chunks muito populosos. Inicialmente: limitar a 8 peers por chunk. |
| Latência de evento > 200ms | Média | Baixo | NPCs podem levar dano com atraso visual. Aceitável para jogo casual. Eventos têm timestamp do tick de origem, não de recebimento. |
| Conexão WebSocket insegura | Baixa | Médio | Usar WSS (WebSocket Secure) em produção. Rate limiting no servidor. |

---

### 6.12 — Métricas de Sucesso

1. **Zero snapshots de NPC na rede**: NPCs só sincronizam via eventos. Verificar com Wireshark/devtools que `SnapshotMessage` não é mais enviado.
2. **Determinismo**: Dois peers no mesmo chunk com os mesmos eventos exibem NPCs nas mesmas posições (±0.01 unidades).
3. **Modo Global funcional**: 3+ peers em máquinas diferentes entram no Global e se veem no mesmo chunk.
4. **Performance**: Modo Global com 5 peers no interest zone não aumenta CPU em mais de 15% comparado ao single player.
5. **Migração suave**: Party Mode usando PeerMesh deve ser drop-in replacement para a funcionalidade atual de Host-Client.
6. **Reconexão**: Peer que cai e volta recupera eventos perdidos e converge estado em < 2 segundos.
