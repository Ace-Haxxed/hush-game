import { Ghost } from "@hush/shared";

/* ===========================================================================
 * Ghost AI — Chapter 1: The Alderton House
 *
 * The ghost roams a four-room house and, if a player lingers too long, drops
 * into a relentless HUNT. Designed to feel unpredictable but fair: it never
 * teleports, it pursues one hop at a time, and it gives players a long camping
 * window before it commits — and a clean escape window once they run.
 * ========================================================================= */

/** Adjacency for the house. The foyer is the hub; the basement is a dead end. */
export const HOUSE: Record<string, string[]> = {
  foyer: ["study", "kitchen", "basement"],
  kitchen: ["foyer"],
  study: ["foyer"],
  basement: ["foyer"],
};

export const GHOST_TUNING = {
  /** Roam: pick a fresh interval in this range after every move. */
  ROAM_MIN_MS: 8_000,
  ROAM_MAX_MS: 12_000,
  /** Hunt: fixed, faster cadence. */
  HUNT_MS: 3_000,
  /** A player must hold one room this long to provoke a hunt. */
  DWELL_TRIGGER_MS: 20_000,
  /** Once the target breaks away, the ghost gives up after this long. */
  HUNT_GIVE_UP_MS: 30_000,
  /** Logic resolution. */
  TICK_MS: 1_000,
  /** Probability the ghost avoids doubling straight back while roaming. */
  ANTI_BACKTRACK: 0.7,
} as const;

/** Minimal view of a player the AI needs: who they are and where they stand. */
export interface PlayerPresence {
  id: string;
  room: string;
}

/** What gets broadcast to clients. Extends the shared Ghost shape. */
export interface GhostState extends Ghost {
  /** The hunted player's id, or null. Only that client shows the red warning. */
  targetPlayerId: string | null;
}

export interface GhostAIOptions {
  getPlayers: () => PlayerPresence[];
  getClueCount: () => number;
  /** Called whenever the broadcastable ghost state changes. */
  broadcast: (state: GhostState) => void;
  startRoom?: string;
  /** Injectable for deterministic tests. */
  rng?: () => number;
  now?: () => number;
}

type Mode = "roam" | "hunt";

interface Dwell {
  room: string;
  since: number;
}

/** First hop along the shortest path from `from` to `to`, avoiding `blocked`. */
function nextHop(from: string, to: string, blocked: Set<string>): string {
  if (from === to) return from;
  const parent = new Map<string, string>([[from, from]]);
  const queue: string[] = [from];
  while (queue.length) {
    const cur = queue.shift()!;
    for (const nb of HOUSE[cur] ?? []) {
      if (blocked.has(nb) || parent.has(nb)) continue;
      parent.set(nb, cur);
      if (nb === to) {
        // Walk back to the hop whose parent is the origin.
        let step = nb;
        while (parent.get(step) !== from) step = parent.get(step)!;
        return step;
      }
      queue.push(nb);
    }
  }
  return from; // unreachable (e.g. basement sealed) — hold position
}

export class GhostAI {
  private readonly opts: Required<
    Pick<GhostAIOptions, "rng" | "now">
  > &
    GhostAIOptions;

  private mode: Mode = "roam";
  private room: string;
  private prevRoom: string | null = null;

  private targetId: string | null = null;
  /** Room whose camping triggered/sustains the current hunt. */
  private anchorRoom: string | null = null;
  /** When the ghost will revert to roaming, or null while actively engaged. */
  private giveUpAt: number | null = null;

  private nextMoveAt: number;
  private readonly dwell = new Map<string, Dwell>();
  private timer: ReturnType<typeof setInterval> | null = null;
  private lastSignature = "";

  constructor(options: GhostAIOptions) {
    this.opts = {
      rng: Math.random,
      now: Date.now,
      ...options,
    };
    // Start somewhere that isn't the player's spawn (foyer) or the sealed basement.
    this.room = options.startRoom ?? "study";
    this.nextMoveAt =
      this.opts.now() + this.randInterval(GHOST_TUNING.ROAM_MIN_MS, GHOST_TUNING.ROAM_MAX_MS);
  }

  start(): void {
    if (this.timer) return;
    this.emitIfChanged(); // publish initial position
    this.timer = setInterval(() => this.tick(), GHOST_TUNING.TICK_MS);
    // Don't keep the Node process alive solely for the ghost.
    if (typeof this.timer === "object" && "unref" in this.timer) {
      (this.timer as { unref: () => void }).unref();
    }
  }

  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  getState(): GhostState {
    return {
      currentRoom: this.room,
      huntMode: this.mode === "hunt",
      isVisible: this.mode === "hunt",
      targetPlayerId: this.targetId,
    };
  }

  /** Advance the simulation by one tick. Exposed for tests; called internally. */
  tick(now: number = this.opts.now()): void {
    const players = this.opts.getPlayers();
    const basementAllowed = this.opts.getClueCount() >= 1;

    this.updateDwell(players, now);

    if (this.mode === "roam") {
      this.maybeStartHunt(now);
    } else {
      this.updateHunt(players, now);
    }

    this.maybeMove(players, basementAllowed, now);
    this.emitIfChanged();
  }

  // --------------------------------------------------------------- internals

  private updateDwell(players: PlayerPresence[], now: number): void {
    const present = new Set<string>();
    for (const p of players) {
      present.add(p.id);
      const d = this.dwell.get(p.id);
      if (!d || d.room !== p.room) {
        this.dwell.set(p.id, { room: p.room, since: now });
      }
    }
    for (const id of [...this.dwell.keys()]) {
      if (!present.has(id)) this.dwell.delete(id);
    }
  }

  /** Promote to hunt if any player has camped past the trigger threshold. */
  private maybeStartHunt(now: number): void {
    let best: { id: string; room: string; dur: number } | null = null;
    for (const [id, d] of this.dwell) {
      const dur = now - d.since;
      if (dur >= GHOST_TUNING.DWELL_TRIGGER_MS && (!best || dur > best.dur)) {
        best = { id, room: d.room, dur };
      }
    }
    if (best) this.enterHunt(best.id, best.room, now);
  }

  private updateHunt(players: PlayerPresence[], now: number): void {
    const target = players.find((p) => p.id === this.targetId);

    if (!target) {
      // Target vanished (disconnected) — start the give-up clock.
      this.giveUpAt ??= now + GHOST_TUNING.HUNT_GIVE_UP_MS;
    } else {
      const d = this.dwell.get(this.targetId!)!;
      if (d.room === this.anchorRoom) {
        // Still camping the anchor — stay aggravated indefinitely.
        this.giveUpAt = null;
      } else {
        // They've left the anchor. Begin (or keep) the give-up countdown...
        this.giveUpAt ??= now + GHOST_TUNING.HUNT_GIVE_UP_MS;
        // ...unless they've settled into a NEW room long enough to re-aggravate.
        if (now - d.since >= GHOST_TUNING.DWELL_TRIGGER_MS) {
          this.anchorRoom = d.room;
          this.giveUpAt = null;
        }
      }
    }

    if (this.giveUpAt !== null && now >= this.giveUpAt) {
      this.enterRoam(now);
    }
  }

  private maybeMove(
    players: PlayerPresence[],
    basementAllowed: boolean,
    now: number
  ): void {
    if (now < this.nextMoveAt) return;

    if (this.mode === "roam") {
      const dest = this.pickRoamRoom(basementAllowed);
      this.moveTo(dest);
      this.nextMoveAt =
        now + this.randInterval(GHOST_TUNING.ROAM_MIN_MS, GHOST_TUNING.ROAM_MAX_MS);
    } else {
      const target = players.find((p) => p.id === this.targetId);
      const goal = target?.room ?? this.anchorRoom ?? this.room;
      const blocked = basementAllowed ? new Set<string>() : new Set(["basement"]);
      this.moveTo(nextHop(this.room, goal, blocked));
      this.nextMoveAt = now + GHOST_TUNING.HUNT_MS;
    }
  }

  /** Choose a roam destination: a random neighbour, usually not straight back. */
  private pickRoamRoom(basementAllowed: boolean): string {
    let options = (HOUSE[this.room] ?? []).filter(
      (r) => basementAllowed || r !== "basement"
    );
    if (options.length === 0) return this.room;

    if (
      options.length > 1 &&
      this.prevRoom &&
      options.includes(this.prevRoom) &&
      this.opts.rng() < GHOST_TUNING.ANTI_BACKTRACK
    ) {
      options = options.filter((r) => r !== this.prevRoom);
    }
    return options[Math.floor(this.opts.rng() * options.length)];
  }

  private moveTo(dest: string): void {
    if (dest === this.room) return;
    this.prevRoom = this.room;
    this.room = dest;
  }

  private enterHunt(id: string, anchorRoom: string, now: number): void {
    this.mode = "hunt";
    this.targetId = id;
    this.anchorRoom = anchorRoom;
    this.giveUpAt = null;
    this.nextMoveAt = now; // begin pursuit on the next tick
    console.log(`[ghost] HUNT engaged — target=${id} anchor=${anchorRoom}`);
  }

  private enterRoam(now: number): void {
    this.mode = "roam";
    this.targetId = null;
    this.anchorRoom = null;
    this.giveUpAt = null;
    this.nextMoveAt =
      now + this.randInterval(GHOST_TUNING.ROAM_MIN_MS, GHOST_TUNING.ROAM_MAX_MS);
    console.log("[ghost] returning to roam");
  }

  private randInterval(min: number, max: number): number {
    return min + this.opts.rng() * (max - min);
  }

  private emitIfChanged(): void {
    const state = this.getState();
    const sig = `${state.currentRoom}|${state.huntMode}|${state.targetPlayerId}`;
    if (sig === this.lastSignature) return;
    this.lastSignature = sig;
    this.opts.broadcast(state);
  }
}
