# Hush

A cooperative horror web game. Built as an npm-workspaces monorepo.

## Structure

```
hush/
├── client/   React + TypeScript + Vite (Tailwind, react-router, socket.io-client)
├── server/   Node.js + Express + TypeScript (socket.io, cors, ts-node)
└── shared/   TypeScript domain types shared by client and server
```

## Getting started

```bash
npm install        # installs all workspaces
npm run dev        # runs server (:3001) and client (:5173) together
```

Run individually:

```bash
npm run dev:server
npm run dev:client
```

## Shared types

Domain types live in `shared/types.ts` (`Player`, `Ghost`, `Clue`, `GameState`,
and the `GamePhase` enum) and are imported via the `@hush/shared` alias from
both the client and the server.
