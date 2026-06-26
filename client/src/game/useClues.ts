import { useCallback, useMemo, useState } from "react";
import { playClueTone } from "./sound";

export interface ClueDef {
  id: string;
  /** Short headline for the card front. */
  title: string;
  /** Full text revealed on the card back. */
  description: string;
  /** Where in the house it was found, shown on the polaroid. */
  location: string;
  /** Single glyph used as the polaroid's "photo". */
  glyph: string;
  /** Photo tint colour. */
  tint: string;
}

/** The three clues hidden across Chapter 1: The Alderton House. */
export const CHAPTER1_CLUES: ClueDef[] = [
  {
    id: "clue-drawing",
    title: "The Family Drawing",
    description: "A child's drawing of a family. One figure is crossed out.",
    location: "Study · Bookshelf",
    glyph: "✎",
    tint: "#3a2a1c",
  },
  {
    id: "clue-musicbox",
    title: "The Music Box",
    description: "A music box that plays 3 notes then stops.",
    location: "Kitchen · Cabinet",
    glyph: "♪",
    tint: "#1f3a2e",
  },
  {
    id: "clue-elara",
    title: "The Name",
    description: "A name scratched into the basement wall: E L A R A",
    location: "Basement · Floor",
    glyph: "▨",
    tint: "#221a1a",
  },
];

/** Chapter 2: five photographs of what happened in the Alderton House. */
export const CHAPTER2_PHOTOS: ClueDef[] = [
  {
    id: "photo-dinner",
    title: "Family Dinner",
    description: "A family dinner. An empty chair where Elara should sit. Oct 3 1987.",
    location: "Kitchen",
    glyph: "🍽",
    tint: "#2a2418",
  },
  {
    id: "photo-clippings",
    title: "The Clippings",
    description: "Daniel's wall, covered in newspaper clippings. One circled: LOCAL GIRL MISSING.",
    location: "Daniel's Room",
    glyph: "📰",
    tint: "#26201a",
  },
  {
    id: "photo-ruth",
    title: "Ruth, Alone",
    description: "Ruth sitting alone, staring at nothing. On the back: “She keeps calling me.”",
    location: "Attic",
    glyph: "👤",
    tint: "#1c2026",
  },
  {
    id: "photo-corner",
    title: "The Corner",
    description: "The corner where Elara was found. A small shoe. Nothing else.",
    location: "Basement",
    glyph: "👟",
    tint: "#201618",
  },
  {
    id: "photo-recent",
    title: "Recently",
    description: "The same corner — 2019 date stamp. The shoe is gone. Someone was here recently.",
    location: "Crawl Space",
    glyph: "📷",
    tint: "#16181c",
  },
];

export interface FoundClue extends ClueDef {
  /** Discovery order, starting at 0. */
  order: number;
}

export interface ClueSystem {
  defs: ClueDef[];
  found: FoundClue[];
  foundIds: Set<string>;
  foundCount: number;
  total: number;
  allFound: boolean;
  /** Records a clue by id. Returns true only when newly discovered. */
  findClue: (id: string) => boolean;
  isFound: (id: string) => boolean;
  reset: () => void;
}

/**
 * Owns the discovered-clue state for the current chapter. Discovering a new
 * clue plays the eerie Web Audio sting; re-inspecting a found clue is a no-op.
 */
export function useClues(defs: ClueDef[] = CHAPTER1_CLUES): ClueSystem {
  const [found, setFound] = useState<FoundClue[]>([]);

  const foundIds = useMemo(
    () => new Set(found.map((c) => c.id)),
    [found]
  );

  const findClue = useCallback(
    (id: string): boolean => {
      if (foundIds.has(id)) return false;
      const def = defs.find((c) => c.id === id);
      if (!def) return false;

      setFound((prev) =>
        prev.some((c) => c.id === id)
          ? prev
          : [...prev, { ...def, order: prev.length }]
      );
      playClueTone();
      return true;
    },
    [foundIds, defs]
  );

  const reset = useCallback(() => setFound([]), []);

  return {
    defs,
    found,
    foundIds,
    foundCount: found.length,
    total: defs.length,
    allFound: found.length === defs.length,
    findClue,
    isFound: (id: string) => foundIds.has(id),
    reset,
  };
}
