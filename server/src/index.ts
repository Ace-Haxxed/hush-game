import http from "http";
import express from "express";
import cors from "cors";
import { Server } from "socket.io";
import { GamePhase, GameState, Player } from "@hush/shared";
import { GhostAI } from "./ghostAI";

const PORT = process.env.PORT ?? 3001;
const CLIENT_ORIGIN = process.env.CLIENT_ORIGIN ?? "http://localhost:5173";

const app = express();
app.use(cors({ origin: CLIENT_ORIGIN }));
app.use(express.json());

app.get("/health", (_req, res) => {
  res.json({ status: "ok", service: "hush-server" });
});

const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: CLIENT_ORIGIN },
});

const START_ROOM = "foyer";

/** Whitelist of valid room ids for `player:move` validation. */
const roomsGuard: Record<string, true> = {
  foyer: true,
  kitchen: true,
  study: true,
  basement: true,
};

/** The single in-memory game state for this prototype. */
const gameState: GameState = {
  players: [],
  ghost: { currentRoom: "study", isVisible: false, huntMode: false },
  clues: [],
  phase: GamePhase.LOBBY,
  chapter: 1,
};

/** Player records keyed by socket id, and the set of discovered clue ids. */
const players = new Map<string, Player>();
const foundClues = new Set<string>();

function syncPlayers(): void {
  gameState.players = [...players.values()];
}

/** Push the full game state to every client. */
function broadcastState(): void {
  syncPlayers();
  io.emit("state", gameState);
}

// ---------------------------------------------------------------- Ghost AI
const ghost = new GhostAI({
  getPlayers: () =>
    [...players.values()].map((p) => ({ id: p.id, room: p.room })),
  getClueCount: () => foundClues.size,
  broadcast: (state) => {
    // Mirror the ghost into the shared state and flag the targeted player.
    gameState.ghost = {
      currentRoom: state.currentRoom,
      isVisible: state.isVisible,
      huntMode: state.huntMode,
    };
    for (const p of players.values()) {
      p.isTarget = p.id === state.targetPlayerId;
    }
    syncPlayers();
    io.emit("ghost", state);
    io.emit("state", gameState);
  },
});

io.on("connection", (socket) => {
  console.log(`[socket] connected: ${socket.id}`);

  players.set(socket.id, {
    id: socket.id,
    name: "Guest",
    room: START_ROOM,
    isAlive: true,
    isTarget: false,
  });

  // Send current state + ghost position to the freshly connected client.
  socket.emit("state", gameState);
  socket.emit("ghost", ghost.getState());
  broadcastState();

  socket.on("player:join", (name: unknown) => {
    const p = players.get(socket.id);
    if (p && typeof name === "string" && name.trim()) {
      p.name = name.trim().slice(0, 24);
      broadcastState();
    }
  });

  // The client reports the room it has walked into.
  socket.on("player:move", (room: unknown) => {
    const p = players.get(socket.id);
    if (p && typeof room === "string" && room in roomsGuard) {
      p.room = room;
      broadcastState();
    }
  });

  socket.on("clue:found", (id: unknown) => {
    if (typeof id === "string" && !foundClues.has(id)) {
      foundClues.add(id);
      broadcastState();
    }
  });

  socket.on("disconnect", () => {
    console.log(`[socket] disconnected: ${socket.id}`);
    players.delete(socket.id);
    broadcastState();
  });
});

server.listen(PORT, () => {
  console.log(`hush server listening on http://localhost:${PORT}`);
  ghost.start();
});
