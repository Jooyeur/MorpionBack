import express from "express";
import { Server } from "socket.io";
import http from "http";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { nanoid } from "nanoid";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const games = {};

app.use(express.static(join(__dirname, "../frontend/build")));

app.get("*", (req, res) => {
  res.sendFile(join(__dirname, "../frontend/build", "index.html"));
});

io.on("connection", (socket) => {
  console.log("New client connected");

  socket.on("createGame", () => {
    const gameId = nanoid();
    games[gameId] = {
      players: [socket.id],
      squares: Array(9).fill(null),
      xIsNext: true,
      currentPlayer: socket.id,
    };
    socket.join(gameId);
    socket.emit("gameCreated", { gameId });
  });

  socket.on("joinGame", ({ gameId }) => {
    if (games[gameId] && games[gameId].players.length === 1) {
      games[gameId].players.push(socket.id);
      socket.join(gameId);
      socket.emit("gameJoined", { gameId, playerId: socket.id });
      io.to(gameId).emit("gameUpdate", {
        squares: games[gameId].squares,
        xIsNext: games[gameId].xIsNext,
        currentPlayer: games[gameId].currentPlayer,
      });
    } else {
      socket.emit("error", { message: "Game not found or already full" });
    }
  });

  socket.on("makeMove", ({ gameId, index, value }) => {
    if (
      games[gameId] &&
      games[gameId].squares[index] === null &&
      games[gameId].currentPlayer === socket.id
    ) {
      games[gameId].squares[index] = value;
      games[gameId].xIsNext = !games[gameId].xIsNext;
      games[gameId].currentPlayer = games[gameId].players.find(
        (player) => player !== socket.id
      );
      const winner = calculateWinner(games[gameId].squares);
      io.to(gameId).emit("gameUpdate", {
        squares: games[gameId].squares,
        xIsNext: games[gameId].xIsNext,
        currentPlayer: games[gameId].currentPlayer,
      });
      if (winner) {
        io.to(gameId).emit("statusUpdate", winner);
      }
    }
  });
});

function calculateWinner(squares) {
  const lines = [
    [0, 1, 2],
    [3, 4, 5],
    [6, 7, 8],
    [0, 3, 6],
    [1, 4, 7],
    [2, 5, 8],
    [0, 4, 8],
    [2, 4, 6],
  ];
  for (let i = 0; i < lines.length; i++) {
    const [a, b, c] = lines[i];
    if (squares[a] && squares[a] === squares[b] && squares[a] === squares[c]) {
      return squares[a];
    }
  }
  return null;
}

const port = process.env.PORT || 4000;
server.listen(port, () => console.log(`Server running on port ${port}`));
