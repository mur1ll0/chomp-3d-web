# Chomp 3D Web 🦖

**A first-person dinosaur survival RPG featuring procedural worlds, advanced AI, multiplayer, and character progression.**

## 🚀 Key Features

- **🎮 6 Playable Species:**
  - Play as T-Rex, Velociraptor, Triceratops, Stegosaurus, Parasaurolophus, or Apatosaurus.
  - Each species has unique stats: Strength, Vitality, Walk/Run speeds, and Diet.
  - Customizable colors per material in the 3D preview.
- **🌿 Infinite Procedural World:**
  - Endless map generated using Simplex Noise with deterministic seed (`WORLD_SEED = 12345`).
  - Chunk-based system (50-unit chunks) with LRU cache (max 256) and dynamic loading/unloading.
  - Interactive environment with plants, meat spawns, and water bodies.
- **🤖 Advanced AI System:**
  - Dynamic NPCs with a Finite State Machine (FSM): Wandering, Fleeing, Hunting, Eating, Attacking, Searching, Dead.
  - Strategy pattern — `CarnivoreStrategy`/`HerbivoreStrategy` with 4 policies each (Combat, FoodTarget, Movement, Threat).
  - Vision system with species-specific FOV (150° carnivores, 165° herbivores).
  - Deterministic NPC spawning based on world seed with pack behavior.
- **⚔️ Combat & RPG Progression:**
  - Melee combat with damage scaling based on Strength × Level multiplier.
  - XP system: gain experience by surviving, eating, and hunting. XP scales 1.2× per level.
  - **Dynamic Growth:** Your dinosaur physically grows from a hatchling (Level 1) to a massive adult (Level 20+) as you level up.
  - Integrated HUD with health bars, stamina, level progress, growth stage labels, and combat feedback.
- **🌐 Multiplayer (Peer-to-Peer):**
  - WebRTC-based P2P using PeerJS with 4-letter session codes.
  - Host-Client architecture: host simulates NPCs, clients receive interpolated snapshots.
  - Pack system: form groups (packs) with invite/join/kick mechanics.
  - 3 game modes: Global World, Local Party, Single Player (Offline).
  - `RemotePlayers` component renders other players' dinosaurs with names.
- **🌍 Internationalization (i18n):**
  - Language switcher in the main menu with flag buttons (🇺🇸 English / 🇧🇷 Português).
  - All user-facing strings are translatable via a centralized key-based system.
  - Easy to add new languages — just add entries to the translation dictionary.
  - Language preference persisted to `localStorage`.

## 🎨 Technology Stack

### Core Engine
- **React 19 + Vite 6:** Modern frontend framework and ultra-fast build tool.
- **TypeScript 6:** Type-safe development with `verbatimModuleSyntax` and `erasableSyntaxOnly`.
- **Three.js + React Three Fiber (R3F):** Hardware-accelerated 3D rendering.
- **@react-three/drei:** High-level abstractions for R3F (OrbitControls, Environment, Bounds, Html).
- **Zustand:** Single global state management store for game stats, UI, and networking.
- **Cannon-es:** High-performance 3D physics engine.

### Styling & UI
- **Tailwind CSS v4:** Utility-first CSS via `@tailwindcss/vite` plugin with `@theme` directive.
- **Lucide React:** Icon library for UI elements.
- **react-colorful:** Lightweight color picker for dinosaur customization.

### Networking
- **PeerJS:** WebRTC P2P data channels for multiplayer (party sessions).
- **Custom PeerMesh:** Mesh networking layer for multi-peer connections, pack management, and network NPC replication.

### Assets & Tools
- **3D Models:** [Quaternius](https://quaternius.itch.io/animated-lowpoly-dinosaurs) (Animated Lowpoly Dinosaurs pack).
- **Blender:** GLB model optimization and skeletal rigging.

## 📁 Project Structure

```text
src/
├── presentation/           # UI and Rendering layers
│   ├── screens/            # HUD, Menus, and UI Overlays
│   └── canvas/             # 3D Components (Player, NPCs, World)
├── domain/                 # Business logic and data models
│   ├── models/             # Dinosaur definitions, NPC state, AI rules
│   └── interfaces/         # TypeScript interfaces and contracts
├── infrastructure/         # Technical implementations
│   ├── generation/         # Procedural Map & Chunk logic
│   ├── network/            # PeerJS networking (PeerHost, PeerClient, PeerMesh, messages)
│   └── random/             # Seeded random providers
├── useCases/               # Application logic and algorithms
│   └── game/               # Core game loop (Combat, AI FSM, Controls, NPC systems)
├── i18n/                   # Internationalization (translations, useT hook)
└── store/                  # Zustand state management
```

Project reference documentation is in `specs/` (AI behavior, movement rules, architecture) and `docs/` (NEXT_STEPS, animations guide).

## 🛠️ Installation & Setup

### Prerequisites
- Node.js 24.15.0
- npm or yarn

### Steps

1. **Clone the repository:**
   ```bash
   git clone <repository-url>
   cd chomp-3d-web
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Run in development mode:**
   ```bash
   npm run dev
   ```

4. **Network exposure (for local testing):**
   ```bash
   npm run dev -- --host
   ```

## 🎮 How to Play

### Controls
- **WASD:** Move your dinosaur
- **Shift:** Sprint (Consumes Stamina)
- **Space:** Jump
- **Left Click:** Attack / Interact (Eat)
- **E:** Interact / Eat
- **H:** Toggle Debug Info (dev mode)
- **Mouse:** Look around / Aim

*Controls can be rebound in the Settings menu.*

### Gameplay Mechanics
- **Survival:** Manage your Health and Stamina. Carnivores must hunt NPCs/Meat, while Herbivores find Plants.
- **Stamina:** Sprinting and Jumping consume stamina. Being exhausted (SP = 0) prevents sprinting until you recover.
- **Leveling:** Gain XP to level up. Higher levels increase your size, strength, and health.
- **Growth:** Levels 1-9 = Cub, 10-19 = Juvenile, 20+ = Adult (logarithmic size scaling beyond 20).
- **Death:** When HP reaches 0, you see a death recap (level, survival time, food eaten). Online players return to character selection; offline players return to main menu.

### Debug Features (dev mode only, press H)
- FPS counter, speed, scale, NPC counts
- Level adjustments (±1, ±10)
- Toggle: Zoom Unlock, Collision Volumes, NPC Level Labels, NPC Vision Debug

## 🌍 Internationalization

The game supports **English (US)** and **Portuguese (Brazil)**.
- Switch languages in the main menu using the flag buttons (🇺🇸/🇧🇷).
- Your preference is saved in `localStorage`.
- Adding a new language: edit `src/i18n/translations.ts` and add entries for your language code in both the `LANGUAGES` array and the `translations` record.

## 🗺️ Roadmap

- [x] **Phase 1:** Core mechanics, movement, and assets.
- [x] **Phase 2:** Procedural infinite world and chunk system.
- [x] **Phase 3:** NPC AI, State Machines, and Combat.
- [x] **Phase 4:** Multiplayer P2P using PeerJS — party system, pack management, NPC snapshot sync.
- [ ] **Phase 5:** Evolution Tree (Switch species), Premium HUD, Biomes.
- [ ] **Phase 6:** True P2P mesh (deterministic NPC sync via EventBus), Global World mode with WebSocket signaling, ChunkInterestManager, SpawnResolver.

## 🐛 Troubleshooting

### "Mouse is stuck or not moving"
- **Cause:** Browser Pointer Lock security.
- **Solution:** Click anywhere on the screen to capture the mouse. Press `Esc` or `Alt` to release.

### "Animations look frozen or glitchy"
- **Cause:** Blender GLB export sometimes bakes extra frames.
- **Solution:** The project includes an automatic animation fixer that crops baked timeline gaps during loading.

### "NPCs not spawning"
- **Cause:** The current seed might have low density in your immediate area.
- **Solution:** Move to a different area or restart the game to generate a new world layout.

### "Build fails with type errors"
- **Requirements:** `npm run build` requires BOTH `tsc -b` and Vite build to pass.
- Check TypeScript 6 strict mode — use `import type` for type-only imports and avoid `enum`.

## 📊 Project Statistics
- **Total Lines of Code:** ~5000+
- **Playable Species:** 6
- **World Size:** Infinite (procedural)
- **Physics Engine:** Cannon-es (Deterministic)
- **Supported Languages:** 2 (English, Portuguese)

## 📜 Credits
- **3D Models:** [Quaternius](https://quaternius.itch.io/animated-lowpoly-dinosaurs) (Animated Lowpoly Dinosaurs).
- **Animations:** Quaternius.

## 📄 License
This project is open-source. See the [LICENSE](LICENSE) file for details.
