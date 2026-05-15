# Plano: Modo Global Puramente P2P (sem servidor de signaling)

## 1. Análise — P2P Puro no Modo Global

### 1.1 O que mudaria

Remover dependência do servidor WebSocket (`SignalingClient.ts` + `server/signaling-server.ts`) e substituir a descoberta de peers por um mecanismo P2P nativo usando apenas o broker do PeerJS (`0.peerjs.com`).

**Arquitetura atual (Global):**

```
   [Jogador A] ←WebSocket→ [Signaling Server] ←WebSocket→ [Jogador B]
       ↓                        ↓                        ↓
   PeerJS("0.peerjs.com")   (só gerencia salas)   PeerJS("0.peerjs.com")
       ↓                                                ↓
   WebRTC DataChannel ←──────────────────────────── WebRTC DataChannel
```

**Arquitetura proposta (Global P2P):**

```
   [Jogador A] ←WebRTC→ [Jogador B]
       ↓                    ↓
   PeerJS("0.peerjs.com")   PeerJS("0.peerjs.com")
       ↓                    ↓
   Broker cloud descobre peers pelo mesmo "room ID"
```

O conceito de "sala global" vira um **room ID fixo** (ex: `chomp3d-global-v1`). Todos que entrarem nesse room se conectam entre si — semelhante ao Party, mas com um código fixo e público.

### 1.2 O que precisa ser alterado

| Componente | Mudança |
|---|---|
| `PeerMesh.ts` | `startGlobal()` deixa de usar `SignalingClient`. Usa `startParty('chomp3d-global')` com um sessionCode fixo. |
| `SignalingClient.ts` | Removido ou movido para legacy. Nenhum arquivo o importa mais. |
| `server/signaling-server.ts` | Opcional — pode ser mantido para deploy opcional, mas não é mais necessário. |
| `CharacterSelectionMenu.tsx` | Remove `startGlobal()` com signalingUrl. Substitui por `startParty('chomp3d-global-v1')`. |
| `SessionSelectScreen.tsx` | Remove health check do WebSocket. Modo Global sempre fica "online". Remove botão desabilitado. |
| `.env` | `VITE_SIGNALING_URL` deixa de ser usada. |
| `useAppStore.ts` | `signalingStatus` e `globalPlayerCount` podem ser removidos ou adaptados. |

### 1.3 Como funcionaria a descoberta de peers

O PeerJS já usa um broker público (`0.peerjs.com`) que faz a negociação WebRTC. O fluxo:

1. **Jogador A** cria um Peer com ID fixo da sala: `new Peer('chomp3d-global-v1')` (modo host)
2. **Jogador B** cria um Peer com ID aleatório: `new Peer(generatePeerId())`
3. **Jogador B** conecta em **Jogador A** via: `peer.connect('chomp3d-global-v1')`
4. **Jogador A** recebe conexão, envia handshake, e reencaminha lista de peers (igual ao Party já faz)
5. **Jogador B** recebe `peer_list` e conecta diretamente nos outros peers

Isso é EXATAMENTE o que o modo Party já faz. O Global seria um Party com código fixo.

### 1.4 Limitações do PeerJS broker público

| Limitação | Impacto |
|---|---|
| **Broker centralizado** | `0.peerjs.com` pode ficar offline. Sem fallback. |
| **Limite de peers** | PeerJS não documenta limite explícito, mas conexões em mesh O(n²) degradam. ~30 peers simultâneos é viável. |
| **Sem persistência** | Se o host (primeiro peer) sai, o room morre — ninguém mais consegue entrar. Solução: eleger novo host via heartbeat ou usar room ID fixo compartilhado. |
| **NAT traversal** | PeerJS usa STUN/TURN do Google. Algumas redes corporativas bloqueiam WebRTC. |
| **Sem moderação** | Qualquer um pode entrar. Sem ban/kick sem implementação própria na camada de aplicação. |

### 1.5 Funciona no GitHub Pages?

**Sim, perfeitamente.** O PeerJS broker está em `0.peerjs.com:443` (HTTPS/WSS). O GitHub Pages:

- ✅ Serve arquivos estáticos → o bundle com PeerJS roda
- ✅ HTTPS → `0.peerjs.com` também é HTTPS → sem mixed content
- ✅ WebRTC DataChannel → não precisa de servidor próprio
- ✅ PeerJS cloud broker → descoberta de peers funciona
- ✅ Sem custom signaling → sem `ws://` bloqueado

O modo Global se torna **funcionalmente idêntico ao Party** em termos de infraestrutura.

---

## 2. Plano de Implementação — Pack/Bando (Gerenciamento de Jogadores)

No modo Global, o jogador poderá formar um "Pack" (bando) com outros jogadores. O líder do pack pode convidar, aceitar e expulsar membros.

### 2.1 Conceito

- **Pack**: grupo de jogadores que compartilham o mesmo chunk de spawn
- **Leader**: primeiro membro do pack (criador)
- **Members**: jogadores que aceitaram convite
- **Convite**: código compartilhado ou solicitação direta via UI

### 2.2 Fluxo de Convite

```
[Jogador A - Líder]                    [Jogador B]
       |                                     |
   Abre UI do Pack                       Abre UI do Pack
       |                                     |
   Gera código do pack                   Vê código do pack
       |                                     |
   Envia código p/ B ------------>     Digita código
       |                                     |
   B clica "Solicitar Entrada" -----> A recebe solicitação
       |                                     |
   A aceita/rejeita                     Notificado
       |                                     |
   B adicionado ao pack               Faz parte do pack
```

### 2.3 Estados do Pack

| Estado | Descrição |
|---|---|
| `solo` | Jogador sem pack |
| `leading` | Jogador criou pack (líder) |
| `member` | Jogador entrou em pack de outro |
| `pending_invite` | Jogador recebeu convite (aguardando resposta) |
| `pending_request` | Líder recebeu solicitação (aguardando resposta) |

### 2.4 Mensagens P2P necessárias

Adicionar ao `messages.ts`:

```typescript
// Pack/Group management messages
export type PackInviteMessage = {
  type: 'pack_invite';
  fromPeerId: string;
  packCode: string;
};

export type PackInviteResponse = {
  type: 'pack_invite_response';
  fromPeerId: string;
  accept: boolean;
};

export type PackJoinRequest = {
  type: 'pack_join_request';
  fromPeerId: string;
  playerName: string;
  dinoId: string;
};

export type PackJoinResponse = {
  type: 'pack_join_response';
  fromPeerId: string;
  accept: boolean;
};

export type PackKickMessage = {
  type: 'pack_kick';
  targetPeerId: string;
};

export type PackMemberUpdate = {
  type: 'pack_member_update';
  members: PackMember[];
};

export type PackLeaveMessage = {
  type: 'pack_leave';
  peerId: string;
};
```

### 2.5 UI — HUD do Pack

No canto inferior direito da tela de jogo (modo Global), exibir:

```
┌──────────────────────┐
│ 🦕 MEU BANDO       │
│ ─────────────────── │
│ 👑 T-Rex_Matador    │ ← líder (você ou outro)
│ 🦕 Raptor_Pro        │
│ 🦕 Trike_Tank        │
│                      │
│ [Convidar] [Sair]   │
│ (se líder: [Expulsar])│
└──────────────────────┘
```

### 2.6 Notificações

- Convite recebido → toast no canto: "Jogador X quer entrar no seu bando [Aceitar] [Recusar]"
- Expulso do bando → toast: "Você foi removido do bando"
- Membro entrou/saiu → toast: "X entrou no bando" / "X saiu do bando"
- Líder saiu → novo líder eleito OU bando dissolvido

### 2.7 Store — Novos campos no Zustand

```typescript
// Pack state
packRole: 'solo' | 'leading' | 'member';
packLeader: string | null; // peerId do líder
packMembers: PackMemberEntry[];
packInvites: PackInvite[];   // solicitações pendentes (líder vê)
packRequests: PackRequest[]; // solicitações feitas por outros
```

---

## 3. Plano de Implementação — Menu Unificado

### 3.1 Problema Atual

O `MainMenu.tsx` tem **dois caminhos para jogar offline**:
1. Botão "Jogar Online" → `SessionSelectScreen` → que tem "Single Player" (outro botão de Offline)
2. Botão "Jogar Offline" → vai direto pro `CharacterSelectionMenu` com `gameMode = 'single'`

Isso duplica a entrada de Single Player.

### 3.2 Proposta

```
┌─────────────────────────┐
│       CHOMP 3D          │
│   Eat to evolve         │
│                         │
│   ┌─────────────────┐   │
│   │     JOGAR       │   │  ← Único botão principal
│   └─────────────────┘   │
│   ┌─────────────────┐   │
│   │   CONFIGURAÇÕES  │   │
│   └─────────────────┘   │
└─────────────────────────┘

        ↓ clicou JOGAR

┌─────────────────────────┐
│   Voltar                │
│                         │
│   Escolha o modo:       │
│                         │
│   🌍  Mundo Global      │
│   (jogadores do mundo)  │
│                         │
│   👥  Party Local       │
│   (amigos com código)   │
│                         │
│   🦖  Offline           │
│   (sozinho)             │
│                         │
│   ┌─────────────────┐   │
│   │   [Selecionar]  │   │
│   └─────────────────┘   │
└─────────────────────────┘
```

### 3.3 Mudanças necessárias

**`MainMenu.tsx`**:
- Botão "Jogar Online" vira "Jogar" → `screen = 'session-select'`
- Botão "Jogar Offline" removido
- Botão "Configurações" mantido

**`SessionSelectScreen.tsx`**:
- Renomear para `ModeSelectScreen` ou similar
- Remover card "Single Player" — substituir por opção inline
- Remover completamente o health check WebSocket se for Global P2P
- Se mantiver Global com signaling, pelo menos remover Single Player daqui

**`CharacterSelectionMenu.tsx`**:
- Tratar `gameMode === 'single'` para ir direto sem config pack/online

### 3.4 Eliminar duplicação de rotas

Atualmente:
- `menu` → `session-select` → `character-select` → `game` (online/global)
- `menu` → `character-select` → `game` (single)

Com a unificação:
- `menu` → `mode-select` → `character-select` → `game` (todos os modos)

O single também passa pelo `mode-select` mas seleciona "Offline" e vai para `character-select` sem opções de pack/multiplayer.

### 3.5 Tela de Modo Select (substitui SessionSelectScreen)

```
┌──────────────────────────────┐
│  ← Voltar                    │
│                              │
│  ESCOLHA SEU MODO            │
│                              │
│  ┌───🌍 MUNDO GLOBAL─────┐  │
│  │ Mundo compartilhado    │  │
│  │ com todos jogadores    │  │
│  │ [ SELECIONAR ]         │  │
│  └────────────────────────┘  │
│                              │
│  ┌───👥 PARTY LOCAL──────┐  │
│  │ Crie ou entre em       │  │
│  │ sessão com amigos      │  │
│  │ [ CRIAR ] [ ENTRAR ]   │  │
│  └────────────────────────┘  │
│                              │
│  ┌───🦖 OFFLINE──────────┐  │
│  │ Jogue sozinho sem      │  │
│  │ conexão com outros     │  │
│  │ [ JOGAR SOZINHO ]      │  │
│  └────────────────────────┘  │
└──────────────────────────────┘
```

---

## 4. Riscos e Mitigações

### Risco 1: PeerJS broker cair (raro mas possível)
- **Mitigação**: Se `0.peerjs.com` ficar offline, Party e Global quebram juntos. Offline continua funcionando. Pode-se adicionar fallback para self-hosted PeerJS server no futuro.

### Risco 2: Limite de peers no mesh global
- **Mitigação**: Já existe `ChunkInterestManager` que limita conexões por chunk. Manter cap de 30 conexões simultâneas.

### Risco 3: Líder do global sair e ninguém conseguir entrar
- **Mitigação**: Usar PeerJS com ID fixo `chomp3d-global-v1` e tratar conflito: se alguém tentar criar com ID já em uso, tratar como "sala cheia" e tentar reconectar como cliente.

### Risco 4: Mixed content (`ws://` em GitHub Pages HTTPS)
- **Mitigação**: Eliminado com a remoção do signaling server. PeerJS usa `wss://` no broker.

### Risco 5: Abuso no bando (kick infinito, spam de convite)
- **Mitigação**: Rate limiting de convites (1 a cada 5s). Apenas o líder expulsa.

---

## 5. Checklists de Implementação

### Fase 1 — Global P2P (sem signaling) ✅ Implementada
- [x] Remover `SignalingClient.ts` ou marcar como obsoleto — *mantido como legado, não importado*
- [x] Alterar `PeerMesh.startGlobal()` para P2P puro com `GLOBAL_ROOM_CODE = 'chomp3d-global-v1'`
- [x] Ajustar `CharacterSelectionMenu.tsx` — remover signalingUrl e `signalingStatus`
- [x] Remover health check WebSocket de `SessionSelectScreen.tsx`
- [x] Remover `signalingStatus` e `globalPlayerCount` da store
- [x] Remover `_connectToInterestPeers` e `_connectToRemotePeer` (dead code)
- [x] Atualizar `BandPanel.tsx` para usar `totalPlayers` em vez de `globalPlayerCount`
- [ ] Testar Party + Global em paralelo (devem funcionar de forma idêntica)
- [ ] (Opcional) Remover `.env` e `VITE_SIGNALING_URL`
- [ ] (Opcional) Deixar `server/signaling-server.ts` como legado mas não linkado

### Fase 2 — Pack/Bando UI ✅ Implementada
- [x] Adicionar tipos de mensagens de pack em `messages.ts` — `PackInviteMessage`, `PackInviteResponseMessage`, `PackJoinRequestMessage`, `PackJoinResponseMessage`, `PackKickMessage`, `PackMemberUpdateMessage`, `PackLeaveMessage`
- [x] Implementar handlers de pack em `PeerMesh.ts` — `createPack()`, `inviteToPack()`, `respondToPackInvite()`, `requestJoinPack()`, `respondToPackJoinRequest()`, `kickFromPack()`, `leavePack()`
- [x] Adicionar estado de pack no Zustand — `packRole`, `packMembers`, `packLeaderPeerId`, `setPackRole`, `setPackMembers`, `setPackLeaderPeerId`
- [x] Criar componente `PackHUD.tsx` (overlay no jogo) — lista membros, líder pode convidar/expulsar, membro pode sair
- [x] Criar componente `PackInviteToast.tsx` — notificações toast com Aceitar/Recusar
- [x] Adicionar toggle "Criar Bando ao entrar" na `CharacterSelectionMenu`
- [x] Adicionar lógica de aceitar/recusar convite
- [x] Adicionar lógica de kick (apenas líder)
- [x] Notificações de entrada/saída, convite recebido, expulsão, membro removido

### Fase 3 — Menu Unificado ✅ Implementada
- [x] Remover botão "Jogar Offline" do `MainMenu.tsx`
- [x] Apenas "Jogar" + "Configurações" no menu principal
- [x] Remover card Single Player do `SessionSelectScreen`
- [x] Adicionar "Offline" como opção inline (separador + botão compacto)
- [x] `handleBack` no `CharacterSelectionMenu` sempre volta ao session-select
- [x] Navegação unificada: `menu → session-select → character-select → game`

---

## 6. Resumo

A migração do Global para P2P puro (usando o broker do PeerJS) **resolve o problema do GitHub Pages**, elimina a necessidade de um servidor de signaling, simplifica a arquitetura e unifica os modos Party e Global. A contrapartida é perder o controle centralizado de peers (moderação, anti-spam, estatísticas), mas para um protótipo isso é aceitável.

O gerenciamento de Pack/Bando adiciona a funcionalidade social solicitada, permitindo que jogadores formem grupos dentro do mundo global.

O menu unificado elimina a duplicação e simplifica a experiência do usuário.
