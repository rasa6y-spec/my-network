const express = require('express');
const socket = require('socket.io');

const app = express();
// Render требует слушать порт, предоставленный переменной среды
const port = process.env.PORT || 10000;
const server = app.listen(port, () => {
    console.log(`Сервер запущен на http://localhost:${port}`);
});

// Статические файлы (находит index.html в папке 'public')
app.use(express.static('public'));

// Настройка Socket.IO
const io = socket(server);

io.on('connection', (socket) => {
    console.log('Новое подключение:', socket.id);

    // Обработка события chat
    socket.on('chat', (data) => {
        io.sockets.emit('chat', data);
    });

    // Обработка события typing
    socket.on('typing', (data) => {
        socket.broadcast.emit('typing', data);
    });
});