const express = require('express');
const mongoose = require('mongoose');
const http = require('http');
const socketIo = require('socket.io');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');

const app = express();
const server = http.createServer(app);

// 📌 1. КОНФИГУРАЦИЯ
// -------------------------------------------------------------
const PORT = process.env.PORT || 10000;
// ВАШ СЕКРЕТНЫЙ КЛЮЧ
const JWT_SECRET = 'your_super_secret_key_for_jwt_auth'; 

// Ваша строка подключения MongoDB Atlas
const MONGODB_URI = 'mongodb+srv://bye_bye:r123321a@momento.gex5zgk.mongodb.net/socialchatdb?appName=Momento'; 

app.use(express.static('.'));
app.use(express.json());

// 📌 2. ПОДКЛЮЧЕНИЕ К MONGODB
// -------------------------------------------------------------
mongoose.connect(MONGODB_URI)
    .then(() => {
        console.log('✅ MongoDB подключена успешно!');
    })
    .catch((error) => {
        console.error('❌ Ошибка подключения к MongoDB:', error);
    });

// 📌 3. СХЕМЫ И МОДЕЛИ
// -------------------------------------------------------------

// Схема пользователя (обновлена для подписок)
const userSchema = new mongoose.Schema({
    username: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    bio: { type: String, default: 'Пользователь нашей новой соцсети.' },
    followers: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }], // Подписчики
    following: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }], // Подписки
});

// Схема поста
const postSchema = new mongoose.Schema({
    content: { type: String, required: true },
    authorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    authorUsername: { type: String, required: true },
    likes: { type: Number, default: 0 },
    createdAt: { type: Date, default: Date.now }
});

const User = mongoose.model('User', userSchema);
const Post = mongoose.model('Post', postSchema);

// 📌 4. MIDDLEWARE АУТЕНТИФИКАЦИИ
// -------------------------------------------------------------
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

// 📌 5. МАРШРУТЫ API
// -------------------------------------------------------------

// 🔸 Регистрация
app.post('/api/register', async (req, res) => {
    try {
        const { username, password } = req.body;
        if (!username || !password) {
            return res.status(400).send({ message: 'Требуется имя пользователя и пароль.' });
        }
        
        const hashedPassword = await bcrypt.hash(password, 10);
        const user = new User({ username, password: hashedPassword });
        await user.save();
        res.status(201).send({ message: 'Пользователь успешно зарегистрирован.' });
    } catch (error) {
        if (error.code === 11000) { // Ошибка дубликата (пользователь уже существует)
            return res.status(409).send({ message: 'Пользователь с таким именем уже существует.' });
        }
        res.status(500).send({ message: 'Ошибка сервера при регистрации.' });
    }
});

// 🔸 Вход
app.post('/api/login', async (req, res) => {
    try {
        const { username, password } = req.body;
        const user = await User.findOne({ username });

        if (!user) {
            return res.status(400).send({ message: 'Неверное имя пользователя или пароль.' });
        }

        const validPassword = await bcrypt.compare(password, user.password);

        if (!validPassword) {
            return res.status(400).send({ message: 'Неверное имя пользователя или пароль.' });
        }

        const token = jwt.sign({ id: user._id, username: user.username }, JWT_SECRET, { expiresIn: '1h' });
        res.send({ token, username: user.username, userId: user._id });

    } catch (error) {
        res.status(500).send({ message: 'Ошибка сервера при входе.' });
    }
});

// 🔸 Получение ленты
app.get('/api/feed', authenticateToken, async (req, res) => {
    try {
        // В будущем здесь будет фильтрация по подпискам
        const posts = await Post.find().sort({ createdAt: -1 }).limit(50);
        res.send(posts);
    } catch (error) {
        res.status(500).send({ message: 'Ошибка загрузки ленты.' });
    }
});

// 🔸 Маршрут для получения данных профиля
app.get('/api/profile/:username', authenticateToken, async (req, res) => {
    try {
        const targetUsername = req.params.username;
        const targetUser = await User.findOne({ username: targetUsername })
            .select('-password -__v'); 

        if (!targetUser) {
            return res.status(404).send({ message: 'Пользователь не найден.' });
        }
        
        // Определяем, подписан ли текущий пользователь на целевого
        const isFollowing = targetUser.followers.includes(req.user.id);

        res.send({
            user: {
                id: targetUser._id,
                username: targetUser.username,
                bio: targetUser.bio,
                followersCount: targetUser.followers.length,
                followingCount: targetUser.following.length,
            },
            isFollowing: isFollowing
        });
    } catch (error) {
        res.status(500).send({ message: 'Ошибка загрузки профиля.' });
    }
});

// 🔸 Маршрут для подписки/отписки (Follow/Unfollow)
app.post('/api/follow/:userId', authenticateToken, async (req, res) => {
    try {
        const targetUserId = req.params.userId;
        const currentUserId = req.user.id;
        
        if (targetUserId === currentUserId.toString()) {
            return res.status(400).send({ message: 'Нельзя подписаться на себя.' });
        }

        const targetUser = await User.findById(targetUserId);
        const currentUser = await User.findById(currentUserId);

        if (!targetUser || !currentUser) {
            return res.status(404).send({ message: 'Пользователь не найден.' });
        }

        const isFollowing = currentUser.following.includes(targetUserId);

        if (isFollowing) {
            // ОТПИСКА (Unfollow)
            currentUser.following.pull(targetUserId);
            targetUser.followers.pull(currentUserId);
            await currentUser.save();
            await targetUser.save();
            res.send({ action: 'unfollowed', followersCount: targetUser.followers.length });
        } else {
            // ПОДПИСКА (Follow)
            currentUser.following.push(targetUserId);
            targetUser.followers.push(currentUserId);
            await currentUser.save();
            await targetUser.save();
            res.send({ action: 'followed', followersCount: targetUser.followers.length });
        }
    } catch (error) {
        console.error('Follow/Unfollow error:', error);
        res.status(500).send({ message: 'Ошибка сервера при подписке/отписке.' });
    }
});

// 📌 6. SOCKET.IO (Обработка постов и лайков)
// -------------------------------------------------------------
const io = socketIo(server);

io.on('connection', (socket) => {
    console.log(`Пользователь подключился: ${socket.id}`);

    // Получение нового поста от клиента
    socket.on('new post', async (data) => {
        try {
            const newPost = new Post({
                content: data.content,
                authorId: data.userId,
                authorUsername: data.username
            });
            await newPost.save();
            
            // Отправляем новый пост всем клиентам
            io.emit('new post', {
                _id: newPost._id,
                content: newPost.content,
                authorUsername: newPost.authorUsername,
                likes: newPost.likes,
                createdAt: newPost.createdAt
            });

        } catch (error) {
            console.error('Ошибка при создании поста:', error);
        }
    });

    // Обработка лайков
    socket.on('post like', async (data) => {
        try {
            const post = await Post.findById(data.postId);
            if (post) {
                post.likes += 1; // Упрощенная логика: просто увеличиваем счетчик
                await post.save();
                
                // Отправляем обновленное количество лайков всем
                io.emit('like update', { 
                    postId: post._id, 
                    newLikes: post.likes 
                });
            }
        } catch (error) {
            console.error('Ошибка при лайке поста:', error);
        }
    });

    socket.on('disconnect', () => {
        console.log(`Пользователь отключился: ${socket.id}`);
    });
});

// 📌 7. ЗАПУСК СЕРВЕРА
// -------------------------------------------------------------
server.listen(PORT, () => {
    console.log(`Сервер запущен на порту: http://localhost:${PORT}`);
});