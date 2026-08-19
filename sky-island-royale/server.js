import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer);

// index.htmlなどを配信
app.use(express.static(__dirname));

// 「/」にアクセスしたらindex.htmlを表示
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

io.on("connection", (socket) => {
  console.log("プレイヤー接続:", socket.id);

  socket.on("disconnect", () => {
    console.log("プレイヤー切断:", socket.id);
  });
});

const PORT = process.env.PORT || 3000;

httpServer.listen(PORT, () => {
  console.log(`ゲームサーバー起動: http://localhost:${PORT}`);
});