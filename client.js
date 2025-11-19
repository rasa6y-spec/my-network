// ===========================================
// 📌 1. ИНИЦИАЛИЗАЦИЯ И ГЛОБАЛЬНЫЕ ПЕРЕМЕННЫЕ
// ===========================================
const socket = io();

// Элементы DOM
const authArea = document.getElementById('auth-area');
const socialContainer = document.getElementById('social-container');
const authForm = document.getElementById('auth-form');
const authMessage = document.getElementById('auth-message');
const loginButton = document.getElementById('login-button');
const registerToggle = document.getElementById('register-toggle');
const welcomeUser = document.getElementById('welcome-user');
const postForm = document.getElementById('post-form');
const postsList = document.getElementById('posts-list');
const logoutButton = document.getElementById('logout-button');

// Состояние
let isRegistering = false;
let authToken = localStorage.getItem('authToken');
let currentUsername = localStorage.getItem('currentUsername');
let currentUserId = localStorage.getItem('currentUserId');

// ------------------------------------------
// 📌 2. ФУНКЦИИ УПРАВЛЕНИЯ ЭКРАНОМ
// ------------------------------------------

function showAuthScreen() {
    // Очистка локального хранилища
    authToken = null;
    currentUsername = null;
    currentUserId = null;
    localStorage.removeItem('authToken');
    localStorage.removeItem('currentUsername');
    localStorage.removeItem('currentUserId');
    
    // Скрытие/Отображение контейнеров
    socialContainer.style.display = 'none'; 
    authArea.style.display = 'block';
    
    // Сброс формы и сообщения
    authMessage.textContent = '';
    authForm.reset();
    isRegistering = false;
    loginButton.textContent = 'Войти';
    registerToggle.textContent = 'Регистрация';

    // Установка заголовка (на случай, если пользователь кликнул на него)
    welcomeUser.textContent = 'Моя Соцсеть'; 
}

function showSocialScreen(username) {
    authArea.style.display = 'none';
    socialContainer.style.display = 'block';
    welcomeUser.textContent = `Привет, ${username}!`;
    document.getElementById('new-post-area').style.display = 'block';
    
    loadFeed();
}

// ------------------------------------------
// 📌 3. ФУНКЦИИ ЗАГРУЗКИ ДАННЫХ
// ------------------------------------------

// Загрузка ленты (главная страница)
async function loadFeed() {
    postsList.innerHTML = ''; // Очищаем старую ленту
    document.getElementById('new-post-area').style.display = 'block'; // Показываем форму поста

    try {
        const response = await fetch('/api/feed', {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });
        
        if (response.ok) {
            const posts = await response.json();
            posts.forEach(post => {
                postsList.prepend(renderPost(post));
            });
        } else if (response.status === 401 || response.status === 403) {
            showAuthScreen();
        } else {
            console.error('Ошибка загрузки ленты.');
        }

    } catch (error) {
        console.error('Ошибка сети при загрузке ленты:', error);
    }
}

// Рендеринг одного поста (обновлено для лучшего дизайна и ссылки на профиль)
function renderPost(post) {
    const li = document.createElement('li');
    li.className = 'post-item';
    li.dataset.postId = post._id || post.id;
    
    const date = new Date(post.createdAt).toLocaleDateString('ru-RU', { 
        day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit'
    });

    li.innerHTML = `
        <div class="post-header">
            <span class="post-author profile-link" data-username="${post.authorUsername}">
                ${post.authorUsername}
            </span>
        </div>
        <p class="post-content-text">${post.content}</p>
        <div class="post-actions">
            <div>
                <button class="like-button" onclick="handleLike('${post._id || post.id}')">❤️</button>
                <span class="likes-count">${post.likes}</span>
            </div>
            <span class="post-date">${date}</span>
        </div>
    `;
    return li;
}

// ------------------------------------------
// 📌 4. ОБРАБОТЧИКИ СОБЫТИЙ (КЛИЕНТ-СЕРВЕР)
// ------------------------------------------

// Обработка регистрации/входа
authForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const username = e.target.username.value;
    const password = e.target.password.value;
    const endpoint = isRegistering ? '/api/register' : '/api/login';
    const method = 'POST';

    try {
        const response = await fetch(endpoint, {
            method: method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });
        
        const data = await response.json();

        if (response.ok) {
            authMessage.textContent = isRegistering ? 'Регистрация успешна! Теперь войдите.' : '';
            
            if (!isRegistering) {
                // Успешный вход
                authToken = data.token;
                currentUsername = data.username;
                currentUserId = data.userId;

                localStorage.setItem('authToken', authToken);
                localStorage.setItem('currentUsername', currentUsername);
                localStorage.setItem('currentUserId', currentUserId);

                showSocialScreen(currentUsername);
            } else {
                // Успешная регистрация, переключаем на вход
                isRegistering = false;
                loginButton.textContent = 'Войти';
                registerToggle.textContent = 'Регистрация';
                authForm.reset();
            }

        } else {
            authMessage.textContent = `Ошибка: ${data.message}`;
        }

    } catch (error) {
        authMessage.textContent = 'Ошибка сети или сервера.';
    }
});

// Переключение на регистрацию
registerToggle.addEventListener('click', () => {
    isRegistering = !isRegistering;
    loginButton.textContent = isRegistering ? 'Зарегистрироваться' : 'Войти';
    registerToggle.textContent = isRegistering ? 'Уже есть аккаунт' : 'Регистрация';
    authMessage.textContent = '';
});

// Выход
logoutButton.addEventListener('click', showAuthScreen);

// Отправка нового поста
postForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const content = e.target['post-content'].value;
    if (content.trim() && authToken) {
        socket.emit('new post', { 
            content: content, 
            username: currentUsername, 
            userId: currentUserId 
        });
        e.target['post-content'].value = ''; // Очистка
    }
});

// Обработка лайка
function handleLike(postId) {
    if (authToken) {
        socket.emit('post like', { postId: postId, userId: currentUserId });
    }
}

// ------------------------------------------
// 📌 5. ПРОФИЛЬ И ПОДПИСКИ
// ------------------------------------------

// Переменная для хранения текущего отображаемого профиля (для возврата)
let currentProfileView = 'feed'; 

// Загрузка и отображение профиля
async function loadProfile(username) {
    // Временно скрываем ленту и форму поста
    document.getElementById('new-post-area').style.display = 'none';
    postsList.innerHTML = ''; // Очищаем ленту

    try {
        const response = await fetch(`/api/profile/${username}`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });
        
        if (response.ok) {
            const { user, isFollowing } = await response.json();

            let profileHtml = `
                <div id="profile-area">
                    <h3>${user.username}</h3>
                    <p style="color: #666;">${user.bio}</p>
                    <p>
                        <span class="stat-link"><strong>${user.followersCount}</strong> подписчиков</span> | 
                        <span class="stat-link"><strong>${user.followingCount}</strong> подписок</span>
                    </p>
            `;
            
            // Если это не наш профиль, показываем кнопку подписки/отписки
            if (user.username !== currentUsername) {
                profileHtml += `<button id="follow-button" data-user-id="${user.id}" class="follow-btn ${isFollowing ? 'unfollow-btn' : ''}">
                    ${isFollowing ? 'Отписаться' : 'Подписаться'}
                </button>`;
            }

            profileHtml += `</div><h4 style="padding: 20px 20px 0; max-width: 500px; margin: 0 auto;">Посты пользователя</h4>`;
            
            postsList.innerHTML = profileHtml; 
            
            // Здесь должна быть логика для загрузки постов этого пользователя (пока пропустим)
            postsList.innerHTML += `<p style="padding: 0 20px; max-width: 500px; margin: 5px auto;">Функция загрузки постов профиля в разработке.</p>`;

            // Добавляем обработчик на кнопку подписки
            if (user.username !== currentUsername) {
                document.getElementById('follow-button').addEventListener('click', handleFollow);
            }

        } else if (response.status === 404) {
             postsList.innerHTML = `<h3 style="padding: 20px; text-align: center;">Пользователь не найден.</h3>`;
        } else {
            showAuthScreen(); 
        }

    } catch (error) {
        console.error('Ошибка загрузки профиля:', error);
    }
}

// Обработка кнопки Подписаться/Отписаться
async function handleFollow(e) {
    const button = e.target;
    const targetUserId = button.dataset.userId;

    try {
        const response = await fetch(`/api/follow/${targetUserId}`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${authToken}` }
        });

        if (response.ok) {
            const data = await response.json();
            
            // Обновляем текст кнопки и классы
            if (data.action === 'followed') {
                button.textContent = 'Отписаться';
                button.classList.add('unfollow-btn');
            } else {
                button.textContent = 'Подписаться';
                button.classList.remove('unfollow-btn');
            }
            
            // Обновляем счетчик подписчиков в HTML (ищем ближайший элемент с количеством)
            const profileArea = document.getElementById('profile-area');
            const countElement = profileArea.querySelector('p strong');
            if (countElement) countElement.textContent = data.followersCount;

        } else if (response.status === 401 || response.status === 403) {
            showAuthScreen();
        } else {
            alert('Не удалось выполнить действие.');
        }

    } catch (error) {
        console.error('Ошибка follow/unfollow:', error);
    }
}


// ------------------------------------------
// 📌 6. SOCKET.IO (Обновление в реальном времени)
// ------------------------------------------

// Получение нового поста от сервера
socket.on('new post', (post) => {
    const newPostElement = renderPost(post);
    postsList.prepend(newPostElement);
});

// Обновление счетчика лайков в реальном времени
socket.on('like update', (data) => {
    const postElement = document.querySelector(`[data-post-id="${data.postId}"]`);
    if (postElement) {
        const likesCountSpan = postElement.querySelector('.likes-count');
        if (likesCountSpan) likesCountSpan.textContent = data.newLikes;
    }
});


// ------------------------------------------
// 📌 7. ОБРАБОТЧИКИ КЛИКА И ИНИЦИАЛИЗАЦИЯ
// ------------------------------------------

// Делегирование события клика для перехода в профиль
document.addEventListener('click', (e) => {
    // Клик на имя пользователя (автора поста)
    if (e.target.classList.contains('profile-link')) {
        e.preventDefault(); // Предотвращаем стандартное действие ссылки
        const username = e.target.dataset.username;
        if (username) {
            loadProfile(username);
            currentProfileView = username;
        }
    }
    // Кнопка в заголовке для возврата в ленту (ваше имя)
    if (e.target.id === 'welcome-user') {
        if (currentProfileView !== 'feed') {
            loadFeed(); // Возвращаемся к ленте
            currentProfileView = 'feed';
        }
    }
});


// Инициализация
if (authToken && currentUsername) {
    showSocialScreen(currentUsername);
} else {
    showAuthScreen();
}