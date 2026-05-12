export interface IGameStateGateway {
  /** Retorna o percentual restante de um recurso comestível (0.0 a 1.0). */
  getEdibleRemaining(id: string): number;

  /** Aplica dano percentual em um recurso comestível. */
  damageEdible(id: string, damage: number): void;
}
