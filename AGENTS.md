# chomp-3d-web — Agent Guide

## Commands (run in order)
- `npm run dev` — Vite dev server
- `npm run build` — `tsc -b` then Vite build (BOTH must pass)
- `npm run lint` — ESLint flat config (`eslint.config.js`), `.ts`/`.tsx` only
- `npm run dev -- --host` — expose dev server on network
- No test framework exists — no test commands

## Stack quirks
- **Tailwind v4**: `@tailwindcss/vite` plugin + `@theme` directive in `src/index.css`. No `tailwind.config.*` / `postcss.config.*`.
- **TypeScript 6**: project references (`tsconfig.app.json` for `src/`, `tsconfig.node.json` for `vite.config.ts`). `verbatimModuleSyntax` — use `import type` for type-only imports. `erasableSyntaxOnly` — prohibit `enum`, use `as const` + type alias (see `src/domain/models/NPCState.ts`).
- **Vite base path**: `/chomp-3d-web/` (GitHub Pages). Asset paths must use `import.meta.env.BASE_URL` prefix (see `DinosaurStats.ts`).
- **`APP_VERSION`** global injected at build time from `package.json` (declared in `src/vite-env.d.ts`).
- **Control bindings** persisted in `sessionStorage` under key `chomp3d.controlBindings` (see `useAppStore.ts`).
- **Deterministic world**: `WORLD_SEED = 12345` in `MapGenerator.ts`. NPC spawning and terrain use seeded RNG (`simplex-noise`).
- **`PlayerPositionRef`** (`src/useCases/game/PlayerPositionRef.ts`) is a mutable module-level singleton — **not** React/Zustand state — updated every frame via `useFrame` for perf. NPC AI and PeerJS read from it directly.
- **World time** (`WorldTime.ts`): 5-min day/night cycle, `Date.now()`-based (syncs across peers), cached every 100ms.
- **Physics**: Cannon-es (integrated via Three.js + custom physics, not Rapier).

## Architecture
- **Single Zustand store**: `src/store/useAppStore.ts` — holds all game state (player stats, edibles, networking, debug toggles).
- **Screen routing**: `src/App.tsx` renders 1 of 5 screens based on `currentScreen`: `'menu' | 'settings' | 'session-select' | 'character-select' | 'game'`.
- **Layers**: `domain/` (models, strategies, policies, interfaces), `infrastructure/` (generation, network/P2P, adapters, random), `useCases/game/` (combat, AI, systems, controls), `presentation/` (screens, canvas/R3F, hooks, utils).
- **NPC AI**: Strategy pattern — `CarnivoreStrategy`/`HerbivoreStrategy` each composed of 4 policies (`Combat`, `FoodTarget`, `Movement`, `Threat`). FSM with 7 states: `Wandering | Fleeing | Hunting | Eating | Attacking | Searching | Dead`. Systems: `NPCFsmSystem`, `NPCMovementSystem`, `NPCSpawnSystem`, `NPCDespawnSystem`.
- **6 playable species**: T-Rex, Velociraptor, Triceratops, Stegosaurus, Parasaurolophus, Apatosaurus — GLB models in `public/models/dinos/`. All have 6 animations: Idle, Walk, Run, Attack, Jump, Death (Apatosaurus also has Eat).
- **Chunk system**: 50-unit chunks, LRU cache (max 256), configurable `renderDistance`. `MapGenerator.getChunksAround()` is the main entrypoint.
- **Multiplayer**: PeerJS (WebRTC P2P) via `PeerHost`/`PeerClient`/`PeerSession` in `src/infrastructure/network/`. 4-letter session codes.
- **Canvas components** (`src/presentation/canvas/`): `DynamicEnvironment` (sky/sun), `ProceduralMap` (terrain), `EdiblesManager`, `NPCDinosaurs`, `PlayerDinosaur`, `RemotePlayers`.
- **RPG**: XP → level up (1-20 growth phase, 20+ adulthood). XP needed scales 1.2× per level. Level determines scale, health, damage.

## Reference Docs (consult for detailed specs)
- **`specs/4-npc-ai-behavior.md`** — Full NPC FSM decision trees, perception radii (omnidirectional threat vs FOV food), bite damage formula, pack retaliation timers. Read before modifying AI policies or combat formulas.
- **`specs/2-dinosaur-behavior.md`** — Unified movement/animation locking rules, interaction radius formulas, animation clip detection regex. Read when working on player/NPC movement or animation sync.
- **`specs/1-game-requisites.md`** — High-level game design: 5-phase dev plan, deterministic world seeding, P2P session code concept.
- **`specs/3-development-criteria.md`** — GC pressure avoidance, deterministic sync rules, multiplayer payload guidelines, LOD/culling patterns.
- **`specs/0-technology.md`** — Stack rationale (TypeScript, R3F, Vite, PeerJS, Clean Architecture + SOLID).
- **`docs/NEXT_STEPS.md`** — Current project phase (Phase 4 complete, Phase 5 pending: evolution tree, premium HUD). Includes backlog reference.
- **`docs/ANIMATIONS.md`** — Per-species animation lists and legacy FBX→GLB conversion notes.
- **`README.md`** — Controls reference (WASD, Shift sprint, Space jump, Left-click attack, E eat, H debug), troubleshooting tips.

## Debug
- **H key** toggles DebugPanel (top-left overlay).
- Store toggles: `debugCollisions`, `debugNpcLevels`, `debugNpcVision`, `debugZoomUnlocked`.
- Debug panel shows FPS, chunk cache metrics, player pos, NPC count.

## Recommended Skills
Load these via `skill` tool when working on matching tasks:

- **`performance-optimizer`** — Before any render/loop/NPC work. This 3D game is performance-critical (Three.js + Cannon-es + procedural chunks + NPC AI per frame). Optimize `useFrame` loops, chunk loading, draw calls, physics steps.
- **`bug-hunter`** — For combat, AI FSM, or physics bugs. Systematic trace from symptom to root cause.
- **`codebase-audit-pre-push`** — Before pushing to `main` (triggers GitHub Pages deploy). Removes dead code, checks secrets, ensures build passes.
- **`logic-lens`** — Deep review of combat formulas, NPC state transitions, or procedural generation algorithms.
- **`brooks-lint`** — Architectural review of the layered domain/infrastructure/useCases/presentation design.
- **`emalorenzo/three-agent-skills@r3f-best-practices`** — R3F + Drei + Zustand optimization (60+ rules for re-renders, useFrame, component patterns). Install: `npx skills add emalorenzo/three-agent-skills@r3f-best-practices`
- **`emalorenzo/three-agent-skills@three-best-practices`** — Pure Three.js guidelines (memory, geometry, shaders, cannon-es integration). Install: `npx skills add emalorenzo/three-agent-skills@three-best-practices`
- **`vercel-labs/agent-skills@vercel-react-best-practices`** — General React 19 + Vite conventions. Install: `npx skills add vercel-labs/agent-skills@vercel-react-best-practices`
