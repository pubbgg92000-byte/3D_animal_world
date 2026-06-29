/**
 * useAudioFeedback — Procedural UI sound effects using Web Audio API.
 *
 * Generates subtle, organic-feeling tones for UI interactions.
 * All sounds are procedurally generated — no audio files needed.
 */

let audioCtx = null;

function getAudioContext() {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
  return audioCtx;
}

/**
 * Play a short procedural tone.
 *
 * @param {number} freq      - Base frequency in Hz
 * @param {number} duration  - Duration in seconds
 * @param {string} type      - Oscillator type: 'sine', 'triangle', 'square'
 * @param {number} volume    - Volume 0..1
 * @param {number} decay     - How quickly the note fades (higher = faster)
 */
function playTone(freq, duration = 0.12, type = 'sine', volume = 0.08, decay = 12) {
  try {
    const ctx = getAudioContext();
    if (ctx.state === 'suspended') ctx.resume();

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = type;
    osc.frequency.setValueAtTime(freq, ctx.currentTime);
    // Slight pitch slide for organic feel
    osc.frequency.exponentialRampToValueAtTime(freq * 1.02, ctx.currentTime + duration * 0.3);

    gain.gain.setValueAtTime(volume, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + duration);
  } catch {
    // Audio not available — fail silently
  }
}

/** Two-note chord for richer feel */
function playChord(freq1, freq2, duration = 0.15, volume = 0.06) {
  playTone(freq1, duration, 'sine', volume);
  playTone(freq2, duration, 'triangle', volume * 0.5);
}

/* ── Predefined sound effects ── */

export function playClick() {
  playTone(880, 0.06, 'sine', 0.04);
}

export function playSelect() {
  playChord(523, 659, 0.18, 0.06); // C5 + E5 — pleasant major third
}

export function playNotification() {
  playTone(698, 0.08, 'triangle', 0.05);
  setTimeout(() => playTone(880, 0.1, 'triangle', 0.04), 80);
}

export function playPanelOpen() {
  playTone(440, 0.12, 'sine', 0.03);
}

export function playPanelClose() {
  playTone(330, 0.1, 'sine', 0.03);
}

export function playCameraMode() {
  playChord(587, 784, 0.15, 0.05); // D5 + G5 — open fifth
}

export function playFollow() {
  playTone(659, 0.06, 'sine', 0.04);
  setTimeout(() => playTone(784, 0.08, 'sine', 0.04), 60);
  setTimeout(() => playTone(1047, 0.12, 'sine', 0.03), 120);
}

export default {
  click: playClick,
  select: playSelect,
  notification: playNotification,
  panelOpen: playPanelOpen,
  panelClose: playPanelClose,
  cameraMode: playCameraMode,
  follow: playFollow,
};
