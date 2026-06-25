import "./EndScreen.css";

interface EndScreenProps {
  variant: "escape" | "caught";
  /** Survival time, formatted e.g. "2:14". */
  timeLabel?: string;
  onContinue: () => void;
}

/**
 * Chapter-1 ending. Two flavours: a hard-won escape (with cliffhanger) or the
 * bad ending when the ghost takes you.
 */
export default function EndScreen({
  variant,
  timeLabel,
  onContinue,
}: EndScreenProps) {
  const caught = variant === "caught";

  return (
    <div
      className={`endscreen ${caught ? "endscreen--caught" : ""}`}
      role="dialog"
      aria-modal="true"
    >
      <div className="endscreen__static" aria-hidden="true" />

      <div className="endscreen__content">
        <p className="endscreen__eyebrow">
          {caught ? "Chapter 1 — Lost" : "Chapter 1 — Escaped"}
        </p>

        <h1 className="endscreen__name">{caught ? "CAUGHT" : "ELARA"}</h1>

        {caught ? (
          <>
            <p className="endscreen__body">
              Cold fingers close around you and the torch goes out. The Alderton
              house keeps what it catches.
            </p>
            <p className="endscreen__body endscreen__body--accent">
              You were never meant to leave.
            </p>
          </>
        ) : (
          <>
            <p className="endscreen__body">
              You burst through the front door into the night air, clutching the
              drawing, the music box, and a name you can't unhear.
            </p>
            <p className="endscreen__body endscreen__body--accent">
              But the porch light flickers behind you. ELARA followed you out.
            </p>
          </>
        )}

        {timeLabel && (
          <p className="endscreen__whisper">Time in the house — {timeLabel}</p>
        )}

        <button type="button" className="endscreen__btn" onClick={onContinue}>
          {caught ? "Try again" : "Chapter 2 awaits"}
        </button>
        <p className="endscreen__tease">
          {caught ? "It is still listening." : "To be continued…"}
        </p>
      </div>
    </div>
  );
}
