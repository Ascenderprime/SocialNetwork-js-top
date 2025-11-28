import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const server = createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

app.use(cors());
app.use(express.json());
app.use(express.static(__dirname));


const users = new Map();
const messages = [];

io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  socket.on('user_join', (userData) => {
    users.set(socket.id, {
      id: socket.id,
      username: userData.username,
      avatar: userData.avatar,
      joinedAt: new Date()
    });

    socket.emit('previous_messages', messages);

    io.emit('users_update', Array.from(users.values()));

    socket.broadcast.emit('user_joined', {
      username: userData.username,
      timestamp: new Date()
    });

    console.log(`${userData.username} joined the chat`);
  });


  socket.on('send_message', (messageData) => {
    const user = users.get(socket.id);
    if (user) {
      const message = {
        id: Date.now() + Math.random(),
        username: user.username,
        avatar: user.avatar,
        text: messageData.text,
        timestamp: new Date(),
        userId: socket.id
      };

      messages.push(message);
      
      if (messages.length > 100) {
        messages.shift();
      }

      io.emit('new_message', message);
    }
  });

  socket.on('typing_start', () => {
    const user = users.get(socket.id);
    if (user) {
      socket.broadcast.emit('user_typing', {
        username: user.username,
        isTyping: true
      });
    }
  });

  socket.on('typing_stop', () => {
    const user = users.get(socket.id);
    if (user) {
      socket.broadcast.emit('user_typing', {
        username: user.username,
        isTyping: false
      });
    }
  });


  socket.on('disconnect', () => {
    const user = users.get(socket.id);
    if (user) {
      users.delete(socket.id);
      
      io.emit('users_update', Array.from(users.values()));
      
      socket.broadcast.emit('user_left', {
        username: user.username,
        timestamp: new Date()
      });

      console.log(`${user.username} left the chat`);
    }
  });
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`🚀 Chat server running on http://localhost:${PORT}`);
});