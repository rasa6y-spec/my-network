// Глобальные переменные для хранения состояния пользователя
let authToken = localStorage.getItem('authToken');
let currentUsername = localStorage.getItem('currentUsername');
let currentUserId = localStorage.getItem('currentUserId'); // Добавлено для Лайков

// Элементы DOM
const authArea = document.getElementById('auth-area');
const socialContainer = document.getElementById('social-container');
const authForm = document.getElementById('auth-form');
const usernameInput = document.getElementById('auth-username');
const passwordInput = document.getElementById('auth-password');
const authMessage = document.getElementById('auth-message');
const loginButton = document.getElementById('login-button');
const registerToggle = document.getElementById('register-toggle');
const welcomeUser = document.getElementById('welcome-user');
const logoutButton = document.getElementById('logout-button');
const postForm = document.getElementById('post-form');
const postContent = document.getElementById('post-content');
const postsList = document.getElementById('posts-list');

// Инициализация Socket.IO
const socket = io();

// ------------------------------------------
// 📌 1. ФУНКЦИИ ИНТЕРФЕЙСА
// ------------------------------------------

function showSocialScreen(username) {
    authArea.style.display = 'none';
    socialContainer.style.display = 'flex';
    welcomeUser.textContent = `Привет, ${username}!`;
    loadFeed();
}

function showAuthScreen() {
    // Очистка локального хранилища
    authToken = null;
    currentUsername = null;
    currentUserId = null;
    localStorage.removeItem('authToken');
    localStorage.removeItem('currentUsername');
    localStorage.removeItem('currentUserId');
    
    socialContainer.style.display = 'none';
    authArea.style.display = 'block';
    authMessage.textContent = '';
    authForm.reset();
    loginButton.textContent = 'Войти';
    registerToggle.textContent = 'Регистрация';
}

function renderPost(post) {
    const li = document.createElement('li');
    li.className = 'post-item';
    li.dataset.postId = post._id || post.id;
    
    const date = new Date(post.createdAt).toLocaleDateString('ru-RU', { 
        hour: '2-digit', minute: '2-digit', day: 'numeric', month: 'short' 
    });

    li.innerHTML = `
        <div class="post-meta">
            <span class="post-author">${post.authorUsername}</span>
            <span class="post-date">${date}</span>
        </div>
        <p class="post-content-text">${post.content}</p>
        <div class="post-actions">
            <span class="likes-count">${post.likes}</span>
            <button class="like-button" onclick="handleLike('${post._id || post.id}')">❤️ Лайк</button>
        </div>
    `;
    return li;
}

// ------------------------------------------
// 📌 2. АУТЕНТИФИКАЦИЯ
// ------------------------------------------

// Инициализация (проверка токена при загрузке)
document.addEventListener('DOMContentLoaded', () => {
    if (authToken && currentUsername) {
        showSocialScreen(currentUsername);
    } else {
        showAuthScreen();
    }
});

// Переключение между Входом и Регистрацией
registerToggle.addEventListener('click', () => {
    const isRegister = loginButton.textContent === 'Зарегистрироваться';
    if (!isRegister) {
        registerToggle.textContent = 'Уже есть аккаунт';
        loginButton.textContent = 'Зарегистрироваться';
    } else {
        registerToggle.textContent = 'Регистрация';
        loginButton.textContent = 'Войти';
    }
    authMessage.textContent = '';
});

// Отправка формы аутентификации
authForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    authMessage.textContent = '';
    
    const username = usernameInput.value.trim();
    const password = passwordInput.value;
    const isRegister = loginButton.textContent === 'Зарегистрироваться';
    const endpoint = isRegister ? '/api/register' : '/api/login';

    try {
        const response = await fetch(endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });

        const data = await response.json();

        if (response.ok) {
            if (isRegister) {
                authMessage.textContent = '✅ Регистрация успешна! Теперь войдите.';
                registerToggle.textContent = 'Регистрация';
                loginButton.textContent = 'Войти';
            } else {
                // Вход успешен
                authToken = data.token;
                currentUsername = data.username;
                currentUserId = data.userId; // Сохраняем ID пользователя
                
                localStorage.setItem('authToken', authToken);
                localStorage.setItem('currentUsername', currentUsername);
                localStorage.setItem('currentUserId', currentUserId);

                showSocialScreen(currentUsername);
            }
        } else {
            authMessage.textContent = `❌ Ошибка: ${data.message || 'Неизвестная ошибка'}`;
        }
    } catch (error) {
        authMessage.textContent = '❌ Ошибка сети или сервера.';
    }
});

// Выход
logoutButton.addEventListener('click', showAuthScreen);

// ------------------------------------------
// 📌 3. ЛЕНТА И ПОСТЫ
// ------------------------------------------

// Загрузка ленты с сервера
async function loadFeed() {
    postsList.innerHTML = ''; // Очистка ленты
    try {
        const response = await fetch('/api/feed', {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });

        if (response.ok) {
            const posts = await response.json();
            posts.forEach(post => {
                postsList.appendChild(renderPost(post));
            });
        } else if (response.status === 401 || response.status === 403) {
            showAuthScreen(); // Токен истек или недействителен
        }
    } catch (error) {
        console.error('Ошибка загрузки ленты:', error);
    }
}

// Отправка нового поста
postForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const content = postContent.value.trim();
    if (!content) return;

    try {
        const response = await fetch('/api/posts', {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify({ content })
        });

        if (response.ok) {
            postContent.value = ''; // Очистка
        } else {
            alert('Не удалось опубликовать пост. Пожалуйста, войдите снова.');
            if (response.status === 401 || response.status === 403) showAuthScreen();
        }
    } catch (error) {
        console.error('Ошибка отправки поста:', error);
    }
});

// Обработка Лайка
function handleLike(postId) {
    if (!authToken || !currentUserId) return showAuthScreen();
    
    // Отправляем событие Лайка на сервер Socket.IO
    socket.emit('post like', { postId, userId: currentUserId });
}

// ------------------------------------------
// 📌 4. SOCKET.IO (Обновление в реальном времени)
// ------------------------------------------

// Получение нового поста от сервера
socket.on('new post', (post) => {
    const newPostElement = renderPost(post);
    postsList.prepend(newPostElement);
});

// Обновление счетчика лайков в реальном времени
socket.on('like update', (data) => {
    const postElement = document.querySelector(`.post-item[data-post-id="${data.postId}"]`);
    if (postElement) {
        const likesCountSpan = postElement.querySelector('.likes-count');
        likesCountSpan.textContent = data.newLikes;
    }
});