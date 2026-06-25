import { CSSProperties, useState } from "react";
import { FoundClue } from "../game/useClues";
import "./Clue.css";

interface ClueProps {
  clue: FoundClue;
  /** Position within the stack (0 = first found, sits at the bottom). */
  index: number;
  total: number;
}

/**
 * A single polaroid clue card. Animates in from the bottom on mount and flips
 * between its "photo" front and a full-description back when tapped/clicked.
 */
export function Clue({ clue, index, total }: ClueProps) {
  const [flipped, setFlipped] = useState(false);

  const tilt = (index % 2 === 0 ? -1 : 1) * (2 + (index % 3));

  const style = {
    "--i": index,
    "--tilt": `${tilt}deg`,
    "--tint": clue.tint,
    zIndex: flipped ? 100 : 10 + index,
  } as CSSProperties;

  return (
    <div className="clue" style={style}>
      <button
        type="button"
        className={`clue__flip ${flipped ? "is-flipped" : ""}`}
        onClick={() => setFlipped((f) => !f)}
        aria-label={`Clue ${index + 1} of ${total}: ${clue.title}. Tap to ${
          flipped ? "hide" : "read"
        } the full description.`}
        aria-pressed={flipped}
      >
        {/* FRONT — polaroid photo */}
        <span className="clue__face clue__face--front">
          <span className="clue__photo" aria-hidden="true">
            <span className="clue__glyph">{clue.glyph}</span>
            <span className="clue__grain" />
          </span>
          <span className="clue__caption">
            <span className="clue__title">{clue.title}</span>
            <span className="clue__loc">{clue.location}</span>
          </span>
        </span>

        {/* BACK — full description */}
        <span className="clue__face clue__face--back">
          <span className="clue__desc">“{clue.description}”</span>
          <span className="clue__no">
            {String(index + 1).padStart(2, "0")} /{" "}
            {String(total).padStart(2, "0")}
          </span>
        </span>
      </button>
    </div>
  );
}

interface ClueStackProps {
  clues: FoundClue[];
  total: number;
}

/** Bottom-left stack of discovered clue polaroids. */
export function ClueStack({ clues, total }: ClueStackProps) {
  return (
    <div className="clue-stack" aria-label="Discovered clues">
      {clues.map((clue, i) => (
        <Clue key={clue.id} clue={clue} index={i} total={total} />
      ))}
    </div>
  );
}

export default Clue;
