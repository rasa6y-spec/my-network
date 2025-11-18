// Глобальная переменная для имени пользователя
let username = '';

// Получаем элементы DOM
const usernameArea = document.getElementById('username-area');
const chatContainer = document.getElementById('chat-container');
const usernameForm = document.getElementById('username-form');
const usernameInput = document.getElementById('username-input');

const messageForm = document.getElementById('message-form');
const input = document.getElementById('input');
const messages = document.getElementById('messages');

// Устанавливаем соединение с сервером
// При деплое, если сервер и клиент на разных доменах, замените io() на io('URL_ВАШЕГО_СЕРВЕРА')
const socket = io(); 

// --- 1. Обработка ввода имени пользователя ---
usernameForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const enteredUsername = usernameInput.value.trim();

    if (enteredUsername) {
        username = enteredUsername;
        
        // Скрываем форму имени и показываем чат
        usernameArea.style.display = 'none';
        chatContainer.style.display = 'block';
        
        // Отправляем системное сообщение о присоединении
        socket.emit('chat message', { 
            username: 'СИСТЕМА', 
            text: `${username} присоединился к чату.` 
        });
    }
});

// --- 2. Обработка отправки сообщения ---
messageForm.addEventListener('submit', (e) => {
  e.preventDefault();
  
  if (input.value && username) {
    // Отправляем объект с именем пользователя и текстом
    const messageData = {
        username: username,
        text: input.value
    };
    
    socket.emit('chat message', messageData);
    input.value = ''; // Очищаем поле ввода
  }
});

// --- 3. Обработка получения сообщения ---
// Ожидаем объект { username: 'Имя', text: 'Сообщение' }
socket.on('chat message', (data) => {
  const item = document.createElement('li');
  
  // Создаем HTML: <span class="username">Имя:</span> Сообщение
  item.innerHTML = `<span class="username">${data.username}:</span> ${data.text}`;

  // Стилизация для системных сообщений
  if (data.username === 'СИСТЕМА') {
      item.classList.add('system-message');
  } else if (data.username === username) {
      // Подсвечиваем свои сообщения
      item.classList.add('my-message');
  }

  messages.appendChild(item);
  
  // Прокрутка к последнему сообщению
  messages.scrollTop = messages.scrollHeight;
});