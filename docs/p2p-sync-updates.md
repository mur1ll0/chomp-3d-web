# P2P Network Synchronization & Performance Upgrades

## 1. Unified PeerMesh Architecture
The legacy `PeerSession` approach has been entirely removed from the game lifecycle (`GameScreen.tsx`, `PlayerDinosaur.tsx`, `NPCDinosaurs.tsx`). Both **Party** and **Global** modes now exclusively use `PeerMesh`, ensuring a unified WebRTC mesh strategy without a centralized authoritative host sending heavy JSON snapshots every frame.

## 2. Deterministic NPC Simulation (Removing Network Thread-Blocking)
Previously, the host serialized and broadcasted the entire state of up to 200+ NPCs, creating a massive `JSON.stringify` and `JSON.parse` bottleneck that stalled the main thread (travamentos/freezes). 

To resolve this while adhering to Web Worker limitations (WebRTC API is generally unavailable in `WorkerGlobalScope` without complex polyfills), we applied **Deterministic P2P Synchronization**:
- Every client now runs `NPCManager.update()` locally.
- Spawns and behavior are deterministic via `WORLD_SEED`.
- Interactions (like attacks, eating) are broadcasted as lightweight events via `EventReplicator`.
- This fundamentally eliminates the massive payload processing from the main thread, satisfying the performance requirements. 

*(A test WebWorker `NetworkWorker.ts` was implemented to verify WebRTC/Worker capabilities but due to browser sandbox limits for `window.location` and `RTCPeerConnection`, data processing was optimized natively in the main loop).*

## 3. Seed-Based NPC Coloring
To ensure NPCs do not mistakenly adopt Player customized colors, while still maintaining visual synchronicity across all clients:
- We implemented a seeded hash generator in `NPCDinosaurs.tsx` (`hashCode(npc.id + mat.name)`).
- This seed deterministically alters the hue of each material uniquely per NPC instance.
- All peers running the simulation will independently calculate the *exact same color* for the same NPC ID, ensuring full P2P visual consistency without sending color strings over the network.

## 4. Multiplayer Component Cleanup
- **`PlayerDinosaur.tsx`**: Stripped out legacy `peerSession.sendInput` syncing. Player state is now solely managed and propagated through `PeerMesh.sendPlayerState`.
- **`NPCDinosaurs.tsx`**: Removed `peerSession` listeners, allowing `NPCManager` to act deterministically for every peer in the mesh. Remote player data is accurately fed into the simulation by iterating over the active `PeerMesh` connections.
