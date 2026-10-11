/* ── Virtual Box gradient resolution ────────────────────────────────
   Boxes may store either a Tailwind token gradient ("from-… to-…"), a
   raw CSS gradient, or nothing. This maps tokens/raw gradients through a
   fixed pastel palette and falls back to a deterministic per-box pick so
   every pack always renders a stable, on-brand surface. ── */
export const TOKEN_GRADIENTS = {
  'from-violet-500 to-fuchsia-500': 'linear-gradient(135deg, #8b5cf6, #d946ef)',
  'from-cyan-500 to-blue-600': 'linear-gradient(135deg, #06b6d4, #2563eb)',
  'from-slate-600 to-ink-900': 'linear-gradient(135deg, #475569, #0f172a)',
  'from-amber-400 to-orange-600': 'linear-gradient(135deg, #fbbf24, #ea580c)',
  'from-emerald-500 to-teal-600': 'linear-gradient(135deg, #10b981, #0d9488)',
  'from-rose-500 to-pink-600': 'linear-gradient(135deg, #f43f5e, #db2777)',
  'from-sky-400 to-violet-500': 'linear-gradient(135deg, #38bdf8, #8b5cf6)',
  'from-fuchsia-500 to-amber-400': 'linear-gradient(135deg, #d946ef, #fbbf24)'
};

export const FALLBACK_GRADIENTS = [
  'linear-gradient(135deg, #db2777 0%, #ec4899 55%, #f9a8d4 110%)',
  'linear-gradient(135deg, #be185d 0%, #ec4899 55%, #f472b6 100%)',
  'linear-gradient(135deg, #a21caf 0%, #d946ef 55%, #f472b6 110%)',
  'linear-gradient(135deg, #9d174d 0%, #db2777 55%, #f472b6 100%)',
  'linear-gradient(135deg, #831843 0%, #be185d 55%, #ec4899 120%)',
  'linear-gradient(135deg, #4c0519 0%, #9d174d 55%, #ec4899 120%)'
];

const hashId = (id) => {
  let h = 0;
  const s = String(id || '');
  for (let i = 0; i < s.length; i += 1) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
};

export const boxBackground = (box, index = 0) => {
  const raw = (box?.gradient || '').trim();
  if (raw.includes('gradient(') || raw.startsWith('radial')) return raw;
  if (TOKEN_GRADIENTS[raw]) return TOKEN_GRADIENTS[raw];
  return FALLBACK_GRADIENTS[(hashId(box?.id) + index) % FALLBACK_GRADIENTS.length];
};

export default boxBackground;
