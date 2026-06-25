import {
  DIRECTION_GLYPH,
  Direction,
  Interaction,
  RoomDef,
  ROOMS,
} from "../game/rooms";

interface ExitView {
  direction: Direction;
  roomId: string;
  name: string;
  locked: boolean;
}

interface RoomProps {
  room: RoomDef;
  /** Ids of interactions that have already been inspected. */
  searched: Set<string>;
  /** True when the ghost shares this room (strong cold spot). */
  ghostHere: boolean;
  /** True when the ghost is in an adjacent room (faint cold spot). */
  ghostNear: boolean;
  /** Number of clues found so far — used to label locked doorways. */
  clueCount: number;
  onInteract: (interaction: Interaction) => void;
  onNavigate: (roomId: string) => void;
}

/**
 * Purely presentational view of a single room: atmospheric description,
 * interaction hotspots, directional doorways, and the cold-spot overlay.
 */
export default function Room({
  room,
  searched,
  ghostHere,
  ghostNear,
  clueCount,
  onInteract,
  onNavigate,
}: RoomProps) {
  const exits: ExitView[] = (Object.entries(room.exits) as [
    Direction,
    string
  ][]).map(([direction, roomId]) => {
    const dest = ROOMS[roomId];
    const lock = dest.locked;
    return {
      direction,
      roomId,
      name: dest.name,
      locked: !!lock && clueCount < lock.requiresClues,
    };
  });

  const coldClass = ghostHere
    ? "room--cold room--cold-strong"
    : ghostNear
    ? "room--cold"
    : "";

  return (
    <section className={`room ${coldClass}`} aria-label={`${room.name} room`}>
      {/* Cold-spot blue pulse */}
      <div className="room__cold" aria-hidden="true" />

      {/* Room name, top left */}
      <header className="room__name">
        <span className="room__name-dot" aria-hidden="true" />
        {room.name}
        {(ghostHere || ghostNear) && (
          <span className="room__cold-label">cold spot</span>
        )}
      </header>

      {/* Atmospheric description */}
      <p className="room__desc">{room.description}</p>

      {/* Interaction hotspots */}
      <div className="room__stage">
        {room.interactions.map((it) => {
          const done = searched.has(it.id);
          return (
            <button
              key={it.id}
              type="button"
              className={`hotspot ${done ? "hotspot--done" : ""}`}
              style={{ left: `${it.x}%`, top: `${it.y}%` }}
              onClick={() => onInteract(it)}
              aria-label={`Inspect ${it.label}${done ? " (searched)" : ""}`}
            >
              <span className="hotspot__glyph" aria-hidden="true">
                {it.glyph}
              </span>
              <span className="hotspot__label">{it.label}</span>
            </button>
          );
        })}
      </div>

      {/* Directional doorways */}
      <nav className="room__exits" aria-label="Doorways">
        {exits.map((exit) => (
          <button
            key={exit.direction}
            type="button"
            className={`exit exit--${exit.direction} ${
              exit.locked ? "exit--locked" : ""
            }`}
            onClick={() => !exit.locked && onNavigate(exit.roomId)}
            disabled={exit.locked}
            aria-label={
              exit.locked
                ? `${exit.name} — locked, find more clues`
                : `Go to ${exit.name}`
            }
          >
            <span className="exit__arrow" aria-hidden="true">
              {exit.locked ? "⚿" : DIRECTION_GLYPH[exit.direction]}
            </span>
            <span className="exit__name">
              {exit.locked ? "Locked" : exit.name}
            </span>
          </button>
        ))}
      </nav>
    </section>
  );
}
