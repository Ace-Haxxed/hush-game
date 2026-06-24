/**
 * Shared domain types for Hush — used by both the client and the server.
 */

/** The phases a game moves through, in rough chronological order. */
export enum GamePhase {
  /** Players are gathering before the game starts. */
  LOBBY = "LOBBY",
  /** Free roaming — searching rooms for clues. */
  EXPLORING = "EXPLORING",
  /** The ghost is actively hunting a target. */
  HUNTED = "HUNTED",
  /** The game is over. */
  ENDED = "ENDED",
}

export interface Player {
  id: string;
  name: string;
  /** Identifier of the room the player currently occupies. */
  room: string;
  isAlive: boolean;
  /** Whether this player is the ghost's current target. */
  isTarget: boolean;
}

export interface Ghost {
  /** Identifier of the room the ghost currently occupies. */
  currentRoom: string;
  isVisible: boolean;
  /** When true, the ghost actively pursues its target. */
  huntMode: boolean;
}

export interface Clue {
  id: string;
  /** Identifier of the room where the clue can be found. */
  room: string;
  description: string;
  found: boolean;
}

export interface GameState {
  players: Player[];
  ghost: Ghost;
  clues: Clue[];
  phase: GamePhase;
  /** The current chapter / level number. */
  chapter: number;
}
