import React, { useState, Suspense, startTransition } from 'react';
import { useAppStore } from '../../store/useAppStore';
import { useT } from '../../i18n/useT';
import { DINOSAUR_ROSTER, type Diet } from '../../domain/models/DinosaurStats';
import { ArrowLeft, Play, Loader2, Shuffle } from 'lucide-react';
import { PeerMesh } from '../../infrastructure/network/PeerMesh';
import { peerSession } from '../../infrastructure/network/PeerSession';
import { EventReplicator } from '../../infrastructure/network/EventReplicator';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Center, Environment, useGLTF, Bounds } from '@react-three/drei';
import * as THREE from 'three';
import { HexColorPicker } from 'react-colorful';

// Componente interno do Canvas que carrega e exibe o modelo
const DinosaurModel = ({ modelPath, activeMaterial, onMaterialsLoaded }: { modelPath: string, activeMaterial: string | null, onMaterialsLoaded: (mats: string[]) => void }) => {
  const gltf = useGLTF(modelPath);
  const { dinoColors, setDinoColor } = useAppStore();

  // Extrair nomes únicos de materiais do GLB
  const materials = React.useMemo(() => {
    const mats: Record<string, THREE.Material> = {};
    if (gltf.scene) {
      gltf.scene.traverse((child) => {
        if ((child as THREE.Mesh).isMesh) {
          const m = (child as THREE.Mesh).material as THREE.Material;
          if (m && !Array.isArray(m) && m.name) {
            mats[m.name] = m;
          }
        }
      });
    }
    return Object.keys(mats);
  }, [gltf.scene]);

  // Notifica o componente Pai (UI HTML) sobre os materiais carregados
  React.useEffect(() => {
    onMaterialsLoaded(materials);
  }, [materials, onMaterialsLoaded]);

  // Inicializar cores padrão extraídas do próprio modelo
  React.useEffect(() => {
    materials.forEach(matName => {
      if (!dinoColors[matName]) {
        let defaultColor = '#ffffff';
        gltf.scene.traverse((child) => {
          if ((child as THREE.Mesh).isMesh) {
            const m = (child as THREE.Mesh).material as THREE.MeshStandardMaterial;
            if (m && !Array.isArray(m) && m.name === matName && m.color) {
              defaultColor = '#' + m.color.getHexString();
            }
          }
        });
        setDinoColor(matName, defaultColor);
      }
    });
  }, [materials, modelPath, gltf.scene, dinoColors, setDinoColor]);

  // Aplicar cores da store aos materiais originais em tempo real
  React.useEffect(() => {
    if (!gltf.scene) return;
    gltf.scene.traverse((child) => {
      if ((child as THREE.Mesh).isMesh || (child as THREE.SkinnedMesh).isSkinnedMesh) {
        const mesh = child as THREE.Mesh;
        if (mesh.material && !Array.isArray(mesh.material)) {
           const mat = mesh.material as THREE.MeshStandardMaterial;
           if (mat.name && dinoColors[mat.name]) {
             mat.color.set(dinoColors[mat.name]);
             mat.needsUpdate = true;
           }
           
           // Emissive highlight para o material ativo
           if (activeMaterial && mat.name === activeMaterial) {
             mat.emissive.set(dinoColors[mat.name]);
             mat.emissiveIntensity = 0.5;
           } else {
             mat.emissive.setHex(0x000000);
             mat.emissiveIntensity = 0;
           }
        }
      }
    });
  }, [gltf.scene, dinoColors, activeMaterial]);

  return <primitive object={gltf.scene} />;
};

// Componente para Configuração do Dinossauro (UI)
const DinosaurConfiguratorUI = ({ modelPath }: { modelPath: string }) => {
  const { dinoColors, setDinoColor } = useAppStore();
  const t = useT();
  const [activeMaterial, setActiveMaterial] = useState<string | null>(null);
  const [materials, setMaterials] = useState<string[]>([]);

  const handleMaterialsLoaded = React.useCallback((mats: string[]) => {
    setMaterials(mats);
  }, []);

  return (
    <div className="w-full h-full flex flex-col relative">
      
      {/* O Canvas nunca deve ser desmontado para não dar Context Lost */}
      <Canvas shadows={{ type: THREE.PCFShadowMap }} camera={{ position: [0, 3, 12], fov: 45 }}>
        <color attach="background" args={['#0f172a']} />
        <ambientLight intensity={0.5} />
        <directionalLight position={[5, 5, 5]} intensity={1} castShadow />
        <Suspense fallback={null}>
          <Environment preset="city" />
          <Bounds fit clip observe margin={1.2}>
            <Center>
              <DinosaurModel 
                 modelPath={modelPath} 
                 activeMaterial={activeMaterial} 
                 onMaterialsLoaded={handleMaterialsLoaded} 
              />
            </Center>
          </Bounds>
        </Suspense>
        <OrbitControls makeDefault autoRotate autoRotateSpeed={2} enableZoom={true} minDistance={1} maxDistance={20} />
      </Canvas>

      {/* Overlay de Loading (Mostra enquanto o modelo 3D suspende a árvore interna) */}
      {materials.length === 0 && (
        <div className="absolute inset-0 z-30 flex flex-col items-center justify-center bg-slate-900/60 backdrop-blur-sm pointer-events-none">
          <Loader2 className="w-10 h-10 animate-spin text-orange-500 mb-4 shadow-orange-500" />
          <span className="font-bold text-slate-300 animate-pulse tracking-wider">{t('char.loading3d')}</span>
        </div>
      )}

      {/* Interface overlay de seleção de cores por material */}
      {materials.length > 0 && (
        <div className="absolute bottom-4 left-0 right-0 flex flex-col items-center gap-4 z-20">
          
          {/* Color Picker popover */}
          {activeMaterial && (
            <div className="p-3 bg-slate-900/90 backdrop-blur-md rounded-2xl shadow-2xl border border-slate-700 animate-in fade-in zoom-in duration-200">
              <div className="text-xs font-bold text-slate-400 mb-2 text-center">
                {t('char.part', { n: materials.indexOf(activeMaterial) + 1 })}
              </div>
              <HexColorPicker 
                color={dinoColors[activeMaterial] || '#ffffff'} 
                onChange={(color) => setDinoColor(activeMaterial, color)} 
              />
            </div>
          )}

          {/* Bolinhas de materiais */}
          <div className="flex gap-3 bg-slate-900/80 p-2 rounded-full backdrop-blur-md border border-slate-700/50 shadow-xl">
            {materials.map((matName, index) => (
              <button 
                key={matName}
                onClick={() => setActiveMaterial(activeMaterial === matName ? null : matName)}
                className={`w-8 h-8 rounded-full border-2 shadow-inner transition-all hover:scale-110 ${activeMaterial === matName ? 'border-orange-500 scale-110' : 'border-slate-600'}`}
                style={{ backgroundColor: dinoColors[matName] || '#ffffff' }}
                title={t('char.paintPart', { n: index + 1 })}
              />
            ))}
            {materials.length === 0 && <span className="text-xs px-2 text-slate-500">{t('char.noCustomMaterials')}</span>}
          </div>
        </div>
      )}
    </div>
  );
};

const DINO_NAMES = [
  'Thunderclaw', 'Rexblade', 'Shadowfang', 'Stormstrike', 'Venomspike',
  'Titanstomp', 'Furyhorn', 'Doomtusk', 'Novaheart', 'Omegaforce',
  'Bladeclaw', 'Stonehide', 'Ironjaw', 'Thornback', 'Saberfang',
  'Duskstalker', 'Bouldertail', 'Firemane', 'Iceblood', 'Swiftstrike',
  'Raptoris', 'Sauronix', 'Clawdius', 'Fangor', 'Terraxl',
  'Stomper', 'Crushar', 'Striker', 'Hunter', 'Tracker',
  'Spikeback', 'Razorclaw', 'Grimjaw', 'Warstomp', 'Wildfang',
  'Chomper', 'Bitez', 'Muncher', 'Gnashar', 'Nomster',
];

function randomDinoName(): string {
  return DINO_NAMES[Math.floor(Math.random() * DINO_NAMES.length)];
}

export const CharacterSelectionMenu: React.FC = () => {
  const t = useT();
  const { 
    gameMode, setScreen, setGameMode,
    playerName, setPlayerName, 
    selectedDinoId, setSelectedDinoId,
    sessionCode, setSessionCode,
    setPackCode,
  } = useAppStore();

  const [packCodeInput, setPackCodeInput] = useState('');
  const [dietFilter, setDietFilter] = useState<Diet>('Carnivore');

  const filteredDinos = DINOSAUR_ROSTER.filter(d => d.diet === dietFilter);
  const selectedDino = DINOSAUR_ROSTER.find(d => d.id === selectedDinoId) || filteredDinos[0];

  const handleSelectDino = (id: string) => {
    startTransition(() => {
      setSelectedDinoId(id);
    });
  };

  const handleStartGame = async () => {
    if ((gameMode === 'global' || gameMode === 'party') && !playerName.trim()) {
      alert(t('char.alert.enterName'));
      return;
    }

    if (gameMode === 'party') {
      try {
        if (sessionCode) {
          await peerSession.joinSession(sessionCode, { playerName, dinoId: selectedDinoId, dinoColors: useAppStore.getState().dinoColors });
        } else {
          await peerSession.startHost();
        }
        useAppStore.getState().setOnlineRole(sessionCode ? 'client' : 'host');
        const code = peerSession.getSessionCode();
        setSessionCode(code);
        PeerMesh.setPlayerInfo(playerName, selectedDinoId, useAppStore.getState().dinoColors);
        // Host: startParty() sem código (cria peer com o código da sessão)
        // Client: startParty(código) (conecta ao peer do host)
        await PeerMesh.startParty(sessionCode ? code : undefined);
      } catch {
        alert(t('char.alert.partyError'));
        return;
      }
    }

    if (gameMode === 'global') {
      try {
        let code = useAppStore.getState().packCode;
        if (!code) {
          code = PeerMesh.getSessionCode(); // Fallback if no code typed
        }
        setPackCode(code);
        PeerMesh.setPackCode(code);
        
        PeerMesh.setPlayerInfo(playerName, selectedDinoId, useAppStore.getState().dinoColors);
        await PeerMesh.startGlobal();
      } catch {
        alert(t('char.alert.globalError'));
        return;
      }
    }

    // Ativa replicação de eventos (NPC combat, etc.) entre peers
    if (gameMode === 'global' || gameMode === 'party') {
      EventReplicator.enable();
    }

    // Associa pack code: Party = session code, Global = código digitado ou auto-gerado
    if (gameMode === 'global' || gameMode === 'party') {
      let code: string;
      if (gameMode === 'party') {
        code = peerSession.getSessionCode();
        setPackCode(code);
        // Party mode pack is handled inherently by PeerSession's pack logic
      } else {
        code = useAppStore.getState().packCode || PeerMesh.getSessionCode();

        // Aguarda mais tempo para conexões p2p (handshakes) completarem
        await new Promise(r => setTimeout(r, 3000));
        if (!PeerMesh.getPackMembers().length) {
          // Só cria se nenhum outro peer conectado já possuir o mesmo packCode
          const peers = PeerMesh.getConnectedPeers();
          const hasLeader = peers.some(p => p.packCode === code);
          if (!hasLeader) {
            PeerMesh.createPack();
          } else {
            // Se tem líder mas não entrou no pack automaticamente (provavelmente por lag de WebRTC), tenta forçar o join
            const leader = peers.find(p => p.packCode === code);
            if (leader) PeerMesh.requestJoinPack(leader.peerId);
          }
        }
      }
    }

    setScreen('game');
  };

  const handleBack = () => {
    setSessionCode('');
    setPackCode('');
    setGameMode(null);
    setScreen('session-select');
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-slate-900 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-slate-800 to-slate-950 text-slate-200 p-4">
      <div className="max-w-6xl w-full p-8 bg-slate-800/80 backdrop-blur-md rounded-2xl shadow-2xl border border-slate-700/50 flex flex-col md:flex-row gap-8 min-h-[600px]">
        
        {/* Left Column: Selection */}
        <div className="flex-1 flex flex-col gap-6">
          <div className="flex items-center gap-4">
            <button 
              onClick={handleBack}
              className="p-2 hover:bg-slate-700 rounded-full transition-colors"
            >
              <ArrowLeft className="w-6 h-6 text-slate-300" />
            </button>
            <h2 className="text-3xl font-bold text-white">{t('char.title')}</h2>
          </div>

          {(gameMode === 'global' || gameMode === 'party') && (
            <div className="space-y-2">
              <label className="block text-sm font-medium text-slate-400">{t('char.playerName')}</label>
              <div className="flex gap-2">
                <input 
                  type="text" 
                  value={playerName}
                  onChange={(e) => setPlayerName(e.target.value)}
                  placeholder={t('char.playerNamePlaceholder')}
                  className="flex-1 bg-slate-700/50 border border-slate-600 rounded-lg p-3 text-white focus:outline-none focus:border-orange-500 transition-colors"
                  maxLength={15}
                />
                <button
                  onClick={() => setPlayerName(randomDinoName())}
                  className="px-3 bg-slate-700/50 hover:bg-slate-600 border border-slate-600 rounded-lg text-slate-300 hover:text-white transition-all active:scale-95"
                  title="Random name"
                >
                  <Shuffle className="w-5 h-5" />
                </button>
              </div>
            </div>
          )}

          {gameMode === 'global' && (
            <div className="bg-blue-900/30 border border-blue-500/30 rounded-xl p-3 text-center">
              <div className="text-xs text-blue-400 uppercase tracking-wider">{t('char.mode.global')}</div>
              <div className="text-xs text-green-400 mt-1">{t('char.p2p')}</div>
            </div>
          )}

          {gameMode === 'global' && (
            <div className="space-y-2">
              <label className="block text-sm font-medium text-slate-400">{t('char.packCode')}</label>
              <input
                type="text"
                value={packCodeInput}
                onChange={(e) => {
                  setPackCodeInput(e.target.value.toUpperCase());
                  if (e.target.value.trim()) {
                    setPackCode(e.target.value.trim().toUpperCase());
                  } else {
                    setPackCode('');
                  }
                }}
                placeholder={t('char.packCodePlaceholder')}
                className="w-full bg-slate-700/50 border border-slate-600 rounded-lg p-3 text-white focus:outline-none focus:border-orange-500 transition-colors font-mono tracking-wider uppercase"
              />
              <p className="text-xs text-slate-500">
                {t('char.packCodeDesc')}
              </p>
            </div>
          )}

          <div className="flex gap-2 p-1 bg-slate-900/50 rounded-lg">
            <button 
              onClick={() => setDietFilter('Carnivore')}
              className={`flex-1 py-2 rounded-md font-bold transition-all ${dietFilter === 'Carnivore' ? 'bg-red-500/20 text-red-400' : 'text-slate-500 hover:text-slate-300'}`}
            >
              {t('char.carnivore')}
            </button>
            <button 
              onClick={() => setDietFilter('Herbivore')}
              className={`flex-1 py-2 rounded-md font-bold transition-all ${dietFilter === 'Herbivore' ? 'bg-green-500/20 text-green-400' : 'text-slate-500 hover:text-slate-300'}`}
            >
              {t('char.herbivore')}
            </button>
          </div>

          <div className="grid grid-cols-2 gap-3 overflow-y-auto max-h-[300px] custom-scrollbar pr-2">
            {filteredDinos.map(dino => (
              <button
                key={dino.id}
                onClick={() => handleSelectDino(dino.id)}
                className={`p-4 rounded-xl border text-left transition-all ${
                  selectedDinoId === dino.id 
                    ? 'border-orange-500 bg-orange-500/10 shadow-lg shadow-orange-500/20' 
                    : 'border-slate-700 bg-slate-800/50 hover:bg-slate-700'
                }`}
              >
                <div className="font-bold text-white">{dino.name}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Middle Column: 3D Preview */}
        <div className="hidden lg:flex w-[300px] xl:w-[400px] flex-col rounded-xl overflow-hidden relative border border-slate-700/50 bg-slate-900/50 justify-center">
          <div className="absolute top-4 left-4 z-10 bg-slate-800/80 backdrop-blur px-3 py-1 rounded-full text-xs font-bold text-slate-300 border border-slate-700">
            {t('char.preview')}
          </div>
          <Suspense fallback={
            <div className="flex flex-col items-center justify-center h-full text-slate-400 gap-3">
              <Loader2 className="w-8 h-8 animate-spin text-orange-500" />
              <span className="font-medium animate-pulse">{t('char.loadingModel')}</span>
            </div>
          }>
            <DinosaurConfiguratorUI key={selectedDino.modelPath} modelPath={selectedDino.modelPath} />
          </Suspense>
        </div>

        {/* Right Column: Stats & Confirmation */}
        <div className="w-full lg:w-[350px] bg-slate-900/50 rounded-xl p-6 border border-slate-700/50 flex flex-col">
          <div className="text-center mb-6">
            <h3 className="text-2xl font-black text-white tracking-wide">{selectedDino.name}</h3>
            <span className={`text-xs uppercase font-bold px-2 py-1 rounded-full ${selectedDino.diet === 'Carnivore' ? 'bg-red-500/20 text-red-400' : 'bg-green-500/20 text-green-400'}`}>
              {selectedDino.diet}
            </span>
          </div>

          <div className="space-y-4 mb-6">
            <div>
              <div className="flex justify-between text-sm mb-1">
                <span className="text-slate-400">{t('char.walkSpeed')}</span>
                <span className="font-bold">{selectedDino.walkSpeed}/10</span>
              </div>
              <div className="h-2 bg-slate-800 rounded-full overflow-hidden mb-3">
                <div className="h-full bg-blue-400" style={{ width: `${(selectedDino.walkSpeed / 10) * 100}%` }} />
              </div>
            </div>
            <div>
              <div className="flex justify-between text-sm mb-1">
                <span className="text-slate-400">{t('char.runSpeed')}</span>
                <span className="font-bold">{selectedDino.runSpeed}/25</span>
              </div>
              <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
                <div className="h-full bg-indigo-500" style={{ width: `${(selectedDino.runSpeed / 25) * 100}%` }} />
              </div>
            </div>
            <div>
              <div className="flex justify-between text-sm mb-1">
                <span className="text-slate-400">{t('char.strength')}</span>
                <span className="font-bold">{selectedDino.strength}/10</span>
              </div>
              <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
                <div className="h-full bg-red-500" style={{ width: `${(selectedDino.strength / 10) * 100}%` }} />
              </div>
            </div>
            <div>
              <div className="flex justify-between text-sm mb-1">
                <span className="text-slate-400">{t('char.vitality')}</span>
                <span className="font-bold">{selectedDino.vitality}/10</span>
              </div>
              <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
                <div className="h-full bg-green-500" style={{ width: `${(selectedDino.vitality / 10) * 100}%` }} />
              </div>
            </div>
          </div>

          <div className="mt-auto">
            <button 
              onClick={handleStartGame}
              className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-orange-500 to-red-600 hover:from-orange-400 hover:to-red-500 text-white font-bold py-4 px-6 rounded-xl shadow-lg transition-all active:scale-95"
            >
              <Play className="w-5 h-5 fill-current" />
              {t('char.start')}
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
