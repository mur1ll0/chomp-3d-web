# Backlog Executavel de Correcoes e Adequacoes de Arquitetura

Objetivo: transformar os achados de review em um plano pratico de execucao, com foco em arquitetura, SOLID, Strategy Pattern e preparacao real para multiplayer PeerJS.

Status atual resumido:
- Fases 1-3 funcionais em modo offline.
- Modo online ainda e apenas estado de UI.
- Ha debt arquitetural no nucleo da simulacao (acoplamento com store/UI) e pontos de nao determinismo.

## Como executar
- Ordem recomendada: E0 -> E1 -> E2 -> E3 -> E4 -> E5.
- Nao iniciar E5 (rede) sem concluir E1 + E2 + E3.
- Cada item abaixo ja inclui arquivos-alvo e criterio de aceite.

## E0 - Correcao rapida de bugs e higiene tecnica (alta prioridade) [OK]

Status:
- [OK] Sprint 1 (E0) concluido em 2026-05-12.
- [OK] Sprint 1.1 (lint global zerado) concluido em 2026-05-12.

### E0.1 Corrigir bug de carcara/alvo de comida no NPC [OK]
Arquivos:
- [src/useCases/game/NPCManager.ts](../src/useCases/game/NPCManager.ts)

Alterar:
- Ajustar a condicao de entrada no estado Eating para permitir consumo de alvo Meat vindo de NPC morto (id de NPC), sem bloquear por prefixo de id.
- Garantir que carnivoros consigam consumir:
  - Meat estatico do mapa
  - carcaca de NPC morto

Criterio de aceite:
- NPC carnivoro consome carcaca de NPC morto e reduz edibleState corretamente.
- NPC nao fica preso em estado Hunting com alvo morto nao consumido.

### E0.2 Corrigir acesso indevido a ref durante render no ambiente dinamico [OK]
Arquivos:
- [src/presentation/canvas/DynamicEnvironment.tsx](../src/presentation/canvas/DynamicEnvironment.tsx)

Alterar:
- Remover acesso a lightRef.current no JSX de render.
- Definir sunPosition inicial estavel (constante) e atualizar somente no useFrame.
- Remover any do skyRef com tipagem adequada quando possivel.

Criterio de aceite:
- npm run lint sem erro de "Cannot access refs during render".
- Cena continua com ciclo dia/noite funcionando.

### E0.3 Fechar warnings/erros de lint de variaveis nao usadas [OK]
Arquivos:
- [src/domain/logic/DinosaurLogic.ts](../src/domain/logic/DinosaurLogic.ts)
- [src/domain/strategies/CarnivoreStrategy.ts](../src/domain/strategies/CarnivoreStrategy.ts)
- [src/domain/strategies/HerbivoreStrategy.ts](../src/domain/strategies/HerbivoreStrategy.ts)
- [src/presentation/canvas/DynamicEnvironment.tsx](../src/presentation/canvas/DynamicEnvironment.tsx)

Alterar:
- Remover variaveis mortas ou ajustar parametros para refletir uso real.
- Evitar silenciar lint sem justificativa tecnica.

Criterio de aceite:
- npm run lint passando nesses arquivos.

## E1 - Desacoplamento de arquitetura (Clean + SOLID no nucleo)

### E1.1 Separar simulacao de jogo da store/UI [OK]
Arquivos:
- [src/useCases/game/NPCManager.ts](../src/useCases/game/NPCManager.ts)
- [src/store/useAppStore.ts](../src/store/useAppStore.ts)
- [src/presentation/canvas/NPCDinosaurs.tsx](../src/presentation/canvas/NPCDinosaurs.tsx)
- [src/presentation/canvas/PlayerDinosaur.tsx](../src/presentation/canvas/PlayerDinosaur.tsx)

Criar:
- [src/useCases/game/contracts/IGameStateGateway.ts](../src/useCases/game/contracts/IGameStateGateway.ts)
- [src/useCases/game/contracts/IWorldQueryGateway.ts](../src/useCases/game/contracts/IWorldQueryGateway.ts)
- [src/infrastructure/adapters/ZustandGameStateGateway.ts](../src/infrastructure/adapters/ZustandGameStateGateway.ts)
- [src/infrastructure/adapters/MapWorldQueryGateway.ts](../src/infrastructure/adapters/MapWorldQueryGateway.ts)

Alterar:
- NPCManager deixa de chamar useAppStore.getState() diretamente.
- Injetar gateways no construtor/setup do NPCManager.
- Presentation monta dependencias concretas e injeta no inicio da partida.

Criterio de aceite:
- NPCManager sem import direto de zustand/store.
- Simulacao roda com gateways mockaveis em teste unitario.

Status:
- [OK] Implementado em 2026-05-12 com contratos e adapters injetados na composicao da cena.

### E1.2 Dividir responsabilidades do NPCManager (SRP) [OK]
Arquivos:
- [src/useCases/game/NPCManager.ts](../src/useCases/game/NPCManager.ts)

Criar:
- [src/useCases/game/systems/NPCSpawnSystem.ts](../src/useCases/game/systems/NPCSpawnSystem.ts)
- [src/useCases/game/systems/NPCFsmSystem.ts](../src/useCases/game/systems/NPCFsmSystem.ts)
- [src/useCases/game/systems/NPCMovementSystem.ts](../src/useCases/game/systems/NPCMovementSystem.ts)
- [src/useCases/game/systems/NPCDespawnSystem.ts](../src/useCases/game/systems/NPCDespawnSystem.ts)

Alterar:
- NPCManager vira orquestrador de sistemas, sem regras detalhadas internas.

Criterio de aceite:
- Cada sistema com responsabilidade unica e API clara.
- Reducao significativa de complexidade ciclomatica em NPCManager.

Status:
- [OK] Implementado em 2026-05-12 com sistemas dedicados para spawn, despawn, FSM e movimento, mantendo lint/build verdes.

## E2 - Strategy Pattern adequado por comportamento (foco principal)

Problema atual:
- Strategy hoje esta focada no "tipo de dieta" (Carnivore/Herbivore), mas ainda concentra regras diferentes no mesmo objeto e mantem ifs de estado fora da estrategia.

Objetivo:
- Evoluir para estrategia composicional por comportamento atomico (policy-based AI).

### E2.1 Introduzir politicas de comportamento [OK]
Arquivos atuais:
- [src/domain/interfaces/IBehaviorStrategy.ts](../src/domain/interfaces/IBehaviorStrategy.ts)
- [src/domain/strategies/CarnivoreStrategy.ts](../src/domain/strategies/CarnivoreStrategy.ts)
- [src/domain/strategies/HerbivoreStrategy.ts](../src/domain/strategies/HerbivoreStrategy.ts)

Criar:
- [src/domain/interfaces/IThreatPolicy.ts](../src/domain/interfaces/IThreatPolicy.ts)
- [src/domain/interfaces/IFoodTargetPolicy.ts](../src/domain/interfaces/IFoodTargetPolicy.ts)
- [src/domain/interfaces/IMovementPolicy.ts](../src/domain/interfaces/IMovementPolicy.ts)
- [src/domain/interfaces/ICombatPolicy.ts](../src/domain/interfaces/ICombatPolicy.ts)
- [src/domain/strategies/policies/CarnivoreThreatPolicy.ts](../src/domain/strategies/policies/CarnivoreThreatPolicy.ts)
- [src/domain/strategies/policies/HerbivoreThreatPolicy.ts](../src/domain/strategies/policies/HerbivoreThreatPolicy.ts)
- [src/domain/strategies/policies/CarnivoreFoodTargetPolicy.ts](../src/domain/strategies/policies/CarnivoreFoodTargetPolicy.ts)
- [src/domain/strategies/policies/HerbivoreFoodTargetPolicy.ts](../src/domain/strategies/policies/HerbivoreFoodTargetPolicy.ts)
- [src/domain/strategies/factories/NpcBehaviorFactory.ts](../src/domain/strategies/factories/NpcBehaviorFactory.ts)

Alterar:
- Trocar IBehaviorStrategy monolitica por composicao de politicas.
- Factory monta o comportamento final por especie/perfil, nao apenas por dieta.

Criterio de aceite:
- Sem if principal por dieta dentro do loop de update.
- Possivel criar nova especie/comportamento sem editar classe existente (OCP).

Status:
- [OK] Implementado em 2026-05-12 com composicao de politicas (threat/food/movement/combat) e factory por especie/perfil.

### E2.2 Levar decisoes de perseguicao/fuga para politicas [OK]
Arquivos:
- [src/useCases/game/systems/NPCFsmSystem.ts](../src/useCases/game/systems/NPCFsmSystem.ts)
- [src/useCases/game/systems/NPCMovementSystem.ts](../src/useCases/game/systems/NPCMovementSystem.ts)

Alterar:
- FSM consulta politicas para decidir threat, alvo, velocidade e intencao de animacao.
- Evitar regras de carnivoro/herbivoro hardcoded no sistema.

Criterio de aceite:
- Sistema de FSM opera sobre interfaces, nao sobre tipos concretos.

Status:
- [OK] Implementado em 2026-05-12 com NPCFsmSystem e NPCMovementSystem consumindo politicas via IBehaviorStrategy.

## E3 - Determinismo e base de sincronizacao para multiplayer

### E3.1 Remover Math.random do loop de simulacao [OK]
Arquivos:
- [src/useCases/game/NPCManager.ts](../src/useCases/game/NPCManager.ts)
- [src/useCases/game/systems/NPCFsmSystem.ts](../src/useCases/game/systems/NPCFsmSystem.ts)

Criar:
- [src/domain/interfaces/IRandomProvider.ts](../src/domain/interfaces/IRandomProvider.ts)
- [src/infrastructure/random/SeededRandomProvider.ts](../src/infrastructure/random/SeededRandomProvider.ts)

Alterar:
- Toda aleatoriedade de IA vira PRNG seeded por worldSeed + npcId + tick.

Criterio de aceite:
- Mesmo seed + mesmos inputs => mesma saida por tick.

Status:
- [OK] Implementado em 2026-05-12 com IRandomProvider/SeededRandomProvider e PRNG seeded por worldSeed + npcId + tick no fluxo de decisao da IA.

### E3.2 Introduzir tick fixo de simulacao [OK]
Arquivos:
- [src/presentation/canvas/NPCDinosaurs.tsx](../src/presentation/canvas/NPCDinosaurs.tsx)
- [src/useCases/game/NPCManager.ts](../src/useCases/game/NPCManager.ts)

Alterar:
- Rodar simulacao em fixed timestep (ex: 20Hz ou 30Hz) com acumulador.
- Render continua em frame rate livre.

Criterio de aceite:
- Simulacao estavel em FPS variavel sem "speedup/slowdown" da IA.

Status:
- [OK] Implementado em 2026-05-12 com fixed timestep de 20Hz em NPCDinosaurs (acumulador + substeps), mantendo render em frame rate livre.

## E4 - Performance e estabilidade de FPS

### E4.1 Implementar eviction no cache de chunks [OK]
Arquivos:
- [src/infrastructure/generation/MapGenerator.ts](../src/infrastructure/generation/MapGenerator.ts)

Alterar:
- Adicionar limite de chunkCache e estrategia de remocao (LRU por distancia/recencia).
- Expor metricas basicas de cache para debug.

Criterio de aceite:
- Memoria estabiliza em sessao longa (>30 min).

Status:
- [OK] Implementado em 2026-05-12 com limite de chunkCache, eviction por distancia+recencia e metricas de cache (hits/misses/evictions/tamanho).

### E4.2 Revisar frustum culling e custos de render [OK]
Arquivos:
- [src/presentation/canvas/ProceduralMap.tsx](../src/presentation/canvas/ProceduralMap.tsx)
- [src/presentation/canvas/EdiblesManager.tsx](../src/presentation/canvas/EdiblesManager.tsx)
- [src/presentation/canvas/NPCDinosaurs.tsx](../src/presentation/canvas/NPCDinosaurs.tsx)

Alterar:
- Reabilitar culling onde possivel.
- Manter frustumCulled=false somente onde houver bug comprovado.
- Em EdiblesManager, clamping de count por capacidade de instancias.

Criterio de aceite:
- Menor custo de draw calls em camera apontando para area vazia.
- Sem erro de acesso fora da capacidade de instancias.

Status:
- [OK] Implementado em 2026-05-12 com culling reabilitado em instanced meshes de mapa/edibles, bounds recalculados e clamping de instancias no EdiblesManager.

### E4.3 Reduzir re-renderes desnecessarios de UI [OK]
Arquivos:
- [src/App.tsx](../src/App.tsx)

Alterar:
- Trocar assinatura ampla da store por selector especifico de currentScreen.

Criterio de aceite:
- Mudancas de estado de gameplay nao rerenderizam App inteiro.

Status:
- [OK] Implementado em 2026-05-12 com selector especifico de currentScreen em App.

## E5 - Fundacao de multiplayer PeerJS (apos E1-E3)

### E5.1 Camada de rede host/client
Criar:
- [src/infrastructure/network/PeerSession.ts](../src/infrastructure/network/PeerSession.ts)
- [src/infrastructure/network/PeerHost.ts](../src/infrastructure/network/PeerHost.ts)
- [src/infrastructure/network/PeerClient.ts](../src/infrastructure/network/PeerClient.ts)
- [src/infrastructure/network/messages.ts](../src/infrastructure/network/messages.ts)

Alterar:
- [src/store/useAppStore.ts](../src/store/useAppStore.ts)
- [src/presentation/screens/MainMenu.tsx](../src/presentation/screens/MainMenu.tsx)
- [src/presentation/screens/CharacterSelectionMenu.tsx](../src/presentation/screens/CharacterSelectionMenu.tsx)
- [src/presentation/screens/GameScreen.tsx](../src/presentation/screens/GameScreen.tsx)

Alterar detalhes:
- Fluxo real de criar/entrar sessao.
- Estado de conexao e erros de rede.
- Troca de mensagens padronizadas (snapshot, input, join/leave, ping).

Criterio de aceite:
- 2 jogadores conectam por codigo de sessao e enxergam estado sincronizado.

### E5.2 Autoridade do host e interpolacao no client
Arquivos:
- [src/useCases/game/NPCManager.ts](../src/useCases/game/NPCManager.ts)
- [src/presentation/canvas/NPCDinosaurs.tsx](../src/presentation/canvas/NPCDinosaurs.tsx)

Criar:
- [src/useCases/game/network/NpcSnapshotInterpolator.ts](../src/useCases/game/network/NpcSnapshotInterpolator.ts)

Alterar:
- Host: roda update de IA/combate e publica snapshots.
- Client: nao executa update autoritativo de NPC, apenas aplica snapshots interpolados.

Criterio de aceite:
- Sem "teleporte" evidente em NPCs sob jitter moderado.
- Estado final converge para o do host.

## Ordem de execucao sugerida por sprint
- Sprint 1: E0 completo.
- Sprint 2: E1.1 + E1.2.
- Sprint 3: E2.1 + E2.2.
- Sprint 4: E3.1 + E3.2.
- Sprint 5: E4 completo.
- Sprint 6: E5.1 + E5.2.

## Checklist de validacao por etapa
- Lint: npm run lint
- Build: npm run build
- Regressao funcional: mover, comer, atacar, morrer, respawn de recursos
- Performance: comparar FPS medio e frame time antes/depois
- Determinismo (E3): mesmo seed + mesmo input reproduz mesmo resultado

## Observacao importante sobre escopo
Nem todo item precisa ser feito em uma unica sessao. Este backlog foi escrito para permitir execucao incremental e retomada com contexto limpo, sem perder o fio da arquitetura alvo.