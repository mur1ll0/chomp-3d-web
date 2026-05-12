# Critérios de Desenvolvimento e Otimização

Este documento define os padrões técnicos para o desenvolvimento do Chomp 3D Web, visando performance, manutenibilidade e compatibilidade com multiplayer.

## 1. Código Limpo e Arquitetura
*   **Separação de Preocupações**: Lógica de domínio (stats, IA, estados) deve ser separada da apresentação (React, Three.js).
*   **Imutabilidade**: Preferir objetos imutáveis ou snapshots para sincronização de estado.
*   **Tipagem Forte**: Uso rigoroso de TypeScript para interfaces e enums.

## 2. Thread Safety e Concorrência (PeerJS)
*   **Autoridade de Estado**: Apenas o Host processa a lógica de `NPCManager` e `MapGenerator`. Clientes recebem snapshots via PeerJS.
*   **Determinismo**: O processamento de lógica deve ser baseado em `delta` time e sementes (seeds) consistentes.
*   **Sincronização**: Estados visuais (animações) devem ser derivados do estado lógico (`animationIntent`) para garantir que todos os jogadores vejam a mesma ação.

## 3. Otimização de Desempenho
*   **Pressão de GC (Garbage Collection)**:
    *   Reutilizar instâncias de `THREE.Vector3`, `Quaternion` e `Matrix4` em loops de frame.
    *   Evitar a criação de novos objetos ou arrays dentro do `useFrame`.
*   **Culling e LOD**:
    *   NPCs distantes devem ser removidos (`despawn`) ou ter seu processamento de IA reduzido.
    *   Usar `React.memo` para instâncias de NPCs para evitar re-renders desnecessários.
*   **Física Simplificada**:
    *   Usar distâncias ao quadrado (`distSq`) para checagens rápidas de proximidade antes de usar `Math.sqrt`.
    *   Colisões procedurais limitadas a chunks vizinhos.

## 4. Práticas de Multiplayer
*   **Latência**: Implementar interpolação para posições de NPCs recebidas da rede.
*   **Payloads Enxutos**: Enviar apenas dados essenciais no snapshot do `NPCManager` (id, pos, rot, state, level, anim).
