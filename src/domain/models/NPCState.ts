/**
 * Estados da Máquina de Estados Finita (FSM) dos NPCs.
 * Cada NPC pode estar em exatamente um desses estados a cada frame.
 */
export const NPCState = {
  /** Andando aleatoriamente em um raio específico */
  Wandering: 'Wandering',
  /** Fugindo de um predador maior no raio de visão */
  Fleeing: 'Fleeing',
  /** Perseguindo comida ou presa menor */
  Hunting: 'Hunting',
  /** Parado comendo (executando animação de comer) */
  Eating: 'Eating',
  /** Executando ataque contra alvo em contato */
  Attacking: 'Attacking',
  /** Morto — deixa carne e aguarda remoção */
  Dead: 'Dead',
} as const;

export type NPCState = typeof NPCState[keyof typeof NPCState];
