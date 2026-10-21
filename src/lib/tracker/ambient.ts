// Offline ambient noise synthesized with Web Audio (no external files). Browser-only: call from handlers.
export type AmbientKind = "rain" | "ocean" | "campfire" | "cafe" | "night";

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let nodes: AudioNode[] = [];
let current: AmbientKind | null = null;

function noiseBuffer(c: AudioContext, kind: AmbientKind) {
  const len = c.sampleRate * 4;
  const buf = c.createBuffer(1, len, c.sampleRate);
  const d = buf.getChannelData(0);
  if (kind === "campfire" || kind === "night") {
    // Brown noise base (crackles/chirps are layered in build())
    let last = 0;
    for (let i = 0; i < len; i++) {
      const w = Math.random() * 2 - 1;
      last = (last + 0.02 * w) / 1.02;
      d[i] = last * (kind === "night" ? 1.2 : 3.5);
    }
  } else if (kind === "cafe") {
    // Pink noise murmur
    let b0 = 0,
      b1 = 0,
      b2 = 0;
    for (let i = 0; i < len; i++) {
      const w = Math.random() * 2 - 1;
      b0 = 0.99765 * b0 + w * 0.099;
      b1 = 0.963 * b1 + w * 0.283;
      b2 = 0.57 * b2 + w * 1.0219;
      d[i] = (b0 + b1 + b2 + w * 0.1848) * 0.08;
    }
  } else if (kind === "rain") {
    // Pink noise (Paul Kellet)
    let b0 = 0,
      b1 = 0,
      b2 = 0,
      b3 = 0,
      b4 = 0,
      b5 = 0,
      b6 = 0;
    for (let i = 0; i < len; i++) {
      const w = Math.random() * 2 - 1;
      b0 = 0.99886 * b0 + w * 0.0555179;
      b1 = 0.99332 * b1 + w * 0.0750759;
      b2 = 0.969 * b2 + w * 0.153852;
      b3 = 0.8665 * b3 + w * 0.3104856;
      b4 = 0.55 * b4 + w * 0.5329522;
      b5 = -0.7616 * b5 - w * 0.016898;
      d[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362) * 0.11;
      b6 = w * 0.115926;
    }
  } else {
    // Brown noise
    let last = 0;
    for (let i = 0; i < len; i++) {
      const w = Math.random() * 2 - 1;
      last = (last + 0.02 * w) / 1.02;
      d[i] = last * 3.5;
    }
  }
  return buf;
}

// Random little detail sounds layered over the noise base (campfire crackles, cricket chirps, cup clinks).
let sparkTimer: ReturnType<typeof setTimeout> | null = null;

function burst(
  freq: number,
  dur: number,
  vol: number,
  type: OscillatorType = "sine",
  sweepTo?: number,
) {
  const c = ctx!;
  const t = c.currentTime + 0.01;
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  if (sweepTo) o.frequency.exponentialRampToValueAtTime(sweepTo, t + dur * 0.8);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + dur * 0.2);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(master!);
  o.start(t);
  o.stop(t + dur + 0.05);
}

function scheduleSparks(kind: AmbientKind) {
  if (sparkTimer) clearTimeout(sparkTimer);
  const loop = () => {
    const active = ctx && ctx.state === "running" && current === kind;
    if (active) {
      try {
        if (kind === "campfire") {
          burst(
            1800 + Math.random() * 2200,
            0.03 + Math.random() * 0.05,
            0.05 + Math.random() * 0.08,
            "triangle",
          );
        } else if (kind === "night") {
          // cricket: 2-3 rapid high pulses
          const n = 2 + Math.floor(Math.random() * 2);
          for (let i = 0; i < n; i++) {
            setTimeout(() => {
              if (current === kind && ctx && ctx.state === "running")
                burst(4300 + Math.random() * 500, 0.05, 0.035);
            }, i * 90);
          }
        } else if (kind === "cafe" && Math.random() < 0.4) {
          burst(1300 + Math.random() * 900, 0.12, 0.03, "sine", 900);
        }
      } catch {
        /* ignore */
      }
    }
    sparkTimer = setTimeout(
      loop,
      kind === "campfire"
        ? 200 + Math.random() * 900
        : kind === "night"
          ? 500 + Math.random() * 900
          : 3000 + Math.random() * 5000,
    );
  };
  sparkTimer = setTimeout(loop, 400);
}

function build(kind: AmbientKind) {
  const c = ctx!;
  nodes.forEach((n) => {
    try {
      (n as AudioScheduledSourceNode).stop?.();
    } catch {
      /* */
    }
    n.disconnect();
  });
  nodes = [];
  const src = c.createBufferSource();
  src.buffer = noiseBuffer(c, kind);
  src.loop = true;
  const lp = c.createBiquadFilter();
  lp.type = "lowpass";
  lp.frequency.value =
    kind === "rain" ? 1400 : kind === "cafe" ? 800 : kind === "campfire" ? 320 : 400;
  const wave = c.createGain();
  wave.gain.value = kind === "ocean" || kind === "night" ? 0.6 : 1;
  src.connect(lp).connect(wave).connect(master!);
  nodes.push(src, lp, wave);
  if (kind === "campfire" || kind === "night" || kind === "cafe") {
    scheduleSparks(kind);
  }
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
  if (!master) {
    master = ctx.createGain();
    master.connect(ctx.destination);
  }
  master.gain.setTargetAtTime(volume, ctx.currentTime, 0.1);
  if (current !== kind) build(kind);
  else if (!sparkTimer) scheduleSparks(kind); // resume detail sounds after a pause
  await ctx.resume();
}
export async function pauseAmbient() {
  if (sparkTimer) {
    clearTimeout(sparkTimer);
    sparkTimer = null;
  }
  if (ctx && ctx.state === "running") await ctx.suspend();
}
export function setAmbientVolume(v: number) {
  if (ctx && master) master.gain.setTargetAtTime(v, ctx.currentTime, 0.1);
}
