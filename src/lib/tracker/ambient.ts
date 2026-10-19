// Offline ambient noise synthesized with Web Audio (no external files). Browser-only: call from handlers.
export type AmbientKind = "rain" | "ocean";

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let nodes: AudioNode[] = [];
let current: AmbientKind | null = null;

function noiseBuffer(c: AudioContext, kind: AmbientKind) {
  const len = c.sampleRate * 4;
  const buf = c.createBuffer(1, len, c.sampleRate);
  const d = buf.getChannelData(0);
  if (kind === "rain") {
    // Pink noise (Paul Kellet)
    let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
    for (let i = 0; i < len; i++) {
      const w = Math.random() * 2 - 1;
      b0 = 0.99886 * b0 + w * 0.0555179; b1 = 0.99332 * b1 + w * 0.0750759; b2 = 0.969 * b2 + w * 0.153852;
      b3 = 0.8665 * b3 + w * 0.3104856; b4 = 0.55 * b4 + w * 0.5329522; b5 = -0.7616 * b5 - w * 0.016898;
      d[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362) * 0.11; b6 = w * 0.115926;
    }
  } else {
    // Brown noise
    let last = 0;
    for (let i = 0; i < len; i++) { const w = Math.random() * 2 - 1; last = (last + 0.02 * w) / 1.02; d[i] = last * 3.5; }
  }
  return buf;
}

function build(kind: AmbientKind) {
  const c = ctx!;
  nodes.forEach((n) => { try { (n as AudioScheduledSourceNode).stop?.(); } catch { /* */ } n.disconnect(); });
  nodes = [];
  const src = c.createBufferSource();
  src.buffer = noiseBuffer(c, kind);
  src.loop = true;
  const lp = c.createBiquadFilter();
  lp.type = "lowpass";
  lp.frequency.value = kind === "rain" ? 1400 : 500;
  const wave = c.createGain();
  wave.gain.value = kind === "ocean" ? 0.6 : 1;
  src.connect(lp).connect(wave).connect(master!);
  nodes.push(src, lp, wave);
  if (kind === "ocean") {
    // Periodic swell: LFO modulates gain (~8s waves)
    const lfo = c.createOscillator();
    lfo.frequency.value = 0.12;
    const depth = c.createGain();
    depth.gain.value = 0.4;
    lfo.connect(depth).connect(wave.gain);
    lfo.start();
    nodes.push(lfo, depth);
  }
  src.start();
  current = kind;
}

export async function playAmbient(kind: AmbientKind, volume: number) {
  ctx ??= new AudioContext();
  if (!master) { master = ctx.createGain(); master.connect(ctx.destination); }
  master.gain.setTargetAtTime(volume, ctx.currentTime, 0.1);
  if (current !== kind) build(kind);
  await ctx.resume();
}
export async function pauseAmbient() { if (ctx && ctx.state === "running") await ctx.suspend(); }
export function setAmbientVolume(v: number) { if (ctx && master) master.gain.setTargetAtTime(v, ctx.currentTime, 0.1); }
