/**
 * Audio and haptic feedback, synthesised in the browser.
 *
 * No audio files ship with the app — every cue is generated with the Web Audio
 * API, so the whole sound design costs zero kilobytes and never blocks a scan
 * on a network request. Cues are deliberately short and tonal: correct answers
 * resolve upward, errors land on a minor second, which reads as "wrong" without
 * being punishing.
 */

import { getState, setPrefs } from "./storage";

let ctx = null;
let master = null;

const ensureContext = () => {
  if (typeof window === "undefined") return null;
  const AudioCtx = window.AudioContext || window.webkitAudioContext;
  if (!AudioCtx) return null;
  if (!ctx) {
    ctx = new AudioCtx();
    master = ctx.createGain();
    master.gain.value = 0.16;
    master.connect(ctx.destination);
  }
  if (ctx.state === "suspended") ctx.resume().catch(() => {});
  return ctx;
};

const soundEnabled = () => getState().prefs?.sound !== false;
const hapticsEnabled = () => getState().prefs?.haptics !== false;

/**
 * One synthesised note.
 * @param {number} freq Hz
 * @param {object} opts { duration, type, delay, gain, sweepTo }
 */
const note = (freq, { duration = 0.12, type = "sine", delay = 0, gain = 1, sweepTo = null } = {}) => {
  const audio = ensureContext();
  if (!audio) return;

  const start = audio.currentTime + delay;
  const osc = audio.createOscillator();
  const env = audio.createGain();

  osc.type = type;
  osc.frequency.setValueAtTime(freq, start);
  if (sweepTo) osc.frequency.exponentialRampToValueAtTime(sweepTo, start + duration);

  // Fast attack, exponential release — reads as a soft "tick" rather than a beep.
  env.gain.setValueAtTime(0.0001, start);
  env.gain.exponentialRampToValueAtTime(gain, start + 0.008);
  env.gain.exponentialRampToValueAtTime(0.0001, start + duration);

  osc.connect(env);
  env.connect(master);
  osc.start(start);
  osc.stop(start + duration + 0.02);
};

const noise = ({ duration = 0.16, gain = 0.5, delay = 0 } = {}) => {
  const audio = ensureContext();
  if (!audio) return;
  const frames = Math.floor(audio.sampleRate * duration);
  const buffer = audio.createBuffer(1, frames, audio.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < frames; i += 1) {
    data[i] = (Math.random() * 2 - 1) * (1 - i / frames) ** 2;
  }
  const src = audio.createBufferSource();
  const env = audio.createGain();
  const filter = audio.createBiquadFilter();
  filter.type = "bandpass";
  filter.frequency.value = 1400;
  env.gain.value = gain;
  src.buffer = buffer;
  src.connect(filter);
  filter.connect(env);
  env.connect(master);
  src.start(audio.currentTime + delay);
};

const CUES = {
  // Rising major third — unambiguous "yes".
  correct: () => {
    note(660, { duration: 0.08, type: "sine", gain: 0.5 });
    note(880, { duration: 0.12, type: "sine", gain: 0.4, delay: 0.05 });
  },
  // Minor second, falling. Clearly wrong, not harsh.
  wrong: () => {
    note(233, { duration: 0.18, type: "triangle", gain: 0.45, sweepTo: 196 });
  },
  tap: () => note(520, { duration: 0.045, type: "sine", gain: 0.28 }),
  tick: () => note(1200, { duration: 0.03, type: "square", gain: 0.12 }),
  // Countdown pips, then a resolved fifth on "GO".
  countdown: () => note(440, { duration: 0.09, type: "sine", gain: 0.35 }),
  go: () => {
    note(523.25, { duration: 0.14, type: "sine", gain: 0.5 });
    note(783.99, { duration: 0.22, type: "sine", gain: 0.45, delay: 0.08 });
  },
  // Arpeggio for level-ups and cleared rounds.
  levelUp: () => {
    [523.25, 659.25, 783.99, 1046.5].forEach((f, i) =>
      note(f, { duration: 0.16, type: "sine", gain: 0.4, delay: i * 0.07 })
    );
  },
  complete: () => {
    [392, 523.25, 659.25, 783.99, 1046.5].forEach((f, i) =>
      note(f, { duration: 0.3, type: "sine", gain: 0.35, delay: i * 0.09 })
    );
  },
  achievement: () => {
    [659.25, 830.61, 987.77, 1318.5].forEach((f, i) =>
      note(f, { duration: 0.28, type: "triangle", gain: 0.34, delay: i * 0.08 })
    );
    noise({ duration: 0.3, gain: 0.12, delay: 0.1 });
  },
  fail: () => {
    note(196, { duration: 0.34, type: "sawtooth", gain: 0.3, sweepTo: 110 });
    noise({ duration: 0.2, gain: 0.16 });
  },
  reveal: () => {
    note(261.63, { duration: 0.6, type: "sine", gain: 0.22, sweepTo: 523.25 });
  },
};

const HAPTICS = {
  correct: 12,
  wrong: [30, 40, 30],
  tap: 8,
  levelUp: [14, 40, 14],
  complete: [20, 60, 20, 60, 40],
  achievement: [10, 30, 10, 30, 60],
  fail: [60, 40, 60],
};

/**
 * Fire a named feedback cue. Safe to call anywhere — silently no-ops when the
 * user has muted, when the browser lacks Web Audio, or when called server-side.
 */
export const cue = (name) => {
  try {
    if (soundEnabled() && CUES[name]) CUES[name]();
  } catch {
    /* audio must never break gameplay */
  }
  try {
    if (
      hapticsEnabled() &&
      HAPTICS[name] &&
      typeof navigator !== "undefined" &&
      typeof navigator.vibrate === "function"
    ) {
      navigator.vibrate(HAPTICS[name]);
    }
  } catch {
    /* vibration is a nice-to-have */
  }
};

/** Browsers require a user gesture before audio can start. Call on first tap. */
export const primeAudio = () => {
  try {
    ensureContext();
  } catch {
    /* ignore */
  }
};

export const toggleSound = () => {
  const next = !soundEnabled();
  setPrefs({ sound: next });
  if (next) cue("tap");
  return next;
};

export const toggleHaptics = () => {
  const next = !hapticsEnabled();
  setPrefs({ haptics: next });
  return next;
};

export { soundEnabled, hapticsEnabled };
