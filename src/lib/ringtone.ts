const RING_FREQS = [440, 480];
const RING_ON_MS = 2000;
const RING_OFF_MS = 3000;

let context: AudioContext | null = null;
let masterGain: GainNode | null = null;
let ringTimeout: ReturnType<typeof setTimeout> | null = null;
let scheduleId = 0;
let activeOscillators: OscillatorNode[] = [];
let ringing = false;

function ensureContext() {
  if (!context) context = new AudioContext();
  if (context.state === "suspended") context.resume().catch(() => undefined);
  return context;
}

export function unlockAudio() {
  try { ensureContext(); } catch {}
}

export function startRingtone() {
  try {
    const ctx = ensureContext();
    if (ringing) return;
    ringing = true;
    masterGain = ctx.createGain();
    masterGain.gain.value = 0.9;
    masterGain.connect(ctx.destination);
    const id = ++scheduleId;
    const ringOnce = (start: number) => {
      if (id !== scheduleId || !ctx || !masterGain) return;
      const oscs = RING_FREQS.map((freq) => {
        const osc = ctx.createOscillator();
        osc.type = "sine";
        osc.frequency.value = freq;
        const gain = ctx.createGain();
        const on = RING_ON_MS / 1000;
        gain.gain.setValueAtTime(0.0001, start);
        gain.gain.exponentialRampToValueAtTime(1, start + 0.04);
        gain.gain.setValueAtTime(1, start + on - 0.1);
        gain.gain.exponentialRampToValueAtTime(0.0001, start + on);
        osc.connect(gain);
        gain.connect(masterGain!);
        osc.start(start);
        osc.stop(start + on + 0.05);
        return osc;
      });
      activeOscillators.push(...oscs);
      ringTimeout = setTimeout(() => ringOnce(start + (RING_ON_MS + RING_OFF_MS) / 1000), RING_ON_MS + RING_OFF_MS);
    };
    ringOnce(ctx.currentTime + 0.05);
  } catch {}
}

export function stopRingtone() {
  ringing = false;
  scheduleId++;
  if (ringTimeout) clearTimeout(ringTimeout);
  ringTimeout = null;
  activeOscillators.forEach((osc) => {
    try { osc.stop(); } catch {}
  });
  activeOscillators = [];
  try { masterGain?.disconnect(); } catch {}
  masterGain = null;
}
