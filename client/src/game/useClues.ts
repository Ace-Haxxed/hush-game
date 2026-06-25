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
export function useClues(): ClueSystem {
  const [found, setFound] = useState<FoundClue[]>([]);

  const foundIds = useMemo(
    () => new Set(found.map((c) => c.id)),
    [found]
  );

  const findClue = useCallback(
    (id: string): boolean => {
      if (foundIds.has(id)) return false;
      const def = CHAPTER1_CLUES.find((c) => c.id === id);
      if (!def) return false;

      setFound((prev) =>
        prev.some((c) => c.id === id)
          ? prev
          : [...prev, { ...def, order: prev.length }]
      );
      playClueTone();
      return true;
    },
    [foundIds]
  );

  const reset = useCallback(() => setFound([]), []);

  return {
    defs: CHAPTER1_CLUES,
    found,
    foundIds,
    foundCount: found.length,
    total: CHAPTER1_CLUES.length,
    allFound: found.length === CHAPTER1_CLUES.length,
    findClue,
    isFound: (id: string) => foundIds.has(id),
    reset,
  };
}
