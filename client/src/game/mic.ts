/**
 * Microphone loudness detection for Hush. Uses getUserMedia + an AnalyserNode
 * to read the player's mic volume. Degrades silently when unsupported/denied.
 *
 * MULTIPLAYER MIC: wire player mic events through Socket.io here in future.
 * Each connected player's mic would be monitored client-side; when a player
 * crosses the threshold, emit { playerId, position, volume } so the server can
 * flash that player's username red on every screen, steer the ghost toward
 * them, and apply static to their voice channel for the other players.
 */

/** Loud enough to make the ghost hunt (0..1). Tweak here. */
export const MIC_THRESHOLD = 0.15;
/** Warning zone — getting loud, not yet triggering. */
export const MIC_WARNING = 0.08;

let ctx: AudioContext | null = null;
let analyser: AnalyserNode | null = null;
let stream: MediaStream | null = null;
let data: Uint8Array<ArrayBuffer> | null = null;
let active = false;
let muteUntil = 0;

export function micSupported(): boolean {
  return typeof navigator !== "undefined" && !!navigator.mediaDevices?.getUserMedia;
}

/** Request the mic and start analysing. Returns false on deny/unsupported. */
export async function startMic(): Promise<boolean> {
  if (!micSupported()) return false;
  try {
    stream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: false },
    });
    const Ctor =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return false;
    ctx = new Ctor();
    if (ctx.state === "suspended") await ctx.resume();
    const src = ctx.createMediaStreamSource(stream);
    analyser = ctx.createAnalyser();
    analyser.fftSize = 512;
    analyser.smoothingTimeConstant = 0.55;
    data = new Uint8Array(new ArrayBuffer(analyser.frequencyBinCount));
    src.connect(analyser);
    active = true;
    return true;
  } catch {
    active = false;
    return false;
  }
}

export function micActive(): boolean {
  return active;
}

/** RMS volume 0..1. Returns 0 while inactive or muted (hold-breath). */
export function micVolume(now: number): number {
  if (!active || !analyser || !data) return 0;
  if (now < muteUntil) return 0;
  analyser.getByteTimeDomainData(data);
  let sum = 0;
  for (let i = 0; i < data.length; i++) {
    const v = (data[i] - 128) / 128;
    sum += v * v;
  }
  return Math.sqrt(sum / data.length);
}

/** Suppress detection for `ms` (used by the hold-breath mechanic). */
export function muteMic(ms: number, now: number): void {
  muteUntil = Math.max(muteUntil, now + ms);
}

export function stopMic(): void {
  active = false;
  stream?.getTracks().forEach((t) => t.stop());
  stream = null;
  analyser = null;
  data = null;
  if (ctx) { ctx.close().catch(() => {}); ctx = null; }
}
