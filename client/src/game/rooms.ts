/**
 * Static layout for Chapter 1: The Alderton House.
 * Four rooms, their atmospheric copy, interaction hotspots, and the doorways
 * that connect them. Kept data-only so <Room /> stays purely presentational.
 */

export type Direction = "up" | "down" | "left" | "right";

export interface Interaction {
  id: string;
  /** Short noun shown on the hotspot, e.g. "Bookshelf". */
  label: string;
  /** Hotspot position within the room stage, in percent (0–100). */
  x: number;
  y: number;
  /** A single glyph used as the hotspot marker. */
  glyph: string;
  /** Flavour revealed when the player inspects the hotspot. */
  reveal: string;
  /** If present, inspecting this hotspot discovers the clue with this id. */
  clueId?: string;
}

export interface RoomDef {
  id: string;
  name: string;
  description: string;
  interactions: Interaction[];
  /** Direction → destination room id. */
  exits: Partial<Record<Direction, string>>;
  /** When set, the room is sealed until this many clues are discovered. */
  locked?: { requiresClues: number };
  /** Hue used for that room's polaroid "photo" tint. */
  tint: string;
}

export const ROOMS: Record<string, RoomDef> = {
  foyer: {
    id: "foyer",
    name: "Foyer",
    tint: "#2b2440",
    description:
      "Dust hangs in the stale air of the entrance hall. The front door has " +
      "locked itself behind you. A grandfather clock ticks, though its hands " +
      "haven't moved in years.",
    exits: { left: "study", right: "kitchen", down: "basement" },
    interactions: [
      {
        id: "foyer-mail",
        label: "Scattered mail",
        x: 50,
        y: 80,
        glyph: "✉",
        reveal:
          "A torn letter, postmarked years ago: “We are not leaving the " +
          "Alderton house. It won't let us.”",
      },
      {
        id: "foyer-clock",
        label: "Grandfather clock",
        x: 82,
        y: 38,
        glyph: "✦",
        reveal:
          "The pendulum is still, yet the ticking continues somewhere behind " +
          "the wall.",
      },
      {
        id: "foyer-coatrack",
        label: "Coat rack",
        x: 16,
        y: 44,
        glyph: "✚",
        reveal:
          "Four coats, all child-sized, all damp. There were never any " +
          "children listed on the deed.",
      },
    ],
  },

  kitchen: {
    id: "kitchen",
    name: "Kitchen",
    tint: "#1f3a2e",
    description:
      "Cold grease and rot. The cupboards hang open like gaping mouths. " +
      "Something was dragged across the tile and wiped away — badly.",
    exits: { left: "foyer" },
    interactions: [
      {
        id: "kitchen-cabinet",
        label: "Cabinet",
        x: 24,
        y: 40,
        glyph: "▤",
        reveal:
          "Inside the cabinet sits a small music box. You wind it. It plays " +
          "three notes — then stops dead, as if a hand closed the lid.",
        clueId: "clue-musicbox",
      },
      {
        id: "kitchen-sink",
        label: "Sink",
        x: 70,
        y: 58,
        glyph: "◍",
        reveal:
          "The tap runs cold and red for a moment, then clears. You decide " +
          "not to drink.",
      },
      {
        id: "kitchen-fridge",
        label: "Refrigerator",
        x: 84,
        y: 36,
        glyph: "▦",
        reveal:
          "Magnets spell a single word across the door: HUSH. You did not " +
          "arrange them.",
      },
    ],
  },

  study: {
    id: "study",
    name: "Study",
    tint: "#3a2a1c",
    description:
      "Floor-to-ceiling shelves swallow the light. A single chair faces the " +
      "wall, as if someone had been made to sit in the corner.",
    exits: { right: "foyer" },
    interactions: [
      {
        id: "study-bookshelf",
        label: "Bookshelf",
        x: 76,
        y: 44,
        glyph: "❏",
        reveal:
          "Wedged behind a row of mildewed books is a child's drawing of a " +
          "family. One figure has been scratched out in furious red crayon.",
        clueId: "clue-drawing",
      },
      {
        id: "study-diary",
        label: "Open diary",
        x: 30,
        y: 62,
        glyph: "❧",
        reveal:
          "The last legible entry, pressed hard into the page: “It hears " +
          "us when we speak. So we have learned to be quiet.”",
      },
      {
        id: "study-painting",
        label: "Portrait",
        x: 52,
        y: 28,
        glyph: "◈",
        reveal:
          "A family portrait — but every face has been scratched out except " +
          "one that was never painted in.",
      },
    ],
  },

  basement: {
    id: "basement",
    name: "Basement",
    tint: "#221a1a",
    locked: { requiresClues: 2 },
    description:
      "The temperature drops with every step down. Your breath fogs in front " +
      "of you. Down here, the house stops pretending to be empty.",
    exits: { up: "foyer" },
    interactions: [
      {
        id: "basement-furnace",
        label: "Furnace",
        x: 28,
        y: 50,
        glyph: "❂",
        reveal:
          "Long cold, yet it breathes warm air against the back of your neck.",
      },
      {
        id: "basement-floor",
        label: "Scratched wall",
        x: 62,
        y: 66,
        glyph: "▨",
        reveal:
          "You scrape away the grime near the floor. A name has been carved " +
          "into the wall, over and over, pressed deep: E L A R A.",
        clueId: "clue-elara",
      },
    ],
  },
};

export const START_ROOM = "foyer";

/** Arrow glyph for a given doorway direction. */
export const DIRECTION_GLYPH: Record<Direction, string> = {
  up: "↑",
  down: "↓",
  left: "←",
  right: "→",
};

/** Maps a keyboard arrow key to a room direction. */
export const KEY_TO_DIRECTION: Record<string, Direction> = {
  ArrowUp: "up",
  ArrowDown: "down",
  ArrowLeft: "left",
  ArrowRight: "right",
};
