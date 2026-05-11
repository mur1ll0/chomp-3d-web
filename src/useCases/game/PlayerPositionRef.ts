/**
 * Referência global da posição do jogador — acessível fora do React.
 * 
 * PlayerDinosaur escreve aqui a cada frame.
 * NPCManager e NPCDinosaurs lêem daqui para cálculos de IA.
 * 
 * Por ser um objeto mutável simples (sem Zustand/React), não gera re-renders
 * e é thread-safe para o contexto single-threaded do JS.
 * Ideal para PeerJS: basta serializar este objeto para enviar ao client.
 */
export const PlayerPositionRef = {
  x: 0,
  y: 0,
  z: 0,
  rotY: 0,
  scale: 0.15,
  level: 1,
  diet: 'Carnivore' as string,
  strength: 5,
  isDead: false,
};
