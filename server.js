const express = require('express');
const socket = require('socket.io');
const path = require('path'); // Добавлено для работы с путями

const app = express();
// Render требует слушать порт, предоставленный переменной среды
const port = process.env.PORT || 10000;
const server = app.listen(port, () => {
    console.log(`Сервер запущен на http://localhost:${port}`);
});

// Статические файлы (предполагаем, что они лежат в папке 'public')
app.use(express.static('public'));

// Явно отдаем index.html при обращении к главной странице
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Настройка Socket.IO
const io = socket(server);

io.on('connection', (socket) => {
    console.log('Новое подключение:', socket.id);

    // Обработка события chat (сообщение + никнейм)
    socket.on('chat', (data) => {
        // data = {message: '...', nickname: '...'}
        io.sockets.emit('chat', data); // Рассылаем всем сообщение с никнеймом
    });

    // Обработка события typing (никнейм)
    socket.on('typing', (data) => {
        // data = никнейм пользователя, который печатает
        socket.broadcast.emit('typing', data); // Рассылаем всем КРОМЕ отправителя
    });
});