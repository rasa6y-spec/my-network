// ВАЖНО: Используем вашу публичную ссылку Render
var socket = io.connect('https://my-network-vldt.onrender.com');

// Элементы DOM
var message = document.getElementById('message');
var send_button = document.getElementById('send');
var output = document.getElementById('output');
var feedback = document.getElementById('feedback');

// НОВЫЕ Элементы для никнейма
var nickname_input = document.getElementById('nickname');
var nickname_set_button = document.getElementById('set-nickname');
var nickname_area = document.getElementById('nickname-area');

var nickname = 'Гость'; // Никнейм по умолчанию

// Обработка установки никнейма
nickname_set_button.addEventListener('click', function(){
    if (nickname_input.value.trim() !== '') {
        nickname = nickname_input.value.trim();
        nickname_area.style.display = 'none'; // Скрываем область ввода
        // Добавляем системное сообщение
        output.innerHTML += '<p class="system-message">Вы вошли как: <strong>' + nickname + '</strong></p>';
    }
});


// Отправка сообщения
send_button.addEventListener('click', function(){
    if (message.value.trim() !== '') {
        socket.emit('chat', {
            message: message.value,
            nickname: nickname // ОТПРАВЛЯЕМ НИКНЕЙМ
        });
        message.value = "";
    }
});

// Получение сообщения
socket.on('chat', function(data){
    feedback.innerHTML = '';
    // ОТОБРАЖАЕМ НИКНЕЙМ
    output.innerHTML += '<p><strong>' + data.nickname + ': </strong>' + data.message + '</p>';
    output.scrollTop = output.scrollHeight; // Автопрокрутка
});

// Индикатор печати
message.addEventListener('keypress', function(){
    socket.emit('typing', nickname); // ОТПРАВЛЯЕМ НИКНЕЙМ при печати
});

// Получение индикатора печати
socket.on('typing', function(data){
    // data здесь - это никнейм печатающего пользователя
    feedback.innerHTML = '<p><em>' + data + ' печатает сообщение...</em></p>';
});