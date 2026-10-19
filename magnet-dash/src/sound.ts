let context: AudioContext | undefined;
type Cue = 'start' | 'flip' | 'land' | 'coin' | 'combo' | 'near' | 'shield' | 'break' | 'crash' | 'perfect' | 'risk';

// A single mixer limits dense pickup clusters without delaying important cues.
// Reaching a multiplier gets a chord; maintaining it gets a short, soft tick.
export function createCueMixer() {
  const last = new Map<Cue, number>();
  let coinIndex = 0;
  return (kind: Cue, now: number, combo = 1) => {
    if (kind === 'start') { last.clear(); coinIndex = 0; }
    const capped = combo >= 5;
    const interval = kind === 'coin' ? (capped ? 0.12 : 0.07) : kind === 'land' ? 0.12 : kind === 'near' ? 0.18 : 0;
    if (now - (last.get(kind) ?? -Infinity) < interval) return;
    last.set(kind, now);
    const root = { start: 360, flip: 240, land: 110,
      coin: (capped ? [392, 440, 494, 440] : [494, 554, 587, 659])[coinIndex % 4],
      combo: 520, near: 660, shield: 440, break: 180, crash: 100, perfect: 450, risk: 523 }[kind];
    if (kind === 'coin') coinIndex++;
    return { root, notes: kind === 'combo' || kind === 'shield' ? [0, 4, 7] : kind === 'risk' ? [0, 7] : [0],
      volume: kind === 'coin' ? (capped ? 0.01 : 0.022) : kind === 'land' ? 0.009 : kind === 'perfect' ? 0.014 : kind === 'flip' || kind === 'risk' ? 0.022 : 0.032,
      duration: kind === 'coin' ? (capped ? 0.065 : 0.1) : kind === 'perfect' ? 0.09 : 0.16,
      sweep: kind === 'crash' || kind === 'land' ? 0.35 : kind === 'flip' ? 1.7 : kind === 'coin' ? 1.02 : 1.2,
      wave: kind === 'crash' || kind === 'break' || kind === 'land' ? 'triangle' as const : 'sine' as const };
  };
}
const mix = createCueMixer();

export function tone(kind: Cue, enabled: boolean, combo = 1) {
  if (!enabled) return;
  try {
    context ??= new AudioContext();
    if (context.state === 'suspended') void context.resume().catch(() => {});
    const cue = mix(kind, context.currentTime, combo);
    if (!cue) return;
    for (const [index, semitone] of cue.notes.entries()) {
      const oscillator = context.createOscillator(), gain = context.createGain();
      const time = context.currentTime + index * 0.045;
      oscillator.type = cue.wave;
      const frequency = cue.root * 2 ** (semitone / 12);
      oscillator.frequency.setValueAtTime(frequency, time);
      oscillator.frequency.exponentialRampToValueAtTime(frequency * cue.sweep, time + cue.duration * 0.7);
      gain.gain.setValueAtTime(0.001, time);
      gain.gain.linearRampToValueAtTime(cue.volume, time + 0.005);
      gain.gain.exponentialRampToValueAtTime(0.001, time + cue.duration);
      oscillator.connect(gain); gain.connect(context.destination); oscillator.start(time); oscillator.stop(time + cue.duration + 0.02);
    }
  } catch { /* Audio remains optional. */ }
}
