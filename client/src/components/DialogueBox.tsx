import { useEffect, useRef, useState } from "react";
import "./DialogueBox.css";

interface DialogueBoxProps {
  lines: string[];
  /** Dim the box so the player can see the ghost through it. */
  dim?: boolean;
  /** Called when the sequence finishes, the timer runs out, or X is tapped. */
  onClose: () => void;
}

const CHAR_MS = 40;
const AUTO_CLOSE_MS = 6000;

/**
 * Clue dialogue. Player movement is frozen by the engine, but the ghost keeps
 * moving — you read at your peril. Auto-closes after 6s (visible countdown).
 */
export default function DialogueBox({ lines, dim, onClose }: DialogueBoxProps) {
  const [idx, setIdx] = useState(0);
  const [shown, setShown] = useState("");
  const [done, setDone] = useState(false);
  const [remain, setRemain] = useState(1);

  const idxRef = useRef(0);
  const doneRef = useRef(false);
  idxRef.current = idx;
  doneRef.current = done;

  useEffect(() => {
    const full = lines[idx] ?? "";
    setShown("");
    setDone(false);
    let i = 0;
    const t = window.setInterval(() => {
      i++;
      setShown(full.slice(0, i));
      if (i >= full.length) { window.clearInterval(t); setDone(true); }
    }, CHAR_MS);
    return () => window.clearInterval(t);
  }, [idx, lines]);

  useEffect(() => {
    const start = performance.now();
    const iv = window.setInterval(() => {
      const frac = 1 - (performance.now() - start) / AUTO_CLOSE_MS;
      setRemain(Math.max(0, frac));
      if (frac <= 0) { window.clearInterval(iv); onClose(); }
    }, 80);
    return () => window.clearInterval(iv);
  }, [onClose]);

  useEffect(() => {
    const skip = () => { setShown(lines[idxRef.current] ?? ""); setDone(true); };
    const advance = () => {
      if (!doneRef.current) { skip(); return; }
      if (idxRef.current + 1 >= lines.length) onClose();
      else setIdx((n) => n + 1);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.code === "Space") { e.preventDefault(); if (!doneRef.current) skip(); else advance(); }
      else if (e.key === "e" || e.key === "E" || e.key === "Enter") { e.preventDefault(); advance(); }
    };
    const onPtr = () => advance();
    window.addEventListener("keydown", onKey);
    window.addEventListener("pointerdown", onPtr);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("pointerdown", onPtr);
    };
  }, [lines, onClose]);

  return (
    <div className={`dialogue ${dim ? "dialogue--dim" : ""}`} role="dialog" aria-live="polite">
      <div className="dialogue__box">
        <button
          type="button"
          className="dialogue__dismiss"
          aria-label="Close"
          onPointerDown={(e) => { e.preventDefault(); e.stopPropagation(); onClose(); }}
        >
          ✕
        </button>
        <div className="dialogue__bar">
          <div className="dialogue__bar-fill" style={{ width: `${remain * 100}%` }} />
        </div>
        <div className="dialogue__row">
          <div className="dialogue__avatar" aria-hidden="true">
            <span className="dialogue__avatar-head" />
            <span className="dialogue__avatar-beam" />
          </div>
          <p className="dialogue__text">
            {shown}
            {!done && <span className="dialogue__caret">▌</span>}
          </p>
        </div>
        <div className="dialogue__hint">
          {done
            ? idx + 1 >= lines.length ? "E / tap to close" : "E / tap to continue"
            : "tap / space to skip"}
        </div>
      </div>
    </div>
  );
}
