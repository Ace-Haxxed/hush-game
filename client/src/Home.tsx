import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import HowToPlay from "./components/HowToPlay";
import "./Home.css";

/**
 * Landing page for Hush. Pure-CSS atmosphere plus the How-To-Play tutorial and
 * a chapter-select. First-time players see the tutorial automatically.
 */
export default function Home() {
  const navigate = useNavigate();
  const [tutorial, setTutorial] = useState(false);
  const [ch1Done, setCh1Done] = useState(false);

  useEffect(() => {
    setCh1Done(localStorage.getItem("hush_ch1_complete") === "1");
    // first-time players get the tutorial automatically
    if (localStorage.getItem("hush_tutorial_seen") !== "1") setTutorial(true);
  }, []);

  const closeTutorial = () => {
    localStorage.setItem("hush_tutorial_seen", "1");
    setTutorial(false);
  };
  const startFromTutorial = () => {
    localStorage.setItem("hush_tutorial_seen", "1");
    navigate("/game/1");
  };

  return (
    <main className="home">
      {/* Atmosphere layers */}
      <div className="home__vignette" aria-hidden="true" />
      <div className="home__static" aria-hidden="true" />
      <div className="home__scanlines" aria-hidden="true" />
      <div className="home__fog" aria-hidden="true" />

      <h1 className="home__title">HUSH</h1>
      <p className="home__tagline">It can hear you.</p>

      {/* Chapter select */}
      <div className="home__chapters">
        <button
          type="button"
          className="chapter-card"
          onClick={() => navigate("/game/1")}
        >
          <span className="chapter-card__icon" aria-hidden="true">🕯</span>
          <span className="chapter-card__no">Chapter 1</span>
          <span className="chapter-card__title">The Alderton House</span>
        </button>

        <button
          type="button"
          className={`chapter-card ${ch1Done ? "" : "chapter-card--locked"}`}
          disabled={!ch1Done}
          onClick={() => ch1Done && navigate("/game/2")}
        >
          <span className="chapter-card__icon" aria-hidden="true">{ch1Done ? "🖼" : "🔒"}</span>
          <span className="chapter-card__no">Chapter 2</span>
          <span className="chapter-card__title">What She Left Behind</span>
          {!ch1Done && <span className="chapter-card__hint">Finish Chapter 1 to unlock</span>}
        </button>
      </div>

      <div className="home__actions">
        <button type="button" className="home__btn home__btn--primary" onClick={() => navigate("/lobby")}>
          Join Game
        </button>
        <button type="button" className="home__btn home__btn--how" onClick={() => setTutorial(true)}>
          How To Play
        </button>
        <button type="button" className="home__btn home__btn--ghost" onClick={() => navigate("/game/1")}>
          Play Solo
        </button>
      </div>

      <footer className="home__footer">
        Chapter 1: <span>The Alderton House</span>
      </footer>

      {tutorial && <HowToPlay onClose={closeTutorial} onStart={startFromTutorial} />}
    </main>
  );
}
