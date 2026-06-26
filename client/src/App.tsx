import { useEffect, useState } from "react";
import { Routes, Route, Link } from "react-router-dom";
import { GamePhase, GameState } from "@hush/shared";
import { socket } from "./socket";
import Home from "./Home";
import Game from "./Game";

function Lobby() {
  const [state, setState] = useState<GameState | null>(null);
  const [connected, setConnected] = useState(socket.connected);

  useEffect(() => {
    const onConnect = () => setConnected(true);
    const onDisconnect = () => setConnected(false);
    const onState = (s: GameState) => setState(s);

    socket.on("connect", onConnect);
    socket.on("disconnect", onDisconnect);
    socket.on("state", onState);

    return () => {
      socket.off("connect", onConnect);
      socket.off("disconnect", onDisconnect);
      socket.off("state", onState);
    };
  }, []);

  return (
    <div className="min-h-screen bg-background text-text flex flex-col items-center justify-center gap-6 p-8">
      <h1 className="text-6xl font-bold tracking-widest text-highlight drop-shadow-[0_0_12px_rgba(255,51,51,0.4)]">
        HUSH
      </h1>
      <p className="text-text/70 italic">Don&apos;t make a sound.</p>

      <div className="rounded-lg border border-accent/40 bg-surface px-6 py-4 text-sm">
        <p>
          server:{" "}
          <span className={connected ? "text-highlight" : "text-text/50"}>
            {connected ? "connected" : "offline"}
          </span>
        </p>
        <p>phase: {state?.phase ?? GamePhase.LOBBY}</p>
        <p>players: {state?.players.length ?? 0}</p>
      </div>

      <Link
        to="/about"
        className="text-accent hover:text-highlight underline underline-offset-4 transition-colors"
      >
        about
      </Link>
    </div>
  );
}

function About() {
  return (
    <div className="min-h-screen bg-background text-text flex flex-col items-center justify-center gap-4 p-8">
      <h2 className="text-3xl text-highlight">About Hush</h2>
      <p className="max-w-md text-center text-text/70">
        A cooperative horror game. Explore the rooms, gather clues, and survive
        the hunt — but stay quiet, the ghost is listening.
      </p>
      <Link
        to="/"
        className="text-accent hover:text-highlight underline underline-offset-4 transition-colors"
      >
        back
      </Link>
    </div>
  );
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/game" element={<Game />} />
      <Route path="/game/:chapter" element={<Game />} />
      <Route path="/solo" element={<Game />} />
      <Route path="/lobby" element={<Lobby />} />
      <Route path="/about" element={<About />} />
    </Routes>
  );
}
