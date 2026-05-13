# chomp-3d-web — Agent Guide

## Commands (run in order)
- `npm run dev` — Vite dev server
- `npm run build` — typecheck (`tsc -b`) then Vite build
- `npm run lint` — ESLint (`.ts` / `.tsx` only)
- `npm run preview` — preview production build
- `npm run dev -- --host` — expose dev server on network

## Stack quirks
- **Tailwind v4**: configured via `@tailwindcss/vite` plugin + `@theme` directive in `src/index.css`. No `tailwind.config.*` / `postcss.config.*`.
- **TypeScript 6**: project references (`tsconfig.app.json` for `src/`, `tsconfig.node.json` for `vite.config.ts`). `verbatimModuleSyntax` required — use `import type` for type-only imports.
- **Vite base path**: `/chomp-3d-web/` (GitHub Pages deploy target). Update in `vite.config.ts` if domain changes.
- **`APP_VERSION`** global injected at build time from `package.json` version (declared in `src/vite-env.d.ts`).
- **Control bindings** persisted in `sessionStorage` under key `chomp3d.controlBindings`.
- **No TS `enum` keyword** — `erasableSyntaxOnly` prohibits it. Use `as const` + type alias (see `src/domain/models/NPCState.ts`).
- **Deterministic world**: `WORLD_SEED = 12345` in `src/infrastructure/generation/MapGenerator.ts`. NPC spawning and terrain noise use seeded RNG.
- **Asset paths** use `import.meta.env.BASE_URL` prefix (see `DinosaurStats.ts` model paths) for GitHub Pages compatibility.
- **`PlayerPositionRef`** (`src/useCases/game/PlayerPositionRef.ts`) is a mutable module-level singleton — **not** React/Zustand state — updated every frame via `useFrame` for performance.

## Recommended Skills

Load these skills via the `skill` tool when working on matching tasks:

- **`performance-optimizer`** — Load before any render/loop/npc work. This 3D game (Three.js + Cannon-es physics + procedural chunks + NPC AI per frame) is performance-critical. Optimize `useFrame` loops, chunk loading, draw calls, and physics steps.
- **`bug-hunter`** — Load for any combat, AI FSM, or physics bug. Game logic is complex — systematic trace from symptom to root cause.
- **`codebase-audit-pre-push`** — Load before pushing to `main` (triggers GitHub Pages deploy). Removes dead code, checks for secrets, and ensures build passes.
- **`logic-lens`** — Load for deep review of combat formulas, NPC state transitions, or procedural generation algorithms where subtle logic errors break gameplay.
- **`brooks-lint`** — Load for architectural review of the layered domain/infrastructure/useCases/presentation design. Catches coupling issues in strategy patterns and interfaces.

## Architecture
- Single-page React 19 app with Three.js (R3F + drei), Cannon-es physics, Zustand store.
- **Entry**: `src/main.tsx` → `src/App.tsx` renders one of 4 screens from Zustand `currentScreen`.
- **State**: single Zustand store at `src/store/useAppStore.ts`.
- **Layers**: `domain/` (models, types, strategies), `infrastructure/` (generation, adapters, random), `useCases/game/` (combat, AI, controls), `presentation/` (canvas components, screens, hooks).
- **3D components** live in `src/presentation/canvas/` — `PlayerDinosaur`, `NPCDinosaurs`, `ProceduralMap`, `EdiblesManager`, `DynamicEnvironment`.

## Testing
- No test framework installed. No tests exist.

## CI / Deploy
- GitHub Actions (`deploy.yml`) builds and deploys to GitHub Pages on push to `main`.
- Node 24, Ubuntu runner, `npm install` → `npm run build` → upload `dist/` artifact.
