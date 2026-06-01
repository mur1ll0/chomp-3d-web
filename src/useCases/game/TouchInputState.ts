export interface TouchInputData {
  moveX: number;
  moveZ: number;
  jump: boolean;
  attack: boolean;
  eat: boolean;
  cameraYaw: number;
  cameraPitch: number;
}

export const touchInput: TouchInputData = {
  moveX: 0,
  moveZ: 0,
  jump: false,
  attack: false,
  eat: false,
  cameraYaw: 0,
  cameraPitch: 0,
};

export function isMobileDevice(): boolean {
  return typeof window !== 'undefined' && 'ontouchstart' in window;
}
