# 1. Arquitetura do Jogo e Boas Práticas

Para manter o projeto sustentável à medida que cresce, é ideal aplicar princípios de Clean Architecture e SOLID, separando a lógica de negócio do jogo da camada de renderização visual.

- Padrão Strategy para Comportamentos: Crie interfaces de dieta/comportamento. Os dinossauros Carnívoros e Herbívoros podem implementar estratégias diferentes de alimentação e busca de alvos, facilitando a adição de onívoros no futuro sem alterar o código base.

- Geração Procedural Determinística: O mapa infinito deve ser gerado usando funções de ruído (como Perlin Noise ou Simplex Noise). É vital que o mapa seja baseado em uma Seed (uma semente numérica). Assim, se dois jogadores estiverem na mesma coordenada (ex: x:100, y:200), a matemática gerará exatamente a mesma árvore e o mesmo terreno no navegador de ambos, sem precisar trafegar o mapa inteiro pela rede.

# 2. Plano de Desenvolvimento

## Fase 1: O Protótipo Solitário (Single Player)

- Use as ferramentas de IA para gerar dois modelos simples: um predador e uma presa.

- Configure a movimentação básica do jogador no cenário.

- Implemente as mecânicas de ataque e defesa.

- Crie o sistema de consumo (comer plantas/carne) e a pontuação/crescimento (aumentar o scale do modelo 3D gradativamente ao ganhar pontos).

## Fase 2: O Mundo Infinito

- Implemente o algoritmo de Perlin Noise.

- Faça com que o mapa seja gerado em "chunks" (pedaços) ao redor do jogador. Conforme ele anda, o jogo renderiza os chunks da frente e descarta da memória os chunks que ficaram para trás, garantindo que o navegador não trave por falta de memória RAM.

## Fase 3: Inteligência Artificial (NPCs)

- Crie uma Máquina de Estados Finita (State Machine) simples para os dinossauros controlados pelo computador:

- Estado: Vagando (Andando aleatoriamente).

- Estado: Fugindo (Se um carnívoro maior entrar no raio de visão).

- Estado: Caçando/Comendo (Indo em direção à comida).

## Fase 4: A Conexão P2P (Multiplayer)

- Integre o WebRTC.

- Crie um sistema onde um jogador gera um "Código de Bando" (que funciona como a ID da sessão no PeerJS).

- Sincronize a posição (x, y, z) e a rotação dos jogadores conectados.

- Transfira a lógica da Máquina de Estados dos NPCs para rodar apenas no navegador do "Host". O Host apenas avisa aos "Clients" onde os NPCs estão.

## Fase 5: Progressão e Evolução

- Crie o menu de evolução. Quando o jogador atinge X pontos, ele pode trocar de modelo 3D (evoluir para uma espécie maior) ou ganhar atributos (mais velocidade, mais força de mordida).

- Refine a UI/UX, adicionando barras de vida, stamina e a interface de criação de bandos.

Começar pela movimentação básica de um único dinossauro em um plano 3D simples usando Three.js ou Godot é o melhor primeiro passo. Deixe o multiplayer e a geração processual para quando o "game feel" do controle do dinossauro já estiver divertido.