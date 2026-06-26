import { useEffect } from "react";
import { breathingUpdate } from "../game/sound";
import "./DeathSequence.css";

interface DeathSequenceProps {
  onDone: () => void;
  /** 1 = Elara only (Ch1), 2 = Elara + Ruth both found you (Ch2). */
  eyes?: 1 | 2;
}

/**
 * The moment of being caught: black, her breathing, a red eye (or two) opening
 * in the dark, held for 3 seconds before the end screen.
 */
export default function DeathSequence({ onDone, eyes = 1 }: DeathSequenceProps) {
  useEffect(() => {
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
      <div className={`death__eyes ${eyes === 2 ? "death__eyes--two" : ""}`} aria-hidden="true">
        <div className="death__eye"><span className="death__pupil" /></div>
        {eyes === 2 && <div className="death__eye"><span className="death__pupil" /></div>}
      </div>
    </div>
  );
}
