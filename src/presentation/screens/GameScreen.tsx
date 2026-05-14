import React, { useMemo, Suspense } from 'react';
import * as THREE from 'three';
import { Canvas } from '@react-three/fiber';
import { useAppStore } from '../../store/useAppStore';
import { ArrowLeft, Settings } from 'lucide-react';
import { MapGenerator } from '../../infrastructure/generation/MapGenerator';
import { peerSession } from '../../infrastructure/network/PeerSession';
import { ProceduralMap } from '../canvas/ProceduralMap';
import { PlayerDinosaur } from '../canvas/PlayerDinosaur';
import { EdiblesManager } from '../canvas/EdiblesManager';
import { SettingsMenu } from './SettingsMenu';
import { DynamicEnvironment } from '../canvas/DynamicEnvironment';
import { DebugPanel } from './DebugPanel';
import { NPCDinosaurs } from '../canvas/NPCDinosaurs';
import { RemotePlayers } from '../canvas/RemotePlayers';
import { BandPanel } from './BandPanel';

// Sub-componente para Tela de Morte
const DeathScreen: React.FC<{ onLeave: () => Promise<void> | void }> = ({ onLeave }) => {
  const level = useAppStore(s => s.level);
  const timeAlive = useAppStore(s => s.timeAlive);
  const foodEaten = useAppStore(s => s.foodEaten);
  const resetGameStats = useAppStore(s => s.resetGameStats);
  const setScreen = useAppStore(s => s.setScreen);
  const gameMode = useAppStore(s => s.gameMode);
  const isOnline = gameMode === 'online';

  return (
    <div 
      className="absolute inset-0 z-[100] bg-black/80 backdrop-blur-md flex flex-col items-center justify-center pointer-events-auto transition-opacity duration-1000"
      onClick={(e) => e.stopPropagation()}
      onPointerDown={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.stopPropagation()}
    >
      <h1 className="text-6xl font-black text-red-600 mb-2 drop-shadow-[0_0_15px_rgba(220,38,38,0.8)]">VOCÊ MORREU</h1>
      <h2 className="text-2xl text-slate-300 mb-8 font-light">Seu dinossauro virou comida...</h2>

      <div className="bg-slate-900/80 border border-slate-700 rounded-xl p-6 w-80 shadow-2xl mb-8 flex flex-col gap-4">
        <div className="flex justify-between items-center border-b border-slate-700 pb-2">
          <span className="text-slate-400">Nível Alcançado</span>
          <span className="text-white font-bold text-xl">{level}</span>
        </div>
        <div className="flex justify-between items-center border-b border-slate-700 pb-2">
          <span className="text-slate-400">Tempo Sobrevivido</span>
          <span className="text-white font-bold text-xl">{Math.floor(timeAlive / 60)}m {timeAlive % 60}s</span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-slate-400">Comida Ingerida</span>
          <span className="text-white font-bold text-xl">{foodEaten} unid.</span>
        </div>
      </div>

      <button
        onClick={async (e) => {
          e.stopPropagation();
          if (isOnline) await onLeave();
          resetGameStats();
          setScreen(isOnline ? 'character-select' : 'menu');
        }}
        className="px-8 py-3 bg-red-600 hover:bg-red-500 text-white rounded-lg font-bold text-lg transition-all shadow-[0_0_20px_rgba(220,38,38,0.4)] hover:shadow-[0_0_30px_rgba(220,38,38,0.8)] cursor-pointer"
      >
        {isOnline ? 'Voltar à Seleção' : 'Voltar ao Menu Principal'}
      </button>
    </div>
  );
};

// Sub-componente para a HUD que assina apenas o necessário
const PlayerHUD: React.FC = () => {
  const level = useAppStore(s => s.level);
  const xp = useAppStore(s => s.xp);
  const xpNeeded = useAppStore(s => s.xpNeeded);
  const health = useAppStore(s => s.health);
  const maxHealth = useAppStore(s => s.maxHealth);
  const stamina = useAppStore(s => s.stamina);
  const maxStamina = useAppStore(s => s.maxStamina);
  const isExhausted = useAppStore(s => s.isExhausted);

  return (
    <div className="absolute bottom-6 left-1/2 -translate-x-1/2 w-80 md:w-[400px] pointer-events-none flex flex-col gap-2 z-20">
      <div className="text-white text-center font-bold drop-shadow-[0_2px_2px_rgba(0,0,0,0.8)] text-lg">
        Nível {level} <span className="text-sm font-normal text-slate-300">
          {level < 10 ? '(Filhote)' : level < 20 ? '(Jovem)' : '(Adulto)'}
        </span>
      </div>

      <div className="w-full h-3 bg-slate-900/80 rounded-full border border-slate-700 overflow-hidden relative shadow-inner">
        <div
          className="h-full bg-cyan-500 transition-all duration-300"
          style={{ width: `${Math.min(100, (xp / xpNeeded) * 100)}%` }}
        />
        <div className="absolute inset-0 flex items-center justify-center text-[10px] text-white font-bold drop-shadow-md">
          XP: {Math.floor(xp)} / {xpNeeded}
        </div>
      </div>

      <div className="w-full h-4 bg-slate-900/80 rounded-full border border-slate-700 overflow-hidden relative shadow-inner">
        <div
          className="h-full bg-red-500 transition-all duration-300"
          style={{ width: `${Math.min(100, (health / maxHealth) * 100)}%` }}
        />
        <div className="absolute inset-0 flex items-center justify-center text-[11px] text-white font-bold drop-shadow-md">
          HP: {Math.floor(health)} / {maxHealth}
        </div>
      </div>

      <div className={`w-full h-3 bg-slate-900/80 rounded-full border overflow-hidden relative shadow-inner transition-all ${isExhausted ? 'border-red-500/70 animate-pulse' : 'border-slate-700'}`}>
        <div
          className={`h-full transition-all duration-75 ${isExhausted ? 'bg-red-400' : 'bg-yellow-400'}`}
          style={{ width: `${Math.min(100, (stamina / maxStamina) * 100)}%` }}
        />
        <div className="absolute inset-0 flex items-center justify-center text-[9px] text-white font-bold drop-shadow-md">
          {isExhausted ? '⚠ EXAUSTO' : `SP: ${Math.floor(stamina)} / ${maxStamina}`}
        </div>
      </div>
    </div>
  );
};

export const GameScreen: React.FC = () => {
  const setScreen = useAppStore(s => s.setScreen);
  const gameMode = useAppStore(s => s.gameMode);
  const playerName = useAppStore(s => s.playerName);
  const selectedDinoId = useAppStore(s => s.selectedDinoId);
  const isSettingsOpenInGame = useAppStore(s => s.isSettingsOpenInGame);
  const toggleSettingsInGame = useAppStore(s => s.toggleSettingsInGame);
  const renderDistance = useAppStore(s => s.renderDistance);
  const playerChunkPos = useAppStore(s => s.playerChunkPos);
  const isDead = useAppStore(s => s.isDead);
  const sessionCode = useAppStore(s => s.sessionCode);
  
  const onlineRole = useAppStore(s => s.onlineRole);
  const isOnline = gameMode === 'online';

  const handleLeaveGame = async () => {
    if (onlineRole === 'host' && peerSession.getHostClients().length > 0) {
      await peerSession.transferHostToNextInLine();
    }
    peerSession.destroy();
    setScreen('menu');
  };

  const chunks = useMemo(() => {
    const centerX = playerChunkPos.x * 50;
    const centerZ = playerChunkPos.z * 50;
    return MapGenerator.getChunksAround(centerX, centerZ, renderDistance);
  }, [renderDistance, playerChunkPos.x, playerChunkPos.z]);

  return (
    <div className="w-full h-screen relative">
      <DebugPanel />
      {isSettingsOpenInGame && (
        <div
          className="absolute inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center pointer-events-auto"
          onClick={(e) => e.stopPropagation()}
          onPointerDown={(e) => e.stopPropagation()}
        >
          <SettingsMenu inGame />
        </div>
      )}

      <div className="absolute top-0 left-0 w-full p-4 z-10 flex justify-between items-start pointer-events-none">
        <div className="flex gap-2">
          <button
            onClick={(e) => { e.stopPropagation(); handleLeaveGame(); }}
            onPointerDown={(e) => e.stopPropagation()}
            className="pointer-events-auto flex items-center gap-2 bg-slate-900/60 hover:bg-slate-800/80 backdrop-blur text-white px-4 py-2 rounded-lg border border-slate-700 transition-all"
          >
            <ArrowLeft className="w-4 h-4" />
            Sair
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); toggleSettingsInGame(); }}
            onPointerDown={(e) => e.stopPropagation()}
            className="pointer-events-auto flex items-center gap-2 bg-slate-900/60 hover:bg-slate-800/80 backdrop-blur text-white px-4 py-2 rounded-lg border border-slate-700 transition-all"
          >
            <Settings className="w-4 h-4" />
            Config
          </button>
        </div>

        <div className="pointer-events-auto bg-slate-900/60 backdrop-blur text-white px-6 py-3 rounded-lg border border-slate-700 shadow-lg text-center flex flex-col items-center">
          <div className="text-lg text-slate-400 uppercase tracking-wider mb-1">
            {isOnline ? playerName : 'Single Player'}
          </div>
          <div className="font-bold text-orange-400 flex items-center gap-2">
            <span className={`w-2 h-2 rounded-full ${isOnline ? 'bg-green-500 animate-pulse' : 'bg-slate-500'}`}></span>
            {selectedDinoId}
          </div>
          {isOnline && (
            <div className="text-lg mt-1 flex items-center justify-center gap-2 bg-slate-800/40 rounded-md px-2 py-0.5">
              <span className="text-slate-300 font-medium">Sessão:</span>
              <span className="font-mono text-orange-400 font-bold tracking-wider">{sessionCode}</span>
              <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
            </div>
          )}
        </div>
      </div>

      {isDead && <DeathScreen onLeave={handleLeaveGame} />}

      {!isDead && <PlayerHUD />}
      {isOnline && <BandPanel />}
      {!isDead && <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-1.5 h-1.5 bg-white/50 rounded-full z-10 pointer-events-none" />}

      <Canvas shadows={{ type: THREE.PCFShadowMap }}>
        <DynamicEnvironment />
        <group position={[playerChunkPos.x * 50, 0, playerChunkPos.z * 50]}>
          <mesh receiveShadow rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]}>
            <planeGeometry args={[2000, 2000]} />
            <meshStandardMaterial color="#4d7c36" roughness={1} metalness={0} />
          </mesh>
        </group>
        <ProceduralMap chunks={chunks} />
        <EdiblesManager chunks={chunks} />
        <Suspense fallback={null}>
          <NPCDinosaurs />
          <PlayerDinosaur />
          {isOnline && <RemotePlayers />}
        </Suspense>
      </Canvas>
    </div>
  );
};
