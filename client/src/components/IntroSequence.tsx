import { useEffect } from "react";
import "./IntroSequence.css";

interface IntroSequenceProps {
  onDone: () => void;
}

const LINES = [
  "The Alderton House. 1987.",
  "You are here to document the haunting.",
  "Do not make a sound.",
];

/**
 * Opening titles: lines fade in over black, a 3s held beat, then the whole
 * overlay fades away to reveal the house.
 */
export default function IntroSequence({ onDone }: IntroSequenceProps) {
  // total: 3 lines (~2.4s each staggered) + 3s hold + 1.2s fade-out
  useEffect(() => {
    const t = window.setTimeout(onDone, 9000);
    return () => window.clearTimeout(t);
  }, [onDone]);

  return (
    <div className="intro" role="dialog" aria-label="Intro">
      <div className="intro__lines">
        {LINES.map((line, i) => (
          <p key={i} className="intro__line" style={{ animationDelay: `${0.6 + i * 1.8}s` }}>
            {line}
          </p>
        ))}
      </div>
    </div>
  );
}
