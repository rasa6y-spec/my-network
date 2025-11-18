// Импорт необходимых модулей
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);

// Настройка Socket.IO
// Разрешаем CORS для глобального доступа (важно для публичного деплоя)
const io = new Server(server, {
  cors: {
    origin: "*", 
    methods: ["GET", "POST"]
  }
});

// Обслуживание статических файлов (index.html, style.css, chat.js)
app.use(express.static(path.join(__dirname, '')));

// Маршрут для главной страницы
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// 📌 Обработка соединений Socket.IO
io.on('connection', (socket) => {
  console.log('Пользователь подключился:', socket.id);

  // Обработка события "chat message"
  // Ожидается объект: { username: 'Имя', text: 'Сообщение' }
  socket.on('chat message', (data) => {
    console.log(`Сообщение от ${data.username}: ${data.text}`);
    
    // Отправка ОБЪЕКТА всем клиентам
    io.emit('chat message', data); 
  });

  // Обработка отключения
  socket.on('disconnect', () => {
    console.log('Пользователь отключился:', socket.id);
  });
});

// Запуск сервера
// Используем переменную окружения PORT для деплоя на хостинге (Render, Heroku и т.д.)
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Сервер запущен на порту: http://localhost:${PORT}`);
});