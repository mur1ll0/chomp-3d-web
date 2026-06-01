import React, { useRef, useCallback } from 'react';
import { touchInput } from '../../../useCases/game/TouchInputState';
import { VirtualJoystick } from './VirtualJoystick';

const BTN = 58;
const GAP = 8;

export const MobileControls: React.FC = () => {
  const cameraId = useRef<number | null>(null);
  const lastPos = useRef<{ x: number; y: number } | null>(null);

  const onCamStart = useCallback((e: React.TouchEvent) => {
    if (cameraId.current !== null) return;
    const t = e.changedTouches[0];
    cameraId.current = t.identifier;
    lastPos.current = { x: t.clientX, y: t.clientY };
  }, []);

  const onCamMove = useCallback((e: React.TouchEvent) => {
    if (cameraId.current === null) return;
    const t = Array.from(e.changedTouches).find(t => t.identifier === cameraId.current);
    if (!t || !lastPos.current) return;
    const dx = t.clientX - lastPos.current.x;
    const dy = t.clientY - lastPos.current.y;
    touchInput.cameraYaw += dx;
    touchInput.cameraPitch += dy;
    lastPos.current = { x: t.clientX, y: t.clientY };
  }, []);

  const onCamEnd = useCallback((e: React.TouchEvent) => {
    const t = Array.from(e.changedTouches).find(t => t.identifier === cameraId.current);
    if (!t) return;
    cameraId.current = null;
    lastPos.current = null;
  }, []);

  const onCamCancel = useCallback(() => {
    cameraId.current = null;
    lastPos.current = null;
  }, []);

  const btnStyle = (color: string): React.CSSProperties => ({
    width: BTN,
    height: BTN,
    borderRadius: '50%',
    background: `rgba(${color}, 0.35)`,
    border: `2px solid rgba(${color}, 0.7)`,
    color: '#fff',
    fontSize: 11,
    fontWeight: 700,
    letterSpacing: '0.5px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    WebkitTapHighlightColor: 'transparent',
    touchAction: 'none',
  });

  return (
    <>
      {/* Camera drag zone — right 60 %, full height */}
      <div
        onTouchStart={onCamStart}
        onTouchMove={onCamMove}
        onTouchEnd={onCamEnd}
        onTouchCancel={onCamCancel}
        style={{
          position: 'fixed',
          inset: 0,
          width: '60%',
          height: '100%',
          marginLeft: '40%',
          touchAction: 'none',
          zIndex: 15,
          userSelect: 'none',
        }}
      />

      <VirtualJoystick />

      {/* Action buttons */}
      <div
        style={{
          position: 'fixed',
          bottom: 28,
          right: 14,
          display: 'flex',
          gap: GAP,
          zIndex: 25,
          touchAction: 'none',
          userSelect: 'none',
        }}
      >
        <button className="mobile-btn" onTouchStart={(e) => { e.stopPropagation(); touchInput.jump = true; }} style={btnStyle('59,130,246')}>
          JUMP
        </button>
        <button className="mobile-btn" onTouchStart={(e) => { e.stopPropagation(); touchInput.attack = true; }} style={btnStyle('239,68,68')}>
          ATK
        </button>
        <button className="mobile-btn" onTouchStart={(e) => { e.stopPropagation(); touchInput.eat = true; }} style={btnStyle('34,197,94')}>
          EAT
        </button>
      </div>
    </>
  );
};
