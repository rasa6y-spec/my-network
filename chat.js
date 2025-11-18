// chat.js
// --- CHAT.JS ЗАГРУЖЕН И НАЧАЛ РАБОТУ ---
console.log("--- CHAT.JS ЗАГРУЖЕН И НАЧАЛ РАБОТУ ---"); 

// Подключаемся к серверу Socket.IO. io() теперь определен!
const socket = io(); 

const messagesDiv = document.getElementById('messages');
const input = document.getElementById('message-input');
const sendButton = document.getElementById('send-button');

// Функция для добавления сообщения в DOM
function appendMessage(msg) {
    const item = document.createElement('div');
    item.classList.add('message-item');
    item.textContent = msg;
    messagesDiv.appendChild(item);
    // Прокрутка вниз
    messagesDiv.scrollTop = messagesDiv.scrollHeight;
}

// Функция отправки сообщения на сервер
function sendMessage() {
    const text = input.value.trim();
    if (text) {
        // Отправляем сообщение на сервер по событию 'chat message'
        socket.emit('chat message', text);
        input.value = ''; // Очищаем поле ввода
    }
}

// Обработчики событий
sendButton.addEventListener('click', sendMessage);

// Обработчик для отправки по Ctrl + Enter
input.addEventListener('keydown', (e) => {
    if (e.ctrlKey && e.key === 'Enter') {
        sendMessage();
    }
});

// Получение сообщения от сервера
// Слушаем событие 'chat message' от сервера
socket.on('chat message', (msg) => {
    appendMessage('User: ' + msg);
});

// Сообщение, которое должно появиться при загрузке страницы
appendMessage('System: Добро пожаловать в чат-терминал!');