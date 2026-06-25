import { useNavigate } from "react-router-dom";
import "./Home.css";

/**
 * Landing page for Hush — a co-op horror mystery game.
 * Pure-CSS atmosphere: static-TV flicker, blood-red ember vignette,
 * a distressed flickering title, and rolling fog along the bottom.
 */
export default function Home() {
  const navigate = useNavigate();

  return (
    <main className="home">
      {/* Atmosphere layers (behind / above content via z-index) */}
      <div className="home__vignette" aria-hidden="true" />
      <div className="home__static" aria-hidden="true" />
      <div className="home__scanlines" aria-hidden="true" />
      <div className="home__fog" aria-hidden="true" />

      <h1 className="home__title">HUSH</h1>
      <p className="home__tagline">It can hear you.</p>

      <div className="home__actions">
        <button
          type="button"
          className="home__btn home__btn--primary"
          onClick={() => navigate("/lobby")}
        >
          Join Game
        </button>
        <button
          type="button"
          className="home__btn home__btn--ghost"
          onClick={() => navigate("/solo")}
        >
          Play Solo
        </button>
      </div>

      <footer className="home__footer">
        Chapter 1: <span>The Alderton House</span>
      </footer>
    </main>
  );
}
