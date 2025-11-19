// Импорт необходимых модулей
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

const app = express();
const server = http.createServer(app);

// ------------------------------------------
// 📌 1. КОНФИГУРАЦИЯ БАЗЫ ДАННЫХ И СЕКРЕТЫ
// ------------------------------------------

// ! ВАША СТРОКА ПОДКЛЮЧЕНИЯ MONGODB ATLAS
const MONGODB_URI = 'mongodb+srv://bye_bye:r123321a@momento.gex5zgk.mongodb.net/socialchatdb?appName=Momento'; 
// Секретный ключ для подписи JWT токенов (ОЧЕНЬ ВАЖНО)
const JWT_SECRET = 'd2e8r9t5y1u4i6o8p0a3s7f0g2h1j5k4l9z3x7c4v1b0n6m'; 

mongoose.connect(MONGODB_URI)
  .then(() => console.log('✅ MongoDB подключена успешно!'))
  .catch(err => console.error('❌ Ошибка подключения к MongoDB:', err));

// ------------------------------------------
// 📌 2. МОДЕЛИ ДАННЫХ (SCHEMAS)
// ------------------------------------------

// Модель пользователя
const UserSchema = new mongoose.Schema({
    username: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    bio: { type: String, default: 'Привет, я новый пользователь!' },
    followers: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }], 
    following: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }] 
}, { timestamps: true });

const User = mongoose.model('User', UserSchema);

// Модель поста (публикации в ленте)
const PostSchema = new mongoose.Schema({
    author: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    authorUsername: { type: String, required: true },
    content: { type: String, required: true },
    likes: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    commentsCount: { type: Number, default: 0 }
}, { timestamps: true });

const Post = mongoose.model('Post', PostSchema);

// ------------------------------------------
// 📌 3. НАСТРОЙКА MIDDLEWARE
// ------------------------------------------

app.use(express.json()); 
app.use(express.static(path.join(__dirname, '')));

// Middleware для защиты маршрутов (проверка токена)
function authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; 
    if (token == null) return res.sendStatus(401); 

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) return res.sendStatus(403); 
        req.user = user; 
        next();
    });
}

// ------------------------------------------
// 📌 4. МАРШРУТЫ API
// ------------------------------------------

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// 🔸 Маршрут регистрации
app.post('/api/register', async (req, res) => {
    try {
        const { username, password } = req.body;
        const hashedPassword = await bcrypt.hash(password, 10);
        
        const user = new User({ username, password: hashedPassword });
        await user.save();

        res.status(201).send({ message: 'Пользователь успешно зарегистрирован!' });
    } catch (error) {
        if (error.code === 11000) {
            return res.status(409).send({ message: 'Имя пользователя уже занято.' });
        }
        res.status(500).send({ message: 'Ошибка сервера при регистрации.' });
    }
});

// 🔸 Маршрут входа
app.post('/api/login', async (req, res) => {
    try {
        const { username, password } = req.body;
        const user = await User.findOne({ username });
        if (!user) return res.status(404).send({ message: 'Пользователь не найден.' });

        const match = await bcrypt.compare(password, user.password);
        if (!match) return res.status(401).send({ message: 'Неверный пароль.' });

        // Создание JWT токена
        const token = jwt.sign(
            { id: user._id, username: user.username }, 
            JWT_SECRET, 
            { expiresIn: '1d' }
        );
        
        res.send({ token, username: user.username, userId: user._id }); // Возвращаем userId
    } catch (error) {
        res.status(500).send({ message: 'Ошибка сервера при входе.' });
    }
});

// 🔸 Маршрут для создания поста (Требует токена!)
app.post('/api/posts', authenticateToken, async (req, res) => {
    try {
        const { content } = req.body;
        const newPost = new Post({
            author: req.user.id,
            authorUsername: req.user.username,
            content
        });
        await newPost.save();

        // Уведомление всех клиентов через Socket.IO о новом посте
        io.emit('new post', { 
            id: newPost._id,
            content: newPost.content,
            authorUsername: newPost.authorUsername,
            createdAt: newPost.createdAt,
            likes: newPost.likes.length 
        });

        res.status(201).send(newPost);
    } catch (error) {
        res.status(500).send({ message: 'Ошибка создания поста.' });
    }
});

// 🔸 Маршрут для получения ленты
app.get('/api/feed', authenticateToken, async (req, res) => {
    try {
        const user = await User.findById(req.user.id);
        const followingIds = user.following; 
        
        // Получаем посты от подписанных пользователей и мои собственные
        const feedPosts = await Post.find({ 
            $or: [
                { author: { $in: followingIds } }, 
                { author: req.user.id }
            ]
        })
        .sort({ createdAt: -1 })
        .limit(20) 
        .select('-author');

        res.send(feedPosts);
    } catch (error) {
        res.status(500).send({ message: 'Ошибка загрузки ленты.' });
    }
});

// ------------------------------------------
// 📌 5. НАСТРОЙКА SOCKET.IO
// ------------------------------------------

const io = new Server(server, {
    cors: {
        origin: "*", 
        methods: ["GET", "POST"]
    }
});

io.on('connection', (socket) => {
    console.log('Пользователь подключился:', socket.id);

    // Обработка события "post like"
    socket.on('post like', async (data) => {
        try {
            // data: { postId, userId }
            const post = await Post.findById(data.postId);
            if (post) {
                // Проверяем, лайкал ли уже пользователь
                const isLiked = post.likes.includes(data.userId);
                if (isLiked) {
                    // Удаляем лайк
                    post.likes.pull(data.userId);
                } else {
                    // Добавляем лайк
                    post.likes.push(data.userId);
                }
                
                await post.save();
                
                // Отправляем всем, чтобы обновить счетчик
                io.emit('like update', { postId: data.postId, newLikes: post.likes.length });
            }
        } catch (e) {
            console.error('Ошибка обработки лайка:', e);
        }
    });

    socket.on('disconnect', () => {
        console.log('Пользователь отключился:', socket.id);
    });
});

// ------------------------------------------
// 📌 6. ЗАПУСК СЕРВЕРА
// ------------------------------------------

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Сервер запущен на порту: http://localhost:${PORT}`);
});