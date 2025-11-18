// ВАЖНО: При локальном запуске замените URL на 'http://localhost:10000'
var socket = io.connect('https://my-network-vldt.onrender.com');

// Элементы DOM
var message = document.getElementById('message');
var send_button = document.getElementById('send');
var output = document.getElementById('output');
var feedback = document.getElementById('feedback');
var handle = 'Гость'; // Простая переменная-заглушка

// Отправка сообщения
send_button.addEventListener('click', function(){
    if (message.value.trim() !== '') {
        socket.emit('chat', {
            message: message.value,
            handle: handle // Отправляем заглушку
        });
        message.value = "";
    }
});

// Получение сообщения
socket.on('chat', function(data){
    feedback.innerHTML = '';
    // Выводим сообщение с заглушкой
    output.innerHTML += '<p><strong>' + data.handle + ': </strong>' + data.message + '</p>';
    output.scrollTop = output.scrollHeight; // Автопрокрутка
});

// Индикатор печати
message.addEventListener('keypress', function(){
    socket.emit('typing', handle); // Отправляем заглушку
});

// Получение индикатора печати
socket.on('typing', function(data){
    feedback.innerHTML = '<p><em>' + data + ' печатает сообщение...</em></p>';
});