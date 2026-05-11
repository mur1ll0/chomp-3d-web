import { create } from 'zustand';

export type Screen = 'menu' | 'character-select' | 'settings' | 'game';
export type GameMode = 'online' | 'offline' | null;

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

  // Game Mechanics
  foodScore: number;
  edibleStates: Record<string, number>; // ID -> remaining size
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

  // Actions
  setScreen: (screen: Screen) => void;
  setGameMode: (mode: GameMode) => void;
  setPlayerName: (name: string) => void;
  setSelectedDinoId: (id: string) => void;
  setDinoColor: (materialName: string, color: string) => void;
  setRenderDistance: (dist: number) => void;
  toggleSettingsInGame: () => void;
  toggleDebugCollisions: () => void;
  setPlayerChunkPos: (x: number, z: number) => void;
  consumeFood: (points: number) => void;
  damageEdible: (id: string, damage: number) => void;
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

  foodScore: 0,
  edibleStates: {},
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
    const currentSize = state.edibleStates[id] ?? 1.0;
    const newSize = Math.max(0, currentSize - damage);
    return {
      edibleStates: { ...state.edibleStates, [id]: newSize }
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
    edibleStates: {}, interactableEdibleId: null
  }),
  setLevel: (level) => set({ level: Math.max(1, level) }),
  setDebugZoomUnlocked: (v) => set({ debugZoomUnlocked: v })
}));
