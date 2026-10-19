let context: AudioContext | undefined;
export function tone(kind: 'flip' | 'coin' | 'crash' | 'surge', enabled: boolean) {
  if (!enabled) return;
  try {
    context ??= new AudioContext();
    if (context.state === 'suspended') void context.resume();
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = kind === 'crash' ? 'triangle' : 'sine';
    const frequency = { flip: 330, coin: 800, crash: 130, surge: 540 }[kind];
    oscillator.frequency.setValueAtTime(frequency, context.currentTime);
    oscillator.frequency.exponentialRampToValueAtTime(kind === 'crash' ? 45 : frequency * 1.6, context.currentTime + 0.12);
    gain.gain.setValueAtTime(0.055, context.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, context.currentTime + 0.18);
    oscillator.connect(gain); gain.connect(context.destination);
    oscillator.start(); oscillator.stop(context.currentTime + 0.2);
  } catch { /* Audio is optional and never blocks input. */ }
}
