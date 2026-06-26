import { useEffect, useRef, useState } from "react";
import "./HowToPlay.css";

interface HowToPlayProps {
  /** Close without starting (X or Escape). */
  onClose: () => void;
  /** Player finished the tutorial and wants to play. */
  onStart: () => void;
}

const PAGES = 4;

/**
 * Full-screen "How to play" overlay. Four pages, arrows on desktop and swipe on
 * mobile. The last page launches the game.
 */
export default function HowToPlay({ onClose, onStart }: HowToPlayProps) {
  const [page, setPage] = useState(0);
  const startX = useRef<number | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      else if (e.key === "ArrowRight") setPage((p) => Math.min(PAGES - 1, p + 1));
      else if (e.key === "ArrowLeft") setPage((p) => Math.max(0, p - 1));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const onDown = (e: React.PointerEvent) => { startX.current = e.clientX; };
  const onUp = (e: React.PointerEvent) => {
    if (startX.current === null) return;
    const dx = e.clientX - startX.current;
    startX.current = null;
    if (dx < -50) setPage((p) => Math.min(PAGES - 1, p + 1));
    else if (dx > 50) setPage((p) => Math.max(0, p - 1));
  };

  return (
    <div className="htp" role="dialog" aria-modal="true">
      <button type="button" className="htp__close" aria-label="Close" onClick={onClose}>✕</button>

      <header className="htp__head">
        <h1 className="htp__title">SURVIVE THE ALDERTON HOUSE</h1>
        <p className="htp__sub">A quick guide before you go in.</p>
      </header>

      <div className="htp__viewport" onPointerDown={onDown} onPointerUp={onUp}>
        <div className="htp__track" style={{ transform: `translateX(-${page * 100}%)` }}>
          {/* PAGE 1 — MOVEMENT */}
          <section className="htp__page">
            <div className="htp__art htp__art--move">
              <div className="htp-house"><span className="htp-dot" /></div>
              <div className="htp-keys">
                <span>W</span><span>A</span><span>S</span><span>D</span>
              </div>
              <div className="htp-stick"><span /></div>
            </div>
            <h2 className="htp__h">Movement</h2>
            <p>Move through the house. Explore every room.</p>
            <p>She cannot see you.</p>
            <p className="htp__warn">But she can hear you.</p>
          </section>

          {/* PAGE 2 — CLUES */}
          <section className="htp__page">
            <div className="htp__art htp__art--clue">
              <div className="htp-polaroid"><span className="htp-polaroid__photo" /></div>
            </div>
            <h2 className="htp__h">Clues</h2>
            <p>Find 3 clues hidden in the house. Each one reveals the truth.</p>
            <p>Walk up to glowing objects. Press E or tap to investigate.</p>
            <p className="htp__warn">Reading takes time. She keeps moving.</p>
          </section>

          {/* PAGE 3 — THE GHOST */}
          <section className="htp__page">
            <div className="htp__art htp__art--ghost">
              <div className="htp-ghost" />
              <div className="htp-attack-ring" />
            </div>
            <h2 className="htp__h">The Ghost</h2>
            <p>She wanders. She listens. Stay out of her path.</p>
            <p>Hide in the wardrobe or under the stairs. She will search after 45 seconds.</p>
            <p className="htp__warn">If she finds you, you do not get a second chance.</p>
          </section>

          {/* PAGE 4 — MICROPHONE */}
          <section className="htp__page">
            <div className="htp__art htp__art--mic">
              <div className="htp-mic">
                <span className="htp-mic__bars"><i /><i /><i /></span>
                <span className="htp-mic__circle" />
              </div>
              <div className="htp-mic-states">
                <span className="is-green">SAFE</span>
                <span className="is-yellow">LOUD</span>
                <span className="is-red">HEARD</span>
              </div>
            </div>
            <h2 className="htp__h">Microphone</h2>
            <p>She can hear you talk. Stay silent. Or run.</p>
            <p>Hold SPACE to hold your breath. You have 4 seconds.</p>
            <p className="htp__warn htp__warn--big">Do not make a sound.</p>
          </section>
        </div>
      </div>

      {/* nav */}
      <div className="htp__nav">
        <button type="button" className="htp__arrow" disabled={page === 0} onClick={() => setPage((p) => Math.max(0, p - 1))} aria-label="Previous">‹</button>
        <div className="htp__dots">
          {Array.from({ length: PAGES }).map((_, i) => (
            <span key={i} className={i === page ? "is-on" : ""} />
          ))}
        </div>
        <button type="button" className="htp__arrow" disabled={page === PAGES - 1} onClick={() => setPage((p) => Math.min(PAGES - 1, p + 1))} aria-label="Next">›</button>
      </div>

      {page === PAGES - 1 && (
        <div className="htp__finish">
          <button type="button" className="htp__start" onClick={onStart}>I understand. Let me in.</button>
          <p className="htp__escape">or press Escape to go back</p>
        </div>
      )}
    </div>
  );
}
