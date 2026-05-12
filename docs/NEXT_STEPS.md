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

## Fase Pré-4: Ajustes finos antes da implementação
- **Visão dos NPCs**: Quando um dinossauro esta atacando outro, se durante a animação das costas você se mover para as costas dele, ele perde você de vista e não ataca mais. Adicionar um estado de perdeu de vista aonde elel tenta girar 360 graus a redor dele para ver se o dino que ele atacou ainda esta ao redor dele. Aumente também o code de visão para ser um pouco mais largo (deve permitir uma visão lateral e não somente frontal).
- **Desempenho**: Verifique possível problemas que causem drop de FPS, algum cache, ou trechos de código desnecessários, ou até mesmo problemas com recursos assíncronos. Garanta que o jogo esteja flúido e não tenha "engasgos".

## Fase 4: A Conexão P2P (Multiplayer)
- [ ] **Integração WebRTC**: Iniciar as classes de rede baseadas no PeerJS na pasta `infrastructure/network`.
- [ ] **Sessão (Bandos)**: Criar a UI para gerar ou inserir um "Código de Bando" (Session ID).
- [ ] **Sincronização**: Sincronizar em tempo real a posição (X, Y, Z), Rotação e Estados de Animação entre os clientes conectados.
- [ ] **Arquitetura Host-Client**: Fazer a lógica da Inteligência Artificial rodar apenas no computador de quem criou a sessão (Host), emitindo as coordenadas apenas para os Clients para evitar desync.

## Fase 5: Progressão e Evolução
- [ ] **Árvore de Evolução**: Implementar o menu que aparece ao ganhar XP suficiente, permitindo trocar o modelo 3D atual para o de um dinossauro maior.
- [ ] **HUD Premium**: Finalizar as interfaces de jogo adicionando barras de vida, stamina, painel de estatísticas, preservando a estética de animações e modernidade vista no Menu Inicial.
