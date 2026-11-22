// A tiny WebAudio synth — no audio files at all. Night sounds: a soft
// moth chime, a low swell while you are seen, a caught sting, and a clear
// arpeggio for the garden you just crossed.
//
// Every sound is a short list of notes, each one [frequency, delay,
// length, wave, volume, glide-to]. `play` schedules the list through one
// shared AudioContext.

export function createAudio() {
  let ctx = null;
  let muted = false;

  function ensure() {
    if (ctx) return ctx;
    try {
      ctx = new (window.AudioContext || window.webkitAudioContext)();
    } catch {
      ctx = null;
    }
    return ctx;
  }

  // One note: an oscillator that swells in and dies away, optionally
  // sliding its pitch toward `glide` across its length.
  function note([freq, delay, len, wave, vol, glide]) {
    const ac = ensure();
    if (!ac || muted) return;
    const osc = ac.createOscillator();
    const amp = ac.createGain();
    osc.type = wave;
    const t0 = ac.currentTime + delay;
    osc.frequency.setValueAtTime(freq, t0);
    if (glide) osc.frequency.exponentialRampToValueAtTime(glide, t0 + len);
    amp.gain.setValueAtTime(0, t0);
    amp.gain.linearRampToValueAtTime(vol, t0 + 0.015);
    amp.gain.exponentialRampToValueAtTime(0.0001, t0 + len);
    osc.connect(amp).connect(ac.destination);
    osc.start(t0);
    osc.stop(t0 + len + 0.05);
  }

  function play(notes) {
    for (const n of notes) note(n);
  }

  return {
    unlock() {
      const ac = ensure();
      if (ac && ac.state === 'suspended') ac.resume();
    },
    toggleMute() {
      muted = !muted;
      return muted;
    },
    seen() {
      play([[220, 0, 0.3, 'sawtooth', 0.05, 330]]);
    },
    moth() {
      play([
        [1180, 0, 0.12, 'sine', 0.1, 0],
        [1560, 0.08, 0.18, 'sine', 0.08, 0],
      ]);
    },
    nearMiss() {
      play([
        [660, 0, 0.1, 'sine', 0.09, 0],
        [520, 0.09, 0.16, 'sine', 0.08, 0],
      ]);
    },
    noise() {
      play([[180, 0, 0.08, 'square', 0.04, 0]]);
    },
    caught() {
      play([
        [320, 0, 0.22, 'sawtooth', 0.12, 160],
        [210, 0.14, 0.34, 'sawtooth', 0.11, 90],
      ]);
    },
    clear() {
      play([
        [523, 0, 0.13, 'triangle', 0.13, 0],
        [659, 0.09, 0.13, 'triangle', 0.13, 0],
        [880, 0.18, 0.24, 'triangle', 0.14, 0],
      ]);
    },
    click() {
      play([[660, 0, 0.05, 'sine', 0.06, 0]]);
    },
  };
}
