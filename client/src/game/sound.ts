/**
 * Procedural horror SFX via the Web Audio API — no audio files.
 * The AudioContext is created lazily on first use; because clue discovery
 * happens inside a click/tap handler, this satisfies browser autoplay rules.
 */

let ctx: AudioContext | null = null;

function getCtx(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!ctx) {
    const Ctor =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext;
    if (!Ctor) return null;
    ctx = new Ctor();
  }
  if (ctx.state === "suspended") void ctx.resume();
  return ctx;
}

/** Force-create / resume the context from inside a user gesture. */
export function ensureAudio(): void {
  getCtx();
}

/**
 * A short, eerie "clue discovered" sting: two slightly detuned voices a minor
 * second apart, bent slowly downward through a muffling low-pass — uneasy and
 * distant, like something heard through a wall.
 */
export function playClueTone(): void {
  const ac = getCtx();
  if (!ac) return;
  const now = ac.currentTime;

  const master = ac.createGain();
  master.gain.value = 0.0001;
  master.connect(ac.destination);

  const filter = ac.createBiquadFilter();
  filter.type = "lowpass";
  filter.frequency.setValueAtTime(1400, now);
  filter.frequency.exponentialRampToValueAtTime(500, now + 2.2);
  filter.connect(master);

  // C#4 + D4 — a dissonant minor second that "beats" unpleasantly.
  const voices: Array<[number, OscillatorType]> = [
    [277.18, "sine"],
    [293.66, "triangle"],
  ];
  for (const [freq, type] of voices) {
    const osc = ac.createOscillator();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, now);
    osc.frequency.exponentialRampToValueAtTime(freq * 0.92, now + 2.2);
    osc.connect(filter);
    osc.start(now);
    osc.stop(now + 2.4);
  }

  // Slow swell, long decaying tail.
  master.gain.setValueAtTime(0.0001, now);
  master.gain.exponentialRampToValueAtTime(0.16, now + 0.22);
  master.gain.exponentialRampToValueAtTime(0.0001, now + 2.3);
}

/**
 * A low, dread-filled drone for the end-of-chapter cliffhanger.
 */
export function playEndDrone(): void {
  const ac = getCtx();
  if (!ac) return;
  const now = ac.currentTime;

  const master = ac.createGain();
  master.gain.value = 0.0001;
  master.connect(ac.destination);

  const filter = ac.createBiquadFilter();
  filter.type = "lowpass";
  filter.frequency.value = 480;
  filter.connect(master);

  // A1 + a sharp neighbour + the octave: a churning, beating low drone.
  for (const freq of [55, 58.27, 110]) {
    const osc = ac.createOscillator();
    osc.type = "sawtooth";
    osc.frequency.value = freq;
    osc.connect(filter);
    osc.start(now);
    osc.stop(now + 5);
  }

  master.gain.setValueAtTime(0.0001, now);
  master.gain.exponentialRampToValueAtTime(0.13, now + 1.4);
  master.gain.exponentialRampToValueAtTime(0.0001, now + 5);
}

/* ----------------------------------------------------------------- Heartbeat
 * A self-scheduling heartbeat. Call heartbeatUpdate(intensity) every frame with
 * intensity 0..1 (how close to being caught). Volume rises and the beat quickens
 * as it climbs; pass 0 to fall silent. Scheduling rides the audio clock so it
 * stays smooth regardless of frame rate.
 */
let hbNextAt = 0;

function scheduleThump(ac: AudioContext, t: number, vol: number): void {
  const osc = ac.createOscillator();
  osc.type = "sine";
  osc.frequency.setValueAtTime(62, t);
  osc.frequency.exponentialRampToValueAtTime(36, t + 0.12);
  const g = ac.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(Math.max(vol, 0.0002), t + 0.02);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.22);
  osc.connect(g);
  g.connect(ac.destination);
  osc.start(t);
  osc.stop(t + 0.26);
}

export function heartbeatUpdate(intensity: number): void {
  const ac = getCtx();
  if (!ac) return;
  if (intensity <= 0.02) {
    hbNextAt = 0; // reset so it doesn't fire a catch-up burst later
    return;
  }
  const now = ac.currentTime;
  if (hbNextAt < now || hbNextAt > now + 2) hbNextAt = now;
  // irregular: jitter the gap so it never feels metronomic
  const period =
    (1.05 - 0.55 * Math.min(intensity, 1)) * (0.9 + Math.random() * 0.2);
  const vol = 0.05 + 0.32 * Math.min(intensity, 1);
  while (hbNextAt <= now + 0.06) {
    scheduleThump(ac, hbNextAt, vol); // "lub"
    scheduleThump(ac, hbNextAt + 0.16, vol * 0.7); // "dub"
    hbNextAt += period;
  }
}

/** A harsh, dread-soaked hit for the moment the ghost takes you. */
export function playCaught(): void {
  const ac = getCtx();
  if (!ac) return;
  const now = ac.currentTime;

  const master = ac.createGain();
  master.gain.value = 0.0001;
  master.connect(ac.destination);

  // filtered noise impact
  const buffer = ac.createBuffer(1, Math.floor(ac.sampleRate * 0.6), ac.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < data.length; i++) {
    data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / data.length, 2);
  }
  const noise = ac.createBufferSource();
  noise.buffer = buffer;
  const lp = ac.createBiquadFilter();
  lp.type = "lowpass";
  lp.frequency.value = 1100;
  noise.connect(lp);
  lp.connect(master);

  // two detuned saws plunging an octave
  for (const f of [110, 116.5]) {
    const osc = ac.createOscillator();
    osc.type = "sawtooth";
    osc.frequency.setValueAtTime(f, now);
    osc.frequency.exponentialRampToValueAtTime(f * 0.5, now + 0.8);
    osc.connect(master);
    osc.start(now);
    osc.stop(now + 0.9);
  }

  master.gain.setValueAtTime(0.0001, now);
  master.gain.exponentialRampToValueAtTime(0.3, now + 0.02);
  master.gain.exponentialRampToValueAtTime(0.0001, now + 0.9);
  noise.start(now);
  noise.stop(now + 0.6);
}

/* --------------------------------------------------------------- Footsteps
 * Soft thuds that get louder/quicker as the ghost nears. Drive every frame
 * with footstepUpdate(0..1); 0 falls silent.
 */
let stepNextAt = 0;
function scheduleStep(ac: AudioContext, t: number, vol: number) {
  const len = Math.floor(ac.sampleRate * 0.12);
  const buf = ac.createBuffer(1, len, ac.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3);
  const src = ac.createBufferSource();
  src.buffer = buf;
  const lp = ac.createBiquadFilter();
  lp.type = "lowpass";
  lp.frequency.value = 300;
  const g = ac.createGain();
  g.gain.value = vol;
  src.connect(lp); lp.connect(g); g.connect(ac.destination);
  src.start(t); src.stop(t + 0.13);
}
export function footstepUpdate(intensity: number): void {
  const ac = getCtx();
  if (!ac) return;
  if (intensity <= 0.04) { stepNextAt = 0; return; }
  const now = ac.currentTime;
  if (stepNextAt < now || stepNextAt > now + 2) stepNextAt = now;
  const period = 0.64 - 0.2 * Math.min(intensity, 1);
  const vol = 0.04 + 0.16 * Math.min(intensity, 1);
  while (stepNextAt <= now + 0.06) {
    scheduleStep(ac, stepNextAt, vol);
    stepNextAt += period;
  }
}

/* ------------------------------------------------------------- Hide breathing
 * Slow, shaky breaths while hidden. Call breathingUpdate(true) each frame.
 */
let breathNextAt = 0;
function mkBreath(ac: AudioContext, t: number, dur: number, f0: number, f1: number, vol: number) {
  const len = Math.floor(ac.sampleRate * dur);
  const buf = ac.createBuffer(1, len, ac.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  const src = ac.createBufferSource();
  src.buffer = buf;
  const bp = ac.createBiquadFilter();
  bp.type = "bandpass";
  bp.Q.value = 0.8;
  bp.frequency.setValueAtTime(f0, t);
  bp.frequency.linearRampToValueAtTime(f1, t + dur);
  const g = ac.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.linearRampToValueAtTime(vol, t + dur * 0.4);
  g.gain.linearRampToValueAtTime(0.0001, t + dur);
  src.connect(bp); bp.connect(g); g.connect(ac.destination);
  src.start(t); src.stop(t + dur);
}
export function breathingUpdate(active: boolean): void {
  const ac = getCtx();
  if (!ac) return;
  if (!active) { breathNextAt = 0; return; }
  const now = ac.currentTime;
  if (breathNextAt < now || breathNextAt > now + 4) breathNextAt = now;
  while (breathNextAt <= now + 0.1) {
    const shake = 0.04 + Math.random() * 0.03;
    mkBreath(ac, breathNextAt, 0.9, 500, 1200, shake); // inhale
    mkBreath(ac, breathNextAt + 1.05, 1.1, 1100, 450, shake * 0.85); // exhale
    breathNextAt += 3.4 + Math.random() * 0.9;
  }
}

/* --------------------------------------------------------------- Low rumble
 * Persistent sub-bass for the attack charge. Set level 0..1 each frame.
 */
let rumbleGain: GainNode | null = null;
function ensureRumble(ac: AudioContext): GainNode {
  if (!rumbleGain) {
    const gain = ac.createGain();
    gain.gain.value = 0;
    const lp = ac.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.value = 110;
    const o1 = ac.createOscillator(); o1.type = "sawtooth"; o1.frequency.value = 42;
    const o2 = ac.createOscillator(); o2.type = "sine"; o2.frequency.value = 27;
    o1.connect(lp); o2.connect(lp); lp.connect(gain); gain.connect(ac.destination);
    o1.start(); o2.start();
    rumbleGain = gain;
  }
  return rumbleGain;
}
export function rumbleUpdate(level: number): void {
  const ac = getCtx();
  if (!ac) return;
  ensureRumble(ac).gain.setTargetAtTime(
    Math.max(0, Math.min(level, 1)) * 0.22,
    ac.currentTime,
    0.08
  );
}

/** Harsh static burst — the ghost crossing into your room. */
export function playStatic(): void {
  const ac = getCtx();
  if (!ac) return;
  const now = ac.currentTime;
  const len = Math.floor(ac.sampleRate * 0.4);
  const buf = ac.createBuffer(1, len, ac.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  const src = ac.createBufferSource();
  src.buffer = buf;
  const hp = ac.createBiquadFilter();
  hp.type = "highpass"; hp.frequency.value = 1500;
  const g = ac.createGain();
  g.gain.setValueAtTime(0.0001, now);
  g.gain.exponentialRampToValueAtTime(0.16, now + 0.02);
  g.gain.exponentialRampToValueAtTime(0.0001, now + 0.4);
  src.connect(hp); hp.connect(g); g.connect(ac.destination);
  src.start(now); src.stop(now + 0.42);
}

/** Electrical buzz — flashlight flicker. */
export function playBuzz(): void {
  const ac = getCtx();
  if (!ac) return;
  const now = ac.currentTime;
  const o = ac.createOscillator();
  o.type = "square"; o.frequency.value = 92;
  const hp = ac.createBiquadFilter();
  hp.type = "highpass"; hp.frequency.value = 420;
  const g = ac.createGain();
  g.gain.setValueAtTime(0.05, now);
  g.gain.exponentialRampToValueAtTime(0.0001, now + 0.22);
  const lfo = ac.createOscillator(); lfo.type = "square"; lfo.frequency.value = 44;
  const lfoG = ac.createGain(); lfoG.gain.value = 0.03;
  lfo.connect(lfoG); lfoG.connect(g.gain);
  o.connect(hp); hp.connect(g); g.connect(ac.destination);
  o.start(now); lfo.start(now); o.stop(now + 0.24); lfo.stop(now + 0.24);
}

/** Bone-chilling shriek — the area scream attack. */
export function playShriek(): void {
  const ac = getCtx();
  if (!ac) return;
  const now = ac.currentTime;
  const master = ac.createGain();
  master.gain.value = 0.0001;
  master.connect(ac.destination);
  for (const f of [880, 932, 1245]) {
    const o = ac.createOscillator();
    o.type = "sawtooth";
    o.frequency.setValueAtTime(f * 0.6, now);
    o.frequency.exponentialRampToValueAtTime(f * 1.4, now + 0.5);
    o.frequency.exponentialRampToValueAtTime(f * 0.5, now + 1.0);
    const g = ac.createGain(); g.gain.value = 0.08;
    o.connect(g); g.connect(master);
    o.start(now); o.stop(now + 1.1);
  }
  const len = Math.floor(ac.sampleRate * 1.0);
  const buf = ac.createBuffer(1, len, ac.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  const src = ac.createBufferSource();
  src.buffer = buf;
  const bp = ac.createBiquadFilter();
  bp.type = "bandpass"; bp.frequency.value = 2000; bp.Q.value = 0.7;
  const ng = ac.createGain(); ng.gain.value = 0.06;
  src.connect(bp); bp.connect(ng); ng.connect(master);
  src.start(now); src.stop(now + 1.0);
  master.gain.setValueAtTime(0.0001, now);
  master.gain.exponentialRampToValueAtTime(0.5, now + 0.05);
  master.gain.exponentialRampToValueAtTime(0.0001, now + 1.1);
}

/** Distant child humming — the music-box motif (E5, C5, A4). */
export const MUSIC_BOX_NOTES = [659.25, 523.25, 440.0];
export function playLullaby(): void {
  const ac = getCtx();
  if (!ac) return;
  let t = ac.currentTime + 0.05;
  for (const f of MUSIC_BOX_NOTES) {
    const o = ac.createOscillator();
    o.type = "sine"; o.frequency.value = f;
    const lp = ac.createBiquadFilter();
    lp.type = "lowpass"; lp.frequency.value = 1100;
    const g = ac.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.045, t + 0.06);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.6);
    o.connect(lp); lp.connect(g); g.connect(ac.destination);
    o.start(t); o.stop(t + 0.62);
    t += 0.55;
  }
}

/** Silence the continuous engines (on unmount / game over). */
export function silenceAll(): void {
  heartbeatUpdate(0);
  footstepUpdate(0);
  breathingUpdate(false);
  rumbleUpdate(0);
}
