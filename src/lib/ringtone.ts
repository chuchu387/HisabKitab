let context: AudioContext | null = null;
let oscillators: OscillatorNode[] = [];
let gain: GainNode | null = null;
let interval: ReturnType<typeof setInterval> | null = null;

function ensureContext() {
  if (!context) context = new AudioContext();
  if (context.state === "suspended") context.resume().catch(() => undefined);
  return context;
}

export function startRingtone() {
  try {
    const ctx = ensureContext();
    if (interval) return;
    gain = ctx.createGain();
    gain.gain.value = 0.08;
    gain.connect(ctx.destination);
    const play = () => {
      if (!ctx || !gain) return;
      const freq = [660, 520];
      freq.forEach((f, i) => {
        const osc = ctx.createOscillator();
        osc.type = "sine";
        osc.frequency.value = f;
        osc.connect(gain!);
        osc.start(ctx.currentTime + i * 0.35);
        osc.stop(ctx.currentTime + i * 0.35 + 0.3);
        oscillators.push(osc);
      });
    };
    play();
    interval = setInterval(play, 900);
  } catch {}
}

export function stopRingtone() {
  if (interval) clearInterval(interval);
  interval = null;
  oscillators.forEach((osc) => {
    try { osc.stop(); } catch {}
  });
  oscillators = [];
  try { gain?.disconnect(); } catch {}
  gain = null;
}
