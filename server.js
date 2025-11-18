// **ОБЯЗАТЕЛЬНЫЙ ПЕРЕХВАТЧИК ОШИБОК**
process.on('uncaughtException', (err) => {
    console.error('КРИТИЧЕСКАЯ ОШИБКА: Сервер не запущен. Проблема с модулями или кодировкой.', err);
    process.exit(1);
});

const express = require('express');
const http = require('http');
const socketIo = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

// КРИТИЧЕСКОЕ ИЗМЕНЕНИЕ ДЛЯ ХОСТИНГА (RENDER): 
// Используем порт хостинга (process.env.PORT) или 3000 для локальной работы.
const PORT = process.env.PORT || 3000; 

// Разрешаем серверу отдавать статические файлы (index.html, style.css, chat.js)
app.use(express.static(__dirname));

// Обработка подключения WebSockets
io.on('connection', (socket) => {
    console.log('🎉 Пользователь подключен');
    
    // Получение сообщения от одного клиента
    socket.on('chat message', (msg) => {
        // Отправка сообщения ВСЕМ подключенным клиентам
        io.emit('chat message', msg);
    });

    // Отключение пользователя
    socket.on('disconnect', () => {
        console.log('Пользователь отключен 😥');
    });
});

// Запуск сервера с обработкой ошибок порта
server.listen(PORT, () => {
    console.log(`Сервер запущен на http://localhost:${PORT}`);
    console.log('Нажмите CTRL+C для остановки.');
}).on('error', (err) => {
    // ВЫВОД ОШИБКИ, ЕСЛИ ПОРТ ЗАНЯТ
    if (err.code === 'EADDRINUSE') {
        console.error(`\n❌ ОШИБКА: Порт ${PORT} уже используется! Попробуйте закрыть другие программы.`);
    } else {
        console.error('\n❌ Неизвестная ошибка при запуске:', err.message);
    }
    process.exit(1);
});