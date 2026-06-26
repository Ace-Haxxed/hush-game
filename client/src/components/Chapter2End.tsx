import { useEffect, useState } from "react";
import { playEndDrone } from "../game/sound";
import "./Chapter2End.css";

interface Chapter2EndProps {
  /** True if the player actually said her name into the mic. */
  secret: boolean;
  onContinue: () => void;
}

const FINALE = [
  "The door won't open.",
  "She won't let you leave. Not until you understand.",
  "You have to say her name.",
  "Elara stands before you. She does not attack. She only stares.",
  "“You know what he did.”",
  "“You found what he left.”",
  "“Tell them. Tell them what happened here.”",
];

/**
 * Chapter 2 ending: the finale beats, a fade to white, then the credit scene.
 * The secret ending adds the girl on the path and an extra credit line.
 */
export default function Chapter2End({ secret, onContinue }: Chapter2EndProps) {
  const [phase, setPhase] = useState<"finale" | "white" | "credits">("finale");
  const [line, setLine] = useState(0);

  useEffect(() => {
    if (phase !== "finale") return;
    if (line >= FINALE.length) { const t = window.setTimeout(() => setPhase("white"), 1200); return () => window.clearTimeout(t); }
    const t = window.setTimeout(() => setLine((n) => n + 1), 2600);
    return () => window.clearTimeout(t);
  }, [phase, line]);

  useEffect(() => {
    if (phase === "white") { const t = window.setTimeout(() => { playEndDrone(); setPhase("credits"); }, 1800); return () => window.clearTimeout(t); }
  }, [phase]);

  if (phase === "finale") {
    return (
      <div className="ch2end ch2end--finale">
        <p key={line} className="ch2end__line">{FINALE[Math.min(line, FINALE.length - 1)]}</p>
      </div>
    );
  }
  if (phase === "white") return <div className="ch2end ch2end--white" />;

  return (
    <div className="ch2end ch2end--credits">
      <div className="ch2end__scroll">
        <h2>CHAPTER 2: WHAT SHE LEFT BEHIND</h2>
        <p className="ch2end__dim">New this chapter:</p>
        <p>The truth about Daniel.</p>
        <p>Ruth, who never stopped listening.</p>
        <p>The crawl space. The shoe. The photograph.</p>

        <h3>DANIEL ALDERTON</h3>
        <p>Born 1971. Still alive.</p>
        <p className="ch2end__red">He knows you found it.</p>

        {secret && (
          <div className="ch2end__secret">
            <div className="ch2end__girl" aria-hidden="true" />
            <p>At the end of the path, a small girl is standing.</p>
            <p>She waves once. Then she is gone.</p>
            <p className="ch2end__red">Elara Alderton. 1978–1987.</p>
            <p className="ch2end__red">She just wanted someone to know.</p>
          </div>
        )}

        <h3>CHAPTER 3: COMING SOON</h3>
        <p>Find Daniel.</p>

        <div className="ch2end__hands" aria-hidden="true">
          <span className="ch2end__hand ch2end__hand--adult" />
          <span className="ch2end__hand ch2end__hand--child" />
        </div>

        <button type="button" className="ch2end__btn" onClick={onContinue}>Return to menu</button>
      </div>
    </div>
  );
}
