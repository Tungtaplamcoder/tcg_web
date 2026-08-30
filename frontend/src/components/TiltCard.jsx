import React, { useRef, useState, useCallback, useEffect, useMemo } from 'react';

/**
 * TiltCard — 3D tilt with velocity-based spring physics (semi-implicit
 * Euler), reactive specular glare scaled by tilt magnitude, rainbow foil,
 * cursor-tracking hotspot, and the VIP PRO hover stack:
 *
 *   • Dynamic holographic sheen (.vip-holo) — gradient angle + conic
 *     oil-slick that bends with cursor position via --mx/--my.
 *   • Chasing edge light (.vip-edge) — thin neon runner racing the card
 *     perimeter, colored by the rarity token in --edge.
 *   • Breakout particles (.vip-breakout) — glowing geometric motes +
 *     a perspective light-grid overflowing from behind the frame.
 *   • Micro-glitch entry (.is-glitching, 100ms) — one-shot chromatic
 *     aberration "activation" jitter on first hover entry.
 *   • True parallax depth — children at different translateZ offsets
 *     (see .vip-depth-* utilities) drift at different screen rates
 *     under perspective(1200px).
 *
 * Pointer position sets *target* rotation; an rAF loop integrates a damped
 * spring toward it every frame (real momentum, slight overshoot on entry,
 * overdamped snap on exit). Reduced motion → no tilt, static glare only.
 * CSS vars (--mx, --my, --glare-o, --px, --py, --edge) drive all layers.
 */

const RARITY_EDGE = {
  // gacha enum (Virtual Boxes)
  common: '#94a3b8',
  uncommon: '#34d399',
  rare: '#8b5cf6',
  epic: '#d946ef',
  legendary: '#e9c46a',
  // TCG rarity ladder (catalog cards)
  'holo rare': '#38bdf8',
  'ultra rare': '#a78bfa',
  'illustration rare': '#818cf8',
  'special rare': '#f0abfc',
  'hyper rare': '#e9c46a',
  'secret rare': '#f0abfc',
  'rainbow rare': '#e879f9'
};

const edgeColorFor = (rarity) => {
  const key = String(rarity || '').toLowerCase().trim();
  return RARITY_EDGE[key] || null;
};

/* Breakout motes — deterministic per-card via useMemo so they never
   reshuffle between renders. Geometric shards + light dust. */
const makeMotes = (seed, count = 9) => {
  let h = seed | 0;
  const rand = () => {
    h = (h * 1664525 + 1013904223) >>> 0;
    return h / 4294967296;
  };
  const palettes = ['#22d3ee', '#d946ef', '#8b5cf6', '#e9c46a', '#ffffff'];
  return Array.from({ length: count }).map((_, i) => {
    const angle = (i / count) * Math.PI * 2 + rand() * 0.9;
    const dist = 34 + rand() * 46;
    return {
      id: i,
      left: `${50 + Math.cos(angle) * 36}%`,
      top: `${50 + Math.sin(angle) * 36}%`,
      '--dx': `${(Math.cos(angle) * dist).toFixed(1)}px`,
      '--dy': `${(Math.sin(angle) * dist).toFixed(1)}px`,
      '--ms': `${(4 + rand() * 5).toFixed(1)}px`,
      '--mc': palettes[i % palettes.length],
      '--md': `${(1.8 + rand() * 1.8).toFixed(2)}s`,
      '--mde': `${(rand() * 1.6).toFixed(2)}s`,
      '--rot': `${Math.round(rand() * 220 - 110)}deg`,
      shape: i % 3 === 0 ? 'is-diamond' : i % 3 === 1 ? 'is-tri' : ''
    };
  });
};

const TiltCard = ({
  children,
  className = '',
  max = 14,
  scale = 1.04,
  glare = true,
  foil = false,
  spotlight = false,
  perspective = 1200,
  stiffness = 170,
  damping = 22,
  rarity,
  glitch = true,
  edge = true,
  breakout = false,
  seed = 0,
  as: Tag = 'div',
  ...rest
}) => {
  const ref = useRef(null);
  const raf = useRef(null);
  const glitchTimer = useRef(null);
  const [active, setActive] = useState(false);
  const [hovering, setHovering] = useState(false);
  const [glitching, setGlitching] = useState(false);
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

  const edgeColor = useMemo(() => edgeColorFor(rarity), [rarity]);
  const motes = useMemo(
    () => (breakout ? makeMotes(97 + (seed || 0) * 31 + String(rarity || '').length, 9) : []),
    [breakout, seed, rarity]
  );
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    state.current.reduced =
      typeof window !== 'undefined' &&
      window.matchMedia &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    setReduced(state.current.reduced);
  }, []);

  useEffect(() => {
    const el = ref.current;
    if (el && edgeColor) el.style.setProperty('--edge', edgeColor);
  }, [edgeColor]);

  useEffect(() => () => {
    if (glitchTimer.current) clearTimeout(glitchTimer.current);
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
    // pointer px coords for particle drift layers
    el.style.setProperty('--px', `${(e.clientX - rect.left).toFixed(0)}`);
    el.style.setProperty('--py', `${(e.clientY - rect.top).toFixed(0)}`);
    startLoop();
  }, [max, scale, startLoop]);

  const handleEnter = useCallback((e) => {
    const s = state.current;
    const el = ref.current;
    s.hovering = true;
    if (el && !s.reduced) {
      el.style.willChange = 'transform';
      // one-shot micro-glitch activation on entry (~100ms)
      if (glitch) {
        setGlitching(true);
        if (glitchTimer.current) clearTimeout(glitchTimer.current);
        glitchTimer.current = setTimeout(() => setGlitching(false), 110);
      }
    }
    setHovering(true);
    setActive(true);
    handleMove(e);
  }, [handleMove, glitch]);

  const handleLeave = useCallback(() => {
    const s = state.current;
    s.hovering = false;
    s.tx = 0;
    s.ty = 0;
    s.ts = 1;
    setHovering(false);
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
      className={`holo-card ${active ? 'is-tilting ' : ''}${hovering ? 'is-hovering ' : ''}${glitching ? 'is-glitching ' : ''}${className}`}
      {...rest}
    >
      {/* VIP PRO: breakout particles + light grid behind the frame */}
      {breakout && !reduced && (
        <span aria-hidden="true" className="vip-breakout rounded-[inherit]">
          <span className="vip-grid" />
          {motes.map((m) => (
            <span
              key={m.id}
              className={`vip-mote ${m.shape}`}
              style={m}
            />
          ))}
        </span>
      )}
      {children}
      {/* VIP PRO: dynamic holographic sheen (oil-slick) */}
      <span aria-hidden="true" className="vip-holo rounded-[inherit]" />
      {/* VIP PRO: chasing edge light (rarity neon) */}
      {edge && (
        <>
          <span aria-hidden="true" className="vip-edge-glow rounded-[inherit]" />
          <span aria-hidden="true" className="vip-edge rounded-[inherit]" />
        </>
      )}
      {/* VIP PRO: micro-glitch ghost layers */}
      {glitch && (
        <>
          <span aria-hidden="true" className="vip-glitch-cyan rounded-[inherit]" />
          <span aria-hidden="true" className="vip-glitch-magenta rounded-[inherit]" />
        </>
      )}
      {foil && <span aria-hidden="true" className="holo-foil rounded-[inherit]" />}
      {glare && <span aria-hidden="true" className="holo-overlay rounded-[inherit]" />}
      {spotlight && <span aria-hidden="true" className="holo-spotlight rounded-[inherit]" />}
      <span aria-hidden="true" className="vip-glitch-layer rounded-[inherit]" />
    </Tag>
  );
};

export default TiltCard;
