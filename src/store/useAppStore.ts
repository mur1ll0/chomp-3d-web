import { create } from 'zustand';

export type Screen = 'menu' | 'character-select' | 'settings' | 'game' | 'session-select';
export type GameMode = 'online' | 'offline' | null;
export type ConnectionStatus = 'disconnected' | 'connecting' | 'connected';
export type OnlineRole = 'host' | 'client' | null;

export type ControlAction =
  | 'moveForward'
  | 'moveBackward'
  | 'moveLeft'
  | 'moveRight'
  | 'attack'
  | 'eat'
  | 'sprint'
  | 'jump';

export interface ControlBindings {
  moveForward: string;
  moveBackward: string;
  moveLeft: string;
  moveRight: string;
  attack: string;
  eat: string;
  sprint: string;
  jump: string;
}

const CONTROL_BINDINGS_STORAGE_KEY = 'chomp3d.controlBindings';

const DEFAULT_CONTROL_BINDINGS: ControlBindings = {
  moveForward: 'KeyW',
  moveBackward: 'KeyS',
  moveLeft: 'KeyA',
  moveRight: 'KeyD',
  attack: 'MouseLeft',
  eat: 'KeyE',
  sprint: 'ShiftLeft',
  jump: 'Space',
};

function loadControlBindings(): ControlBindings {
  if (typeof window === 'undefined') return DEFAULT_CONTROL_BINDINGS;
  try {
    const raw = window.sessionStorage.getItem(CONTROL_BINDINGS_STORAGE_KEY);
    if (!raw) return DEFAULT_CONTROL_BINDINGS;
    const parsed = JSON.parse(raw) as Partial<ControlBindings>;
    return {
      ...DEFAULT_CONTROL_BINDINGS,
      ...parsed,
    };
  } catch {
    return DEFAULT_CONTROL_BINDINGS;
  }
}

function persistControlBindings(bindings: ControlBindings): void {
  if (typeof window === 'undefined') return;
  try {
    window.sessionStorage.setItem(CONTROL_BINDINGS_STORAGE_KEY, JSON.stringify(bindings));
  } catch {
    // noop
  }
}

interface AppState {
  currentScreen: Screen;
  gameMode: GameMode;
  
  // Player Configuration
  playerName: string;
  selectedDinoId: string;
  dinoColors: Record<string, string>;
  
  // Settings
  renderDistance: number;
  isSettingsOpenInGame: boolean;
  debugCollisions: boolean;
  debugNpcLevels: boolean;
  debugNpcVision: boolean;
  controlBindings: ControlBindings;

  // Game Mechanics
  foodScore: number;
  edibleStates: Record<string, number>; // ID -> remaining size
  respawnTimers: Record<string, number>; // ID -> seconds until regrow starts
  edibleGrowthLocks: Record<string, number>; // Plant ID -> seconds while an eater is interacting
  interactableEdibleId: string | null;
  playerChunkPos: { x: number, z: number };
  
  // RPG System (XP, Life, Death)
  level: number;
  xp: number;
  xpNeeded: number;
  health: number;
  maxHealth: number;
  stamina: number;
  maxStamina: number;
  isDead: boolean;
  isExhausted: boolean;
  timeAlive: number; // in seconds
  foodEaten: number; // total units of food eaten
  debugZoomUnlocked: boolean;

  // Multiplayer State
  sessionCode: string;
  connectionStatus: ConnectionStatus;
  onlineRole: OnlineRole;
  connectedPlayers: string[];
  networkNPCs: unknown[];
  networkPlayers: unknown[];
  networkTick: number;

  // Actions
  setScreen: (screen: Screen) => void;
  setGameMode: (mode: GameMode) => void;
  setPlayerName: (name: string) => void;
  setSelectedDinoId: (id: string) => void;
  setDinoColor: (materialName: string, color: string) => void;
  setRenderDistance: (dist: number) => void;
  toggleSettingsInGame: () => void;
  toggleDebugCollisions: () => void;
  toggleDebugNpcLevels: () => void;
  toggleDebugNpcVision: () => void;
  setControlBinding: (action: ControlAction, keyCode: string) => void;
  setPlayerChunkPos: (x: number, z: number) => void;
  consumeFood: (points: number) => void;
  damageEdible: (id: string, damage: number) => void;
  regrowEdibles: (secondsPassed: number) => void;
  setInteractableEdibleId: (id: string | null) => void;
  
  // RPG Actions
  gainXp: (amount: number) => void;
  takeDamage: (amount: number) => void;
  consumeStamina: (amount: number) => void;
  regenerateStamina: (amount: number) => void;
  setExhausted: (v: boolean) => void;
  die: () => void;
  initPlayerStats: (vitality: number) => void;
  incrementTimeAlive: () => void;
  resetGameStats: () => void;
  setLevel: (level: number) => void;
  setDebugZoomUnlocked: (v: boolean) => void;
  setSessionCode: (code: string) => void;
  setConnectionStatus: (status: ConnectionStatus) => void;
  setOnlineRole: (role: OnlineRole) => void;
  setConnectedPlayers: (players: string[]) => void;
  setNetworkData: (npcs: unknown[], players: unknown[], tick: number, edibleStates?: Record<string, number>) => void;
}

export const useAppStore = create<AppState>((set) => ({
  currentScreen: 'menu',
  gameMode: null,
  
  playerName: 'Chomper',
  selectedDinoId: 'Velociraptor',
  dinoColors: {}, 
  
  renderDistance: 2,
  isSettingsOpenInGame: false,
  debugCollisions: false,
  debugNpcLevels: false,
  debugNpcVision: false,
  controlBindings: loadControlBindings(),

  foodScore: 0,
  edibleStates: {},
  respawnTimers: {},
  edibleGrowthLocks: {},
  interactableEdibleId: null,
  playerChunkPos: { x: 0, z: 0 },

  level: 1,
  xp: 0,
  xpNeeded: 100,
  health: 100,
  maxHealth: 100,
  stamina: 100,
  maxStamina: 100,
  isDead: false,
  isExhausted: false,
  timeAlive: 0,
  foodEaten: 0,
  debugZoomUnlocked: false,

  // Multiplayer
  sessionCode: '',
  connectionStatus: 'disconnected',
  onlineRole: null,
  connectedPlayers: [],
  networkNPCs: [],
  networkPlayers: [],
  networkTick: 0,

  setScreen: (screen) => set({ currentScreen: screen }),
  setGameMode: (mode) => set({ gameMode: mode }),
  setPlayerName: (name) => set({ playerName: name }),
  setSelectedDinoId: (id) => set({ selectedDinoId: id }),
  setDinoColor: (materialName, color) => set((state) => ({ 
    dinoColors: { ...state.dinoColors, [materialName]: color } 
  })),
  setRenderDistance: (dist) => set({ renderDistance: dist }),
  toggleSettingsInGame: () => set((state) => ({ isSettingsOpenInGame: !state.isSettingsOpenInGame })),
  toggleDebugCollisions: () => set((state) => ({ debugCollisions: !state.debugCollisions })),
  toggleDebugNpcLevels: () => set((state) => ({ debugNpcLevels: !state.debugNpcLevels })),
  toggleDebugNpcVision: () => set((state) => ({ debugNpcVision: !state.debugNpcVision })),
  setControlBinding: (action, keyCode) => set((state) => {
    const updated = {
      ...state.controlBindings,
      [action]: keyCode,
    };
    persistControlBindings(updated);
    return { controlBindings: updated };
  }),
  setPlayerChunkPos: (x, z) => set({ playerChunkPos: { x, z } }),
  consumeFood: (points) => set((state) => {
    // Cada comida dá 10 de XP por ponto de nutrição (ex: tamanho)
    const xpGained = points * 10;
    let newXp = state.xp + xpGained;
    let newLevel = state.level;
    let newXpNeeded = state.xpNeeded;
    let newHealth = state.health;
    let newStamina = Math.min(state.maxStamina, state.stamina + 2);

    // Lógica de Level Up
    while (newXp >= newXpNeeded) {
      newXp -= newXpNeeded;
      newLevel++;
      // Aumenta a necessidade de XP em 20% a cada level
      newXpNeeded = Math.floor(newXpNeeded * 1.2);
      // Evoluir enche a vida e a stamina
      newHealth = state.maxHealth; 
      newStamina = state.maxStamina;
    }

    return { 
      foodScore: state.foodScore + points,
      foodEaten: state.foodEaten + 1,
      xp: newXp,
      level: newLevel,
      xpNeeded: newXpNeeded,
      health: newHealth,
      stamina: newStamina
    };
  }),
  damageEdible: (id, damage) => set((state) => {
    const isPlant = id.startsWith('p_');
    const isMeat = id.startsWith('m_');
    const isCarcass = id.startsWith('npc_') || id === 'player_carcass';
    const currentSize = state.edibleStates[id] ?? 1.0;
    const newSize = Math.max(0, currentSize - damage);

    const newRespawnTimers = { ...state.respawnTimers };
    const newGrowthLocks = { ...state.edibleGrowthLocks };

    // Carcaças nunca regeneram: remove qualquer estado residual de timer/trava.
    if (isCarcass) {
      delete newRespawnTimers[id];
      delete newGrowthLocks[id];
    }

    // Plantas pausam crescimento enquanto algum dinossauro está comendo.
    // Cada mordida renova a trava por 2 segundos.
    if (isPlant && newSize > 0) {
      newGrowthLocks[id] = 2;
    }

    if (!isCarcass && newSize <= 0) {
      if (isPlant) {
        // Arbustos/plantas seguem mecânica de regrowth gradual após breve espera.
        newRespawnTimers[id] = 30;
      } else if (isMeat) {
        // Carnes estáticas do mapa: respawn completo após 1 ciclo de dia/noite.
        newRespawnTimers[id] = 300;
      }
    }

    return {
      edibleStates: { ...state.edibleStates, [id]: newSize },
      respawnTimers: newRespawnTimers,
      edibleGrowthLocks: newGrowthLocks,
    };
  }),
  regrowEdibles: (seconds) => set((state) => {
    const newStates = { ...state.edibleStates };
    const newTimers = { ...state.respawnTimers };
    const newGrowthLocks = { ...state.edibleGrowthLocks };
    let hasChanges = false;

    for (const id in newGrowthLocks) {
      const next = newGrowthLocks[id] - seconds;
      if (next > 0) {
        newGrowthLocks[id] = next;
      } else {
        delete newGrowthLocks[id];
      }
      hasChanges = true;
    }

    for (const id in newStates) {
      if (id.startsWith('npc_')) continue; // Carcaças não regeneram

      const isPlant = id.startsWith('p_');
      const isMeat = id.startsWith('m_');

      if (!isPlant && !isMeat) continue;

      const size = newStates[id];

      if (isMeat) {
        // Carne não cresce gradualmente; apenas respawna inteira quando o timer termina.
        if (size <= 0 && newTimers[id] !== undefined) {
          newTimers[id] -= seconds;
          hasChanges = true;

          if (newTimers[id] <= 0) {
            delete newTimers[id];
            delete newStates[id];
          }
        }
        continue;
      }

      // Plantas/arbustos: crescimento gradual com trava durante interação.
      if (size < 1.0) {
        if (size <= 0) {
          if (newTimers[id] !== undefined && newTimers[id] > 0) {
            newTimers[id] -= seconds;
            hasChanges = true;
            continue;
          }

          delete newTimers[id];
          newStates[id] = 0.01;
          hasChanges = true;
          continue;
        }

        if ((newGrowthLocks[id] ?? 0) > 0) {
          continue;
        }

        newStates[id] = Math.min(1.0, size + (0.02 * seconds));
        if (newStates[id] >= 1.0) {
          delete newStates[id]; // Limpa do estado se voltou ao normal (100%)
        }
        hasChanges = true;
      }
    }

    if (!hasChanges) return {};
    return {
      edibleStates: newStates,
      respawnTimers: newTimers,
      edibleGrowthLocks: newGrowthLocks,
    };
  }),
  setInteractableEdibleId: (id) => set({ interactableEdibleId: id }),

  // RPG Implementations
  initPlayerStats: (vitality: number) => set(() => {
    const maxHp = vitality * 10;
    return {
      health: maxHp,
      maxHealth: maxHp,
      stamina: 100,
      maxStamina: 100,
      level: 1,
      xp: 0,
      xpNeeded: 100,
      isDead: false,
      timeAlive: 0,
      foodEaten: 0,
      foodScore: 0,
      edibleStates: {},
      edibleGrowthLocks: {},
      interactableEdibleId: null
    };
  }),
  gainXp: (amount) => set((state) => {
    if (state.isDead) return {};
    let newXp = state.xp + amount;
    let newLevel = state.level;
    let newXpNeeded = state.xpNeeded;
    let newHealth = state.health;

    while (newXp >= newXpNeeded) {
      newXp -= newXpNeeded;
      newLevel++;
      newXpNeeded = Math.floor(newXpNeeded * 1.2);
      newHealth = state.maxHealth;
    }
    return { xp: newXp, level: newLevel, xpNeeded: newXpNeeded, health: newHealth };
  }),
  takeDamage: (amount) => set((state) => {
    if (state.isDead) return {};
    const newHealth = Math.max(0, state.health - amount);
    return { health: newHealth, isDead: newHealth === 0 };
  }),
  consumeStamina: (amount) => set((state) => {
    if (state.isDead) return {};
    return { stamina: Math.max(0, state.stamina - amount) };
  }),
  regenerateStamina: (amount) => set((state) => {
    if (state.isDead) return {};
    return { stamina: Math.min(state.maxStamina, state.stamina + amount) };
  }),
  setExhausted: (v) => set({ isExhausted: v }),
  die: () => set({ isDead: true, health: 0 }),
  incrementTimeAlive: () => set((state) => ({ timeAlive: state.timeAlive + 1 })),
  resetGameStats: () => set({
    level: 1, xp: 0, xpNeeded: 100, isDead: false, isExhausted: false, timeAlive: 0, foodEaten: 0, foodScore: 0, health: 100, maxHealth: 100, stamina: 100, maxStamina: 100,
    edibleStates: {}, edibleGrowthLocks: {}, interactableEdibleId: null
  }),
  setLevel: (level) => set({ level: Math.max(1, level) }),
  setDebugZoomUnlocked: (v) => set({ debugZoomUnlocked: v }),
  setSessionCode: (code) => set({ sessionCode: code }),
  setConnectionStatus: (status) => set({ connectionStatus: status }),
  setOnlineRole: (role) => set({ onlineRole: role }),
  setConnectedPlayers: (players) => set({ connectedPlayers: players }),
  setNetworkData: (npcs, players, tick, edibleStates) => set((state) => {
    const update: Partial<AppState> = { networkNPCs: npcs, networkPlayers: players, networkTick: tick };
    if (edibleStates) {
      // Merge edible states from host — client doesn't have authority to override local
      // ones, but needs to reflect what host sees for visual sync.
      update.edibleStates = { ...state.edibleStates, ...edibleStates };
      // Also respawn timers: if host says something is gone, mark it
      for (const id in edibleStates) {
        if (edibleStates[id] <= 0) {
          update.edibleStates = { ...update.edibleStates!, [id]: 0 };
        }
      }
    }
    return update;
  }),
}));
