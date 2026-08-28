/**
 * sfx.js — tiny WebAudio sound engine + haptics for pack openings & micro-feedback.
 *
 * All sounds are synthesized (no assets), lazy-initialized on first user
 * gesture, and fail silently in unsupported contexts. Volumes are kept low
 * so FX read as "premium UI", not arcade noise.
 */

let ctx = null;
let master = null;
let enabled = true;

const ensureContext = () => {
  if (typeof window === 'undefined') return null;
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return null;
  if (!ctx) {
    try {
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = 0.5;
      master.connect(ctx.destination);
    } catch (e) {
      return null;
    }
  }
  if (ctx.state === 'suspended') ctx.resume().catch(() => {});
  return ctx;
};

export const setSfxEnabled = (on) => { enabled = !!on; };
export const isSfxEnabled = () => enabled;

const tone = ({ freq = 440, type = 'sine', duration = 0.15, volume = 0.2, delay = 0, glideTo = null }) => {
  const ac = ensureContext();
  if (!ac || !enabled || !master) return;
  try {
    const osc = ac.createOscillator();
    const gain = ac.createGain();
    const t0 = ac.currentTime + delay;
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (glideTo) osc.frequency.exponentialRampToValueAtTime(glideTo, t0 + duration);
    gain.gain.setValueAtTime(0, t0);
    gain.gain.linearRampToValueAtTime(volume, t0 + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);
    osc.connect(gain);
    gain.connect(master);
    osc.start(t0);
    osc.stop(t0 + duration + 0.05);
  } catch (e) { /* no-op */ }
};

const noiseBurst = ({ duration = 0.25, volume = 0.18, delay = 0, filterFreq = 1800, q = 0.8 }) => {
  const ac = ensureContext();
  if (!ac || !enabled || !master) return;
  try {
    const length = Math.max(1, Math.floor(ac.sampleRate * duration));
    const buffer = ac.createBuffer(1, length, ac.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / length, 1.6);
    }
    const src = ac.createBufferSource();
    src.buffer = buffer;
    const filter = ac.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = filterFreq;
    filter.Q.value = q;
    const gain = ac.createGain();
    const t0 = ac.currentTime + delay;
    gain.gain.setValueAtTime(volume, t0);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);
    src.connect(filter);
    filter.connect(gain);
    gain.connect(master);
    src.start(t0);
  } catch (e) { /* no-op */ }
};

/** Paper/foil tear — filtered noise crackle */
export const playTear = () => {
  noiseBurst({ duration: 0.16, volume: 0.3, filterFreq: 2400, q: 0.6 });
  noiseBurst({ duration: 0.22, volume: 0.16, delay: 0.05, filterFreq: 900, q: 0.7 });
};

/** Rising magical shimmer as the card appears */
export const playReveal = (tier = 1) => {
  const base = 520 + tier * 90;
  tone({ freq: base, type: 'sine', duration: 0.5, volume: 0.12, glideTo: base * 1.5 });
  tone({ freq: base * 1.335, type: 'triangle', duration: 0.55, volume: 0.1, delay: 0.08, glideTo: base * 2 });
  if (tier >= 3) {
    // Chase-pull arpeggio sparkle
    [0, 0.09, 0.18, 0.27].forEach((d, i) =>
      tone({ freq: base * (1.5 + i * 0.25), type: 'sine', duration: 0.4, volume: 0.09, delay: 0.15 + d })
    );
    noiseBurst({ duration: 0.5, volume: 0.05, delay: 0.1, filterFreq: 5200, q: 1.4 });
  }
};

/** Soft confirmation tick (add-to-cart, toggles) */
export const playTick = () => {
  tone({ freq: 1150, type: 'sine', duration: 0.07, volume: 0.06 });
  tone({ freq: 1720, type: 'sine', duration: 0.06, volume: 0.045, delay: 0.03 });
};

/** Subtle hover/pop for chips & buttons */
export const playPop = () => {
  tone({ freq: 340, type: 'triangle', duration: 0.06, volume: 0.05, glideTo: 520 });
};

/** Haptic feedback, tier-scaled; no-op when unsupported */
export const vibrate = (pattern) => {
  if (typeof navigator === 'undefined' || !navigator.vibrate) return;
  try { navigator.vibrate(pattern); } catch (e) { /* no-op */ }
};
