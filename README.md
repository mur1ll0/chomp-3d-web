# Chomp 3D Web 🦖

**A first-person dinosaur survival RPG featuring procedural worlds, advanced AI, and character progression.**

> [!IMPORTANT]
> **Current Status:** Project in Development (Phase 3: AI & NPCs - Completed)
> Multiplayer and Evolution Trees are in the roadmap.

## 🚀 Key Features

- **🎮 6 Playable Species:**
  - Play as T-Rex, Velociraptor, Triceratops, Stegosaurus, Parasaurolophus, or Apatosaurus.
  - Each species has unique stats: Strength, Vitality, Walk/Run speeds, and Diet.
- **🌿 Infinite Procedural World:**
  - Endless map generated using Perlin Noise with unique seeds.
  - Chunk-based system with dynamic loading/unloading for high performance.
  - Interactive environment with various plants and food sources.
- **🤖 Advanced AI System:**
  - Dynamic NPCs with a Finite State Machine (FSM): Wandering, Fleeing, Hunting, Eating, Attacking.
  - Vision system with detection cones and species-specific behaviors.
  - Deterministic NPC spawning based on world seed.
- **⚔️ Combat & RPG Progression:**
  - Melee combat with damage scaling based on Strength and Level.
  - XP system: gain experience by surviving, eating, and hunting.
  - **Dynamic Growth:** Your dinosaur physically grows from a hatchling to a massive adult as you level up.
  - Integrated HUD with health bars, stamina, level progress, and combat feedback.

## 🎨 Technology Stack

### Core Engine
- **React 19 + Vite:** Modern frontend framework and ultra-fast build tool.
- **TypeScript:** Type-safe development for complex game logic.
- **Three.js + React Three Fiber:** Hardware-accelerated 3D rendering.
- **@react-three/drei:** High-level abstractions for R3F.
- **Zustand:** Global state management for game stats and UI.
- **Cannon-es:** High-performance 3D physics engine.

### Assets & Tools
- **3D Models:** [Quaternius](https://quaternius.itch.io/animated-lowpoly-dinosaurs) (Lowpoly Dinosaurs pack).
- **Blender:** GLB model optimization and skeletal rigging.
- **Antigravity:** AI-powered code generation and assistance.

## 📁 Project Structure

```text
src/
├── presentation/           # UI and Rendering layers
│   ├── screens/            # HUD, Menus, and UI Overlays
│   └── canvas/             # 3D Components (Player, NPCs, World)
├── domain/                 # Business logic and data models
│   ├── models/             # Dinosaur definitions and AI rules
│   └── types/              # TypeScript interfaces and types
├── infrastructure/         # Technical implementations
│   └── generation/         # Procedural Map & Chunk logic
├── useCases/               # Application logic and algorithms
│   └── game/               # Core game loop (Combat, AI, Controls)
└── store/                  # Zustand state management
```

## 🛠️ Installation & Setup

### Prerequisites
- Node.js 18+
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
- **H:** Toggle Debug Info
- **Mouse:** Look around / Aim

### Gameplay Mechanics
- **Survival:** Manage your Health and Stamina. Carnivores must hunt NPCs/Meat, while Herbivores find Plants.
- **Stamina:** Sprinting and Jumping consume stamina. Being exhausted prevents sprinting until you recover.
- **Leveling:** Gain XP to level up. Higher levels increase your size, strength, and health.
- **Growth:** Level 1-20 is the growth phase. After Level 20, you reach adulthood with logarithmic size gains.

## 🗺️ Roadmap

- [x] **Phase 1:** Core mechanics, movement, and assets.
- [x] **Phase 2:** Procedural infinite world and chunk system.
- [x] **Phase 3:** NPC AI, State Machines, and Combat.
- [ ] **Phase 4 (Next):** Multiplayer P2P integration using PeerJS (WebRTC).
- [ ] **Phase 5:** Evolution Tree (Switch species), Biomes, and Premium HUD.

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

## 📊 Project Statistics
- **Total Lines of Code:** ~5000+
- **Playable Species:** 6
- **World Size:** Infinite
- **Physics Engine:** Cannon-es (Deterministic)

## 📜 Credits
- **3D Models:** [Quaternius](https://quaternius.itch.io/animated-lowpoly-dinosaurs) (Animated Lowpoly Dinosaurs).
- **Animations:** Quaternius.

## 📄 License
This project is open-source. See the [LICENSE](LICENSE) file for details.
