import { useEffect } from "react";
import { breathingUpdate } from "../game/sound";
import "./DeathSequence.css";

interface DeathSequenceProps {
  onDone: () => void;
}

/**
 * The moment of being caught: black, her breathing, a single red eye opening
 * in the dark, held for 3 seconds before the end screen.
 */
export default function DeathSequence({ onDone }: DeathSequenceProps) {
  useEffect(() => {
    // drive the shaky breathing for the duration
    const iv = window.setInterval(() => breathingUpdate(true), 250);
    const done = window.setTimeout(onDone, 3000);
    return () => {
      window.clearInterval(iv);
      window.clearTimeout(done);
      breathingUpdate(false);
    };
  }, [onDone]);

  return (
    <div className="death" role="dialog" aria-label="Caught">
      <div className="death__eye" aria-hidden="true">
        <span className="death__pupil" />
      </div>
    </div>
  );
}
