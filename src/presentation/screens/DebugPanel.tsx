import React, { useEffect, useState, useRef } from 'react';
import { useAppStore } from '../../store/useAppStore';

type DinoDebugInfo = {
  speed: number;
  gameScale: number;
  worldScale: number;
};

type WindowWithDinoDebug = Window & {
  dinoDebug?: DinoDebugInfo;
};

export const DebugPanel: React.FC = () => {
  const { 
    level, setLevel, 
    debugZoomUnlocked, setDebugZoomUnlocked,
    selectedDinoId, isDead,
    debugCollisions, toggleDebugCollisions
  } = useAppStore();

  const [fps, setFps] = useState(0);
  const [currentSpeed, setCurrentSpeed] = useState(0);
  const [currentSize, setCurrentSize] = useState({ game: 0, world: 0 });
  
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

  return (
    <div 
      onMouseDown={(e) => e.stopPropagation()}
      onPointerDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
      style={{
      position: 'absolute',
      top: '85px',
      right: '16px',
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
      <h3 style={{ margin: '0 0 10px 0', borderBottom: '1px solid #444', paddingBottom: '5px', color: '#fff' }}>
        DEV DEBUG PANEL
      </h3>
      
      <div style={{ marginBottom: '10px' }}>
        <div>FPS: <span style={{ color: fps < 30 ? '#ff4444' : '#fff' }}>{fps}</span></div>
        <div>Speed: <span style={{ color: '#fff' }}>{currentSpeed.toFixed(2)}</span></div>
        <div>Game Scale: <span style={{ color: '#fff' }}>{currentSize.game.toFixed(2)}</span></div>
        <div>World Scale: <span style={{ color: '#fff' }}>{currentSize.world.toFixed(3)}</span></div>
        <div>Dino: <span style={{ color: '#fff' }}>{selectedDinoId}</span></div>
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
        <button 
          onClick={(e) => { setDebugZoomUnlocked(!debugZoomUnlocked); e.currentTarget.blur(); }}
          style={{
            ...buttonStyle,
            width: '100%',
            backgroundColor: debugZoomUnlocked ? '#225522' : '#442222',
            color: '#fff',
            borderColor: debugZoomUnlocked ? '#00ff00' : '#ff0000',
            marginBottom: '5px'
          }}
        >
          {debugZoomUnlocked ? '🔓 ZOOM UNLOCKED' : '🔒 ZOOM LOCKED'}
        </button>
        <button 
          onClick={(e) => { toggleDebugCollisions(); e.currentTarget.blur(); }}
          style={{
            ...buttonStyle,
            width: '100%',
            backgroundColor: debugCollisions ? '#225522' : '#442222',
            color: '#fff',
            borderColor: debugCollisions ? '#00ff00' : '#ff0000'
          }}
        >
          {debugCollisions ? '📦 HIDE COLLISIONS' : '📦 SHOW COLLISIONS'}
        </button>
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
