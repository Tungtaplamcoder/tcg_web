import React, { useRef, useState, useCallback } from 'react';

/**
 * TiltCard — high-fps 3D tilt physics with a reactive specular glare.
 * Pointer position drives CSS vars (--rx, --ry, --mx, --my) consumed by the
 * .holo-card / .holo-overlay utilities for foil + glare.
 */
const TiltCard = ({
  children,
  className = '',
  max = 14,
  scale = 1.04,
  glare = true,
  perspective = 1000,
  as: Tag = 'div',
  ...rest
}) => {
  const ref = useRef(null);
  const frame = useRef(null);
  const [active, setActive] = useState(false);

  const handleMove = useCallback((e) => {
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const px = (e.clientX - rect.left) / rect.width;
    const py = (e.clientY - rect.top) / rect.height;
    if (frame.current) cancelAnimationFrame(frame.current);
    frame.current = requestAnimationFrame(() => {
      const ry = (px - 0.5) * (max * 2);
      const rx = (0.5 - py) * (max * 2);
      el.style.setProperty('--rx', `${rx.toFixed(2)}deg`);
      el.style.setProperty('--ry', `${ry.toFixed(2)}deg`);
      el.style.setProperty('--mx', `${(px * 100).toFixed(2)}%`);
      el.style.setProperty('--my', `${(py * 100).toFixed(2)}%`);
      el.style.transform = `perspective(${perspective}px) rotateX(${rx}deg) rotateY(${ry}deg) scale(${scale})`;
    });
  }, [max, scale, perspective]);

  const handleEnter = useCallback(() => setActive(true), []);
  const handleLeave = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    if (frame.current) cancelAnimationFrame(frame.current);
    el.style.transform = `perspective(${perspective}px) rotateX(0deg) rotateY(0deg) scale(1)`;
    el.style.setProperty('--mx', '50%');
    el.style.setProperty('--my', '50%');
    setActive(false);
  }, [perspective]);

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
      {glare && (
        <span
          aria-hidden="true"
          className="holo-overlay rounded-[inherit]"
          style={{ opacity: active ? 1 : 0 }}
        />
      )}
    </Tag>
  );
};

export default TiltCard;
