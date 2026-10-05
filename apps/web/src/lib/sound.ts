/**
 * Synthesizes a loud, crisp gym rest timer chime using the Web Audio API.
 * Zero external audio files required — generates standard digital timer beeps
 * directly through device speakers.
 */
let audioCtx: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  try {
    if (!audioCtx) {
      const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (Ctx) audioCtx = new Ctx();
    }
    if (audioCtx && audioCtx.state === "suspended") {
      void audioCtx.resume();
    }
    return audioCtx;
  } catch {
    return null;
  }
}

/** Pre-unlock audio context on user tap */
export function unlockAudio(): void {
  const ctx = getAudioContext();
  if (ctx && ctx.state === "suspended") {
    void ctx.resume();
  }
}

/** Play a 3-beep alarm chime (880Hz -> 880Hz -> 1760Hz) */
export function playRestChime(): void {
  const ctx = getAudioContext();
  if (!ctx) return;

  try {
    const now = ctx.currentTime;
    const beeps = [
      { freq: 880, start: 0.0, duration: 0.12 },
      { freq: 880, start: 0.18, duration: 0.12 },
      { freq: 1760, start: 0.36, duration: 0.4 },
    ];

    for (const b of beeps) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = "sine";
      osc.frequency.setValueAtTime(b.freq, now + b.start);

      gain.gain.setValueAtTime(0.001, now + b.start);
      gain.gain.linearRampToValueAtTime(0.85, now + b.start + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, now + b.start + b.duration);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now + b.start);
      osc.stop(now + b.start + b.duration);
    }
  } catch {
    // Ignore audio policy errors
  }
}
