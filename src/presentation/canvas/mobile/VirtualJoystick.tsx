import React, { useRef, useCallback, useState } from 'react';
import { touchInput } from '../../../useCases/game/TouchInputState';

const BASE_SIZE = 140;
const KNOB_SIZE = 50;
const DEAD_ZONE = 0.15;
const TAP_THRESHOLD = 12;

export const VirtualJoystick: React.FC = () => {
  const baseRef = useRef<HTMLDivElement>(null);
  const knobRef = useRef<HTMLDivElement>(null);
  const touchIdRef = useRef<number | null>(null);
  const baseRectRef = useRef<DOMRect | null>(null);
  const startPosRef = useRef<{ x: number; y: number } | null>(null);
  const [sprintOn, setSprintOn] = useState(touchInput.sprintToggled);

  const updateKnob = useCallback((x: number, y: number) => {
    const knob = knobRef.current;
    if (!knob) return;
    knob.style.transform = `translate3d(${x}px, ${y}px, 0)`;
  }, []);

  const resetKnob = useCallback(() => {
    updateKnob(0, 0);
    touchInput.moveX = 0;
    touchInput.moveZ = 0;
    touchIdRef.current = null;
  }, [updateKnob]);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (touchIdRef.current !== null) return;
    const touch = e.changedTouches[0];
    touchIdRef.current = touch.identifier;
    startPosRef.current = { x: touch.clientX, y: touch.clientY };

    const base = baseRef.current;
    if (!base) return;

    // Lock the rect so it doesn't change during the gesture
    baseRectRef.current = base.getBoundingClientRect();

    const rect = baseRectRef.current;
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const maxR = rect.width / 2 - KNOB_SIZE / 2;

    const dx = touch.clientX - cx;
    const dy = touch.clientY - cy;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const clampedDist = Math.min(dist, maxR);
    const angle = Math.atan2(dy, dx);

    const nx = Math.cos(angle) * clampedDist;
    const ny = Math.sin(angle) * clampedDist;

    const normX = nx / maxR;
    const normY = ny / maxR;

    if (dist < DEAD_ZONE * maxR) {
      resetKnob();
      return;
    }

    updateKnob(nx, ny);

    // Invert Z so up on screen = forward (+Z in game world)
    touchInput.moveX = normX;
    touchInput.moveZ = -normY;
  }, [resetKnob, updateKnob]);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (touchIdRef.current === null) return;
    const touch = Array.from(e.changedTouches).find(t => t.identifier === touchIdRef.current);
    if (!touch) return;

    const rect = baseRectRef.current;
    if (!rect) return;
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const maxR = rect.width / 2 - KNOB_SIZE / 2;

    const dx = touch.clientX - cx;
    const dy = touch.clientY - cy;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const clampedDist = Math.min(dist, maxR);
    const angle = Math.atan2(dy, dx);

    const nx = Math.cos(angle) * clampedDist;
    const ny = Math.sin(angle) * clampedDist;

    const normX = nx / maxR;
    const normY = ny / maxR;

    if (dist < DEAD_ZONE * maxR) {
      resetKnob();
      return;
    }

    updateKnob(nx, ny);
    touchInput.moveX = normX;
    touchInput.moveZ = -normY;
  }, [resetKnob, updateKnob]);

  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    if (touchIdRef.current === null) return;
    const touch = Array.from(e.changedTouches).find(t => t.identifier === touchIdRef.current);
    if (!touch) return;

    // Detect tap (start and end close together) to toggle sprint
    if (startPosRef.current) {
      const dx = touch.clientX - startPosRef.current.x;
      const dy = touch.clientY - startPosRef.current.y;
      if (Math.sqrt(dx * dx + dy * dy) < TAP_THRESHOLD) {
        const next = !touchInput.sprintToggled;
        touchInput.sprintToggled = next;
        setSprintOn(next);
      }
    }
    startPosRef.current = null;
    resetKnob();
  }, [resetKnob]);

  const handleTouchCancel = useCallback(() => {
    resetKnob();
  }, [resetKnob]);

  return (
      <div
        ref={baseRef}
        className="mobile-joystick"
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onTouchCancel={handleTouchCancel}
        style={{
        position: 'absolute',
        bottom: 100,
        left: 24,
        width: BASE_SIZE,
        height: BASE_SIZE,
        borderRadius: '50%',
        background: 'rgba(255,255,255,0.1)',
        border: '2px solid rgba(255,255,255,0.2)',
        touchAction: 'none',
        zIndex: 30,
        userSelect: 'none',
        WebkitUserSelect: 'none',
      }}
    >
      <div
        ref={knobRef}
        style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          width: KNOB_SIZE,
          height: KNOB_SIZE,
          borderRadius: '50%',
          background: sprintOn ? 'rgba(251,146,60,0.8)' : 'rgba(255,255,255,0.6)',
          pointerEvents: 'none',
          marginTop: -(KNOB_SIZE / 2),
          marginLeft: -(KNOB_SIZE / 2),
          transition: 'background 0.15s',
        }}
      />
      {sprintOn && (
        <div
          style={{
            position: 'absolute',
            bottom: -18,
            left: '50%',
            transform: 'translateX(-50%)',
            color: '#fb923c',
            fontSize: 9,
            fontWeight: 700,
            letterSpacing: '1px',
            whiteSpace: 'nowrap',
            pointerEvents: 'none',
          }}
        >
          RUN
        </div>
      )}
    </div>
  );
};
