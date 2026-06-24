import http from "http";
import express from "express";
import cors from "cors";
import { Server } from "socket.io";
import { GamePhase, GameState } from "@hush/shared";

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

/** The single in-memory game state for this prototype. */
const gameState: GameState = {
  players: [],
  ghost: { currentRoom: "foyer", isVisible: false, huntMode: false },
  clues: [],
  phase: GamePhase.LOBBY,
  chapter: 1,
};

io.on("connection", (socket) => {
  console.log(`[socket] connected: ${socket.id}`);

  // Send the current state to the freshly connected client.
  socket.emit("state", gameState);

  socket.on("disconnect", () => {
    console.log(`[socket] disconnected: ${socket.id}`);
  });
});

server.listen(PORT, () => {
  console.log(`hush server listening on http://localhost:${PORT}`);
});
