// server.js
import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

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

// JWT секрет
const JWT_SECRET = process.env.JWT_SECRET || 'chat-app-secret-key-2024';

// База данных в памяти
class MemoryDatabase {
  constructor() {
    this.users = new Map(); // userId -> user data
    this.usernameMap = new Map(); // username -> userId
    this.messages = [];
    this.nextUserId = 1;
    this.userSessions = new Map(); // socketId -> userId
  }

  async createUser(username, avatar, password = null) {
    // Проверяем существование пользователя
    if (this.usernameMap.has(username)) {
      throw new Error('Пользователь уже существует');
    }

    const hashedPassword = password ? await bcrypt.hash(password, 10) : null;
    
    const user = {
      id: this.nextUserId,
      username,
      avatar,
      password: hashedPassword,
      created_at: new Date(),
      is_online: false,
      socket_id: null,
      last_seen: new Date()
    };

    this.users.set(this.nextUserId, user);
    this.usernameMap.set(username, this.nextUserId);
    this.nextUserId++;
    
    return user;
  }

  getUserByUsername(username) {
    const userId = this.usernameMap.get(username);
    return userId ? this.users.get(userId) : null;
  }

  async getUserById(id) {
    return this.users.get(parseInt(id));
  }

  async updateUserOnlineStatus(userId, isOnline, socketId = null) {
    const user = await this.getUserById(userId);
    if (user) {
      user.is_online = isOnline;
      user.socket_id = socketId;
      user.last_seen = new Date();
      
      if (socketId) {
        this.userSessions.set(socketId, userId);
      }
    }
  }

  async getAllOnlineUsers() {
    const onlineUsers = [];
    for (const [userId, user] of this.users.entries()) {
      if (user.is_online) {
        onlineUsers.push({
          id: user.id,
          username: user.username,
          avatar: user.avatar,
          created_at: user.created_at,
          last_seen: user.last_seen
        });
      }
    }
    return onlineUsers;
  }

  async getAllUsers() {
    const allUsers = [];
    for (const user of this.users.values()) {
      allUsers.push({
        id: user.id,
        username: user.username,
        avatar: user.avatar,
        created_at: user.created_at,
        is_online: user.is_online,
        last_seen: user.last_seen
      });
    }
    return allUsers;
  }

  async saveMessage(senderId, text, isSticker = false, roomType = 'global', receiverId = null) {
    const message = {
      id: Date.now(),
      sender_id: parseInt(senderId),
      text,
      is_sticker: isSticker,
      room_type: roomType,
      receiver_id: receiverId ? parseInt(receiverId) : null,
      created_at: new Date(),
      read_status: false
    };

    this.messages.push(message);
    
    // Ограничиваем историю
    if (this.messages.length > 1000) {
      this.messages.shift();
    }

    return message;
  }

  async getGlobalMessages(limit = 100) {
    const globalMessages = this.messages
      .filter(msg => msg.room_type === 'global')
      .slice(-limit)
      .map(msg => {
        const user = this.users.get(msg.sender_id);
        return {
          ...msg,
          username: user?.username || 'Неизвестный',
          avatar: user?.avatar || '👤'
        };
      });

    return globalMessages;
  }

  async getPrivateMessages(user1Id, user2Id, limit = 100) {
    const id1 = parseInt(user1Id);
    const id2 = parseInt(user2Id);
    
    const privateMessages = this.messages
      .filter(msg => 
        msg.room_type === 'private' && 
        ((msg.sender_id === id1 && msg.receiver_id === id2) ||
         (msg.sender_id === id2 && msg.receiver_id === id1))
      )
      .slice(-limit)
      .map(msg => {
        const user = this.users.get(msg.sender_id);
        return {
          ...msg,
          username: user?.username || 'Неизвестный',
          avatar: user?.avatar || '👤'
        };
      });

    return privateMessages;
  }

  async markMessagesAsRead(senderId, receiverId) {
    const sender = parseInt(senderId);
    const receiver = parseInt(receiverId);
    
    this.messages.forEach(msg => {
      if (msg.sender_id === sender && msg.receiver_id === receiver) {
        msg.read_status = true;
      }
    });
  }

  async getUnreadCount(userId) {
    const id = parseInt(userId);
    return this.messages.filter(msg => 
      msg.receiver_id === id && !msg.read_status
    ).length;
  }

  getUserBySocketId(socketId) {
    const userId = this.userSessions.get(socketId);
    return userId ? this.users.get(userId) : null;
  }

  removeUserSession(socketId) {
    const userId = this.userSessions.get(socketId);
    if (userId) {
      const user = this.users.get(userId);
      if (user) {
        user.is_online = false;
        user.socket_id = null;
      }
      this.userSessions.delete(socketId);
    }
  }
}

const db = new MemoryDatabase();

// API для регистрации
app.post('/api/register', async (req, res) => {
  try {
    const { username, avatar, email, password } = req.body;

    if (!username || !avatar) {
      return res.status(400).json({ error: 'Имя пользователя и аватар обязательны' });
    }

    // Проверка минимальной длины пароля
    if (password && password.length < 6) {
      return res.status(400).json({ error: 'Пароль должен содержать минимум 6 символов' });
    }

    // Создаем пользователя
    const user = await db.createUser(username, avatar, password);
    
    // Создаем JWT токен
    const token = jwt.sign({ userId: user.id, username }, JWT_SECRET, { expiresIn: '7d' });

    res.json({ 
      success: true, 
      token,
      user: { id: user.id, username, avatar }
    });
  } catch (error) {
    console.error('Registration error:', error.message);
    if (error.message === 'Пользователь уже существует') {
      return res.status(400).json({ error: error.message });
    }
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// API для входа
app.post('/api/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: 'Имя пользователя и пароль обязательны' });
    }

    // Находим пользователя
    const user = db.getUserByUsername(username);
    if (!user) {
      return res.status(401).json({ error: 'Неверные учетные данные' });
    }

    // Проверяем пароль
    if (user.password) {
      const validPassword = await bcrypt.compare(password, user.password);
      if (!validPassword) {
        return res.status(401).json({ error: 'Неверные учетные данные' });
      }
    } else {
      // Если у пользователя нет пароля (старые записи)
      return res.status(401).json({ error: 'Неверные учетные данные' });
    }

    // Создаем JWT токен
    const token = jwt.sign({ userId: user.id, username: user.username }, JWT_SECRET, { expiresIn: '7d' });

    res.json({ 
      success: true, 
      token,
      user: { 
        id: user.id, 
        username: user.username, 
        avatar: user.avatar 
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// API для проверки токена
app.post('/api/verify-token', async (req, res) => {
  try {
    const { token } = req.body;
    
    if (!token) {
      return res.status(401).json({ error: 'Токен отсутствует' });
    }

    const decoded = jwt.verify(token, JWT_SECRET);
    
    const user = await db.getUserById(decoded.userId);
    if (!user) {
      return res.status(401).json({ error: 'Пользователь не найден' });
    }

    res.json({ 
      success: true, 
      user: { 
        id: user.id, 
        username: user.username, 
        avatar: user.avatar 
      }
    });
  } catch (error) {
    console.error('Token verification error:', error.message);
    res.status(401).json({ error: 'Неверный токен' });
  }
});

// API для получения информации о сервере
app.get('/api/info', (req, res) => {
  const onlineCount = Array.from(db.users.values()).filter(user => user.is_online).length;
  res.json({
    status: 'online',
    users: onlineCount,
    total_users: db.users.size,
    timestamp: new Date().toISOString()
  });
});

// API для получения всех пользователей
app.get('/api/users', async (req, res) => {
  try {
    const allUsers = await db.getAllUsers();
    res.json(allUsers);
  } catch (error) {
    console.error('Error getting users:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// API для получения профиля пользователя
app.get('/api/user/:id', async (req, res) => {
  try {
    const userId = parseInt(req.params.id);
    const user = await db.getUserById(userId);
    
    if (!user) {
      return res.status(404).json({ error: 'Пользователь не найден' });
    }

    res.json({
      id: user.id,
      username: user.username,
      avatar: user.avatar,
      created_at: user.created_at,
      is_online: user.is_online,
      last_seen: user.last_seen
    });
  } catch (error) {
    console.error('Error getting user profile:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// Middleware для проверки JWT в Socket.IO
const authenticateSocket = (socket, next) => {
  const token = socket.handshake.auth.token;
  
  if (!token) {
    return next(new Error('Требуется авторизация'));
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    socket.userId = decoded.userId;
    socket.username = decoded.username;
    next();
  } catch (error) {
    console.error('Socket auth error:', error.message);
    return next(new Error('Неверный токен'));
  }
};

// Socket.IO с аутентификацией
io.use(authenticateSocket);

// Map для хранения активных соединений
const socketToUserMap = new Map(); // socket.id -> {userId, username}

io.on('connection', async (socket) => {
  const userId = socket.userId;
  const username = socket.username;

  console.log(`✅ Подключен пользователь: ${username} (ID: ${userId}, Socket: ${socket.id})`);

  try {
    // Обновляем статус пользователя
    await db.updateUserOnlineStatus(userId, true, socket.id);
    
    // Сохраняем информацию о соединении
    socketToUserMap.set(socket.id, { userId, username });

    // Получаем данные пользователя
    const user = await db.getUserById(userId);
    if (!user) {
      socket.emit('error', { message: 'Пользователь не найден' });
      socket.disconnect();
      return;
    }

    // Отправляем предыдущие сообщения общего чата
    const globalMessages = await db.getGlobalMessages(50);
    socket.emit('previous_messages', globalMessages.map(msg => ({
      id: msg.id,
      username: msg.username,
      avatar: msg.avatar,
      text: msg.text,
      timestamp: msg.created_at,
      userId: msg.sender_id,
      isSticker: msg.is_sticker
    })));

    // Получаем онлайн пользователей
    const onlineUsers = await db.getAllOnlineUsers();
    io.emit('users_update', onlineUsers.map(user => ({
      id: user.id,
      username: user.username,
      avatar: user.avatar,
      joinedAt: user.created_at,
      isOnline: true
    })));

    // Уведомляем всех о новом пользователе
    socket.broadcast.emit('user_joined', {
      username: username,
      timestamp: new Date()
    });

    // Обработка отправки сообщения в общий чат
    socket.on('send_message', async (messageData) => {
      try {
        const message = await db.saveMessage(
          userId, 
          messageData.text, 
          messageData.isSticker || false, 
          'global'
        );

        const savedMessage = {
          id: message.id,
          username: user.username,
          avatar: user.avatar,
          text: messageData.text,
          timestamp: message.created_at,
          userId: userId,
          isSticker: messageData.isSticker || false
        };

        io.emit('new_message', savedMessage);
        console.log(`💬 ${username}: ${messageData.text.substring(0, 50)}${messageData.text.length > 50 ? '...' : ''}`);
      } catch (error) {
        console.error('Error saving message:', error);
        socket.emit('error', { message: 'Ошибка отправки сообщения' });
      }
    });

    // Начало приватного чата - исправленная версия
    socket.on('start_private_chat', async (targetUserId) => {
      try {
        console.log(`🔒 ${username} запрашивает приватный чат с пользователем ID: ${targetUserId}`);
        
        const targetUser = await db.getUserById(targetUserId);
        if (!targetUser) {
          console.error(`Пользователь с ID ${targetUserId} не найден`);
          socket.emit('error', { message: 'Пользователь не найден' });
          return;
        }

        console.log(`Найден пользователь: ${targetUser.username}`);

        // Получаем историю приватных сообщений
        const privateMessages = await db.getPrivateMessages(userId, targetUserId, 50);
        
        console.log(`Найдено приватных сообщений: ${privateMessages.length}`);
        
        // Форматируем сообщения для клиента
        const formattedMessages = privateMessages.map(msg => {
          const isFromCurrentUser = msg.sender_id === parseInt(userId);
          return {
            id: msg.id,
            from: {
              id: msg.sender_id,
              username: msg.username,
              avatar: msg.avatar
            },
            to: {
              id: isFromCurrentUser ? targetUser.id : userId,
              username: isFromCurrentUser ? targetUser.username : user.username,
              avatar: isFromCurrentUser ? targetUser.avatar : user.avatar
            },
            text: msg.text,
            timestamp: msg.created_at,
            isSticker: msg.is_sticker,
            read: msg.read_status
          };
        });

        // Отправляем историю чата клиенту
        socket.emit('private_messages_history', {
          targetUser: {
            id: targetUser.id,
            username: targetUser.username,
            avatar: targetUser.avatar
          },
          messages: formattedMessages
        });

        console.log(`✅ История приватного чата отправлена ${username}`);

        // Уведомляем другого пользователя, если он онлайн
        const targetSocketId = Array.from(socketToUserMap.entries())
          .find(([_, userData]) => userData.userId === parseInt(targetUserId))?.[0];
        
        if (targetSocketId) {
          console.log(`Уведомляем ${targetUser.username} об открытии чата`);
          io.to(targetSocketId).emit('private_chat_opened', {
            userId: userId,
            username: username
          });
        }
      } catch (error) {
        console.error('Error starting private chat:', error);
        socket.emit('error', { message: 'Ошибка открытия приватного чата' });
      }
    });

    // Отправка приватного сообщения - исправленная версия
    socket.on('send_private_message', async (data) => {
      try {
        console.log(`🔐 ${username} отправляет приватное сообщение пользователю ID: ${data.targetUserId}`);
        
        const targetUser = await db.getUserById(data.targetUserId);
        if (!targetUser) {
          socket.emit('error', { message: 'Пользователь не найден' });
          return;
        }

        const message = await db.saveMessage(
          userId, 
          data.text, 
          data.isSticker || false, 
          'private', 
          data.targetUserId
        );

        const messageObj = {
          id: message.id,
          from: {
            id: parseInt(userId),
            username: user.username,
            avatar: user.avatar
          },
          to: {
            id: parseInt(data.targetUserId),
            username: targetUser.username,
            avatar: targetUser.avatar
          },
          text: data.text,
          timestamp: message.created_at,
          isSticker: data.isSticker || false,
          read: false
        };

        console.log(`Создано приватное сообщение: ${JSON.stringify(messageObj, null, 2)}`);

        // Отправляем получателю
        const targetSocketId = Array.from(socketToUserMap.entries())
          .find(([_, userData]) => userData.userId === parseInt(data.targetUserId))?.[0];
        
        if (targetSocketId) {
          console.log(`Отправляем сообщение ${targetUser.username} (Socket: ${targetSocketId})`);
          io.to(targetSocketId).emit('new_private_message', messageObj);
        }

        // Отправляем обратно отправителю
        socket.emit('new_private_message', messageObj);

        console.log(`✅ Приватное сообщение отправлено: ${user.username} -> ${targetUser.username}`);

        // Обновляем счетчик непрочитанных
        const unreadCount = await db.getUnreadCount(data.targetUserId);
        if (targetSocketId) {
          io.to(targetSocketId).emit('unread_update', {
            userId: userId,
            count: unreadCount
          });
        }
      } catch (error) {
        console.error('Error sending private message:', error);
        socket.emit('error', { message: 'Ошибка отправки приватного сообщения' });
      }
    });

    // Пометка сообщений как прочитанных
    socket.on('mark_as_read', async (targetUserId) => {
      try {
        await db.markMessagesAsRead(targetUserId, userId);
        
        // Уведомляем отправителя
        const targetSocketId = Array.from(socketToUserMap.entries())
          .find(([_, userData]) => userData.userId === parseInt(targetUserId))?.[0];
        
        if (targetSocketId) {
          io.to(targetSocketId).emit('unread_cleared', { userId: userId });
        }
      } catch (error) {
        console.error('Error marking messages as read:', error);
      }
    });

    // Запрос профиля пользователя - исправленная версия
    socket.on('get_user_profile', async (targetUserId) => {
      try {
        console.log(`📋 ${username} запрашивает профиль пользователя ID: ${targetUserId}`);
        
        const targetUser = await db.getUserById(targetUserId);
        if (targetUser) {
          const profileData = {
            id: targetUser.id,
            username: targetUser.username,
            avatar: targetUser.avatar,
            online: targetUser.is_online,
            joinedAt: targetUser.created_at,
            lastSeen: targetUser.last_seen
          };
          
          console.log(`Отправляем профиль пользователя: ${JSON.stringify(profileData, null, 2)}`);
          socket.emit('user_profile', profileData);
        } else {
          console.error(`Пользователь с ID ${targetUserId} не найден`);
          socket.emit('error', { message: 'Пользователь не найден' });
        }
      } catch (error) {
        console.error('Error getting user profile:', error);
        socket.emit('error', { message: 'Ошибка получения профиля' });
      }
    });

    // Начало печати
    socket.on('typing_start', () => {
      socket.broadcast.emit('user_typing', {
        username: username,
        isTyping: true
      });
    });

    // Окончание печати
    socket.on('typing_stop', () => {
      socket.broadcast.emit('user_typing', {
        username: username,
        isTyping: false
      });
    });

    // Обработка отключения
    socket.on('disconnect', async () => {
      try {
        console.log(`❌ Отключен пользователь: ${username} (Socket: ${socket.id})`);

        // Обновляем статус в БД
        await db.updateUserOnlineStatus(userId, false);
        db.removeUserSession(socket.id);
        socketToUserMap.delete(socket.id);

        // Получаем актуальный список онлайн пользователей
        const onlineUsers = await db.getAllOnlineUsers();
        io.emit('users_update', onlineUsers.map(user => ({
          id: user.id,
          username: user.username,
          avatar: user.avatar,
          joinedAt: user.created_at,
          isOnline: true
        })));

        // Уведомляем о выходе
        socket.broadcast.emit('user_left', {
          username: username,
          timestamp: new Date()
        });

      } catch (error) {
        console.error('Error on disconnect:', error);
      }
    });

    // Обработка ошибок
    socket.on('error', (error) => {
      console.error('Socket error:', error);
    });

  } catch (error) {
    console.error('Connection setup error:', error);
    socket.emit('error', { message: 'Ошибка подключения' });
    socket.disconnect();
  }
});

// Обслуживание статических файлов
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.get('/styles.css', (req, res) => {
  res.sendFile(path.join(__dirname, 'styles.css'));
});

app.get('/script.js', (req, res) => {
  res.sendFile(path.join(__dirname, 'script.js'));
});

app.get('/auth.js', (req, res) => {
  res.sendFile(path.join(__dirname, 'auth.js'));
});

// Обработка 404
app.use((req, res) => {
  res.status(404).json({ error: 'Страница не найдена' });
});

// Запуск сервера
const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`🚀 Сервер чата запущен: http://localhost:${PORT}`);
  console.log(`🔐 JWT Secret установлен`);
  console.log(`📊 Используется база данных в памяти`);
  console.log(`👥 Готов к подключению пользователей...`);
});

// Обработка завершения приложения
process.on('SIGINT', () => {
  console.log('\n👋 Выключение сервера...');
  process.exit(0);
});