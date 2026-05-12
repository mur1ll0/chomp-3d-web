import { useAppStore } from '../../store/useAppStore';
import type { IGameStateGateway } from '../../useCases/game/contracts/IGameStateGateway';

export class ZustandGameStateGateway implements IGameStateGateway {
  getEdibleRemaining(id: string): number {
    return useAppStore.getState().edibleStates[id] ?? 1.0;
  }

  damageEdible(id: string, damage: number): void {
    useAppStore.getState().damageEdible(id, damage);
  }
}
