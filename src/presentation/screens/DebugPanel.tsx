import React, { useEffect, useState, useRef } from 'react';
import { useAppStore } from '../../store/useAppStore';
import { isMobileDevice } from '../../useCases/game/TouchInputState';

type DinoDebugInfo = {
  speed: number;
  gameScale: number;
  worldScale: number;
};

type NpcCountsInfo = {
  herbivores: number;
  carnivores: number;
};

type WindowWithDinoDebug = Window & {
  dinoDebug?: DinoDebugInfo;
  dinoNpcCounts?: NpcCountsInfo;
};

export const DebugPanel: React.FC = () => {
  const [collapsed, setCollapsed] = useState(isMobileDevice());

  const { 
    level, setLevel, 
    debugZoomUnlocked, setDebugZoomUnlocked,
    selectedDinoId, isDead,
    debugCollisions, toggleDebugCollisions,
    debugNpcLevels, toggleDebugNpcLevels,
    debugNpcVision, toggleDebugNpcVision,
  } = useAppStore();

  const [fps, setFps] = useState(0);
  const [currentSpeed, setCurrentSpeed] = useState(0);
  const [currentSize, setCurrentSize] = useState({ game: 0, world: 0 });
  const [npcCounts, setNpcCounts] = useState({ herbivores: 0, carnivores: 0 });
  
  const frameCount = useRef(0);
  const lastTime = useRef(0);

  useEffect(() => {
    let animationId: number;
    lastTime.current = performance.now();
    
    const updateStats = () => {
      const now = performance.now();
      
      // FPS Calculation (ainda precisa rodar a cada frame para ser preciso, 
      // mas vamos mover o cálculo de FPS para um sistema separado se necessário.
      // Por enquanto, vamos apenas reduzir a frequência de atualização do ESTADO do React)
      frameCount.current++;
      
      if (now - lastTime.current >= 500) {
        setFps(Math.round((frameCount.current * 1000) / (now - lastTime.current)));
        frameCount.current = 0;
        lastTime.current = now;

        // Tenta pegar dados do objeto global injetado pelo PlayerDinosaur
        const debugInfo = (window as WindowWithDinoDebug).dinoDebug;
        if (debugInfo) {
          setCurrentSpeed(debugInfo.speed || 0);
          setCurrentSize({
            game: debugInfo.gameScale || 0,
            world: debugInfo.worldScale || 0
          });
        }

        const counts = (window as WindowWithDinoDebug).dinoNpcCounts;
        if (counts) {
          setNpcCounts(counts);
        }
      }
    };

    // Usamos um frame loop interno apenas para contar FPS, 
    // mas o setFps e outros estados do React só mudam a cada 500ms
    const loop = () => {
      updateStats();
      animationId = requestAnimationFrame(loop);
    };

    animationId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animationId);
  }, []);

  if (!import.meta.env.DEV || isDead) return null;

  const toggleStyle: React.CSSProperties = {
    position: 'absolute',
    top: '85px',
    left: '16px',
    zIndex: 1000,
    backgroundColor: 'rgba(0,0,0,0.7)',
    color: '#00ff00',
    border: '1px solid #444',
    borderRadius: '4px',
    padding: '4px 8px',
    fontFamily: 'monospace',
    fontSize: '11px',
    cursor: 'pointer',
    pointerEvents: 'auto',
  };

  if (collapsed) {
    return (
      <button
        style={toggleStyle}
        onClick={() => setCollapsed(false)}
        onMouseDown={(e) => e.stopPropagation()}
        onPointerDown={(e) => e.stopPropagation()}
      >
        DBG
      </button>
    );
  }

  return (
    <div 
      onMouseDown={(e) => e.stopPropagation()}
      onPointerDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
      style={{
      position: 'absolute',
      top: '85px',
      left: '16px',
      backgroundColor: 'rgba(0, 0, 0, 0.7)',
      color: '#00ff00',
      padding: '15px',
      borderRadius: '8px',
      fontFamily: 'monospace',
      fontSize: '12px',
      zIndex: 1000,
      pointerEvents: 'auto',
      border: '1px solid #444',
      minWidth: '200px',
      boxShadow: '0 4px 15px rgba(0,0,0,0.5)'
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px', borderBottom: '1px solid #444', paddingBottom: '5px' }}>
        <h3 style={{ margin: 0, color: '#fff' }}>
          DEV DEBUG PANEL
        </h3>
        <button
          onClick={() => setCollapsed(true)}
          style={{ ...buttonStyle, padding: '2px 8px', fontSize: '10px' }}
          onMouseDown={(e) => e.stopPropagation()}
        >
          Hide
        </button>
      </div>
      
      <div style={{ marginBottom: '10px' }}>
        <div>FPS: <span style={{ color: fps < 30 ? '#ff4444' : '#fff' }}>{fps}</span></div>
        <div>Speed: <span style={{ color: '#fff' }}>{currentSpeed.toFixed(2)}</span></div>
        <div>Game Scale: <span style={{ color: '#fff' }}>{currentSize.game.toFixed(2)}</span></div>
        <div>World Scale: <span style={{ color: '#fff' }}>{currentSize.world.toFixed(3)}</span></div>
        <div>Dino: <span style={{ color: '#fff' }}>{selectedDinoId}</span></div>
        <div style={{ marginTop: '4px', borderTop: '1px solid #333', paddingTop: '4px' }}>
          <div>Herbívoros: <span style={{ color: '#4caf50' }}>{npcCounts.herbivores}</span></div>
          <div>Carnívoros: <span style={{ color: '#f44336' }}>{npcCounts.carnivores}</span></div>
        </div>
      </div>

      <div style={{ marginBottom: '10px' }}>
        <div style={{ marginBottom: '5px' }}>Level: <strong>{level}</strong></div>
        <div style={{ display: 'flex', gap: '5px' }}>
          <button 
            onClick={(e) => { setLevel(level - 10); e.currentTarget.blur(); }}
            style={buttonStyle}
          > -10 </button>
          <button 
            onClick={(e) => { setLevel(level - 1); e.currentTarget.blur(); }}
            style={buttonStyle}
          > - </button>
          <button 
            onClick={(e) => { setLevel(level + 1); e.currentTarget.blur(); }}
            style={buttonStyle}
          > + </button>
          <button 
            onClick={(e) => { setLevel(level + 10); e.currentTarget.blur(); }}
            style={buttonStyle}
          > +10 </button>
        </div>
      </div>

      <div>
        <ToggleRow
          label="Zoom Unlock"
          enabled={debugZoomUnlocked}
          onToggle={() => setDebugZoomUnlocked(!debugZoomUnlocked)}
        />
        <ToggleRow
          label="Collision Volumes"
          enabled={debugCollisions}
          onToggle={toggleDebugCollisions}
        />
        <ToggleRow
          label="NPC Level Labels"
          enabled={debugNpcLevels}
          onToggle={toggleDebugNpcLevels}
        />
        <ToggleRow
          label="NPC Vision Debug"
          enabled={debugNpcVision}
          onToggle={toggleDebugNpcVision}
        />
        <div style={{ fontSize: '10px', marginTop: '5px', opacity: 0.7 }}>
          (Dev features for internal testing)
        </div>
      </div>
    </div>
  );
};

const buttonStyle: React.CSSProperties = {
  backgroundColor: '#333',
  color: '#fff',
  border: '1px solid #666',
  padding: '5px 10px',
  cursor: 'pointer',
  borderRadius: '4px',
  fontWeight: 'bold',
  outline: 'none'
};

const toggleRootStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  background: 'rgba(255,255,255,0.04)',
  border: '1px solid #444',
  borderRadius: '8px',
  padding: '6px 8px',
  marginBottom: '5px',
  color: '#fff'
};

const toggleTrackStyle: React.CSSProperties = {
  width: '36px',
  height: '18px',
  borderRadius: '999px',
  border: '1px solid #555',
  display: 'flex',
  alignItems: 'center',
  padding: '0 2px',
  cursor: 'pointer',
};

const toggleKnobStyle: React.CSSProperties = {
  width: '12px',
  height: '12px',
  borderRadius: '999px',
  transition: 'transform 120ms ease',
};

const ToggleRow: React.FC<{ label: string; enabled: boolean; onToggle: () => void }> = ({ label, enabled, onToggle }) => {
  return (
    <div style={toggleRootStyle}>
      <span>{label}</span>
      <button
        onClick={(e) => { onToggle(); e.currentTarget.blur(); }}
        style={{
          ...toggleTrackStyle,
          backgroundColor: enabled ? '#225522' : '#442222',
          borderColor: enabled ? '#00ff00' : '#aa3333',
          justifyContent: enabled ? 'flex-end' : 'flex-start',
        }}
      >
        <span style={{ ...toggleKnobStyle, backgroundColor: enabled ? '#00ff88' : '#ff6666' }} />
      </button>
    </div>
  );
};
