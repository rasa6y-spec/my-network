const express = require('express');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const cors = require('cors');
const http = require('http');
const { Server } = require("socket.io");
const dotenv = require('dotenv');

// Загрузка переменных окружения (для SECRET)
dotenv.config(); 

const app = express();
const server = http.createServer(app);

// Используем порт 10000, как вы указали, или тот, который даст хостинг
const PORT = process.env.PORT || 10000;
const JWT_SECRET = process.env.JWT_SECRET || 'your_secret_key_for_testing';

// ===============================================
// 1. КОНФИГУРАЦИЯ
// ===============================================
app.use(cors());
app.use(express.json());
app.use(express.static('C:\\Users\\Admin\\Desktop\\python')); // Раздача статики

// Ссылка на вашу базу данных MongoDB (используем прямую ссылку с паролем)
// **ВНИМАНИЕ: ЗАМЕНИТЕ ЭТУ СТРОКУ НА СВОЮ АКТУАЛЬНУЮ ИНФОРМАЦИЮ, ЕСЛИ ВАША БАЗА ИЗМЕНИЛАСЬ**
const MONGO_URI = "mongodb+srv://admin:r123321a@cluster0.b96nrmf.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0";

// ===============================================
// 2. ПОДКЛЮЧЕНИЕ К MONGODB
// ===============================================
mongoose.connect(MONGO_URI)
    .then(() => console.log('✅ MongoDB подключена успешно!'))
    .catch(err => console.error('❌ Ошибка подключения MongoDB:', err));

// ===============================================
// 3. СХЕМЫ И МОДЕЛИ
// ===============================================

// --- Схема Пользователя ---
const DEFAULT_AVATAR = 'https://i.ibb.co/L8229Fq/default-avatar.png';
const DEFAULT_BANNER = 'https://i.ibb.co/2P157M4/default-banner.png';

const UserSchema = new mongoose.Schema({
    username: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    bio: { type: String, default: 'Пользователь Momento.' },
    avatarUrl: { type: String, default: DEFAULT_AVATAR },
    bannerUrl: { type: String, default: DEFAULT_BANNER },
    // НОВЫЕ ПОЛЯ ДЛЯ ПОДПИСКИ
    following: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }], 
    followers: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }]  
});

const User = mongoose.model('User', UserSchema);

// --- Схема Поста ---
const PostSchema = new mongoose.Schema({
    author: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    content: { type: String, required: true },
    createdAt: { type: Date, default: Date.now },
    likes: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
});

const Post = mongoose.model('Post', PostSchema);

// --- Схема Комментария ---
const CommentSchema = new mongoose.Schema({
    postId: { type: mongoose.Schema.Types.ObjectId, ref: 'Post', required: true },
    author: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    content: { type: String, required: true },
    createdAt: { type: Date, default: Date.now },
});

const Comment = mongoose.model('Comment', CommentSchema);

// --- Схема Чата ---
const ChatSchema = new mongoose.Schema({
    participants: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    lastMessage: { type: String, default: '' },
    updatedAt: { type: Date, default: Date.now }
});

const Chat = mongoose.model('Chat', ChatSchema);

// --- Схема Сообщения ---
const MessageSchema = new mongoose.Schema({
    chatId: { type: mongoose.Schema.Types.ObjectId, ref: 'Chat', required: true },
    senderId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    content: { type: String, required: true },
    createdAt: { type: Date, default: Date.now }
});

const Message = mongoose.model('Message', MessageSchema);


// ===============================================
// 4. МИДДЛВАРЫ АУТЕНТИФИКАЦИИ
// ===============================================
const isAuthenticated = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    if (!authHeader) return res.status(401).json({ message: 'Нет токена авторизации.' });

    const token = authHeader.split(' ')[1];
    if (!token) return res.status(401).json({ message: 'Формат токена неверен.' });

    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        req.session = { userId: decoded.userId };
        next();
    } catch (error) {
        return res.status(403).json({ message: 'Недействительный токен.' });
    }
};

// ===============================================
// 5. РОУТЫ АУТЕНТИФИКАЦИИ
// ===============================================

// Роут регистрации
app.post('/api/register', async (req, res) => {
    try {
        const { username, password } = req.body;
        
        const existingUser = await User.findOne({ username });
        if (existingUser) {
            return res.status(400).json({ message: 'Пользователь с таким именем уже существует.' });
        }

        const hashedPassword = await bcrypt.hash(password, 10);
        const user = new User({ username, password: hashedPassword });
        await user.save();

        const token = jwt.sign({ userId: user._id }, JWT_SECRET, { expiresIn: '1d' });
        res.status(201).json({ 
            message: 'Регистрация успешна', 
            token, 
            user: { username: user.username, id: user._id } 
        });
    } catch (error) {
        res.status(500).json({ message: 'Ошибка сервера при регистрации.' });
    }
});

// Роут входа
app.post('/api/login', async (req, res) => {
    try {
        const { username, password } = req.body;
        const user = await User.findOne({ username });

        if (!user || !await bcrypt.compare(password, user.password)) {
            return res.status(400).json({ message: 'Неверное имя пользователя или пароль.' });
        }

        const token = jwt.sign({ userId: user._id }, JWT_SECRET, { expiresIn: '1d' });
        res.json({ 
            message: 'Вход успешен', 
            token, 
            user: { 
                username: user.username, 
                id: user._id, 
                bio: user.bio, 
                avatarUrl: user.avatarUrl,
                bannerUrl: user.bannerUrl
            } 
        });
    } catch (error) {
        res.status(500).json({ message: 'Ошибка сервера при входе.' });
    }
});

// ===============================================
// 6. РОУТЫ ПОСТОВ И ЛЕНТЫ
// ===============================================

// Создание поста
app.post('/api/posts', isAuthenticated, async (req, res) => {
    try {
        const { content } = req.body;
        const post = new Post({ author: req.session.userId, content });
        await post.save();

        // Поиск поста с информацией об авторе для отправки сокетом
        const newPost = await Post.findById(post._id).populate('author', 'username avatarUrl');
        
        // Добавление временных полей для клиента
        const postForClient = {
            ...newPost.toObject(),
            authorUsername: newPost.author.username,
            authorAvatarUrl: newPost.author.avatarUrl || DEFAULT_AVATAR
        };

        // Отправка поста всем подключенным клиентам (в ленту)
        io.emit('new post', postForClient); 
        res.status(201).json(postForClient);
    } catch (error) {
        console.error('Ошибка создания поста:', error);
        res.status(500).json({ message: 'Ошибка сервера при создании поста.' });
    }
});

// Загрузка ленты
app.get('/api/feed', isAuthenticated, async (req, res) => {
    try {
        // Здесь можно реализовать сложную логику, чтобы показывать посты
        // только от тех, на кого подписан пользователь.
        // Пока показываем просто все посты.
        const posts = await Post.find()
            .sort({ createdAt: -1 })
            .populate('author', 'username avatarUrl'); 

        const formattedPosts = posts.map(post => ({
            _id: post._id,
            content: post.content,
            createdAt: post.createdAt,
            likes: post.likes,
            authorUsername: post.author.username,
            authorAvatarUrl: post.author.avatarUrl || DEFAULT_AVATAR // Использование дефолтного аватара
        }));

        res.json(formattedPosts);
    } catch (error) {
        console.error('Ошибка загрузки ленты:', error);
        res.status(500).json({ message: 'Ошибка сервера при загрузке ленты.' });
    }
});

// Лайк поста
app.post('/api/posts/:id/like', isAuthenticated, async (req, res) => {
    try {
        const postId = req.params.id;
        const userId = req.session.userId;

        const post = await Post.findById(postId);
        if (!post) {
            return res.status(404).json({ message: 'Пост не найден.' });
        }

        const index = post.likes.indexOf(userId);

        if (index > -1) {
            // Дизлайк
            post.likes.splice(index, 1);
        } else {
            // Лайк
            post.likes.push(userId);
        }

        await post.save();
        
        // Уведомляем всех о лайке
        io.emit('post liked', { postId: post._id, likes: post.likes.length });
        res.json({ likes: post.likes.length });

    } catch (error) {
        console.error('Ошибка лайка:', error);
        res.status(500).json({ message: 'Ошибка сервера при лайке.' });
    }
});

// ===============================================
// 7. РОУТЫ КОММЕНТАРИЕВ
// ===============================================

// Получить комментарии поста
app.get('/api/posts/:postId/comments', isAuthenticated, async (req, res) => {
    try {
        const comments = await Comment.find({ postId: req.params.postId })
            .sort({ createdAt: 1 })
            .populate('author', 'username avatarUrl'); 

        const formattedComments = comments.map(comment => ({
            _id: comment._id,
            content: comment.content,
            createdAt: comment.createdAt,
            authorUsername: comment.author.username,
            authorAvatarUrl: comment.author.avatarUrl || DEFAULT_AVATAR 
        }));

        res.json(formattedComments);
    } catch (error) {
        res.status(500).json({ message: 'Ошибка сервера при загрузке комментариев.' });
    }
});

// Добавить комментарий
app.post('/api/posts/:postId/comments', isAuthenticated, async (req, res) => {
    try {
        const { content } = req.body;
        const postId = req.params.postId;

        const comment = new Comment({ 
            postId, 
            author: req.session.userId, 
            content 
        });
        await comment.save();

        const newComment = await Comment.findById(comment._id).populate('author', 'username avatarUrl');
        
        const commentForClient = {
            ...newComment.toObject(),
            authorUsername: newComment.author.username,
            authorAvatarUrl: newComment.author.avatarUrl || DEFAULT_AVATAR
        };

        // Уведомляем клиентов
        io.to(postId).emit('new comment', commentForClient);
        res.status(201).json(commentForClient);
    } catch (error) {
        console.error('Ошибка добавления комментария:', error);
        res.status(500).json({ message: 'Ошибка сервера при добавлении комментария.' });
    }
});

// ===============================================
// 8. РОУТЫ ПРОФИЛЯ И ПОДПИСКИ
// ===============================================

// Получение профиля пользователя
app.get('/api/profile/:username', isAuthenticated, async (req, res) => {
    try {
        const username = req.params.username;
        const targetUser = await User.findOne({ username }).select('-password');

        if (!targetUser) {
            return res.status(404).json({ message: 'Пользователь не найден.' });
        }
        
        const currentUserId = req.session.userId;
        const isFollowing = targetUser.followers.includes(currentUserId);
        
        const userPayload = {
            _id: targetUser._id,
            username: targetUser.username,
            bio: targetUser.bio,
            // Принудительное использование дефолтной ссылки, если поле пустое
            avatarUrl: targetUser.avatarUrl || DEFAULT_AVATAR, 
            bannerUrl: targetUser.bannerUrl || DEFAULT_BANNER,
            followersCount: targetUser.followers.length,
            followingCount: targetUser.following.length,
        };

        res.json({ user: userPayload, isFollowing });

    } catch (error) {
        console.error('Ошибка загрузки профиля:', error);
        res.status(500).json({ message: 'Ошибка сервера при загрузке профиля.' });
    }
});


// Редактирование профиля
app.put('/api/profile', isAuthenticated, async (req, res) => {
    try {
        const { bio, avatarUrl, bannerUrl } = req.body;
        const currentUserId = req.session.userId;

        const updatedUser = await User.findByIdAndUpdate(
            currentUserId,
            { 
                bio: bio, 
                // Убеждаемся, что сохраняется или переданный URL, или стандартная заглушка
                avatarUrl: avatarUrl || DEFAULT_AVATAR, 
                bannerUrl: bannerUrl || DEFAULT_BANNER
            },
            { new: true, runValidators: true } // new: true возвращает обновленный документ
        ).select('-password');

        if (!updatedUser) {
            return res.status(404).json({ message: 'Пользователь не найден.' });
        }
        
        res.json({ 
            message: 'Профиль успешно обновлен', 
            user: {
                username: updatedUser.username,
                bio: updatedUser.bio,
                avatarUrl: updatedUser.avatarUrl,
                bannerUrl: updatedUser.bannerUrl,
            }
        });

    } catch (error) {
        console.error('Ошибка обновления профиля:', error);
        res.status(500).json({ message: 'Ошибка сервера при обновлении профиля.' });
    }
});

// Роут для подписки/отписки
app.post('/api/follow/:userIdToFollow/:action', isAuthenticated, async (req, res) => {
    const userIdToFollow = req.params.userIdToFollow;
    const action = req.params.action; // 'follow' или 'unfollow'
    const currentUserId = req.session.userId;

    if (currentUserId.toString() === userIdToFollow.toString()) {
        return res.status(400).json({ message: 'Вы не можете подписаться на самого себя.' });
    }

    try {
        const currentUser = await User.findById(currentUserId);
        const targetUser = await User.findById(userIdToFollow);

        if (!currentUser || !targetUser) {
            return res.status(404).json({ message: 'Пользователь не найден.' });
        }
        
        const isFollowing = currentUser.following.includes(userIdToFollow);

        if (action === 'follow' && !isFollowing) {
            // ПОДПИСКА
            currentUser.following.push(userIdToFollow);
            targetUser.followers.push(currentUserId);
            
            await currentUser.save();
            await targetUser.save();
            
            return res.json({ message: 'Успешная подписка', status: 'followed' });
            
        } else if (action === 'unfollow' && isFollowing) {
            // ОТПИСКА
            currentUser.following.pull(userIdToFollow);
            targetUser.followers.pull(currentUserId);
            
            await currentUser.save();
            await targetUser.save();

            return res.json({ message: 'Успешная отписка', status: 'unfollowed' });

        } else if (action === 'follow' && isFollowing) {
            return res.status(400).json({ message: 'Вы уже подписаны на этого пользователя.' });
        } else if (action === 'unfollow' && !isFollowing) {
            return res.status(400).json({ message: 'Вы не подписаны на этого пользователя.' });
        }
        
        return res.status(400).json({ message: 'Некорректное действие.' });

    } catch (error) {
        console.error('Ошибка подписки/отписки:', error);
        res.status(500).json({ message: 'Ошибка сервера.' });
    }
});


// ===============================================
// 9. РОУТЫ ЧАТОВ И СООБЩЕНИЙ (Сокращены)
// ===============================================

// Роут для поиска или создания чата
app.post('/api/chats/findOrCreate', isAuthenticated, async (req, res) => {
    try {
        const { targetUserId } = req.body;
        const currentUserId = req.session.userId;

        let chat = await Chat.findOne({
            participants: { $all: [currentUserId, targetUserId], $size: 2 }
        }).populate('participants', 'username avatarUrl');

        if (!chat) {
            chat = new Chat({ participants: [currentUserId, targetUserId] });
            await chat.save();
            // Получаем с информацией о юзерах для ответа
            chat = await Chat.findById(chat._id).populate('participants', 'username avatarUrl');
        }

        res.json({ chat });
    } catch (error) {
        console.error('Ошибка findOrCreateChat:', error);
        res.status(500).json({ message: 'Ошибка сервера при поиске/создании чата.' });
    }
});

// Получение списка чатов
app.get('/api/chats', isAuthenticated, async (req, res) => {
    try {
        const chats = await Chat.find({ participants: req.session.userId })
            .sort({ updatedAt: -1 })
            .populate('participants', 'username avatarUrl');
        
        // Форматирование для клиента
        const formattedChats = chats.map(chat => {
            const partner = chat.participants.find(p => p._id.toString() !== req.session.userId.toString());
            return {
                _id: chat._id,
                participants: chat.participants,
                lastMessage: chat.lastMessage,
                updatedAt: chat.updatedAt,
                partnerName: partner ? partner.username : 'Групповой чат',
                partnerAvatarUrl: partner ? (partner.avatarUrl || DEFAULT_AVATAR) : DEFAULT_AVATAR
            };
        });

        res.json(formattedChats);
    } catch (error) {
        console.error('Ошибка загрузки чатов:', error);
        res.status(500).json({ message: 'Ошибка сервера при загрузке чатов.' });
    }
});

// Получение сообщений чата
app.get('/api/chats/:chatId/messages', isAuthenticated, async (req, res) => {
    try {
        const messages = await Message.find({ chatId: req.params.chatId })
            .sort({ createdAt: 1 });
        res.json(messages);
    } catch (error) {
        res.status(500).json({ message: 'Ошибка сервера при загрузке сообщений.' });
    }
});


// ===============================================
// 10. SOCKET.IO (Реальное время)
// ===============================================

const io = new Server(server, {
    cors: {
        origin: "*", // Разрешаем всем
    }
});

io.use((socket, next) => {
    const token = socket.handshake.auth.token;
    if (!token) return next(new Error('Нет токена'));

    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        socket.userId = decoded.userId;
        next();
    } catch (error) {
        next(new Error('Недействительный токен'));
    }
});

io.on('connection', (socket) => {
    // console.log(`User connected: ${socket.userId}`);

    // Регистрация пользователя (для Direct Messaging)
    socket.on('register user', (userId) => {
        socket.join(userId);
    });

    // Присоединение к комнате чата (для сообщений)
    socket.on('join chat', (chatId) => {
        socket.join(chatId);
        socket.join(chatId); // Комнаты для чата
    });
    
    // Присоединение к комнате поста (для комментариев)
    socket.on('join post', (postId) => {
        socket.join(postId); // Комнаты для комментариев
    });

    // Отправка сообщения
    socket.on('send message', async (messageData) => {
        try {
            const { chatId, senderId, content } = messageData;
            
            // Сохраняем сообщение
            const message = new Message({ chatId, senderId, content });
            await message.save();

            // Обновляем чат (lastMessage и updatedAt)
            const chat = await Chat.findByIdAndUpdate(
                chatId, 
                { lastMessage: content, updatedAt: Date.now() }, 
                { new: true }
            );

            // Отправляем сообщение всем участникам чата
            if (chat) {
                chat.participants.forEach(participantId => {
                    io.to(participantId.toString()).emit('receive message', message);
                    // Также обновляем список чатов
                    io.to(participantId.toString()).emit('update chat list', { chatId });
                });
            }
        } catch (error) {
            console.error('Ошибка обработки сообщения в сокете:', error);
        }
    });

    socket.on('disconnect', () => {
        // console.log(`User disconnected: ${socket.userId}`);
    });
});

// ===============================================
// 11. ЗАПУСК СЕРВЕРА
// ===============================================
server.listen(PORT, () => {
    console.log(`🚀 Сервер запущен на http://localhost:${PORT}`);
});