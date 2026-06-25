import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import EndScreen from "./components/EndScreen";
import DialogueBox from "./components/DialogueBox";
import IntroSequence from "./components/IntroSequence";
import DeathSequence from "./components/DeathSequence";
import MicPrompt from "./components/MicPrompt";
import { ClueStack } from "./components/Clue";
import { useClues } from "./game/useClues";
import {
  MIC_THRESHOLD,
  MIC_WARNING,
  micActive,
  micSupported,
  micVolume,
  muteMic,
  stopMic,
} from "./game/mic";
import {
  ensureAudio,
  heartbeatUpdate,
  footstepUpdate,
  breathingUpdate,
  rumbleUpdate,
  playStatic,
  playBuzz,
  playShriek,
  playLullaby,
  playSting,
  playBoom,
  playEndDrone,
  silenceAll,
} from "./game/sound";
import "./Game.css";

/* ===========================================================================
 * Hush — flashlight-cone horror escape on a single <canvas>.
 * ========================================================================= */

const T = 18;
const DOOR = 60;

interface Rect { minx: number; miny: number; maxx: number; maxy: number }
interface RoomRect extends Rect { id: string; fill: string }
interface Vec { x: number; y: number }

const ROOMS: RoomRect[] = [
  { id: "foyer", minx: -260, miny: -200, maxx: 260, maxy: 200, fill: "#0e0e12" },
  { id: "kitchen", minx: -780, miny: -200, maxx: -260, maxy: 200, fill: "#0c100e" },
  { id: "study", minx: 260, miny: -200, maxx: 780, maxy: 200, fill: "#100e0c" },
  { id: "basement", minx: -260, miny: 200, maxx: 260, maxy: 600, fill: "#120c0c" },
];
const ROOM_CENTER: Record<string, Vec> = {
  foyer: { x: 0, y: 0 }, kitchen: { x: -520, y: 0 },
  study: { x: 520, y: 0 }, basement: { x: 0, y: 400 },
};
const DOORWAY: Record<string, Vec> = {
  kitchen: { x: -260, y: 0 }, study: { x: 260, y: 0 }, basement: { x: 0, y: 200 },
};
const NEIGHBORS: Record<string, string[]> = {
  foyer: ["kitchen", "study", "basement"], kitchen: ["foyer"], study: ["foyer"], basement: ["foyer"],
};

const vWall = (x: number, yA: number, yB: number): Rect => ({
  minx: x - T / 2, maxx: x + T / 2, miny: Math.min(yA, yB) - T / 2, maxy: Math.max(yA, yB) + T / 2,
});
const hWall = (y: number, xA: number, xB: number): Rect => ({
  miny: y - T / 2, maxy: y + T / 2, minx: Math.min(xA, xB) - T / 2, maxx: Math.max(xA, xB) + T / 2,
});
const STATIC_WALLS: Rect[] = [
  vWall(-780, -200, 200), vWall(780, -200, 200), vWall(-260, 200, 600), vWall(260, 200, 600),
  hWall(600, -260, 260),
  vWall(-260, -200, -DOOR), vWall(-260, DOOR, 200), vWall(260, -200, -DOOR), vWall(260, DOOR, 200),
  hWall(-200, -780, -DOOR), hWall(-200, DOOR, 780), hWall(200, -780, -DOOR), hWall(200, DOOR, 780),
];

const EXIT_POS = { x: 0, y: -200 };
const BASEMENT_DOOR = { x: 0, y: 200 };
// spread out so the player has to actually explore each room
const CLUE_OBJECTS = [
  { id: "clue-musicbox", x: -720, y: -130 },
  { id: "clue-drawing", x: 720, y: 130 },
  { id: "clue-elara", x: 0, y: 545 },
];
const BASEMENT_CLUE_ID = "clue-elara";
const BASEMENT_READ_SECS = 5; // must linger in the basement to read it

/** Fake drawers — open them, find nothing. Builds the explore habit. */
const DECOYS: { x: number; y: number; text: string }[] = [
  { x: -150, y: -150, text: "An empty drawer." },
  { x: 170, y: 150, text: "Nothing but cobwebs." },
  { x: -680, y: 120, text: "Old receipts. Faded to nothing." },
  { x: 680, y: -120, text: "Just cutlery. Cold to the touch." },
  { x: -180, y: 320, text: "A coal scuttle. Empty." },
];

/** Red herring — reads like a clue, but it doesn't fit. */
const HERRING = { id: "herring-photo", x: 130, y: -150 };
const HERRING_DIALOGUE = [
  "A polaroid photo. The whole family, smiling.",
  "They look happy. Recent, even.",
  "The date in the corner reads 2019.",
  "But this house has been empty since 1987.",
];
const HERRING_NOTE = "A photo dated 2019 — that's impossible";
const HIDE_SPOTS = [
  { id: "wardrobe", room: "study", x: 720, y: -150 },
  { id: "stairs", room: "foyer", x: -200, y: 150 },
];
const CLUE_DIALOGUE: Record<string, string[]> = {
  "clue-musicbox": [
    "...a music box. Who winds these up anymore?",
    "It only plays three notes before it stops.",
    "Like it's waiting for someone to finish the song.",
  ],
  "clue-drawing": [
    "A child drew this. A family portrait.",
    "Mother. Father. And... someone crossed out.",
    "They didn't erase it. They wanted it gone.",
  ],
  "clue-elara": [
    "There is something scratched into the wall.",
    "Someone did this with their fingers.",
    "E... L... A... R... A.",
    "Someone was down here for a long time.",
  ],
};
/** Short reminder that floats over the clue spot after the dialogue closes. */
const CLUE_NOTE: Record<string, string> = {
  "clue-musicbox": "Music box — 3 notes, then silence",
  "clue-drawing": "Family portrait — one face crossed out",
  "clue-elara": "Scratched in the wall — ELARA",
};

// tunables
const PLAYER_SPEED = 168, PLAYER_R = 11;
const NPC_R = 9, NPC_SPEED = 158;
const GHOST_R = 15, GHOST_ROAM = 56, GHOST_HUNT = 122, GHOST_SPEED_PER_CLUE = 0.15;
const GHOST_LOSE = 580;
const CONE_HALF = (70 / 2) * (Math.PI / 180);
const CONE_LEN = 250;
const FLICKER_DIST = 200, BLACKOUT_DIST = 100, BLACKOUT_MS = 1500;
const WARN_DIST = 135, DANGER_SECS = 3, CATCH_DIST = PLAYER_R + GHOST_R;
const PING_SECS = 2.6, DISTRACT_MS = 30_000;
const HIDE_RANGE = 38, HIDE_SEARCH_MS = 45_000;
const ATTACK_MIN = 45_000, ATTACK_MAX = 60_000, ATTACK_CHARGE = 2000;
const ATTACK_R = 180, ATTACK_RECOVER = 3000, ATTACK_BREAK_MS = 8000, NPC_PANIC_MS = 15_000;
const FOOTPRINT_FADE = 8000;

const clamp = (v: number, lo: number, hi: number) => (v < lo ? lo : v > hi ? hi : v);
function roomOf(x: number, y: number): string | null {
  for (const r of ROOMS) if (x >= r.minx && x <= r.maxx && y >= r.miny && y <= r.maxy) return r.id;
  return null;
}
function fmtTime(s: number): string {
  s = Math.max(0, Math.floor(s));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

export default function Game() {
  const navigate = useNavigate();
  const clues = useClues();
  const clueRef = useRef(clues);
  clueRef.current = clues;

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const joyRef = useRef<HTMLDivElement>(null);
  const joyBaseRef = useRef<HTMLDivElement>(null);
  const knobRef = useRef<HTMLDivElement>(null);
  const interactRef = useRef<() => void>(() => {});
  const closeDialogueRef = useRef<() => void>(() => {});
  const dialogueRef = useRef(false);
  const hidingRef = useRef(false);
  const peekRef = useRef(0);

  const [showEnd, setShowEnd] = useState(false);
  const [ending, setEnding] = useState<"escape" | "caught">("escape");
  const [timeSec, setTimeSec] = useState(0);
  const [distractSec, setDistractSec] = useState(0);
  const [prompt, setPrompt] = useState<{ text: string; locked: boolean } | null>(null);
  const [hiding, setHiding] = useState(false);
  const [dialogue, setDialogue] = useState<string[] | null>(null);
  const [dlgDim, setDlgDim] = useState(false);
  const [actPulse, setActPulse] = useState(false);
  const [intro, setIntro] = useState(true);
  const [death, setDeath] = useState(false);
  const introRef = useRef(true);
  // mic gate: if unsupported, skip the prompt entirely (silently, no mic)
  const [micAsked, setMicAsked] = useState(() => !micSupported());
  const [micOn, setMicOn] = useState(false);
  const breathHoldRef = useRef(false);
  const breathRingRef = useRef<HTMLDivElement>(null);
  const [isTouch] = useState(
    () => typeof window !== "undefined" && !!window.matchMedia?.("(pointer: coarse)").matches
  );
  const isTouchRef = useRef(isTouch);

  useEffect(() => {
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext("2d")!;
    const view = { w: 0, h: 0 };
    const cam = { ox: 0, oy: 0 };

    const player = { x: 0, y: 0, idle: 0 };
    const ghost = {
      x: 0, y: 540, mode: "roam" as "roam" | "hunt", lose: 0, seed: Math.random() * 99,
      distractUntil: 0,
      attackState: "idle" as "idle" | "charging", nextAttackAt: 0,
      chargeUntil: 0, frozenUntil: 0, warn1: false, warn2: false, fireAt: 0,
      prevX: 0, prevY: 540, stepAcc: 0, footSide: 1, hideSearchT: 0,
      trail: [] as Vec[],
      // pacing
      behavior: "move" as "move" | "idle" | "dash",
      behaviorUntil: 0, dashTarget: { x: 0, y: 0 },
      patrolPath: [] as string[], patrolIdx: 0, breakAt: 0,
    };
    // pick 2–3 preferred rooms to circle
    ghost.patrolPath = (() => {
      const a = ["foyer", "kitchen", "study", "basement"];
      for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
      return a.slice(0, 3);
    })();
    const npc = {
      x: -36, y: 44, alive: true, selected: false, hidden: false,
      mode: "follow" as "follow" | "goto" | "check",
      path: [] as Vec[], checkT: 0,
      frantic: false, franticAngle: Math.random() * Math.PI * 2, franticNext: 0, turnRate: 0,
      trailT: 0, emote: "", emoteUntil: 0, puffNext: 0, guttering: 0, panicUntil: 0,
    };
    const npcTrail: { x: number; y: number; life: number }[] = [];
    const footprints: { x: number; y: number; t: number; side: number }[] = [];
    const notes: { x: number; y: number; text: string; t: number }[] = [];

    let danger = 0, pingT = 0, caughtFx = 0, whiteFlash = 0, attackFlash = 0, shake = 0;
    let ended = false, raf = 0, perf = 0, startPerf = -1;
    let lastSec = -1, lastDistract = -1, lastPrompt = "", lastDim = false, lastAct = false;
    let facing = -Math.PI / 2, mouseRX = 0, mouseRY = 0, mouseActive = false;
    let flashOutUntil = 0, flashOutCd = 0;
    let lullabyNext = 1200;
    let ghostRoomPrev: string | null = null;
    let playerSpot: (typeof HIDE_SPOTS)[number] | null = null;
    let pendingNote: { text: string; x: number; y: number } | null = null;
    let reading = 0; // basement-clue channel progress (seconds)
    let warmupUntil = 0; // flashlight warm-up
    let graceEnded = false;
    let stingAt = 0;
    // mic detection + hold-breath
    let micCheckAt = 0, micLevel = 0, micHuntUntil = 0, micHeardUntil = 0;
    let micFlash = 0, micStaticAt = 0, micLastSound = -9999;
    let holding = false, breathMeter = 1, breathCdUntil = 0;

    function currentWalls(): Rect[] {
      const w = STATIC_WALLS.slice();
      if (clueRef.current.foundCount < 2) w.push(hWall(200, -DOOR, DOOR));
      if (!clueRef.current.allFound) w.push(hWall(-200, -DOOR, DOOR));
      return w;
    }
    function resolve(ent: { x: number; y: number }, r: number, walls: Rect[]) {
      for (let pass = 0; pass < 2; pass++) for (const w of walls) {
        const cx = clamp(ent.x, w.minx, w.maxx), cy = clamp(ent.y, w.miny, w.maxy);
        const dx = ent.x - cx, dy = ent.y - cy, d2 = dx * dx + dy * dy;
        if (d2 < r * r) {
          if (d2 > 1e-4) { const d = Math.sqrt(d2), p = r - d; ent.x += (dx / d) * p; ent.y += (dy / d) * p; }
          else {
            const l = ent.x - w.minx, ri = w.maxx - ent.x, t = ent.y - w.miny, b = w.maxy - ent.y;
            const m = Math.min(l, ri, t, b);
            if (m === l) ent.x = w.minx - r; else if (m === ri) ent.x = w.maxx + r;
            else if (m === t) ent.y = w.miny - r; else ent.y = w.maxy + r;
          }
        }
      }
    }
    const dist = (ax: number, ay: number, bx: number, by: number) => Math.hypot(ax - bx, ay - by);
    function moveToward(ent: { x: number; y: number }, t: Vec, sp: number, dt: number) {
      const dx = t.x - ent.x, dy = t.y - ent.y, d = Math.hypot(dx, dy);
      if (d > 1) { ent.x += (dx / d) * sp * dt; ent.y += (dy / d) * sp * dt; }
    }

    function openDialogue(lines: string[], note?: { text: string; x: number; y: number }) {
      dialogueRef.current = true;
      setDialogue(lines);
      pendingNote = note ?? null;
    }
    /** Close the dialogue and leave a fading note over the spot. */
    function closeDialogue() {
      if (!dialogueRef.current) return;
      dialogueRef.current = false;
      setDialogue(null);
      setDlgDim(false);
      lastDim = false;
      if (pendingNote) { notes.push({ ...pendingNote, t: perf }); pendingNote = null; }
    }
    closeDialogueRef.current = closeDialogue;
    function onCluePickedUp() {
      pingT = PING_SECS;
      if (perf >= ghost.distractUntil) {
        ghost.mode = "hunt"; // the noise drew it toward you
        ghost.behavior = "move";
      }
    }
    let herringRead = false;
    function doInteract() {
      if (ended || dialogueRef.current || hidingRef.current) return;
      const api = clueRef.current;
      // real clues (basement is channeled separately, so skip it here)
      for (const c of CLUE_OBJECTS) {
        if (c.id === BASEMENT_CLUE_ID || api.foundIds.has(c.id)) continue;
        if (dist(player.x, player.y, c.x, c.y) < HIDE_RANGE + 6) {
          if (api.findClue(c.id)) { onCluePickedUp(); openDialogue(CLUE_DIALOGUE[c.id], { text: CLUE_NOTE[c.id], x: c.x, y: c.y }); }
          return;
        }
      }
      // red herring — looks like a clue, doesn't count
      if (!herringRead && dist(player.x, player.y, HERRING.x, HERRING.y) < HIDE_RANGE + 6) {
        herringRead = true; pingT = 0;
        openDialogue(HERRING_DIALOGUE, { text: HERRING_NOTE, x: HERRING.x, y: HERRING.y });
        return;
      }
      // fake drawers
      for (const dq of DECOYS) {
        if (dist(player.x, player.y, dq.x, dq.y) < HIDE_RANGE + 6) {
          notes.push({ x: dq.x, y: dq.y, text: dq.text, t: perf });
          return;
        }
      }
      if (api.allFound && dist(player.x, player.y, EXIT_POS.x, EXIT_POS.y) < 80) triggerEnd("escape");
    }
    interactRef.current = doInteract;

    function handleE() {
      if (dialogueRef.current) return;
      if (hidingRef.current) { hidingRef.current = false; setHiding(false); breathingUpdate(false); playerSpot = null; return; }
      const spot = HIDE_SPOTS.find((s) => dist(player.x, player.y, s.x, s.y) < HIDE_RANGE);
      if (spot) {
        hidingRef.current = true; setHiding(true);
        player.x = spot.x; player.y = spot.y; playerSpot = spot; ghost.hideSearchT = 0;
        return;
      }
      doInteract();
    }
    function forceUnhide() {
      hidingRef.current = false; setHiding(false); breathingUpdate(false);
      playerSpot = null; ghost.hideSearchT = 0;
    }
    function startDistraction() {
      npc.selected = false; npc.guttering = 0.6;
      npc.emote = "💨"; npc.emoteUntil = perf + 2000; npc.puffNext = perf + 3500;
      ghost.distractUntil = perf + DISTRACT_MS; danger = 0;
    }
    function triggerEnd(kind: "escape" | "caught") {
      if (ended) return;
      ended = true;
      if (dialogueRef.current) { dialogueRef.current = false; setDialogue(null); }
      silenceAll();
      if (kind === "caught") {
        // slow, earned death: DeathSequence handles breathing + the eye, then EndScreen
        setEnding("caught");
        setDeath(true);
      } else {
        playEndDrone();
        setEnding("escape");
        setShowEnd(true);
      }
    }

    function ghostTarget(): Vec | null {
      const c: Vec[] = [];
      if (!hidingRef.current) c.push({ x: player.x, y: player.y });
      if (npc.alive && !npc.hidden) c.push({ x: npc.x, y: npc.y });
      if (!c.length) return null;
      return c.length === 1 ? c[0]
        : dist(ghost.x, ghost.y, c[0].x, c[0].y) <= dist(ghost.x, ghost.y, c[1].x, c[1].y) ? c[0] : c[1];
    }

    // ---- area attack ----
    function updateAttack() {
      if (ghost.attackState === "idle") {
        if (perf >= ghost.nextAttackAt && perf >= ghost.distractUntil) {
          ghost.attackState = "charging";
          ghost.chargeUntil = perf + ATTACK_CHARGE;
          ghost.warn1 = ghost.warn2 = false;
        }
      } else {
        const prog = clamp(1 - (ghost.chargeUntil - perf) / ATTACK_CHARGE, 0, 1);
        rumbleUpdate(prog);
        shake = Math.max(shake, 1.5 + prog * 2.5);
        if (!ghost.warn1 && prog > 0.25) { ghost.warn1 = true; whiteFlash = 0.6; }
        if (!ghost.warn2 && prog > 0.55) { ghost.warn2 = true; whiteFlash = 0.6; }
        if (perf >= ghost.chargeUntil) fireAttack();
      }
    }
    function fireAttack() {
      ghost.attackState = "idle";
      rumbleUpdate(0); playShriek();
      ghost.fireAt = perf; attackFlash = 0.5;
      if (!hidingRef.current && dist(ghost.x, ghost.y, player.x, player.y) < ATTACK_R) {
        flashOutUntil = perf + ATTACK_BREAK_MS;
      }
      if (npc.alive && dist(ghost.x, ghost.y, npc.x, npc.y) < ATTACK_R) {
        npc.panicUntil = perf + NPC_PANIC_MS;
      }
      ghost.frozenUntil = perf + ATTACK_RECOVER;
      // later tiers attack more often
      const late = perf - startPerf >= 240000;
      const iv = late ? 30000 + Math.random() * 20000 : ATTACK_MIN + Math.random() * (ATTACK_MAX - ATTACK_MIN);
      ghost.nextAttackAt = perf + ATTACK_RECOVER + iv;
      shake = isTouchRef.current ? 22 : 10; // stronger physical kick on mobile
      if (isTouchRef.current && navigator.vibrate) navigator.vibrate([200, 100, 200]);
    }

    // ---- simulation ----
    function update(dt: number) {
      const api = clueRef.current;
      const walls = currentWalls();
      const foundCount = api.foundCount;
      const distracted = perf < ghost.distractUntil;
      const frozen = perf < ghost.frozenUntil;

      // ---- pacing clock: grace period + tension tiers ----
      if (startPerf < 0) { startPerf = perf; warmupUntil = perf + 2200; }
      const elapsed = perf - startPerf;
      const grace = elapsed < 30000; // first 30s: explore freely
      const tier = grace ? 0 : elapsed < 120000 ? 1 : elapsed < 240000 ? 2 : 3;
      if (!graceEnded && !grace) {
        graceEnded = true;
        playBoom(); // distant sound — the house wakes up
        ghost.nextAttackAt = perf + 60000 + Math.random() * 30000;
        stingAt = perf + 90000 + Math.random() * 60000;
      }

      // ---- hold breath (mutes mic detection for up to 4s, 20s cooldown) ----
      if (holding) {
        breathMeter -= dt / 4;
        muteMic(200, perf);
        if (!breathHoldRef.current || breathMeter <= 0) { breathMeter = Math.max(0, breathMeter); holding = false; breathCdUntil = perf + 20000; }
      } else {
        if (perf >= breathCdUntil) breathMeter = 1;
        if (breathHoldRef.current && micActive() && perf >= breathCdUntil && breathMeter > 0.99 && !dialogueRef.current) holding = true;
      }
      if (breathRingRef.current) {
        let frac: number, color: string;
        if (holding) { frac = breathMeter; color = "#6cc0ff"; }
        else if (perf < breathCdUntil) { frac = 1 - (breathCdUntil - perf) / 20000; color = "#666"; }
        else { frac = 1; color = "#6cc0ff"; }
        breathRingRef.current.style.background = `conic-gradient(${color} ${frac * 360}deg, rgba(255,255,255,0.08) 0deg)`;
      }

      // ---- mic detection: sample loudness every 100ms ----
      if (micActive() && perf > micCheckAt) {
        micCheckAt = perf + 100;
        const vol = micVolume(perf); // 0 while muted (holding breath)
        micLevel = vol;
        if (vol > 0.03) micLastSound = perf;
        if (!grace && !hidingRef.current) {
          if (vol > MIC_THRESHOLD) {
            ghost.mode = "hunt"; ghost.behavior = "move";
            micHuntUntil = perf + 8000; // stays in hunt at least 8s
            micHeardUntil = perf + 2000; micFlash = 1;
            // MULTIPLAYER MIC: emit this player's mic-trigger over Socket.io here
          } else if (vol > MIC_WARNING) {
            if (perf > micStaticAt) { micStaticAt = perf + 700; playStatic(); } // she's close
          }
        }
      }

      // player movement (frozen while reading dialogue or hiding)
      let mx = (input.right ? 1 : 0) - (input.left ? 1 : 0) + input.jx;
      let my = (input.down ? 1 : 0) - (input.up ? 1 : 0) + input.jy;
      const len = Math.hypot(mx, my);
      if (len > 1) { mx /= len; my /= len; }
      if (!hidingRef.current && !dialogueRef.current) {
        player.x += mx * PLAYER_SPEED * dt; player.y += my * PLAYER_SPEED * dt;
        resolve(player, PLAYER_R, walls);
        player.idle = len < 0.05 ? player.idle + dt : 0;
        if (len > 0.05) facing = Math.atan2(my, mx);
      }
      // desktop: aim flashlight with the mouse
      if (!isTouchRef.current && mouseActive && !hidingRef.current) {
        facing = Math.atan2(mouseRY - view.h / 2, mouseRX - view.w / 2);
      }

      // ---- NPC ----
      const ghostNearNpc = dist(ghost.x, ghost.y, npc.x, npc.y) < 340;
      const wantHide = hidingRef.current && ghostNearNpc;
      const chaos = distracted || perf < npc.panicUntil;
      if (npc.alive) {
        if (wantHide) {
          // hide in the spot opposite the player's
          const opp = HIDE_SPOTS.find((s) => s !== playerSpot) ?? HIDE_SPOTS[0];
          moveToward(npc, opp, NPC_SPEED, dt);
          npc.hidden = dist(npc.x, npc.y, opp.x, opp.y) < 22;
          resolve(npc, NPC_R, walls);
        } else if (chaos) {
          npc.hidden = false; npc.frantic = true;
          if (perf > npc.franticNext) {
            npc.franticNext = perf + 800 + Math.random() * 400;
            npc.turnRate = (Math.random() < 0.5 ? -1 : 1) * (1.6 + Math.random() * 2.4);
            if (Math.random() < 0.35) npc.franticAngle += (Math.random() - 0.5) * Math.PI;
          }
          npc.franticAngle += npc.turnRate * dt;
          const sp = NPC_SPEED * 1.55;
          npc.x += Math.cos(npc.franticAngle) * sp * dt;
          npc.y += Math.sin(npc.franticAngle) * sp * dt;
          resolve(npc, NPC_R, walls);
          npc.trailT -= dt;
          if (npc.trailT <= 0) { npc.trailT = 0.045; npcTrail.push({ x: npc.x, y: npc.y, life: 0.6 }); }
          const fearEmote = perf < npc.panicUntil ? "😨" : "💨";
          if (perf > npc.puffNext) { npc.puffNext = perf + 3500; npc.emote = fearEmote; npc.emoteUntil = perf + 2000; }
        } else {
          npc.hidden = false;
          if (npc.frantic) { npc.frantic = false; npc.mode = "follow"; npc.path = []; npc.emote = "🫡"; npc.emoteUntil = perf + 2000; }
          if (npc.mode === "follow") {
            if (dist(player.x, player.y, npc.x, npc.y) > 46) moveToward(npc, player, NPC_SPEED, dt);
          } else if (npc.mode === "goto") {
            const wp = npc.path[0];
            if (wp) { moveToward(npc, wp, NPC_SPEED, dt); if (dist(wp.x, wp.y, npc.x, npc.y) < 26) npc.path.shift(); }
            else { npc.mode = "check"; npc.checkT = 1.4; }
          } else { npc.checkT -= dt; if (npc.checkT <= 0) npc.mode = "follow"; }
          resolve(npc, NPC_R, walls);
        }
        if (npc.guttering > 0) npc.guttering -= dt;
        // NPC scoops clues it walks over (but not the channelled basement clue)
        for (const c of CLUE_OBJECTS) {
          if (c.id === BASEMENT_CLUE_ID || api.foundIds.has(c.id)) continue;
          if (dist(npc.x, npc.y, c.x, c.y) < HIDE_RANGE) if (api.findClue(c.id)) onCluePickedUp();
        }
      }
      for (let i = npcTrail.length - 1; i >= 0; i--) { npcTrail[i].life -= dt; if (npcTrail[i].life <= 0) npcTrail.splice(i, 1); }

      // ---- basement clue: must linger 5s to read it ----
      const bc = CLUE_OBJECTS.find((o) => o.id === BASEMENT_CLUE_ID)!;
      if (!api.foundIds.has(BASEMENT_CLUE_ID) && !hidingRef.current && !dialogueRef.current &&
        dist(player.x, player.y, bc.x, bc.y) < HIDE_RANGE + 10) {
        reading += dt;
        if (reading >= BASEMENT_READ_SECS) {
          reading = 0;
          if (api.findClue(BASEMENT_CLUE_ID)) { onCluePickedUp(); openDialogue(CLUE_DIALOGUE[BASEMENT_CLUE_ID], { text: CLUE_NOTE[BASEMENT_CLUE_ID], x: bc.x, y: bc.y }); }
        }
      } else reading = Math.max(0, reading - dt * 2);

      // ---- ghost ----
      if (!grace && tier >= 2) updateAttack();
      const hideSearchActive = hidingRef.current && (ghost.hideSearchT += dt) > HIDE_SEARCH_MS;

      // tension-scaled parameters
      const speedMul = [0, 0.85, 1.05, 1.32][tier] * (1 + GHOST_SPEED_PER_CLUE * foundCount);
      const detectR = [0, 200, 250, 320][tier];
      const idleMin = [0, 4, 3, 2][tier], idleMax = [0, 8, 6, 4][tier];
      const roamSpeed = GHOST_ROAM * speedMul, huntSpeed = GHOST_HUNT * speedMul;

      if (grace) {
        ghost.mode = "roam"; ghost.behavior = "idle"; // completely still in the basement
      } else if (distracted) {
        if (!hidingRef.current && dist(ghost.x, ghost.y, player.x, player.y) < dist(ghost.x, ghost.y, npc.x, npc.y)) {
          ghost.distractUntil = perf;
        } else if (!frozen) { moveToward(ghost, npc, 36, dt); ghost.mode = "roam"; }
      } else {
        const tgt = ghostTarget();
        if (tgt) {
          const d = dist(ghost.x, ghost.y, tgt.x, tgt.y);
          if (ghost.mode === "roam") { if (d < detectR || (player.idle > 18 && !hidingRef.current)) { ghost.mode = "hunt"; ghost.behavior = "move"; } }
          else if (d > GHOST_LOSE) { ghost.lose += dt; if (ghost.lose > 3) { ghost.mode = "roam"; ghost.lose = 0; } }
          else ghost.lose = 0;
        } else ghost.mode = "roam";
        // mic trigger keeps it hunting toward you regardless of distance
        if (perf < micHuntUntil && tgt) { ghost.mode = "hunt"; ghost.behavior = "move"; }

        if (!frozen) {
          if (hideSearchActive && playerSpot) {
            ghost.mode = "roam"; ghost.behavior = "move";
            moveToward(ghost, playerSpot, roamSpeed, dt);
          } else if (ghost.mode === "hunt" && tgt) {
            moveToward(ghost, tgt, huntSpeed, dt);
          } else {
            // ---- roam: patrol path + idle "listening" + sudden dash ----
            const gRoom = roomOf(ghost.x, ghost.y) ?? "foyer";
            if (ghost.behavior === "idle") {
              if (perf > ghost.behaviorUntil) {
                if (Math.random() < 0.5) ghost.behavior = "move"; // resume
                else { // sudden dash one room over
                  ghost.behavior = "dash";
                  const nb = NEIGHBORS[gRoom] ?? ["foyer"];
                  ghost.dashTarget = ROOM_CENTER[nb[Math.floor(Math.random() * nb.length)]];
                }
              }
            } else if (ghost.behavior === "dash") {
              moveToward(ghost, ghost.dashTarget, huntSpeed * 1.35, dt);
              if (dist(ghost.x, ghost.y, ghost.dashTarget.x, ghost.dashTarget.y) < 26) ghost.behavior = "move";
            } else {
              const target = ROOM_CENTER[ghost.patrolPath[ghost.patrolIdx] ?? "foyer"];
              moveToward(ghost, target, roamSpeed, dt);
              if (dist(ghost.x, ghost.y, target.x, target.y) < 44) {
                if (Math.random() < 0.55) { ghost.behavior = "idle"; ghost.behaviorUntil = perf + (idleMin + Math.random() * (idleMax - idleMin)) * 1000; }
                else ghost.patrolIdx = (ghost.patrolIdx + 1) % ghost.patrolPath.length;
              }
              // break pattern — patrol tightens toward you as tension climbs
              if (perf > ghost.breakAt) {
                ghost.breakAt = perf + (tier >= 3 ? 8000 : 14000) + Math.random() * 6000;
                const pRoom = roomOf(player.x, player.y);
                const bPending = foundCount >= 2 && !api.foundIds.has(BASEMENT_CLUE_ID);
                const tighten = [0, 0.15, 0.45, 0.7][tier];
                if (bPending && Math.random() < 0.5) ghost.patrolPath[ghost.patrolIdx] = "basement";
                else if (pRoom && Math.random() < tighten) ghost.patrolPath[ghost.patrolIdx] = pRoom;
              }
            }
          }
        }

        if (!hidingRef.current && dist(ghost.x, ghost.y, player.x, player.y) < CATCH_DIST) triggerEnd("caught");
        else if (npc.alive && !npc.hidden && dist(ghost.x, ghost.y, npc.x, npc.y) < NPC_R + GHOST_R) startDistraction();
        if (hideSearchActive && playerSpot && dist(ghost.x, ghost.y, playerSpot.x, playerSpot.y) < 42) forceUnhide();
      }

      // ghost footprints + motion trail
      const moved = Math.hypot(ghost.x - ghost.prevX, ghost.y - ghost.prevY);
      ghost.stepAcc += moved;
      if (ghost.stepAcc > 26) { ghost.stepAcc = 0; ghost.footSide *= -1; footprints.push({ x: ghost.x, y: ghost.y, t: perf, side: ghost.footSide }); }
      ghost.trail.push({ x: ghost.x, y: ghost.y }); if (ghost.trail.length > 6) ghost.trail.shift();
      ghost.prevX = ghost.x; ghost.prevY = ghost.y;
      for (let i = footprints.length - 1; i >= 0; i--) if (perf - footprints[i].t > FOOTPRINT_FADE) footprints.splice(i, 1);

      // ---- danger / win ----
      const pd = dist(ghost.x, ghost.y, player.x, player.y);
      // dialogue danger override: ghost too close → slam the box shut (keep clue)
      if (dialogueRef.current) {
        if (pd < 150) {
          closeDialogue();
          caughtFx = Math.max(caughtFx, 1.0);
          if (isTouchRef.current && navigator.vibrate) navigator.vibrate(140);
        } else {
          const dim = pd < 250; // see-through so the player can react
          if (dim !== lastDim) { lastDim = dim; setDlgDim(dim); }
        }
      }
      if (!grace && !hidingRef.current && pd < WARN_DIST) danger = Math.min(danger + dt, DANGER_SECS + 0.01);
      else danger = Math.max(danger - dt * 0.8, 0);
      if (danger >= DANGER_SECS) triggerEnd("caught");
      if (api.allFound && !hidingRef.current && player.y < -198 && Math.abs(player.x) < DOOR) triggerEnd("escape");

      // ---- audio (paced) ----
      const prox = clamp((300 - pd) / 300, 0, 1);
      heartbeatUpdate(grace ? 0 : Math.max(danger / DANGER_SECS, prox * 0.85));
      footstepUpdate(clamp((300 - pd) / 300, 0, 1) * (moved > 0.4 ? 1 : 0.3)); // only within 300px
      breathingUpdate(hidingRef.current);
      if (!grace && perf > lullabyNext) {
        lullabyNext = perf + 16000 + Math.random() * 10000;
        playLullaby(0.018 + [0, 0.018, 0.038, 0.06][tier]); // humming grows louder over time
      }
      const gRoom = roomOf(ghost.x, ghost.y), pRoom = roomOf(player.x, player.y);
      if (!grace && gRoom && gRoom !== ghostRoomPrev && gRoom === pRoom) playStatic();
      ghostRoomPrev = gRoom;
      // random jumpscare sting even when far — at most once per ~90s
      if (!grace && stingAt > 0 && perf > stingAt) { playSting(); stingAt = perf + 90000 + Math.random() * 60000; }

      if (pingT > 0) pingT -= dt;
      if (caughtFx > 0) caughtFx -= dt * 1.4;
      if (whiteFlash > 0) whiteFlash -= dt * 4;
      if (attackFlash > 0) attackFlash -= dt * 2;
      if (micFlash > 0) micFlash -= dt * 2;
      for (let i = notes.length - 1; i >= 0; i--) if (perf - notes[i].t > 4000) notes.splice(i, 1);

      pushHud();
      updatePrompt();
    }

    function pushHud() {
      if (startPerf < 0) startPerf = perf;
      const sec = Math.floor((perf - startPerf) / 1000);
      if (sec !== lastSec) { lastSec = sec; setTimeSec(sec); }
      const d = perf < ghost.distractUntil ? Math.ceil((ghost.distractUntil - perf) / 1000) : 0;
      if (d !== lastDistract) { lastDistract = d; setDistractSec(d); }
    }
    function updatePrompt() {
      const api = clueRef.current;
      let text = "", locked = false, act = false;
      if (hidingRef.current) { text = isTouchRef.current ? "Tap E to leave hiding" : "Press E to leave hiding"; act = true; }
      else if (npc.selected) text = "Tap a room to send the investigator";
      else {
        let near = false;
        for (const c of CLUE_OBJECTS) { if (c.id === BASEMENT_CLUE_ID || api.foundIds.has(c.id)) continue; if (dist(player.x, player.y, c.x, c.y) < HIDE_RANGE + 6) { near = true; break; } }
        if (!near && !herringRead && dist(player.x, player.y, HERRING.x, HERRING.y) < HIDE_RANGE + 6) near = true;
        const bco = CLUE_OBJECTS.find((o) => o.id === BASEMENT_CLUE_ID)!;
        const bNear = !api.foundIds.has(BASEMENT_CLUE_ID) && dist(player.x, player.y, bco.x, bco.y) < HIDE_RANGE + 10;
        const decoyNear = !near && DECOYS.some((d) => dist(player.x, player.y, d.x, d.y) < HIDE_RANGE + 6);
        const spot = HIDE_SPOTS.find((s) => dist(player.x, player.y, s.x, s.y) < HIDE_RANGE);
        if (near) { text = isTouchRef.current ? "Tap to inspect" : "Press E to inspect"; act = true; }
        else if (decoyNear) { text = isTouchRef.current ? "Tap to open" : "Press E to open"; act = true; }
        else if (bNear) { text = reading > 0.15 ? "Reading the wall…" : "Stay still to read the wall"; }
        else if (spot) { text = isTouchRef.current ? "Tap E to hide" : "Press E to hide"; act = true; }
        else if (dist(player.x, player.y, EXIT_POS.x, EXIT_POS.y) < 90) {
          if (api.allFound) { text = isTouchRef.current ? "Tap to escape" : "Press E to escape"; act = true; }
          else { text = "The front door is locked"; locked = true; }
        } else if (api.foundCount < 2 && dist(player.x, player.y, BASEMENT_DOOR.x, BASEMENT_DOOR.y) < 70) { text = "Basement sealed — find 2 clues"; locked = true; }
      }
      const sig = text + locked;
      if (sig !== lastPrompt) { lastPrompt = sig; setPrompt(text ? { text, locked } : null); }
      if (act !== lastAct) { lastAct = act; setActPulse(act); }
    }

    // ---- rendering ----
    function render() {
      const ox = (cam.ox = view.w / 2 - player.x);
      const oy = (cam.oy = view.h / 2 - player.y);
      const px = view.w / 2, py = view.h / 2;
      const api = clueRef.current;

      ctx.fillStyle = "#000"; ctx.fillRect(0, 0, view.w, view.h);

      for (const r of ROOMS) {
        ctx.fillStyle = r.fill;
        ctx.fillRect(r.minx + ox, r.miny + oy, r.maxx - r.minx, r.maxy - r.miny);
        ctx.strokeStyle = "rgba(255,255,255,0.022)"; ctx.lineWidth = 1;
        for (let y = r.miny + 40; y < r.maxy; y += 40) { ctx.beginPath(); ctx.moveTo(r.minx + ox, y + oy); ctx.lineTo(r.maxx + ox, y + oy); ctx.stroke(); }
      }
      // ghost footprints
      for (const f of footprints) {
        const a = (1 - (perf - f.t) / FOOTPRINT_FADE) * 0.5;
        ctx.fillStyle = `rgba(0,0,0,${a})`;
        ctx.beginPath(); ctx.ellipse(f.x + ox + f.side * 4, f.y + oy, 4, 7, 0, 0, Math.PI * 2); ctx.fill();
      }
      for (const w of currentWalls()) {
        ctx.fillStyle = "#24202c";
        ctx.fillRect(w.minx + ox, w.miny + oy, w.maxx - w.minx, w.maxy - w.miny);
        ctx.fillStyle = "rgba(255,255,255,0.05)"; ctx.fillRect(w.minx + ox, w.miny + oy, w.maxx - w.minx, 2);
      }
      drawExit(ox, oy, api.allFound);
      drawDoor(ox, oy, api.foundCount >= 2);
      drawHideSpots(ox, oy);
      for (const c of CLUE_OBJECTS) {
        if (api.foundIds.has(c.id)) continue;
        const sx = c.x + ox, sy = c.y + oy, pulse = 0.55 + 0.45 * Math.sin(perf * 0.005 + c.x);
        const g = ctx.createRadialGradient(sx, sy, 0, sx, sy, 30);
        g.addColorStop(0, `rgba(255,228,150,${0.55 * pulse})`); g.addColorStop(0.5, `rgba(220,150,60,${0.28 * pulse})`); g.addColorStop(1, "rgba(220,150,60,0)");
        ctx.fillStyle = g; ctx.fillRect(sx - 30, sy - 30, 60, 60);
        ctx.fillStyle = `rgba(255,240,200,${0.7 + 0.3 * pulse})`; ctx.beginPath(); ctx.arc(sx, sy, 4.5, 0, Math.PI * 2); ctx.fill();
      }
      drawProps(ox, oy);
      drawGhost(ox, oy);
      drawPlayer(px, py);

      // ---- darkness (flashlight / hide / blackout) ----
      const pd = dist(ghost.x, ghost.y, player.x, player.y);
      if (hidingRef.current) {
        if (perf < peekRef.current) radialDark(px, py, 120);
        else { ctx.fillStyle = "rgba(0,0,0,0.965)"; ctx.fillRect(0, 0, view.w, view.h); }
      } else if (perf < flashOutUntil) {
        ctx.fillStyle = "#000"; ctx.fillRect(0, 0, view.w, view.h);
      } else {
        let l = CONE_LEN;
        // warm-up: the flashlight sputters on at game start
        if (perf < warmupUntil) {
          const w = clamp(1 - (warmupUntil - perf) / 2200, 0, 1);
          l *= 0.2 + 0.8 * w;
          if (Math.random() < 0.45 * (1 - w)) { l *= 0.4; if (Math.random() < 0.2) playBuzz(); }
        }
        if (pd < FLICKER_DIST) {
          const f = 1 - pd / FLICKER_DIST;
          if (Math.random() < 0.05 + 0.2 * f) { l *= 0.25 + Math.random() * 0.4; if (Math.random() < 0.25) playBuzz(); }
          if (pd < BLACKOUT_DIST && perf > flashOutUntil && perf > flashOutCd) { flashOutUntil = perf + BLACKOUT_MS; flashOutCd = perf + BLACKOUT_MS + 3000; playBuzz(); }
        }
        coneDark(px, py, l);
      }

      // red edges
      const sameRoom = roomOf(player.x, player.y) === roomOf(ghost.x, ghost.y);
      const dFrac = danger / DANGER_SECS;
      if ((sameRoom || ghost.mode === "hunt" || dFrac > 0) && !hidingRef.current) {
        const base = ghost.mode === "hunt" ? 0.5 : 0.36;
        const intensity = Math.max(base * (0.55 + 0.45 * Math.sin(perf * 0.012)), dFrac * 0.95);
        const e = ctx.createRadialGradient(px, py, Math.min(view.w, view.h) * 0.26, px, py, Math.max(view.w, view.h) * 0.72);
        e.addColorStop(0, "rgba(139,0,0,0)"); e.addColorStop(1, `rgba(139,0,0,${intensity})`);
        ctx.fillStyle = e; ctx.fillRect(0, 0, view.w, view.h);
      }

      // attack telegraphs (above darkness)
      const gx = ghost.x + ox, gy = ghost.y + oy;
      if (ghost.attackState === "charging") {
        const p = 0.5 + 0.5 * Math.sin(perf * 0.02);
        ctx.strokeStyle = `rgba(255,40,40,${0.25 + 0.35 * p})`; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(gx, gy, ATTACK_R, 0, Math.PI * 2); ctx.stroke();
      }
      if (perf - ghost.fireAt < 600) {
        const t = (perf - ghost.fireAt) / 600;
        ctx.strokeStyle = `rgba(255,255,255,${(1 - t) * 0.8})`; ctx.lineWidth = 5 * (1 - t) + 1;
        ctx.beginPath(); ctx.arc(gx, gy, ATTACK_R * (0.3 + t * 1.2), 0, Math.PI * 2); ctx.stroke();
      }
      if (attackFlash > 0) {
        const g = ctx.createRadialGradient(gx, gy, 0, gx, gy, ATTACK_R);
        g.addColorStop(0, `rgba(255,255,255,${Math.min(attackFlash, 0.5) * 1.6})`); g.addColorStop(1, "rgba(255,255,255,0)");
        ctx.fillStyle = g; ctx.fillRect(0, 0, view.w, view.h);
      }
      if (whiteFlash > 0) { ctx.fillStyle = `rgba(255,255,255,${Math.min(whiteFlash, 0.6)})`; ctx.fillRect(0, 0, view.w, view.h); }

      drawNpc(ox, oy);
      drawNotes(ox, oy);
      if (pingT > 0) drawPing(ox, oy, px, py);
      // holding breath dims the screen slightly
      if (holding) { ctx.fillStyle = "rgba(0,0,0,0.22)"; ctx.fillRect(0, 0, view.w, view.h); }
      drawMic();
      if (caughtFx > 0) { ctx.fillStyle = `rgba(255,30,30,${Math.min(caughtFx, 1) * 0.75})`; ctx.fillRect(0, 0, view.w, view.h); }
    }

    function drawMic() {
      if (!micActive()) return;
      const cx = view.w / 2, y = 30;
      // desktop breath meter (mobile uses the button ring)
      if (!isTouchRef.current) {
        let bf = -1, bc = "";
        if (holding) { bf = breathMeter; bc = "#6cc0ff"; }
        else if (perf < breathCdUntil) { bf = 1 - (breathCdUntil - perf) / 20000; bc = "#666"; }
        if (bf >= 0) {
          ctx.fillStyle = "rgba(255,255,255,0.1)"; ctx.fillRect(cx - 22, y + 26, 44, 4);
          ctx.fillStyle = bc; ctx.fillRect(cx - 22, y + 26, 44 * bf, 4);
        }
      }
      const silent = perf - micLastSound > 3000;
      const fade = silent ? Math.max(0, 1 - (perf - micLastSound - 3000) / 800) : 1;
      const a = Math.max(fade, micFlash);
      if (a > 0.01) {
        const triggered = perf < micHuntUntil;
        const color = triggered || micLevel >= MIC_THRESHOLD ? "#ff3030"
          : micLevel >= MIC_WARNING ? "#ffcc33" : "#46d27a";
        const x = cx + (triggered ? (Math.random() - 0.5) * 5 : 0);
        ctx.save();
        ctx.globalAlpha = a;
        ctx.fillStyle = color;
        ctx.beginPath();
        if (ctx.roundRect) ctx.roundRect(x - 5, y - 12, 10, 16, 5); else ctx.rect(x - 5, y - 12, 10, 16);
        ctx.fill();
        ctx.strokeStyle = color; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(x, y - 2, 8, 0.15 * Math.PI, 0.85 * Math.PI); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(x, y + 6); ctx.lineTo(x, y + 11); ctx.stroke();
        ctx.restore();
      }
      if (perf < micHeardUntil) {
        ctx.save();
        ctx.globalAlpha = Math.min(1, (micHeardUntil - perf) / 600);
        ctx.fillStyle = "#ff3030";
        ctx.font = "bold 15px system-ui, sans-serif";
        ctx.textAlign = "center";
        ctx.fillText("SHE HEARD YOU", cx, y + 52);
        ctx.restore();
      }
    }

    function drawNotes(ox: number, oy: number) {
      for (const n of notes) {
        const age = (perf - n.t) / 4000;
        const alpha = age < 0.12 ? age / 0.12 : Math.max(0, 1 - (age - 0.12) / 0.88);
        if (alpha <= 0) continue;
        const x = n.x + ox, y = n.y + oy - 28;
        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.textAlign = "center";
        ctx.font = "italic 14px ui-serif, Georgia, serif";
        const w = ctx.measureText(n.text).width;
        ctx.fillStyle = "rgba(10,8,6,0.72)";
        ctx.fillRect(x - w / 2 - 8, y - 13, w + 16, 20);
        ctx.fillStyle = "rgba(232,222,198,0.96)";
        ctx.fillText(n.text, x, y + 2);
        ctx.restore();
      }
    }

    function drawProps(ox: number, oy: number) {
      // fake drawers — open them, find nothing
      for (const d of DECOYS) {
        const x = d.x + ox, y = d.y + oy;
        ctx.fillStyle = "rgba(38,38,48,0.55)";
        ctx.fillRect(x - 10, y - 7, 20, 14);
        ctx.strokeStyle = "rgba(150,150,175,0.3)"; ctx.lineWidth = 1.5;
        ctx.strokeRect(x - 10, y - 7, 20, 14);
        ctx.fillStyle = "rgba(150,150,175,0.4)"; ctx.fillRect(x - 3, y - 1, 6, 2);
      }
      // red herring — disguised as a clue until inspected
      if (!herringRead) {
        const sx = HERRING.x + ox, sy = HERRING.y + oy, pulse = 0.55 + 0.45 * Math.sin(perf * 0.005 + HERRING.x);
        const g = ctx.createRadialGradient(sx, sy, 0, sx, sy, 30);
        g.addColorStop(0, `rgba(255,228,150,${0.55 * pulse})`); g.addColorStop(0.5, `rgba(220,150,60,${0.28 * pulse})`); g.addColorStop(1, "rgba(220,150,60,0)");
        ctx.fillStyle = g; ctx.fillRect(sx - 30, sy - 30, 60, 60);
        ctx.fillStyle = `rgba(255,240,200,${0.7 + 0.3 * pulse})`; ctx.beginPath(); ctx.arc(sx, sy, 4.5, 0, Math.PI * 2); ctx.fill();
      }
      // basement clue channel ring
      if (reading > 0 && !clueRef.current.foundIds.has(BASEMENT_CLUE_ID)) {
        const bco = CLUE_OBJECTS.find((o) => o.id === BASEMENT_CLUE_ID)!;
        const sx = bco.x + ox, sy = bco.y + oy, frac = reading / BASEMENT_READ_SECS;
        ctx.strokeStyle = "rgba(60,60,70,0.6)"; ctx.lineWidth = 3;
        ctx.beginPath(); ctx.arc(sx, sy, 22, 0, Math.PI * 2); ctx.stroke();
        ctx.strokeStyle = "rgba(255,228,150,0.9)"; ctx.lineWidth = 3;
        ctx.beginPath(); ctx.arc(sx, sy, 22, -Math.PI / 2, -Math.PI / 2 + frac * Math.PI * 2); ctx.stroke();
      }
    }

    function coneDark(px: number, py: number, length: number) {
      const seg = 20;
      ctx.beginPath();
      ctx.rect(0, 0, view.w, view.h);
      ctx.moveTo(px, py);
      for (let i = 0; i <= seg; i++) { const a = facing - CONE_HALF + 2 * CONE_HALF * (i / seg); ctx.lineTo(px + Math.cos(a) * length, py + Math.sin(a) * length); }
      ctx.closePath();
      ctx.fillStyle = "rgba(0,0,0,1)";
      ctx.fill("evenodd");
      // distance falloff inside the cone
      ctx.save();
      ctx.beginPath(); ctx.moveTo(px, py);
      for (let i = 0; i <= seg; i++) { const a = facing - CONE_HALF + 2 * CONE_HALF * (i / seg); ctx.lineTo(px + Math.cos(a) * length, py + Math.sin(a) * length); }
      ctx.closePath(); ctx.clip();
      const g = ctx.createRadialGradient(px, py, length * 0.2, px, py, length);
      g.addColorStop(0, "rgba(0,0,0,0)"); g.addColorStop(0.75, "rgba(0,0,0,0.12)"); g.addColorStop(1, "rgba(0,0,0,0.92)");
      ctx.fillStyle = g; ctx.fillRect(0, 0, view.w, view.h);
      ctx.restore();
    }
    function radialDark(px: number, py: number, r: number) {
      const g = ctx.createRadialGradient(px, py, r * 0.15, px, py, r);
      g.addColorStop(0, "rgba(0,0,0,0.2)"); g.addColorStop(0.7, "rgba(0,0,0,0.7)"); g.addColorStop(1, "rgba(0,0,0,1)");
      ctx.fillStyle = g; ctx.fillRect(0, 0, view.w, view.h);
    }

    function drawPlayer(px: number, py: number) {
      const g = ctx.createRadialGradient(px, py, 0, px, py, 22);
      g.addColorStop(0, "rgba(255,255,255,0.95)"); g.addColorStop(0.5, "rgba(210,230,255,0.4)"); g.addColorStop(1, "rgba(180,200,255,0)");
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(px, py, 22, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "#fff"; ctx.beginPath(); ctx.arc(px, py, 6, 0, Math.PI * 2); ctx.fill();
    }

    function drawGhost(ox: number, oy: number) {
      const charging = ghost.attackState === "charging";
      const idle = ghost.behavior === "idle" && !charging;
      const gx = ghost.x + ox + (idle ? Math.sin(perf * 0.005) * 4 : 0); // sways while listening
      const gy = ghost.y + oy;
      const prog = charging ? clamp(1 - (ghost.chargeUntil - perf) / ATTACK_CHARGE, 0, 1) : 0;
      const scale = 1 + prog * 0.5;
      // motion blur
      for (let i = 0; i < ghost.trail.length; i++) {
        const p = ghost.trail[i], a = (i / ghost.trail.length) * 0.1;
        ctx.fillStyle = `rgba(15,0,0,${a})`;
        ctx.beginPath(); ctx.ellipse(p.x + ox, p.y + oy, 13 * scale, 30 * scale, 0, 0, Math.PI * 2); ctx.fill();
      }
      const bodyH = 64 * scale, bodyW = 26 * scale, headR = 12 * scale, headY = gy - bodyH * 0.42;
      const bg = ctx.createLinearGradient(gx, gy - bodyH * 0.5, gx, gy + bodyH * 0.5);
      bg.addColorStop(0, `rgba(${charging ? 70 : 12},0,0,0.95)`); bg.addColorStop(1, "rgba(5,0,0,0.9)");
      ctx.fillStyle = bg; ctx.beginPath(); ctx.ellipse(gx, gy, bodyW * 0.5, bodyH * 0.5, 0, 0, Math.PI * 2); ctx.fill();
      // long dripping hair (up in attack)
      ctx.strokeStyle = charging ? "rgba(50,0,0,0.85)" : "rgba(8,4,8,0.85)"; ctx.lineWidth = 2 * scale;
      const strands = 11;
      for (let i = 0; i < strands; i++) {
        const t = i / (strands - 1), sx = gx + (t - 0.5) * bodyW * 1.2;
        const len = (charging ? -1 : 1) * (28 + Math.sin(perf * 0.004 + i) * 6) * scale;
        ctx.beginPath(); ctx.moveTo(sx, headY);
        ctx.quadraticCurveTo(sx + Math.sin(perf * 0.003 + i * 1.3) * 6 * scale, headY + len * 0.5, sx + Math.sin(perf * 0.002 + i) * 4, headY + len);
        ctx.stroke();
      }
      ctx.fillStyle = charging ? "rgba(55,0,0,0.95)" : "rgba(8,4,8,0.95)";
      ctx.beginPath(); ctx.arc(gx, headY, headR, 0, Math.PI * 2); ctx.fill();
      // hollow red eyes — glow brighter while idle/listening
      const eg = idle ? 0.95 : 0.5 + 0.5 * Math.sin(perf * 0.02);
      ctx.fillStyle = `rgba(255,${idle ? 60 : 40},40,${0.6 + 0.4 * eg})`;
      ctx.beginPath(); ctx.ellipse(gx - 4.5 * scale, headY - 1, 2.4 * scale, 3.4 * scale, 0, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.ellipse(gx + 4.5 * scale, headY - 1, 2.4 * scale, 3.4 * scale, 0, 0, Math.PI * 2); ctx.fill();
      if (charging) {
        const a = ctx.createRadialGradient(gx, gy, 4, gx, gy, bodyH * scale);
        a.addColorStop(0, `rgba(255,0,0,${0.3 + 0.3 * Math.sin(perf * 0.05)})`); a.addColorStop(1, "rgba(255,0,0,0)");
        ctx.fillStyle = a; ctx.beginPath(); ctx.arc(gx, gy, bodyH * scale, 0, Math.PI * 2); ctx.fill();
      }
    }

    function drawNpc(ox: number, oy: number) {
      for (const t of npcTrail) { const a = (t.life / 0.6) * 0.5; ctx.fillStyle = `rgba(120,225,255,${a})`; ctx.beginPath(); ctx.arc(t.x + ox, t.y + oy, 3.2, 0, Math.PI * 2); ctx.fill(); }
      if (npc.hidden) return; // tucked away, light hidden
      const nx = npc.x + ox, ny = npc.y + oy;
      const glow = npc.guttering > 0 ? (Math.sin(perf * 0.05) > 0 ? 0.25 : 0.75) : 1;
      if (npc.selected) { ctx.strokeStyle = "rgba(120,220,255,0.85)"; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(nx, ny, 18, 0, Math.PI * 2); ctx.stroke(); }
      const radius = 18 * glow + 2;
      const g = ctx.createRadialGradient(nx, ny, 0, nx, ny, radius);
      g.addColorStop(0, `rgba(150,230,255,${0.8 * glow})`); g.addColorStop(0.5, `rgba(80,170,220,${0.4 * glow})`); g.addColorStop(1, "rgba(80,170,220,0)");
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(nx, ny, radius, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = `rgba(220,245,255,${0.95 * glow})`; ctx.beginPath(); ctx.arc(nx, ny, 4, 0, Math.PI * 2); ctx.fill();
      if (npc.emote && perf < npc.emoteUntil) {
        ctx.save(); ctx.globalAlpha = Math.min(1, (npc.emoteUntil - perf) / 700);
        ctx.font = "18px system-ui, 'Segoe UI Emoji', 'Apple Color Emoji', serif"; ctx.textAlign = "center";
        ctx.fillText(npc.emote, nx, ny - 22); ctx.restore();
      }
    }

    function drawPing(ox: number, oy: number, px: number, py: number) {
      const fade = Math.min(pingT / PING_SECS, 1), m = 26;
      let gx = ghost.x + ox, gy = ghost.y + oy;
      const off = gx < m || gx > view.w - m || gy < m || gy > view.h - m;
      gx = clamp(gx, m, view.w - m); gy = clamp(gy, m, view.h - m);
      const r = 10 + (1 - (pingT % 1)) * 22;
      ctx.strokeStyle = `rgba(255,40,40,${0.7 * fade})`; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(gx, gy, r, 0, Math.PI * 2); ctx.stroke();
      ctx.fillStyle = `rgba(255,60,60,${0.9 * fade})`; ctx.beginPath(); ctx.arc(gx, gy, 4, 0, Math.PI * 2); ctx.fill();
      if (off) { const a = Math.atan2(gy - py, gx - px); ctx.save(); ctx.translate(gx, gy); ctx.rotate(a); ctx.beginPath(); ctx.moveTo(12, 0); ctx.lineTo(2, -6); ctx.lineTo(2, 6); ctx.closePath(); ctx.fill(); ctx.restore(); }
    }

    function drawExit(ox: number, oy: number, open: boolean) {
      const x = EXIT_POS.x + ox, y = EXIT_POS.y + oy;
      if (open) {
        const g = ctx.createLinearGradient(x, y - 30, x, y + 6);
        g.addColorStop(0, "rgba(120,180,160,0)"); g.addColorStop(1, "rgba(150,220,190,0.4)");
        ctx.fillStyle = g; ctx.fillRect(x - DOOR, y - 30, DOOR * 2, 36);
        ctx.strokeStyle = "rgba(150,220,190,0.6)"; ctx.lineWidth = 2; ctx.strokeRect(x - DOOR, y - 26, DOOR * 2, 26);
      } else { ctx.strokeStyle = "rgba(139,0,0,0.7)"; ctx.lineWidth = 3; for (let i = -1; i <= 1; i++) { ctx.beginPath(); ctx.moveTo(x - DOOR, y + i * 7); ctx.lineTo(x + DOOR, y + i * 7); ctx.stroke(); } }
    }
    function drawDoor(ox: number, oy: number, open: boolean) {
      const x = BASEMENT_DOOR.x + ox, y = BASEMENT_DOOR.y + oy;
      if (open) { ctx.fillStyle = "rgba(0,0,0,0.6)"; ctx.fillRect(x - DOOR, y - 4, DOOR * 2, 16); }
      else { ctx.strokeStyle = "rgba(139,0,0,0.7)"; ctx.lineWidth = 3; for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.moveTo(x - DOOR, y + i * 7 - 4); ctx.lineTo(x + DOOR, y + i * 7 - 4); ctx.stroke(); } }
    }
    function drawHideSpots(ox: number, oy: number) {
      for (const s of HIDE_SPOTS) {
        const x = s.x + ox, y = s.y + oy;
        ctx.fillStyle = "rgba(30,40,55,0.7)"; ctx.fillRect(x - 22, y - 26, 44, 52);
        ctx.strokeStyle = "rgba(120,160,200,0.35)"; ctx.lineWidth = 1.5; ctx.strokeRect(x - 22, y - 26, 44, 52);
        ctx.fillStyle = "rgba(120,160,200,0.5)"; ctx.font = "9px system-ui, sans-serif"; ctx.textAlign = "center";
        ctx.fillText(s.id === "wardrobe" ? "WARDROBE" : "STAIRS", x, y + 38);
      }
    }

    let last = performance.now();
    function frame(now: number) {
      perf = now;
      const dt = Math.min((now - last) / 1000, 0.033); last = now;
      if (!ended && !introRef.current) update(dt);
      else if (ended) silenceAll();
      render();
      // physical screen shake (stronger on mobile)
      if (shake > 0.3) {
        canvas.style.transform = `translate(${(Math.random() - 0.5) * shake}px, ${(Math.random() - 0.5) * shake}px)`;
        shake *= 0.86;
      } else if (canvas.style.transform) {
        shake = 0; canvas.style.transform = "";
      }
      raf = requestAnimationFrame(frame);
    }
    function resize() {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      view.w = canvas.clientWidth; view.h = canvas.clientHeight;
      canvas.width = view.w * dpr; canvas.height = view.h * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    resize(); window.addEventListener("resize", resize);

    const input = { up: false, down: false, left: false, right: false, jx: 0, jy: 0 };
    const onKeyDown = (e: KeyboardEvent) => {
      ensureAudio();
      if (dialogueRef.current) return; // DialogueBox owns the keys
      if (e.code === "Space") { breathHoldRef.current = true; e.preventDefault(); return; } // hold breath
      switch (e.key) {
        case "w": case "W": case "ArrowUp": input.up = true; e.preventDefault(); break;
        case "s": case "S": case "ArrowDown": input.down = true; e.preventDefault(); break;
        case "a": case "A": case "ArrowLeft": input.left = true; e.preventDefault(); break;
        case "d": case "D": case "ArrowRight": input.right = true; e.preventDefault(); break;
        case "e": case "E": handleE(); break;
        case "Escape": navigate("/"); break;
      }
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.code === "Space") { breathHoldRef.current = false; return; }
      switch (e.key) {
        case "w": case "W": case "ArrowUp": input.up = false; break;
        case "s": case "S": case "ArrowDown": input.down = false; break;
        case "a": case "A": case "ArrowLeft": input.left = false; break;
        case "d": case "D": case "ArrowRight": input.right = false; break;
      }
    };
    const onMouseMove = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      mouseRX = e.clientX - rect.left; mouseRY = e.clientY - rect.top; mouseActive = true;
    };
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    window.addEventListener("mousemove", onMouseMove);

    const onCanvasPointer = (e: PointerEvent) => {
      e.preventDefault(); ensureAudio();
      if (dialogueRef.current) return; // DialogueBox handles taps
      const rect = canvas.getBoundingClientRect();
      const wx = e.clientX - rect.left - cam.ox, wy = e.clientY - rect.top - cam.oy;
      if (npc.alive && !npc.hidden && dist(wx, wy, npc.x, npc.y) < 32) { npc.selected = !npc.selected; updatePrompt(); return; }
      if (npc.alive && npc.selected) { const rid = roomOf(wx, wy); if (rid) { npc.path = []; if (rid !== "foyer") npc.path.push(DOORWAY[rid]); npc.path.push(ROOM_CENTER[rid]); npc.mode = "goto"; } npc.selected = false; updatePrompt(); return; }
      handleE();
    };
    canvas.addEventListener("pointerdown", onCanvasPointer);

    // Floating joystick: appears under the thumb wherever the left zone is touched.
    const zone = joyRef.current, base = joyBaseRef.current, knob = knobRef.current;
    let joyId: number | null = null; const JOY_MAX = 62;
    let cx0 = 0, cy0 = 0;
    const onJoyDown = (e: PointerEvent) => {
      e.preventDefault(); e.stopPropagation(); ensureAudio();
      joyId = e.pointerId; zone?.setPointerCapture(e.pointerId);
      const rect = canvas.getBoundingClientRect();
      cx0 = e.clientX - rect.left; cy0 = e.clientY - rect.top;
      if (base) { base.style.left = `${cx0}px`; base.style.top = `${cy0}px`; base.style.display = "block"; }
      if (knob) knob.style.transform = "translate(0px, 0px)";
    };
    const onJoyMove = (e: PointerEvent) => {
      if (joyId !== e.pointerId) return;
      const rect = canvas.getBoundingClientRect();
      let dx = e.clientX - rect.left - cx0, dy = e.clientY - rect.top - cy0;
      const d = Math.hypot(dx, dy); if (d > JOY_MAX) { dx = (dx / d) * JOY_MAX; dy = (dy / d) * JOY_MAX; }
      input.jx = dx / JOY_MAX; input.jy = dy / JOY_MAX;
      if (knob) knob.style.transform = `translate(${dx}px, ${dy}px)`;
    };
    const onJoyUp = (e: PointerEvent) => {
      if (joyId !== e.pointerId) return;
      joyId = null; input.jx = 0; input.jy = 0;
      if (base) base.style.display = "none";
    };
    if (zone) { zone.addEventListener("pointerdown", onJoyDown); zone.addEventListener("pointermove", onJoyMove); zone.addEventListener("pointerup", onJoyUp); zone.addEventListener("pointercancel", onJoyUp); }

    raf = requestAnimationFrame(frame);
    return () => {
      cancelAnimationFrame(raf); silenceAll(); stopMic();
      window.removeEventListener("resize", resize);
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("mousemove", onMouseMove);
      canvas.removeEventListener("pointerdown", onCanvasPointer);
      if (zone) { zone.removeEventListener("pointerdown", onJoyDown); zone.removeEventListener("pointermove", onJoyMove); zone.removeEventListener("pointerup", onJoyUp); zone.removeEventListener("pointercancel", onJoyUp); }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="game">
      <canvas ref={canvasRef} className="game__canvas" />

      <button type="button" className="game__leave" onClick={() => navigate("/")}>✕ Leave</button>
      <div className="timer">{fmtTime(timeSec)}</div>

      <div className="hud-clues" aria-live="polite">
        <span className="hud-clues__count">{clues.foundCount}/{clues.total}</span>
        <span className="hud-clues__label">clues</span>
        <span className="hud-clues__pips" aria-hidden="true">
          {clues.defs.map((d) => (<span key={d.id} className={`hud-clues__pip ${clues.isFound(d.id) ? "is-on" : ""}`} />))}
        </span>
      </div>

      {distractSec > 0 && <div className="buff">Investigator luring ghost · {fmtTime(distractSec)}</div>}
      {hiding && <div className="buff buff--hide">Hidden — hold your breath</div>}

      {prompt && <div className={`prompt ${prompt.locked ? "prompt--locked" : ""}`}>{prompt.text}</div>}

      {hiding && (
        <button
          type="button"
          className="peek-btn"
          onPointerDown={(e) => { e.preventDefault(); e.stopPropagation(); peekRef.current = performance.now() + 850; }}
        >
          👁 Peek
        </button>
      )}

      {isTouch && (
        <>
          <div className="joy-zone" ref={joyRef} />
          <div className="joystick" ref={joyBaseRef} style={{ display: "none" }}>
            <div className="joystick__knob" ref={knobRef} />
          </div>
          <button
            type="button"
            className={`touch-action ${actPulse ? "is-pulse" : ""}`}
            onPointerDown={(e) => { e.preventDefault(); e.stopPropagation(); ensureAudio(); interactRef.current(); }}
          >
            <span className="touch-action__e">E</span>
            <span className="touch-action__sub">ACT</span>
          </button>
        </>
      )}

      {/* mobile hold-breath button — only while the mic is live */}
      {isTouch && micOn && !hiding && (
        <button
          type="button"
          className="breath-btn"
          onPointerDown={(e) => { e.preventDefault(); e.stopPropagation(); breathHoldRef.current = true; }}
          onPointerUp={(e) => { e.preventDefault(); e.stopPropagation(); breathHoldRef.current = false; }}
          onPointerLeave={() => { breathHoldRef.current = false; }}
          onPointerCancel={() => { breathHoldRef.current = false; }}
        >
          <div className="breath-btn__ring" ref={breathRingRef} />
          <span className="breath-btn__label">HOLD<br />BREATH</span>
        </button>
      )}

      {dialogue && !showEnd && (
        <DialogueBox lines={dialogue} dim={dlgDim} onClose={() => closeDialogueRef.current()} />
      )}

      <ClueStack clues={clues.found} total={clues.total} />

      {!micAsked && (
        <MicPrompt onResult={(allowed) => { setMicOn(allowed); setMicAsked(true); }} />
      )}

      {micAsked && intro && (
        <IntroSequence
          onDone={() => { introRef.current = false; setIntro(false); }}
        />
      )}

      {death && !showEnd && (
        <DeathSequence onDone={() => { setDeath(false); setShowEnd(true); }} />
      )}

      {showEnd && <EndScreen variant={ending} timeLabel={fmtTime(timeSec)} onContinue={() => navigate("/")} />}

      <div className="rotate-warn" aria-hidden="true">
        <div className="rotate-warn__icon">⟳</div>
        <p>Rotate your device upright to play</p>
      </div>
    </div>
  );
}
