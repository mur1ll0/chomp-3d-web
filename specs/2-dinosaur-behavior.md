# Especificação de Funcionamento: Dinossauros (Player & NPC)

Este documento descreve as regras unificadas de movimentação, animação e interação para todos os dinossauros no Chomp 3D Web, garantindo paridade entre o Jogador e os NPCs.

## 1. Máquina de Estados e Bloqueio de Movimento

Ambos o Jogador e os NPCs seguem um padrão de bloqueio de estado durante ações de "One-Shot" (execução única).

### Estados de Bloqueio
*   **Eating (Comendo)**: Bloqueia o movimento e a mudança de direção até que a animação termine.
*   **Attacking (Atacando)**: Bloqueia o movimento e a mudança de direção até que a animação termine.
*   **Death (Morte)**: Estado final, bloqueia todas as ações permanentemente.

### Regra de Implementação
*   **Player**: Utiliza o ref `isActionLocked` e o estado `isActing`. Se verdadeiro, o loop de `useFrame` ignora entradas de teclado e aplicação de velocidade horizontal.
*   **NPC**: Utiliza o campo `state` (`NPCState.Eating` ou `NPCState.Attacking`). O `NPCManager` deve pular o `updateMovement` enquanto o `stateTimer` for maior que zero nesses estados.

## 2. Lógica de Animação

As animações devem ser sincronizadas com o estado lógico.

*   **Detecção de Clipe**: Utilizar busca robusta (Regex) para encontrar animações como "Idle", "Walk", "Run", "Eat", "Attack", "Jump" e "Death", ignorando sufixos do exportador (ex: "Armature|Eat_Action").
*   **Tratamento de Frames**: Todas as animações devem ter sua duração corrigida para o `maxActiveTime` para evitar "gaps" ou congelamentos no final do clipe.
*   **Transições**: Cross-fade de 0.2s entre animações para suavidade visual.

## 3. Áreas de Interação (Colisão vs. Interação)

A distância de interação deve ser proporcional à escala e ao raio de colisão do dinossauro.

### Fórmulas Unificadas
*   **Escala Final (`finalScale`)**: Calculada com base no Level (1-20 linear, 20+ logarítmico).
*   **Raio de Colisão Física**: `stats.collisionRadius * finalScale`.
*   **Raio de Interação (Comer/Atacar)**: `Math.min(collisionRadius * 3 * finalScale, 15.0)`.

### Condições para Ação
*   **Comer**: 
    1. O alvo deve ser do tipo correto para a dieta (`Meat` para carnívoros, `Plant` para herbívoros).
    2. A distância entre os centros deve ser menor que `interactRadius + edibleRadius`.
    3. O alvo deve ter escala restante > 0.
*   **Atacar**: 
    1. A distância entre os centros deve ser menor que `interactRadiusPlayer + collisionRadiusTarget`.

## 4. Centralização de Métodos Comuns

Para evitar duplicação, os seguintes cálculos devem ser movidos para utilitários ou classes de domínio:
*   `calculateInteractRadius(collisionRadius, finalScale)`
*   `getScaleByLevel(level, stats)`
*   `checkInteractionDistance(posA, posB, radiusA, radiusB)`

### Lógica de Animação Centralizada
As animações são gerenciadas pelo hook `useDinosaurAnimations`, que encapsula:
*   Tratamento de frames vazios (correção de exportação Blender).
*   Busca robusta por intenção via Regex.
*   Controle de cross-fade e loop.
