import React, { useRef, useState, useCallback, useEffect } from 'react';

/**
 * TiltCard — 3D tilt with velocity-based spring physics (semi-implicit
 * Euler), reactive specular glare scaled by tilt magnitude, rainbow foil
 * and cursor-tracking hotspot.
 *
 * Pointer position sets *target* rotation; an rAF loop integrates a damped
 * spring toward it every frame (real momentum, slight overshoot on entry,
 * overdamped snap on exit). Reduced motion → no tilt, static glare only.
 * CSS vars (--mx, --my, --glare-o) drive .holo-overlay / .holo-foil /
 * .holo-spotlight layers.
 */
const TiltCard = ({
  children,
  className = '',
  max = 14,
  scale = 1.04,
  glare = true,
  foil = false,
  spotlight = false,
  perspective = 1000,
  stiffness = 170,
  damping = 22,
  as: Tag = 'div',
  ...rest
}) => {
  const ref = useRef(null);
  const raf = useRef(null);
  const [active, setActive] = useState(false);
  const state = useRef({
    cx: 0, cy: 0, cs: 1,
    vx: 0, vy: 0, vs: 0,
    tx: 0, ty: 0, ts: 1,
    mx: 50, my: 50,
    hovering: false,
    running: false,
    reduced: false,
    lastT: 0
  });

  useEffect(() => {
    state.current.reduced =
      typeof window !== 'undefined' &&
      window.matchMedia &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }, []);

  const writeFrame = useCallback((now) => {
    const el = ref.current;
    if (!el) return;
    const s = state.current;

    const dt = Math.min(0.032, Math.max(0.001, (now - (s.lastT || now)) / 1000));
    s.lastT = now;

    // Overdamp the return so exit settles ~25% faster with no wobble
    const k = stiffness;
    const c = s.hovering ? damping : damping * 1.6;

    const step = (cur, vel, target) => {
      const acc = k * (target - cur) - c * vel;
      const v = vel + acc * dt;
      return [cur + v * dt, v];
    };
    [s.cx, s.vx] = step(s.cx, s.vx, s.tx);
    [s.cy, s.vy] = step(s.cy, s.vy, s.ty);
    [s.cs, s.vs] = step(s.cs, s.vs, s.ts);

    el.style.transform =
      `perspective(${perspective}px) rotateX(${s.cx.toFixed(3)}deg) rotateY(${s.cy.toFixed(3)}deg) scale(${s.cs.toFixed(4)})`;
    el.style.setProperty('--mx', `${s.mx.toFixed(2)}`);
    el.style.setProperty('--my', `${s.my.toFixed(2)}`);

    // Specular glare strengthens with tilt magnitude
    const mag = Math.min(1, Math.hypot(s.cx, s.cy) / max);
    el.style.setProperty('--glare-o', (0.55 + 0.45 * mag).toFixed(3));

    const settled =
      Math.abs(s.tx - s.cx) < 0.01 && Math.abs(s.vx) < 0.01 &&
      Math.abs(s.ty - s.cy) < 0.01 && Math.abs(s.vy) < 0.01 &&
      Math.abs(s.ts - s.cs) < 0.001 && Math.abs(s.vs) < 0.001;

    if (settled && !s.hovering) {
      s.running = false;
      s.lastT = 0;
      el.style.transform = `perspective(${perspective}px) rotateX(0deg) rotateY(0deg) scale(1)`;
      el.style.setProperty('--mx', '50');
      el.style.setProperty('--my', '50');
      el.style.willChange = 'auto';
      setActive(false);
    } else {
      raf.current = requestAnimationFrame(writeFrame);
    }
  }, [perspective, stiffness, damping, max]);

  const startLoop = useCallback(() => {
    const s = state.current;
    if (!s.running) {
      s.running = true;
      s.lastT = 0;
      raf.current = requestAnimationFrame(writeFrame);
    }
  }, [writeFrame]);

  const handleMove = useCallback((e) => {
    const el = ref.current;
    const s = state.current;
    if (!el || s.reduced) return;
    const rect = el.getBoundingClientRect();
    const px = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));
    const py = Math.min(1, Math.max(0, (e.clientY - rect.top) / rect.height));
    s.ty = (px - 0.5) * (max * 2);
    s.tx = (0.5 - py) * (max * 2);
    s.ts = scale;
    s.mx = px * 100;
    s.my = py * 100;
    startLoop();
  }, [max, scale, startLoop]);

  const handleEnter = useCallback((e) => {
    const s = state.current;
    s.hovering = true;
    if (ref.current && !s.reduced) ref.current.style.willChange = 'transform';
    setActive(true);
    handleMove(e);
  }, [handleMove]);

  const handleLeave = useCallback(() => {
    const s = state.current;
    s.hovering = false;
    s.tx = 0;
    s.ty = 0;
    s.ts = 1;
    startLoop();
  }, [startLoop]);

  useEffect(() => () => {
    if (raf.current) cancelAnimationFrame(raf.current);
  }, []);

  return (
    <Tag
      ref={ref}
      onMouseMove={handleMove}
      onMouseEnter={handleEnter}
      onMouseLeave={handleLeave}
      className={`holo-card ${active ? 'is-tilting' : ''} ${className}`}
      {...rest}
    >
      {children}
      {foil && <span aria-hidden="true" className="holo-foil rounded-[inherit]" />}
      {glare && <span aria-hidden="true" className="holo-overlay rounded-[inherit]" />}
      {spotlight && <span aria-hidden="true" className="holo-spotlight rounded-[inherit]" />}
    </Tag>
  );
};

export default TiltCard;
