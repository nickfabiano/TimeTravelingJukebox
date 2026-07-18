import { useEffect, useRef } from 'react';

export interface KnobProps {
  label: string;
  value: number;
  min: number;
  max: number;
  /** Degrees of physical rotation per unit of value. Small = fast knob. */
  degreesPerUnit: number;
  /** Angle of the indicator at min. Multi-turn knobs just keep rotating. */
  startAngle?: number;
  size?: number;
  display?: string;
  /** Fires continuously while turning. */
  onChange: (value: number) => void;
  /** Fires when the user lets go (or after wheel/keys go idle). */
  onCommit?: (value: number) => void;
  disabled?: boolean;
}

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));

export function Knob({
  label,
  value,
  min,
  max,
  degreesPerUnit,
  startAngle = -135,
  size = 120,
  display,
  onChange,
  onCommit,
  disabled = false,
}: KnobProps) {
  const knobRef = useRef<HTMLDivElement>(null);
  const drag = useRef<{ lastAngle: number; fraction: number } | null>(null);
  const idleCommit = useRef<number | null>(null);
  const valueRef = useRef(value);
  valueRef.current = value;

  useEffect(() => {
    return () => {
      if (idleCommit.current !== null) window.clearTimeout(idleCommit.current);
    };
  }, []);

  const pointerAngle = (e: { clientX: number; clientY: number }) => {
    const rect = knobRef.current!.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    return (Math.atan2(e.clientY - cy, e.clientX - cx) * 180) / Math.PI;
  };

  const applyDelta = (units: number) => {
    const next = clamp(valueRef.current + units, min, max);
    if (next !== valueRef.current) onChange(next);
    return next;
  };

  const scheduleIdleCommit = () => {
    if (idleCommit.current !== null) window.clearTimeout(idleCommit.current);
    idleCommit.current = window.setTimeout(() => {
      idleCommit.current = null;
      onCommit?.(valueRef.current);
    }, 400);
  };

  const handlePointerDown = (e: React.PointerEvent) => {
    if (disabled) return;
    e.preventDefault();
    knobRef.current!.setPointerCapture(e.pointerId);
    drag.current = { lastAngle: pointerAngle(e), fraction: 0 };
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!drag.current) return;
    const angle = pointerAngle(e);
    let delta = angle - drag.current.lastAngle;
    if (delta > 180) delta -= 360;
    if (delta < -180) delta += 360;
    drag.current.lastAngle = angle;
    drag.current.fraction += delta / degreesPerUnit;
    const whole = Math.trunc(drag.current.fraction);
    if (whole !== 0) {
      drag.current.fraction -= whole;
      applyDelta(whole);
    }
  };

  const handlePointerUp = () => {
    if (!drag.current) return;
    drag.current = null;
    onCommit?.(valueRef.current);
  };

  const handleWheel = (e: React.WheelEvent) => {
    if (disabled) return;
    applyDelta(e.deltaY < 0 ? 1 : -1);
    scheduleIdleCommit();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (disabled) return;
    let units = 0;
    if (e.key === 'ArrowUp' || e.key === 'ArrowRight') units = 1;
    else if (e.key === 'ArrowDown' || e.key === 'ArrowLeft') units = -1;
    else if (e.key === 'PageUp') units = 10;
    else if (e.key === 'PageDown') units = -10;
    else if (e.key === 'Home') units = min - valueRef.current;
    else if (e.key === 'End') units = max - valueRef.current;
    else return;
    e.preventDefault();
    applyDelta(units);
    scheduleIdleCommit();
  };

  const rotation = startAngle + (value - min) * degreesPerUnit;

  return (
    <div className={`knob-block${disabled ? ' knob-disabled' : ''}`}>
      <div
        ref={knobRef}
        className="knob"
        style={{ width: size, height: size }}
        role="slider"
        aria-label={label}
        aria-valuemin={min}
        aria-valuemax={max}
        aria-valuenow={value}
        aria-valuetext={display ?? String(value)}
        aria-disabled={disabled}
        tabIndex={disabled ? -1 : 0}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        onWheel={handleWheel}
        onKeyDown={handleKeyDown}
      >
        <div className="knob-face" style={{ transform: `rotate(${rotation}deg)` }}>
          <div className="knob-indicator" />
        </div>
      </div>
      <div className="knob-label">{label}</div>
    </div>
  );
}
