const express = require("express");
const socketio = require("socket.io");
const app = express();

app.use(express.static(__dirname + "/public"));

const server = app.listen(process.env.PORT || 3000, () =>
  console.log(`Server has started on port ${process.env.PORT || 3000}`)
);

const io = socketio(server);
const sockets = new Set();
const searching = new Set();
const notAvailable = new Set();
const rooms = new Map();

io.on("connection", async (socket) => {
  sockets.add(socket);
  io.emit("numberOfOnline", await io.allSockets().size);

  socket.on("start", (id) => {
    sockets.delete(socket);
    searching.add(socket);

    for (const peer of searching) {
      if (peer.id !== id) {
        searching.delete(peer);
        notAvailable.add(socket, peer);
        const roomName = `${id}#${peer.id}`;
        rooms.set(roomName, new Set([socket, peer]));
        [socket, peer].forEach((s) => {
          s.leaveAll();
          s.join(roomName);
        });
        io.of("/").to(roomName).emit("chatStart", "Bạn đang trò chuyện với một người lạ");
        break;
      }
    }

    socket.emit("searching", "Đang ghép...");
  });

  socket.on("newMessageToServer", (msg) => {
    const [room] = socket.rooms;
    io.of("/").to(room).emit("newMessageToClient", { id: socket.id, msg });
  });

  socket.on("typing", (msg) => {
    const [room, id] = socket.rooms;
    const peer = [...rooms.get(room)].find((s) => s.id !== id);
    peer.emit("strangerIsTyping", msg);
  });

  socket.on("doneTyping", () => {
    const [room, id] = socket.rooms;
    const peer = [...rooms.get(room)].find((s) => s.id !== id);
    peer.emit("strangerIsDoneTyping");
  });

  socket.on("stop", () => {
    const [room, id] = socket.rooms;
    const peer = [...rooms.get(room)].find((s) => s.id !== id);
    peer.leave(room);
    socket.leave(room);
    peer.emit("strangerDisconnected");
  });

  socket.on("disconnect", () => {
    sockets.delete(socket);
    searching.delete(socket);
    notAvailable.delete(socket);
  });
});
