let context: AudioContext | undefined;
type Cue = 'start' | 'flip' | 'land' | 'coin' | 'combo' | 'near' | 'shield' | 'break' | 'crash';
export function tone(kind: Cue, enabled: boolean, combo = 1) {
  if (!enabled) return;
  try {
    context ??= new AudioContext();
    if (context.state === 'suspended') void context.resume();
    const notes = kind === 'combo' || kind === 'shield' ? [0, 4, 7] : [0];
    for (const [index, semitone] of notes.entries()) {
      const oscillator = context.createOscillator(), gain = context.createGain();
      const time = context.currentTime + index * 0.045;
      oscillator.type = kind === 'crash' || kind === 'break' || kind === 'land' ? 'triangle' : 'sine';
      const root = { start: 360, flip: 250, land: 120, coin: 580 + combo * 80, combo: 620, near: 920, shield: 440, break: 180, crash: 100 }[kind];
      const frequency = root * 2 ** (semitone / 12);
      oscillator.frequency.setValueAtTime(frequency, time);
      oscillator.frequency.exponentialRampToValueAtTime(kind === 'crash' || kind === 'land' ? frequency * 0.35 : kind === 'flip' ? frequency * 2.5 : frequency * 1.2, time + 0.11);
      gain.gain.setValueAtTime(kind === 'land' ? 0.025 : 0.045, time);
      gain.gain.exponentialRampToValueAtTime(0.001, time + 0.16);
      oscillator.connect(gain); gain.connect(context.destination); oscillator.start(time); oscillator.stop(time + 0.18);
    }
  } catch { /* Audio remains optional. */ }
}
