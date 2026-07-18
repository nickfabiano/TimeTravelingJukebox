// Tiny synthesized UI sounds via Web Audio — no audio assets needed.
// The AudioContext is created lazily inside user-gesture handlers, which
// keeps browser autoplay policies happy.

let ctx: AudioContext | null = null;

function audio(): AudioContext | null {
  try {
    if (!ctx) ctx = new AudioContext();
    if (ctx.state === 'suspended') void ctx.resume();
    return ctx;
  } catch {
    return null;
  }
}

function blip(
  freq: number,
  durationMs: number,
  peakGain: number,
  type: OscillatorType = 'square',
  freqEnd?: number,
): void {
  const ac = audio();
  if (!ac) return;
  const osc = ac.createOscillator();
  const gain = ac.createGain();
  const t = ac.currentTime;
  const dur = durationMs / 1000;
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t);
  if (freqEnd) osc.frequency.exponentialRampToValueAtTime(freqEnd, t + dur);
  gain.gain.setValueAtTime(peakGain, t);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  osc.connect(gain).connect(ac.destination);
  osc.start(t);
  osc.stop(t + dur + 0.01);
}

let lastTick = 0;

/** Soft mechanical click as the knob passes a detent. Throttled. */
export function knobTick(): void {
  const now = performance.now();
  if (now - lastTick < 30) return;
  lastTick = now;
  blip(1800, 12, 0.015);
}

/** The "ka-chunk" of a year engaging. */
export function yearClunk(): void {
  blip(150, 90, 0.07, 'triangle', 70);
  window.setTimeout(() => blip(110, 70, 0.05, 'triangle', 60), 55);
}

/** Button press click. */
export function buttonClick(): void {
  blip(950, 18, 0.02);
}
