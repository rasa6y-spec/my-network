// ===========================================
// 📌 1. ИНИЦИАЛИЗАЦИЯ И ГЛОБАЛЬНЫЕ ПЕРЕМЕННЫЕ
// ===========================================
const socket = io();

// Элементы DOM
const authArea = document.getElementById('auth-area');
const socialContainer = document.getElementById('social-container');
const authForm = document.getElementById('auth-form');

// --- ИСПРАВЛЕННЫЕ ПЕРЕМЕННЫЕ ДЛЯ ПОЛЕЙ ВВОДА ---
const usernameInput = document.getElementById('username'); 
const passwordInput = document.getElementById('password');
// -------------------------------------------------

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
let currentProfileView = 'feed'; // Текущий вид: 'feed' или имя пользователя

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
    welcomeUser.textContent = 'Моя Соцсеть'; 
    postsList.innerHTML = ''; // Очистка ленты
}

function showSocialScreen(username) {
    authArea.style.display = 'none';
    socialContainer.style.display = 'block';
    welcomeUser.textContent = `Привет, ${username}!`;
    document.getElementById('new-post-area').style.display = 'block';
    
    loadFeed();
}

// ------------------------------------------
// 📌 3. ФУНКЦИИ ЗАГРУЗКИ И РЕНДЕРИНГА
// ------------------------------------------

// Загрузка ленты (главная страница)
async function loadFeed() {
    postsList.innerHTML = ''; 
    document.getElementById('new-post-area').style.display = 'block'; 
    currentProfileView = 'feed';

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
        } 

    } catch (error) {
        console.error('Ошибка сети при загрузке ленты:', error);
    }
}

// Рендеринг одного поста 
function renderPost(post) {
    const li = document.createElement('li');
    li.className = 'post-item';
    // Используем уникальный ID поста
    const postId = post._id || post.id;
    li.dataset.postId = postId;
    
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
                <button class="like-button" onclick="handleLike('${postId}')">❤️</button>
                <span class="likes-count">${post.likes}</span>
                <button class="comment-toggle-button" data-post-id="${postId}" onclick="toggleComments(this)">💬</button> 
            </div>
            <span class="post-date">${date}</span>
        </div>
        <div class="comments-section" id="comments-${postId}" style="display: none;">
            <ul class="comments-list" data-post-id="${postId}"></ul>
            <form class="comment-form" data-post-id="${postId}" onsubmit="handleCommentSubmit(event, this)">
                <input type="text" placeholder="Добавить комментарий..." required>
                <button type="submit">ОК</button>
            </form>
        </div>
    `;
    return li;
}

// ------------------------------------------
// 📌 4. ОБРАБОТЧИКИ АУТЕНТИФИКАЦИИ И ПОСТОВ
// ------------------------------------------

// Обработка регистрации/входа
authForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    // ИСПРАВЛЕНИЕ: Используем переменные usernameInput и passwordInput
    const username = usernameInput.value; 
    const password = passwordInput.value;
    
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
        e.target['post-content'].value = ''; 
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

// Загрузка и отображение профиля
async function loadProfile(username) {
    document.getElementById('new-post-area').style.display = 'none';
    postsList.innerHTML = ''; 
    currentProfileView = username;

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
            
            if (user.username !== currentUsername) {
                profileHtml += `<button id="follow-button" data-user-id="${user.id}" class="follow-btn ${isFollowing ? 'unfollow-btn' : ''}">
                    ${isFollowing ? 'Отписаться' : 'Подписаться'}
                </button>`;
            }

            profileHtml += `</div><h4 style="padding: 20px 20px 0; max-width: 500px; margin: 0 auto;">Посты пользователя</h4>`;
            
            postsList.innerHTML = profileHtml; 
            
            // Заглушка для постов профиля
            postsList.innerHTML += `<p style="padding: 0 20px; max-width: 500px; margin: 5px auto;">Функция загрузки постов профиля в разработке.</p>`;

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
            
            if (data.action === 'followed') {
                button.textContent = 'Отписаться';
                button.classList.add('unfollow-btn');
            } else {
                button.textContent = 'Подписаться';
                button.classList.remove('unfollow-btn');
            }
            
            const profileArea = document.getElementById('profile-area');
            // Обновляем счетчик подписчиков
            const countElement = profileArea.querySelector('p strong:first-child'); 
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
// 📌 6. КОММЕНТАРИИ
// ------------------------------------------

// Рендеринг одного комментария
function renderComment(comment) {
    const li = document.createElement('li');
    li.innerHTML = `
        <div style="font-size: 0.9em; margin-bottom: 5px;">
            <strong class="profile-link" data-username="${comment.authorUsername}">${comment.authorUsername}:</strong> 
            ${comment.content}
        </div>
    `;
    return li;
}

// Переключение видимости комментариев и их загрузка
async function toggleComments(button) {
    const postId = button.dataset.postId;
    const commentsSection = document.getElementById(`comments-${postId}`);
    const commentsList = commentsSection.querySelector('.comments-list');

    if (commentsSection.style.display === 'none') {
        commentsSection.style.display = 'block';
        commentsList.innerHTML = '<li>Загрузка комментариев...</li>';

        try {
            const response = await fetch(`/api/posts/${postId}/comments`, {
                headers: { 'Authorization': `Bearer ${authToken}` }
            });
            
            if (response.ok) {
                const comments = await response.json();
                commentsList.innerHTML = ''; 
                if (comments.length === 0) {
                    commentsList.innerHTML = '<li style="color: #666; font-size: 0.9em;">Комментариев пока нет.</li>';
                } else {
                    comments.forEach(comment => {
                        commentsList.appendChild(renderComment(comment));
                    });
                }
            } else {
                 commentsList.innerHTML = '<li style="color: red; font-size: 0.9em;">Ошибка загрузки.</li>';
            }
        } catch (error) {
            console.error('Ошибка загрузки комментариев:', error);
        }

    } else {
        commentsSection.style.display = 'none';
    }
}

// Отправка нового комментария
async function handleCommentSubmit(e, form) {
    e.preventDefault();
    const postId = form.dataset.postId;
    const input = form.querySelector('input');
    const content = input.value;

    try {
        const response = await fetch(`/api/posts/${postId}/comments`, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify({ content })
        });

        if (response.ok) {
            input.value = ''; 
        } else if (response.status === 401 || response.status === 403) {
            showAuthScreen();
        } else {
            alert('Не удалось отправить комментарий.');
        }

    } catch (error) {
        console.error('Ошибка отправки комментария:', error);
    }
}


// ------------------------------------------
// 📌 7. SOCKET.IO (Обновление в реальном времени)
// ------------------------------------------

// Получение нового поста от сервера
socket.on('new post', (post) => {
    if (currentProfileView === 'feed') {
        const newPostElement = renderPost(post);
        postsList.prepend(newPostElement);
    }
});

// Обновление счетчика лайков в реальном времени
socket.on('like update', (data) => {
    const postElement = document.querySelector(`[data-post-id="${data.postId}"]`);
    if (postElement) {
        const likesCountSpan = postElement.querySelector('.likes-count');
        if (likesCountSpan) likesCountSpan.textContent = data.newLikes;
    }
});

// Получение нового комментария от сервера
socket.on('new comment', (comment) => {
    const commentsList = document.querySelector(`.comments-list[data-post-id="${comment.postId}"]`);
    
    if (commentsList && commentsList.parentElement.style.display !== 'none') {
        if (commentsList.children.length === 1 && commentsList.children[0].textContent.includes('Комментариев пока нет.')) {
            commentsList.innerHTML = '';
        }
        
        commentsList.appendChild(renderComment(comment));
    }
});


// ------------------------------------------
// 📌 8. ОБРАБОТЧИКИ КЛИКА И ИНИЦИАЛИЗАЦИЯ
// ------------------------------------------

// Делегирование события клика для перехода в профиль
document.addEventListener('click', (e) => {
    // Клик на имя пользователя (автора поста)
    if (e.target.classList.contains('profile-link')) {
        e.preventDefault(); 
        const username = e.target.dataset.username;
        if (username) {
            loadProfile(username);
        }
    }
    // Кнопка в заголовке для возврата в ленту (ваше имя)
    if (e.target.id === 'welcome-user') {
        if (currentProfileView !== 'feed') {
            loadFeed(); 
        }
    }
});


// Инициализация
if (authToken && currentUsername) {
    showSocialScreen(currentUsername);
} else {
    showAuthScreen();
}