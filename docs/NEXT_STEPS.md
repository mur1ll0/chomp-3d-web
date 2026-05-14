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

**O quê**: Gerenciar quais peers são relevantes para o jogador baseado em chunks do mapa e na distância de renderização configurada. Determina conexões P2P e filtragem de eventos.

**Por quê**: Em uma mesh global, não podemos nos conectar a todos. A área de interesse deve corresponder ao que o jogador vê na tela — se o `renderDistance` está configurado para 5 chunks, o jogador espera ver e interagir com peers a até 5 chunks de distância. Usar o render distance garante fidelidade visual: o ambiente de rede reflete exatamente o ambiente renderizado.

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
  private _interestRadius: number;  // sincronizado com renderDistance do store
  private _maxConnections: number;  // hard cap: 30 conexões simultâneas
  private _peerChunks: Map<string, ChunkPos & { renderDistance: number }>;

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

**Interesse radial**: O raio é definido pelo `renderDistance` do store (configurável de 1 a 6, default 2). `interestRadius = renderDistance` significa que consideramos chunks num grid `(2*renderDistance+1)²`. Exemplos:
- renderDistance=1: 3×3 = 9 chunks (150×150 unidades)
- renderDistance=2: 5×5 = 25 chunks (250×250 unidades) — **default**
- renderDistance=5: 11×11 = 121 chunks (550×550 unidades)
- renderDistance=6: 13×13 = 169 chunks (650×650 unidades)

**Hard cap de conexões**: `maxConnections = 30`. Se houver mais de 30 peers no interest zone, conecta apenas aos 30 mais próximos (ordenados por distância euclidiana de chunk). Isso evita sobrecarga de WebRTC.

**Atualização dinâmica**: Toda vez que o jogador muda o `renderDistance` no menu de configurações, `ChunkInterestManager.updateInterestRadius()` recalcula o interest zone e PeerMesh reconecta conforme necessário.

**Algoritmo de conexão bidirecional** (ver 6.14):
```typescript
// Peer A se conecta ao Peer B se B estiver no interest zone de A.
// Como a conexão é simétrica (WebRTC DataChannel), uma vez conectados
// ambos enviam/recebem eventos normalmente.
// Peer com maior renderDistance naturalmente "puxa" conexões com peers
// mais distantes, garantindo que jogadores com visão ampla vejam tudo.

function shouldConnectToPeer(peerChunk: ChunkPos, peerRenderDist: number): boolean {
  // Conecta SE o peer está no MEU interest zone OU
  // SE eu estou no interest zone do peer (conexão mútua)
  const dist = chunkDistance(this._playerChunk, peerChunk);
  const myInterest = dist <= this._interestRadius;
  const theirInterest = dist <= peerRenderDist;
  return myInterest || theirInterest;
}
```

**Eficiência**: Operações O(1) para `updatePeerChunk` e `getPeersInInterestZone` (usa hash maps). A ordenação para o hard cap de 30 peers é O(n log n) mas n é tipicamente < 50, irrelevante.

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

### 6.10 — Riscos e Mitigações

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

### 6.11 — Métricas de Sucesso

1. **Zero snapshots de NPC na rede**: NPCs só sincronizam via eventos. Verificar com Wireshark/devtools que `SnapshotMessage` não é mais enviado.
2. **Determinismo**: Dois peers no mesmo chunk com os mesmos eventos exibem NPCs nas mesmas posições (±0.01 unidades).
3. **Modo Global funcional**: 3+ peers em máquinas diferentes entram no Global e se veem no mesmo chunk.
4. **Performance**: Modo Global com 5 peers no interest zone não aumenta CPU em mais de 15% comparado ao single player.
5. **Migração suave**: Party Mode usando PeerMesh deve ser drop-in replacement para a funcionalidade atual de Host-Client.
6. **Reconexão**: Peer que cai e volta recupera eventos perdidos e converge estado em < 2 segundos.

---

### 6.12 — Spawn Determinístico do Jogador Próximo a Packs

**O quê**: Em vez de sempre spawnar em `(0, 0, 0)`, o jogador spawna próximo a um grupo (pack) de NPCs da sua própria espécie que esteja longe de predadores. A posição é completamente determinística: mesma espécie + mesma seed = mesma posição de spawn.

**Por quê**: Imersão e coerência — o jogador aparece no mundo como se fizesse parte de um bando. Além disso, a posição determinística significa que em modo Party/Global, dois jogadores da mesma espécie spawnam no mesmo pack e se veem imediatamente.

| Arquivo | Ação |
|---------|------|
| `src/useCases/game/SpawnResolver.ts` | **CRIAR** |
| `src/presentation/canvas/PlayerDinosaur.tsx` | MODIFICAR |
| `src/useCases/game/NPCManager.ts` | MODIFICAR |

#### 6.12.1 — SpawnResolver.ts (NOVO)

```
src/useCases/game/SpawnResolver.ts
```

**Responsabilidade**: Dado um `speciesId` e `WORLD_SEED`, encontrar deterministicamente a melhor posição de spawn — próxima a um pack da mesma espécie e longe de predadores.

**Lógica**:
```typescript
const CHUNK_SIZE = 50;
const SEARCH_RADIUS = 15;   // concentric rings até 15 chunks do centro
const CARNIVORE_CHECK_RADIUS = 2;  // checar 2 chunks ao redor por predadores
const WATER_CHECK_RESOLUTION = 5;  // samples de água na área

interface SpawnPosition {
  chunkX: number;
  chunkZ: number;
  worldX: number;
  worldZ: number;
}

class SpawnResolver {
  constructor(private worldSeed: number) {}

  resolve(speciesId: string, herbivoreRoster: string[]): SpawnPosition {
    // Busca em anéis concêntricos (chunks mais próximos primeiro)
    for (let radius = 1; radius <= SEARCH_RADIUS; radius++) {
      for (let cx = -radius; cx <= radius; cx++) {
        for (let cz = -radius; cz <= radius; cz++) {
          // Pula chunks internos (já processados em raios menores)
          if (Math.abs(cx) !== radius && Math.abs(cz) !== radius) continue;

          const pos = this.evaluateChunk(cx, cz, speciesId, herbivoreRoster);
          if (pos) return pos;
        }
      }
    }
    // Fallback: origem
    return { chunkX: 0, chunkZ: 0, worldX: 0, worldZ: 0 };
  }

  private evaluateChunk(
    cx: number, cz: number,
    speciesId: string,
    herbivoreRoster: string[]
  ): SpawnPosition | null {
    const herbCount = Math.floor(seededRandom(cx, cz, 100) * 3) + 1; // 1-3 grupos

    for (let g = 0; g < herbCount; g++) {
      // Determina espécie deste grupo (determinístico)
      const speciesIdx = Math.floor(
        seededRandom(cx + g, cz + g, 200) * herbivoreRoster.length
      );
      if (herbivoreRoster[speciesIdx] !== speciesId) continue;

      // Calcula centro do grupo (determinístico)
      const groupCenterX = cx * CHUNK_SIZE + seededRandom(cx + g, cz, 150) * CHUNK_SIZE;
      const groupCenterZ = cz * CHUNK_SIZE + seededRandom(cx, cz + g, 150) * CHUNK_SIZE;

      // Verifica água na área
      if (this.isAreaWater(groupCenterX, groupCenterZ)) continue;

      // Verifica predadores nas redondezas
      if (this.hasCarnivoreNearby(cx, cz)) continue;

      return {
        chunkX: cx,
        chunkZ: cz,
        worldX: groupCenterX + (seededRandom(cx, cz, 999) - 0.5) * 5,
        worldZ: groupCenterZ + (seededRandom(cx, cz, 888) - 0.5) * 5,
      };
    }

    return null; // Nenhum grupo da espécie neste chunk
  }

  private hasCarnivoreNearby(cx: number, cz: number): boolean {
    for (let dx = -CARNIVORE_CHECK_RADIUS; dx <= CARNIVORE_CHECK_RADIUS; dx++) {
      for (let dz = -CARNIVORE_CHECK_RADIUS; dz <= CARNIVORE_CHECK_RADIUS; dz++) {
        // 30% de chance por chunk de ter carnívoro
        if (seededRandom(cx + dx, cz + dz, 500) < 0.3) return true;
      }
    }
    return false;
  }

  private isAreaWater(worldX: number, worldZ: number): boolean {
    // Samples em grid 5×5 ao redor do ponto
    for (let dx = -WATER_CHECK_RESOLUTION; dx <= WATER_CHECK_RESOLUTION; dx += 2) {
      for (let dz = -WATER_CHECK_RESOLUTION; dz <= WATER_CHECK_RESOLUTION; dz += 2) {
        // Usa o mesmo noise do MapGenerator
        const waterNoise = createNoise2D(() => 98765);
        if (getWaterValue(worldX + dx, worldZ + dz) > WATER_THRESHOLD) return true;
      }
    }
    return false;
  }
}
```

**SeededRandom idêntico ao NPCSpawnSystem**: Usar exatamente a mesma função `seededRandom(x, z, salt)` para produzir os mesmos resultados. Isso garante que o spawn escolhido corresponda a um pack que REALMENTE existe no jogo.

**Performance**: A busca em anéis concêntricos encontra um resultado tipicamente no raio 1-3 (primeiros anéis). No pior caso (espécie rara, muitos predadores), leva ~200 iterações — ainda assim < 1ms porque é só aritmética.

**Posição exata do jogador**: O centro do grupo é ajustado com `±5 unidades` de jitter (determinístico) para evitar que múltiplos jogadores spawnem exatamente na mesma coordenada.

#### 6.12.2 — PlayerDinosaur.tsx — Usar SpawnResolver

**Mudanças**:
1. Na montagem do componente (`useLayoutEffect` ou `useEffect` inicial), chamar `SpawnResolver.resolve(speciesId, herbivoreRoster)` para obter a posição de spawn
2. Modificar o `<group position={[0, 0, 0]}>` para usar a posição resolvida:
   ```typescript
   const spawnPos = useRef<SpawnPosition>({ worldX: 0, worldY: 0, worldZ: 0 });
   
   useLayoutEffect(() => {
     if (gameMode === 'single' || gameMode === 'global') {
       const pos = SpawnResolver.resolve(playerSpecies, HERBIVORE_ROSTER);
       spawnPos.current = { worldX: pos.worldX, worldY: 0, worldZ: pos.worldZ };
       playerRef.current?.position.set(pos.worldX, 0, pos.worldZ);
     }
     // Em Party: spawn position pode vir do pack code (ver 6.13)
   }, []);
   ```
3. A câmera (`useFrame`) deve seguir a posição do grupo, que já acontece naturalmente pois a câmera segue o `playerRef`

**IMPORTANTE**: A primeira chamada de `NPCManager.update()` captura `playerSpawnX/Z` e usa para exclusion radius (40 unidades). Se o jogador spawna em uma posição diferente de `(0,0)`, o exclusion radius se move junto — sem problemas.

#### 6.12.3 — Integração com Modos de Jogo

| Modo | Spawn |
|------|-------|
| Single | `SpawnResolver.resolve(speciesId)` → spawn próximo ao pack da espécie |
| Party (sem pack code) | `SpawnResolver.resolve(speciesId)` → todos no party spawnam perto do mesmo pack |
| Party (com pack code) | Posição do pack code (ver 6.13) |
| Global (sem pack code) | `SpawnResolver.resolve(speciesId)` |
| Global (com pack code) | Posição do pack code (ver 6.13) |

---

### 6.13 — Sistema de Código de Pack (Pack Code)

**O quê**: Na tela de seleção de dinossauro, o jogador pode opcionalmente informar um "código de pack" para spawnar próximo a um grupo específico. O código codifica `(species, chunkX, chunkZ)` — qualquer jogador com o mesmo código spawna no mesmo pack.

**Por quê**: Amigos querem cair juntos no mesmo grupo ao entrar no mesmo mundo Party/Global. O pack code serve como "ponto de encontro" determinístico.

| Arquivo | Ação |
|---------|------|
| `src/useCases/game/PackCodec.ts` | **CRIAR** |
| `src/presentation/screens/CharacterSelectionMenu.tsx` | MODIFICAR |
| `src/presentation/canvas/PlayerDinosaur.tsx` | MODIFICAR |
| `src/store/useAppStore.ts` | MODIFICAR |

#### 6.13.1 — PackCodec.ts (NOVO)

```
src/useCases/game/PackCodec.ts
```

**Formato do código**: `{ESPÉCIE}-{CX}x{CZ}` — legível por humanos, fácil de copiar.

Exemplos:
- `TRIC-3x5` → Triceratops, chunk (3, 5)
- `RAPT-0x0` → Velociraptor, chunk (0, 0)
- `APAT--2x4` → Apatossauro, chunk (-2, 4)

```typescript
const SPECIES_SHORT: Record<string, string> = {
  'TRex': 'TREX',
  'Velociraptor': 'RAPT',
  'Triceratops': 'TRIC',
  'Stegosaurus': 'STEG',
  'Parasaurolophus': 'PARA',
  'Apatosaurus': 'APAT',
};

const SHORT_TO_SPECIES: Record<string, string> = { /* inverso */ };

class PackCodec {
  static encode(speciesId: string, chunkX: number, chunkZ: number): string {
    const short = SPECIES_SHORT[speciesId] ?? speciesId.slice(0, 4).toUpperCase();
    return `${short}-${chunkX}x${chunkZ}`;
  }

  static decode(code: string): { speciesId: string; chunkX: number; chunkZ: number } | null {
    const match = code.toUpperCase().match(/^([A-Z]{3,5})-(-?\d+)x(-?\d+)$/);
    if (!match) return null;
    const [, short, cxStr, czStr] = match;
    const speciesId = SHORT_TO_SPECIES[short];
    if (!speciesId) return null;
    return {
      speciesId,
      chunkX: parseInt(cxStr, 10),
      chunkZ: parseInt(czStr, 10),
    };
  }

  /** Gera um código de pack para o jogador baseado no chunk onde ele spawnou */
  static fromSpawnPosition(speciesId: string, spawn: SpawnPosition): string {
    return PackCodec.encode(speciesId, spawn.chunkX, spawn.chunkZ);
  }
}
```

**Validação**:
- `decode()` retorna `null` para códigos mal formatados
- UI mostra erro se código inválido
- O código pode ser gerado automaticamente ao criar um Party ("Compartilhe o código do pack com seus amigos: TRIC-3x5")
- O pack code aparece no BandPanel durante o jogo para ser copiado

#### 6.13.2 — CharacterSelectionMenu.tsx — Campo de Pack Code

**Novo campo na UI**:
```
┌──────────────────────────────────────┐
│  Nome: [___________________]         │
│  Dinossauro: [Triceratops ▼]         │
│                                      │
│  Código do Pack: (opcional)          │
│  [___________________]               │
│  │ Compartilhe este código com       │
│  │ amigos para cair junto!           │
│  │ Gerar código do meu pack │        │
│                                      │
│  Seu código de pack (seu grupo):     │
│  TRIC-3x5  [Copiar]                  │
│                                      │
│  [INICIAR PARTIDA]                   │
└──────────────────────────────────────┘
```

**Comportamento**:
- **Campo opcional**: se vazio, usa `SpawnResolver.resolve(speciesId)` normalmente
- **Campo preenchido**: valida com `PackCodec.decode()`. Se válido, usa `(species, chunkX, chunkZ)` como posição de spawn. Se inválido, mostra erro.
- **Botão "Gerar código do meu pack"**: calcula o spawn para a espécie selecionada e preenche o campo com o código — útil para compartilhar com amigos
- **Seu código de pack**: mostra o código do pack onde o jogador VAI spawnar (calculado deterministicamente antes mesmo de entrar no jogo), com botão copiar
- Em **Modo Party**: o código do pack é gerado automaticamente baseado na espécie do host. Todos que entrarem na sala são redirecionados para o mesmo pack.
- Em **Modo Global**: o código do pack pode ser compartilhado via chat externo (Discord, etc.)

#### 6.13.3 — PlayerDinosaur.tsx — Spawn por Pack Code

**Lógica de posição inicial**:
```typescript
function getInitialSpawnPosition(gameMode, speciesId, packCode): SpawnPosition {
  if (packCode) {
    const decoded = PackCodec.decode(packCode);
    if (decoded && decoded.speciesId === speciesId) {
      // Spawn no centro do chunk especificado, com leve jitter
      return {
        chunkX: decoded.chunkX,
        chunkZ: decoded.chunkZ,
        worldX: decoded.chunkX * CHUNK_SIZE + CHUNK_SIZE / 2,
        worldZ: decoded.chunkZ * CHUNK_SIZE + CHUNK_SIZE / 2,
      };
    }
  }
  // Fallback: spawn determinístico
  return SpawnResolver.resolve(speciesId, HERBIVORE_ROSTER);
}
```

**IMPORTANTE**: O `packCode` é validado na tela de seleção, então ao chegar no jogo ele já é conhecido como válido. A posição `worldX, worldZ` é calculada como o centro do chunk + jitter para evitar overlap exato entre jogadores.

#### 6.13.4 — Integração com o Store

```typescript
// useAppStore.ts — novos campos
packCode: string;  // código do pack para spawn (opcional, '')
setPackCode(code: string): void;
```

---

### 6.14 — Interest Zone Adaptativo por Render Distance

**O quê**: A área de interesse para sincronização P2P (quem conectar, com quem trocar eventos) deve usar o `renderDistance` configurado pelo jogador, em vez de um valor fixo. O ambiente de rede reflete exatamente o ambiente renderizado.

**Por quê**: Um jogador com `renderDistance=5` vê 121 chunks e espera ver NPCs/jogadores sincronizados nessa área toda. Usar o mesmo raio da renderização garante consistência visual sem configuração extra.

**Já integrado em 6.2** — esta seção detalha a integração completa.

#### 6.14.1 — Fluxo de Conexão com Render Distance

```
1. Usuário configura renderDistance no menu (slider 1-6, default 2)
   → store.setRenderDistance(valor)

2. Ao entrar no Modo Global:
   → SignalingClient.sendJoin(peerId, playerName, dinoId, colors, renderDistance)
   → Servidor armazena peer com seu renderDistance
   → Servidor envia peer_list com { chunkX, chunkZ, renderDistance } para cada peer

3. PeerMesh.startGlobal() → para cada peer na peer_list:
   → Calcula chunkDistance(playerChunk, peerChunk)
   → Se distância <= player.renderDistance OU distância <= peer.renderDistance:
     → connectToPeer(peerId)  // conexão bidirecional
   → Se mais de 30 peers elegíveis: ordenar por distância, conectar os 30 mais próximos

4. Quando renderDistance muda (usuário altera slider):
   → ChunkInterestManager.updateInterestRadius()
   → PeerMesh.reconcileConnections()  // desconecta peers que saíram, conecta novos

5. PeerMesh também envia o renderDistance atual no heartbeat:
   { type: 'heartbeat', chunkX, chunkZ, tick, renderDistance }
   → Permite que peers remotos recalculem se devem manter conexão
```

#### 6.14.2 — Signaling Server — Novo Campo renderDistance

**Mudanças**:
```typescript
// Estado do servidor
interface ConnectedPeer {
  peerId: string;
  playerName: string;
  dinoId: string;
  chunkX: number;
  chunkZ: number;
  renderDistance: number;     // ← NOVO
  lastSeen: number;
  connectedAt: number;
  ws: WebSocket;
}

// Mensagem de join atualizada
type WSClientMessage =
  | { type: 'join'; peerId: string; playerName: string; dinoId: string;
      colors: Record<string, string>; renderDistance: number }  // ← NOVO campo
  | { type: 'render_distance_update'; renderDistance: number }   // ← NOVA mensagem
  | { type: 'leave' }
  | { type: 'chunk_update'; chunkX: number; chunkZ: number }
  | { type: 'heartbeat'; chunkX: number; chunkZ: number }

// Peer list inclui renderDistance
type WSServerMessage =
  | { type: 'peer_list'; peers: Array<{
      peerId, playerName, dinoId, chunkX, chunkZ, renderDistance  // ← NOVO
    }> }
  | { type: 'peer_joined'; peer: {
      peerId, playerName, dinoId, chunkX, chunkZ, renderDistance  // ← NOVO
    } }
  | ...
```

#### 6.14.3 — Exemplo de Conexão Assimétrica

```
Cenário:
- Peer A: chunk (2, 2), renderDistance=1 (vê 3×3 chunks: 1..3)
- Peer B: chunk (5, 5), renderDistance=4 (vê 9×9 chunks: 1..9)

Distância entre chunks: |5-2| + |5-2| = 6 (Manhattan)

Avaliação:
- Peer A vê peers em chunks com distância ≤ 1. B a 6 de distância → A não conecta em B
- Peer B vê peers em chunks com distância ≤ 4. A a 6 de distância → B não conecta em A
- Conexão mútua: conecta se distância ≤ renderDistance DE QUALQUER UM DOS DOIS.
  6 ≤ 1? Não. 6 ≤ 4? Não. → NENHUM conecta no outro.

OK, eles não se veem mesmo — A só vê 3 chunks, B está a 6 chunks de distância.
```

```
Cenário 2:
- Peer A: chunk (2, 2), renderDistance=1
- Peer B: chunk (3, 2), renderDistance=3 (vê 7×7 chunks: 0..6)

Distância: |3-2| + |2-2| = 1

Avaliação:
- A: distância 1 ≤ 1? Sim! → A conecta em B
- B: distância 1 ≤ 3? Sim! → B conecta em A
- Conexão estabelecida. Ambos trocam eventos.
```

```
Cenário 3 (assimétrico):
- Peer A: chunk (2, 2), renderDistance=1
- Peer B: chunk (4, 2), renderDistance=3

Distância: |4-2| + |2-2| = 2

Avaliação:
- A: distância 2 ≤ 1? Não. → A NÃO conecta em B
- B: distância 2 ≤ 3? Sim! → B conecta em A
- B inicia conexão com A. Uma vez conectados, ambos trocam eventos.
- A recebe eventos de B (ataques em NPCs), mas B não está no render de A
- Isso é desejável: B vê A na tela (render de B alcança), então B precisa dos eventos de A
```

#### 6.14.4 — Atualização em Tempo Real

Quando o jogador altera o `renderDistance` durante o jogo (via SettingsMenu):

```typescript
// SettingsMenu.tsx
onChange={(e) => {
  const newDist = parseInt(e.target.value);
  setRenderDistance(newDist);
  
  // Se estiver em modo Global/Party, notifica a rede
  if (gameMode === 'global' || gameMode === 'party') {
    signalingClient?.send({ type: 'render_distance_update', renderDistance: newDist });
    chunkInterestManager?.updateInterestRadius();
    peerMesh?.reconcileConnections();
  }
}}
```

`reconcileConnections()`:
1. Reavalia todos os peers conhecidos (global list + conectados)
2. Desconecta de peers que não estão mais no interest zone (considerando renderDistance de ambos)
3. Conecta a novos peers que entraram no interest zone
4. Mantém conexões existentes que ainda são relevantes

#### 6.14.5 — Implicações na Sincronização de NPCs

Com o interest zone baseado em render distance:
- NPCs em chunks visíveis são simulados localmente (determinístico)
- Eventos de interação são trocados com TODOS os peers no interest zone
- Quanto maior o renderDistance, mais eventos chegam (mais peers, mais NPCs visíveis)
- NPCManager já spawna NPCs em `SPAWN_RADIUS = 2` chunks (5×5 = 25 chunks). Se renderDistance > 2, NPCManager deve expandir SPAWN_RADIUS para corresponder:
  ```typescript
  // NPCManager.ts
  const SPAWN_RADIUS = Math.max(2, useAppStore.getState().renderDistance);
  ```
- NPCDespawnSystem.DESPAWN_RADIUS também deve acompanhar: `renderDistance + 1`

---

### 6.15 — Registro de Progresso das Sprints

---

#### ✅ Sprint 1 — Fundação (Concluída em 2026-05-14)

**O que foi implementado:**

| Item | Arquivo | Descrição |
|------|---------|-----------|
| 1. EventBus | `src/infrastructure/network/EventBus.ts` | Fila global de eventos P2P com push/consume/getHistory/prune. ID único por hash FNV-1a. Callback `onEventPushed` para broadcast. |
| 2. NPCManager | `src/useCases/game/NPCManager.ts` | `deterministicMode` flag, `consumeEventsFromBus()`, `applyEvent()`. SPAWN_RADIUS dinâmico via `Math.max(2, renderDistance)`. Implementa `INPCManager`. |
| 3. NPCFsmSystem | `src/useCases/game/systems/NPCFsmSystem.ts` | Parâmetro opcional `peerPresenceInChunk`. Player visibility combinada com presença no chunk. Cálculo de `npcChunkX/Z`. |
| 4. ChunkInterestManager | `src/infrastructure/network/ChunkInterestManager.ts` | Interesse radial por renderDistance. Hard cap 30 conexões. Conexão bidirecional. `worldToChunk()`. |
| 5. SpawnResolver | `src/useCases/game/SpawnResolver.ts` | Spawn determinístico em anéis concêntricos. Busca packs da espécie longe de predadores/água. Fallback `(0,0)` com jitter. |
| 6. PackCodec | `src/useCases/game/PackCodec.ts` | Encode/decode `ESPÉCIE-CxZ` (ex: `TRIC-3x5`). 6 espécies mapeadas. |
| 7. CombatSystem | `src/useCases/game/CombatSystem.ts` | `playerAttackNPCWithEvent()` — dano local + evento EventBus. |
| 8. Store | `src/store/useAppStore.ts` | Novo estado: `packCode`, `signalingStatus`, `globalPlayerCount`. GameMode expandido. |
| 9. Interface | `src/domain/interfaces/INPCManager.ts` | Interface completa do NPCManager. |

**Bug corrigido (pós-sprint):**
- **NPCDinosaurs.tsx**: NPC simulation só rodava quando `onlineRole === 'host'`. Em single player (`onlineRole === null`), `NPCManager.update()` nunca era chamado → nenhum NPC spawnava. Fix: a simulação agora roda para ambos host e single player (o bloco `client` retorna cedo, então só chegam `host`/`null`).

**Status do build:** `npm run build` ✅ | `npm run lint` ✅

---

#### Sprint 2 — PeerMesh (Modo Party) (PRÓXIMA)

**O que implementar:**

1. **`PeerMesh.ts`** — Classe que gerencia N conexões DataChannel simultâneas:
   - `startParty(sessionCode?)` — modo Party com mesh completo (todos conectados)
   - `connectToPeer()`, `disconnectFromPeer()`, `onPeerDisconnected()`
   - Heartbeat a cada 5s, timeout de 15s para desconexão
   - Integrar `ChunkInterestManager.onChunkChanged` para reconexão automática
   - `broadcastEvent(event)` e `sendEventToPeers(event, peerIds)`

2. **`EventReplicator.ts`** — Camada entre EventBus e PeerMesh:
   - Conectar `EventBus.onEventPushed` ao `PeerMesh.broadcastEvent()`
   - Recebimento/validação/deduplicação de eventos remotos
   - History request (pedir eventos perdidos ao conectar)
   - Gap detection (detectar ticks perdidos no heartbeat)

3. **Reescrever `messages.ts`** — Novo protocolo simétrico:
   ```typescript
   type PeerMeshMessage =
     | { type: 'event'; event: GameEvent }
     | { type: 'player_state'; peerId, posX, posY, posZ, rotY, health, maxHealth, isDead, animationIntent, level, scale }
     | { type: 'peer_handshake'; playerName, dinoId, colors, chunkX, chunkZ, tick }
     | { type: 'peer_handshake_ack'; playerName, dinoId, colors, chunkX, chunkZ, tick }
     | { type: 'heartbeat'; chunkX, chunkZ, tick }
     | { type: 'event_history_request'; sinceTick: number }
     | { type: 'event_history_response'; events: GameEvent[] }
   ```

4. **Party + Pack Code**: Todos no mesmo Party spawnam perto do pack do host.
   - Host gera pack code automaticamente
   - Clients recebem pack code no handshake

**Antes de começar a Sprint 2:**
- `EventBus.setOwnPeerId()` deve ser chamado após conexão com PeerJS
- `NPCManager.setDeterministicMode(true)` ao entrar em Party
- Usar `playerAttackNPCWithEvent()` em vez de `playerAttackNPC()` para ataques em modo Party/Global
- Revisar testes single player com spawn perto de pack (SpawnResolver + PackCodec)

---

#### Sprint 3 — Signaling Server + Modo Global
(conteúdo mantido)

**O que implementar:**
1. `server/signaling-server.ts` — incluir renderDistance nos peer records
2. `SignalingClient.ts` — enviar renderDistance no join + render_distance_update
3. `PeerMesh.startGlobal()` — interesse bidirecional (minha RD OU peer RD)
4. `reconcileConnections()` — reconexão dinâmica quando renderDistance muda
5. Integração SpawnResolver + PackCodec no Global: pack code opcional
6. Testar: 3 peers com renderDistances diferentes

---

#### Sprint 4 — UI + Finalização
(conteúdo mantido)

Sobre sua pergunta
> "Se jogar um modo party sem convidar ninguém seria considerado um modo offline?"
Sim, faz sentido. Um Party sem outros jogadores é funcionalmente single player. Na Sprint 4 (UI), podemos tratar Party solo como "Modo Offline" — ou adicionar um toggle. Deixo para decidirmos quando chegarmos lá.

**O que implementar:**
1. `SessionSelectScreen.tsx` — 3 modos (Global, Party, Single)
2. `CharacterSelectionMenu.tsx` — + campo pack code, + botão gerar código
3. `BandPanel.tsx` — + mostrar pack code atual, + copiar
4. `GameScreen.tsx` — remover host transfer
5. `useAppStore.ts` — novo estado + packCode (✅ já feito no Sprint 1)
6. `PlayerDinosaur.tsx` — spawn position via SpawnResolver ou pack code
7. Remover arquivos legados: PeerHost.ts, PeerClient.ts, PeerSession.ts, NpcSnapshotInterpolator.ts
8. Testar: todos os modos + pack codes + render distance dinâmico