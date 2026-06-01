import { isMobileDevice } from '../../useCases/game/TouchInputState';

export function useIsMobile(): boolean {
  return isMobileDevice();
}
