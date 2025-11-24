// server.js

// ===============================================
// 1. ИМПОРТЫ
// ===============================================
const express = require('express');
const http = require('http');
const mongoose = require('mongoose');
const path = require('path');
const dotenv = require('dotenv');
const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');

// Загрузка переменных окружения из .env
dotenv.config();

// ===============================================
// 2. КОНФИГУРАЦИЯ
// ===============================================
const app = express();
const server = http.createServer(app);
const io = new Server(server); 
const PORT = process.env.PORT || 10000;
const JWT_SECRET = process.env.JWT_SECRET || 'your_secret_key_for_social_network'; 

// ===============================================
// 3. MIDDLEWARE
// ===============================================
app.use(express.json());

// Настройка статических файлов: Express будет искать index.html, client.js и style.css 
// в корневой папке проекта (поскольку вы их там размещаете).
app.use(express.static(path.join(__dirname))); 

// ===============================================
// 4. СХЕМЫ И МОДЕЛИ MONGODB
// ===============================================

const UserSchema = new mongoose.Schema({
    username: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    bio: String,
    avatarUrl: String,
    bannerUrl: String,
    followers: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    following: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
});

UserSchema.virtual('followersCount').get(function() { return this.followers.length; });
UserSchema.virtual('followingCount').get(function() { return this.following.length; });

const PostSchema = new mongoose.Schema({
    authorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    authorUsername: String, 
    content: { type: String, required: true },
    likes: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    createdAt: { type: Date, default: Date.now },
});

const ChatSchema = new mongoose.Schema({
    participants: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    isGroup: { type: Boolean, default: false },
    chatName: String,
    lastMessage: String,
    updatedAt: { type: Date, default: Date.now }
});

const MessageSchema = new mongoose.Schema({
    chatId: { type: mongoose.Schema.Types.ObjectId, ref: 'Chat', required: true },
    senderId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    content: { type: String, required: true },
    createdAt: { type: Date, default: Date.now }
});

const CommentSchema = new mongoose.Schema({
    postId: { type: mongoose.Schema.Types.ObjectId, ref: 'Post', required: true },
    authorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    authorUsername: String,
    content: { type: String, required: true },
    createdAt: { type: Date, default: Date.now }
});

const User = mongoose.model('User', UserSchema);
const Post = mongoose.model('Post', PostSchema);
const Chat = mongoose.model('Chat', ChatSchema);
const Message = mongoose.model('Message', MessageSchema);
const Comment = mongoose.model('Comment', CommentSchema);


// ===============================================
// 5. ФУНКЦИИ АВТОРИЗАЦИИ И МИДДЛВАРЫ
// ===============================================

const generateToken = (user) => {
    return jwt.sign({ id: user._id, username: user.username }, JWT_SECRET, { expiresIn: '7d' });
};

const authMiddleware = async (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({ message: 'Нет токена авторизации' });
        }
        
        const token = authHeader.split(' ')[1];
        const decoded = jwt.verify(token, JWT_SECRET);
        
        req.userId = decoded.id;
        req.username = decoded.username;
        
        next();
    } catch (error) {
        return res.status(401).json({ message: 'Недействительный токен' });
    }
};

// ===============================================
// 6. МАРШРУТЫ (ROUTES)
// ===============================================

// AUTH ROUTES
app.post('/api/register', async (req, res) => {
    const { username, password } = req.body;
    try {
        let user = await User.findOne({ username });
        if (user) return res.status(400).json({ message: 'Пользователь уже существует' });
        
        // В реальном приложении: const hashedPassword = await bcrypt.hash(password, 10);
        user = new User({ username, password }); // Пароль хранится как plain text для упрощения
        await user.save();
        
        const token = generateToken(user);
        res.json({ token, user: { id: user._id, username: user.username } });
    } catch (error) {
        res.status(500).json({ message: 'Ошибка сервера' });
    }
});

app.post('/api/login', async (req, res) => {
    const { username, password } = req.body;
    try {
        const user = await User.findOne({ username });
        if (!user) return res.status(400).json({ message: 'Неверный логин или пароль' });
        
        // В реальном приложении: const isMatch = await bcrypt.compare(password, user.password);
        if (user.password !== password) return res.status(400).json({ message: 'Неверный логин или пароль' });
        
        const token = generateToken(user);
        res.json({ token, user: { id: user._id, username: user.username } });
    } catch (error) {
        res.status(500).json({ message: 'Ошибка сервера' });
    }
});


// POST ROUTES
app.post('/api/posts', authMiddleware, async (req, res) => {
    const { content } = req.body;
    try {
        const post = new Post({ 
            authorId: req.userId, 
            authorUsername: req.username, 
            content 
        });
        await post.save();
        // Отправляем новый пост всем через сокет
        io.emit('new post', post); 
        res.status(201).json(post);
    } catch (error) {
        res.status(500).json({ message: 'Ошибка создания поста' });
    }
});

app.get('/api/feed', authMiddleware, async (req, res) => {
    try {
        const posts = await Post.find().sort({ createdAt: -1 });
        res.json(posts);
    } catch (error) {
        res.status(500).json({ message: 'Ошибка загрузки ленты' });
    }
});

app.post('/api/posts/:postId/like', authMiddleware, async (req, res) => {
    try {
        const post = await Post.findById(req.params.postId);
        if (!post) return res.status(404).json({ message: 'Пост не найден' });

        const isLiked = post.likes.includes(req.userId);
        if (isLiked) {
            post.likes.pull(req.userId);
        } else {
            post.likes.push(req.userId);
        }
        await post.save();

        io.emit('post liked', { postId: post._id, likes: post.likes.length }); 
        res.json({ likes: post.likes.length });
    } catch (error) {
        res.status(500).json({ message: 'Ошибка лайка' });
    }
});


// COMMENT ROUTES
app.post('/api/posts/:postId/comments', authMiddleware, async (req, res) => {
    const { content } = req.body;
    try {
        const comment = new Comment({
            postId: req.params.postId,
            authorId: req.userId,
            authorUsername: req.username,
            content
        });
        await comment.save();
        io.emit('new comment', comment); 
        res.status(201).json(comment);
    } catch (error) {
        res.status(500).json({ message: 'Ошибка создания комментария' });
    }
});

app.get('/api/posts/:postId/comments', authMiddleware, async (req, res) => {
    try {
        const comments = await Comment.find({ postId: req.params.postId }).sort({ createdAt: 1 });
        res.json(comments);
    } catch (error) {
        res.status(500).json({ message: 'Ошибка загрузки комментариев' });
    }
});


// PROFILE ROUTES
app.get('/api/profile/:username', authMiddleware, async (req, res) => {
    try {
        const user = await User.findOne({ username: req.params.username }).select('-password -__v');
        if (!user) return res.status(404).json({ message: 'Пользователь не найден' });

        const isFollowing = user.followers.includes(req.userId);
        
        const userObject = user.toObject({ virtuals: true });

        res.json({ user: userObject, isFollowing });
    } catch (error) {
        res.status(500).json({ message: 'Ошибка загрузки профиля' });
    }
});

app.put('/api/profile', authMiddleware, async (req, res) => {
    const { bio, avatarUrl, bannerUrl } = req.body;
    try {
        const user = await User.findByIdAndUpdate(req.userId, { bio, avatarUrl, bannerUrl }, { new: true });
        res.json({ message: 'Профиль обновлен', user });
    } catch (error) {
        res.status(500).json({ message: 'Ошибка обновления профиля' });
    }
});

app.post('/api/follow/:targetUserId/:action', authMiddleware, async (req, res) => {
    const { targetUserId, action } = req.params;
    try {
        const currentUser = await User.findById(req.userId);
        const targetUser = await User.findById(targetUserId);

        if (!targetUser) return res.status(404).json({ message: 'Пользователь не найден' });
        if (currentUser._id.toString() === targetUser._id.toString()) {
            return res.status(400).json({ message: 'Нельзя подписаться на себя' });
        }

        const isFollowing = currentUser.following.includes(targetUserId);

        if (action === 'follow' && !isFollowing) {
            currentUser.following.push(targetUserId);
            targetUser.followers.push(req.userId);
        } else if (action === 'unfollow' && isFollowing) {
            currentUser.following.pull(targetUserId);
            targetUser.followers.pull(req.userId);
        }
        
        await currentUser.save();
        await targetUser.save();
        res.json({ message: action === 'follow' ? 'Подписка оформлена' : 'Подписка отменена' });

    } catch (error) {
        res.status(500).json({ message: 'Ошибка подписки/отписки' });
    }
});

app.get('/api/following/:username', authMiddleware, async (req, res) => {
    try {
        const user = await User.findOne({ username: req.params.username }).populate('following', 'username avatarUrl');
        if (!user) return res.status(404).json({ message: 'Пользователь не найден' });
        res.json(user.following);
    } catch (error) {
        res.status(500).json({ message: 'Ошибка загрузки подписок' });
    }
});


// CHAT ROUTES
app.post('/api/chats/findOrCreate', authMiddleware, async (req, res) => {
    const { targetUserId } = req.body;
    const participants = [req.userId, targetUserId].sort();
    try {
        let chat = await Chat.findOne({
            participants: { $all: participants },
            isGroup: false 
        });

        if (!chat) {
            chat = new Chat({ participants, isGroup: false });
            await chat.save();
        }
        res.json({ chat });
    } catch (error) {
        res.status(500).json({ message: 'Ошибка создания чата' });
    }
});

app.get('/api/chats', authMiddleware, async (req, res) => {
    try {
        const chats = await Chat.find({ participants: req.userId })
            .populate('participants', 'username avatarUrl') 
            .sort({ updatedAt: -1 });
        
        const clientChats = await Promise.all(chats.map(async (chat) => {
            const lastMsg = await Message.findOne({ chatId: chat._id }).sort({ createdAt: -1 });
            return {
                ...chat.toObject(),
                lastMessage: lastMsg ? lastMsg.content : 'Нет сообщений',
            };
        }));

        res.json(clientChats);
    } catch (error) {
        res.status(500).json({ message: 'Ошибка загрузки чатов' });
    }
});

app.get('/api/chats/:chatId/messages', authMiddleware, async (req, res) => {
    try {
        const messages = await Message.find({ chatId: req.params.chatId }).sort({ createdAt: 1 });
        res.json(messages);
    } catch (error) {
        res.status(500).json({ message: 'Ошибка загрузки сообщений' });
    }
});


// ===============================================
// 7. SOCKET.IO (СОКЕТЫ)
// ===============================================

const onlineUsers = {};

io.on('connection', (socket) => {
    // Регистрация пользователя
    socket.on('register user', (userId) => {
        onlineUsers[userId] = socket.id;
    });

    // Присоединение к чату
    socket.on('join chat', (chatId) => {
        socket.join(chatId);
    });

    // Выход из чата
    socket.on('leave chat', (chatId) => {
        socket.leave(chatId);
    });

    // Отправка сообщения
    socket.on('send message', async (messageData) => {
        try {
            const message = new Message(messageData);
            await message.save();
            
            // Обновляем последнее сообщение и дату чата
            await Chat.findByIdAndUpdate(messageData.chatId, { 
                lastMessage: messageData.content,
                updatedAt: Date.now()
            });

            // Отправляем сообщение всем участникам чата
            io.to(messageData.chatId).emit('receive message', message);

            // Оповещаем участников об обновлении списка чатов
            const chat = await Chat.findById(messageData.chatId);
            chat.participants.forEach(participantId => {
                const socketId = onlineUsers[participantId.toString()];
                if (socketId) {
                    io.to(socketId).emit('update chat list', { chatId: messageData.chatId });
                }
            });

        } catch (error) {
            console.error('Socket error processing message:', error);
        }
    });

    // Отключение
    socket.on('disconnect', () => {
        for (const userId in onlineUsers) {
            if (onlineUsers[userId] === socket.id) {
                delete onlineUsers[userId];
                break;
            }
        }
    });
});


// ===============================================
// 8. ЗАПУСК СЕРВЕРА
// ===============================================

// **ВСТАВЛЕН ВАШ РАБОЧИЙ URL С ПАРОЛЕМ 'r123321a'**
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://bye_bye:r123321a@momento.gex5zgk.mongodb.net/?appName=Momento';

mongoose.connect(MONGODB_URI)
    .then(() => {
        console.log('✅ MongoDB подключена успешно!');
        
        // Запуск сервера только после успешного подключения к БД
        server.listen(PORT, () => {
            console.log(`🚀 Сервер запущен на http://localhost:${PORT}`);
        });

    })
    .catch(err => {
        console.error('❌ Ошибка подключения к MongoDB:', err.message);
        console.error('Проверьте ваш URL, пароль и Network Access в MongoDB Atlas.');
    });