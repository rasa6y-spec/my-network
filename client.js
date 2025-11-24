// client.js

// ===============================================
// 1. КОНФИГУРАЦИЯ И ПЕРЕМЕННЫЕ
// ===============================================
const API_BASE_URL = window.location.origin;
let token = localStorage.getItem('token');
let currentUsername = localStorage.getItem('username');
let currentUserId = localStorage.getItem('userId');
let currentView = 'feed';
let currentChatId = null;
let currentPartnerId = null;
let socket = null;

// DOM элементы
const authArea = document.getElementById('auth-area');
const socialContainer = document.getElementById('social-container');

// Элементы аутентификации
const loginForm = document.getElementById('login-form');
const registerForm = document.getElementById('register-form');
const showRegisterLink = document.getElementById('show-register');
const showLoginLink = document.getElementById('show-login');
const loginError = document.getElementById('login-error');
const registerError = document.getElementById('register-error');

// Общие элементы интерфейса
const sidebar = document.getElementById('sidebar');
const mobileNav = document.getElementById('mobile-nav');

// Элементы ленты и постов
const feedArea = document.getElementById('feed');
const postsList = document.getElementById('posts-list');
const newPostAreaInline = document.getElementById('new-post-area-inline');
const postContentInline = document.getElementById('post-content-inline');
const submitPostInline = document.getElementById('submit-post-inline');

// Элементы профиля
const profileView = document.getElementById('profile-view');
const profileUsername = document.getElementById('profile-username');
const profileBio = document.getElementById('profile-bio');
const profileAvatar = document.getElementById('profile-avatar');
const profileBanner = document.getElementById('profile-banner');
const profileActions = document.getElementById('profile-actions');
const followersCount = document.getElementById('followers-count');
const followingCount = document.getElementById('following-count');
const userPostsList = document.getElementById('user-posts-list');

// Модальное окно редактирования профиля
const editProfileModal = document.getElementById('edit-profile-modal');
const editProfileForm = document.getElementById('edit-profile-form');

// Модальное окно комментариев
const commentsModal = document.getElementById('comments-modal');
const commentsList = document.getElementById('comments-list');
const submitCommentButton = document.getElementById('submit-comment');
const commentContentInput = document.getElementById('comment-content');
let currentPostIdForComments = null;

// Элементы чатов
const messagesArea = document.getElementById('messages-area');
const groupsArea = document.getElementById('groups-area');
const chatList = document.getElementById('chat-list');
const chatWindow = document.getElementById('chat-window');
const messagesContainer = document.getElementById('messages-container');
const messageContentInput = document.getElementById('message-content');
const sendMessageButton = document.getElementById('send-message');
const backToChatsButton = document.getElementById('back-to-chats');


// ===============================================
// 2. АУТЕНТИФИКАЦИЯ
// ===============================================

function saveAuthData(data) {
    token = data.token;
    currentUsername = data.user.username;
    currentUserId = data.user.id;
    localStorage.setItem('token', token);
    localStorage.setItem('username', currentUsername);
    localStorage.setItem('userId', currentUserId);
}

async function handleAuth(event, endpoint, errorElement) {
    event.preventDefault();
    errorElement.textContent = '';

    const form = event.target;
    const username = form.querySelector('input[type="text"]').value;
    const password = form.querySelector('input[type="password"]').value;

    try {
        const response = await fetch(`${API_BASE_URL}/api/${endpoint}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });

        const data = await response.json();

        if (response.ok) {
            saveAuthData(data);
            showSocialScreen(currentUsername);
        } else {
            errorElement.textContent = data.message || 'Ошибка аутентификации';
        }

    } catch (error) {
        errorElement.textContent = 'Ошибка сети. Проверьте подключение сервера.';
        console.error('Auth Error:', error);
    }
}

function handleLogout() {
    localStorage.clear();
    location.reload(); 
}


// ===============================================
// 3. УПРАВЛЕНИЕ ИНТЕРФЕЙСОМ И НАВИГАЦИЕЙ
// ===============================================

function showAuthScreen() {
    authArea.style.display = 'flex';
    socialContainer.style.display = 'none';
}

function showSocialScreen(username) {
    authArea.style.display = 'none';
    socialContainer.style.display = 'flex';
    
    // Обновляем верхнюю панель
    const topBarUsername = document.getElementById('top-bar-username');
    const topBarAvatar = document.getElementById('top-bar-avatar');
    if (topBarUsername) topBarUsername.textContent = username;
    if (topBarAvatar) {
        topBarAvatar.src = localStorage.getItem('avatarUrl') || 'https://i.ibb.co/L8229Fq/default-avatar.png';
    }
    document.getElementById('new-post-inline-avatar').src = localStorage.getItem('avatarUrl') || 'https://i.ibb.co/L8229Fq/default-avatar.png';

    // Обновляем ссылки на профиль
    [mobileNav, sidebar].forEach(container => {
        const profileLink = container.querySelector('.profile-link');
        if (profileLink) {
            profileLink.onclick = () => loadProfile(currentUsername);
        }
    });

    if (!socket || !socket.connected) {
        initSocketIO();
    }

    loadFeed();
}

function showView(view) {
    // Скрываем все основные области
    feedArea.style.display = 'none';
    profileView.style.display = 'none';
    messagesArea.style.display = 'none';
    groupsArea.style.display = 'none';
    newPostAreaInline.style.display = 'none'; 
    postsList.innerHTML = '';
    userPostsList.innerHTML = '';

    currentView = view;
    
    // Показываем нужную область
    if (view === 'feed') { 
        feedArea.style.display = 'block';
        newPostAreaInline.style.display = 'flex';
        // Устанавливаем активный класс
        document.querySelectorAll('.nav-item').forEach(item => item.classList.remove('active'));
        document.querySelector('.nav-item[onclick*="feed"]').classList.add('active');
    } else if (view === 'profile') {
        profileView.style.display = 'block';
        // Устанавливаем активный класс для профиля
        document.querySelectorAll('.nav-item').forEach(item => item.classList.remove('active'));
        document.querySelector('.nav-item[onclick*="profile"]').classList.add('active');
    } else if (view === 'messages') {
        messagesArea.style.display = 'flex'; 
        document.querySelectorAll('.nav-item').forEach(item => item.classList.remove('active'));
        document.querySelector('.nav-item[onclick*="messages"]').classList.add('active');
    } else if (view === 'groups') {
        groupsArea.style.display = 'block';
        document.querySelectorAll('.nav-item').forEach(item => item.classList.remove('active'));
        document.querySelector('.nav-item[onclick*="groups"]').classList.add('active');
    }
}

// Функции для выпадающего меню (Top Bar)
function toggleProfileDropdown() {
    const dropdown = document.getElementById('profile-dropdown');
    dropdown.style.display = dropdown.style.display === 'block' ? 'none' : 'block';
}

// Закрытие дропдауна при клике вне его
window.addEventListener('click', function(event) {
    const profileIcon = document.getElementById('current-user-profile-icon');
    const dropdown = document.getElementById('profile-dropdown');

    if (profileIcon && dropdown && dropdown.style.display === 'block') {
        if (!profileIcon.contains(event.target) && !dropdown.contains(event.target)) {
            dropdown.style.display = 'none';
        }
    }
});


// ===============================================
// 4. ГЕНЕРАЦИЯ ЭЛЕМЕНТОВ
// ===============================================

function createPostElement(post) {
    const li = document.createElement('li');
    li.className = 'post';
    li.dataset.postId = post._id;
    
    // Проверяем, лайкнул ли текущий пользователь
    const isLiked = post.likes.includes(currentUserId);
    const likeClass = isLiked ? 'liked' : '';
    const likeIcon = isLiked ? 'fa-solid' : 'fa-regular';

    li.innerHTML = `
        <div class="post-header">
            <img src="${post.authorAvatarUrl || 'https://i.ibb.co/L8229Fq/default-avatar.png'}" alt="Аватар" class="post-avatar">
            <span class="post-author" onclick="loadProfile('${post.authorUsername}')">${post.authorUsername}</span>
            <span class="post-date">${new Date(post.createdAt).toLocaleDateString()}</span>
        </div>
        <div class="post-content">
            <p>${post.content}</p>
        </div>
        <div class="post-actions">
            <button class="like-button ${likeClass}" data-post-id="${post._id}">
                <i class="${likeIcon} fa-heart"></i> <span class="like-count">${post.likes.length}</span>
            </button>
            <button class="comment-button" data-post-id="${post._id}">
                <i class="fa-regular fa-comment"></i> Комментарии
            </button>
        </div>
    `;

    li.querySelector('.like-button').addEventListener('click', () => handleLikePost(post._id));
    li.querySelector('.comment-button').addEventListener('click', () => openCommentsModal(post._id));

    return li;
}

function createCommentElement(comment) {
    const div = document.createElement('div');
    div.className = 'comment';
    div.innerHTML = `
        <span class="comment-author" onclick="loadProfile('${comment.authorUsername}')">@${comment.authorUsername}</span>: 
        <span class="comment-content-text">${comment.content}</span>
        <span class="comment-date">${new Date(comment.createdAt).toLocaleDateString('ru-RU', { hour: '2-digit', minute: '2-digit' })}</span>
    `;
    return div;
}

function createChatElement(chat) {
    const li = document.createElement('li');
    li.className = 'chat-item';
    li.dataset.chatId = chat._id;

    // Определяем собеседника
    const partner = chat.participants.find(p => p._id !== currentUserId);
    const partnerName = partner ? partner.username : (chat.isGroup ? chat.chatName : 'Неизвестно');
    const partnerAvatar = partner ? (partner.avatarUrl || 'https://i.ibb.co/L8229Fq/default-avatar.png') : 'https://i.ibb.co/L8229Fq/default-avatar.png';

    li.innerHTML = `
        <img src="${partnerAvatar}" alt="Аватар" class="chat-avatar">
        <div class="chat-info">
            <div class="chat-name">${partnerName}</div>
            <div class="last-message">${chat.lastMessage}</div>
        </div>
    `;

    li.addEventListener('click', () => openChat(chat._id, partnerName, partner._id));
    return li;
}

function createMessageElement(message) {
    const div = document.createElement('div');
    div.className = 'message';
    if (message.senderId === currentUserId) {
        div.classList.add('sent');
    } else {
        div.classList.add('received');
    }
    div.innerHTML = `
        <div class="message-content">${message.content}</div>
        <div class="message-time">${new Date(message.createdAt).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}</div>
    `;
    return div;
}


// ===============================================
// 5. ВЗАИМОДЕЙСТВИЕ С API (ПОСТЫ, ПРОФИЛЬ)
// ===============================================

async function handleNewPostInline() {
    const content = postContentInline.value.trim();
    if (!content) return;

    try {
        const response = await fetch(`${API_BASE_URL}/api/posts`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ content })
        });

        if (response.ok) {
            postContentInline.value = ''; // Очищаем инлайн-поле
        } else {
            alert('Не удалось опубликовать пост.');
        }

    } catch (error) {
        console.error('Ошибка публикации:', error);
    }
}

async function loadFeed() {
    try {
        const response = await fetch(`${API_BASE_URL}/api/feed`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const posts = await response.json();
        
        postsList.innerHTML = '';
        posts.forEach(post => {
            const element = createPostElement(post);
            postsList.appendChild(element);
        });

    } catch (error) {
        console.error('Ошибка загрузки ленты:', error);
    }
}

async function handleLikePost(postId) {
    try {
        const response = await fetch(`${API_BASE_URL}/api/posts/${postId}/like`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}` }
        });
        
        if (!response.ok) {
            alert('Ошибка лайка.');
        }

    } catch (error) {
        console.error('Ошибка лайка:', error);
    }
}

async function loadProfile(username) {
    if (!username) return;

    showView('profile');
    try {
        const response = await fetch(`${API_BASE_URL}/api/profile/${username}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await response.json();
        
        if (response.ok) {
            const user = data.user;
            
            profileUsername.textContent = `@${user.username}`;
            profileBio.textContent = user.bio || 'Нет информации о себе.';
            profileAvatar.src = user.avatarUrl || 'https://i.ibb.co/L8229Fq/default-avatar.png';
            profileBanner.src = user.bannerUrl || 'https://i.ibb.co/2P157M4/default-banner.png';
            followersCount.textContent = `Подписчики: ${user.followersCount || 0}`;
            followingCount.textContent = `Подписки: ${user.followingCount || 0}`;

            // Кнопки действий
            profileActions.innerHTML = '';
            if (user.username !== currentUsername) {
                const followButton = document.createElement('button');
                followButton.textContent = data.isFollowing ? 'Отписаться' : 'Подписаться';
                followButton.className = data.isFollowing ? 'unfollow-button' : 'follow-button';
                followButton.onclick = () => handleFollow(user._id, data.isFollowing ? 'unfollow' : 'follow');
                profileActions.appendChild(followButton);

                const messageButton = document.createElement('button');
                messageButton.textContent = 'Сообщение';
                messageButton.className = 'message-button';
                messageButton.onclick = () => findOrCreateChat(user._id);
                profileActions.appendChild(messageButton);
            } else {
                const editButton = document.createElement('button');
                editButton.textContent = 'Редактировать профиль';
                editButton.className = 'edit-button';
                editButton.onclick = openEditProfileModal;
                profileActions.appendChild(editButton);

                // Сохраняем данные текущего пользователя для редактирования
                localStorage.setItem('userBio', user.bio);
                localStorage.setItem('avatarUrl', user.avatarUrl);
                localStorage.setItem('bannerUrl', user.bannerUrl);
            }
            
            // Загрузка постов пользователя (здесь можно добавить fetch-запрос к /api/posts/byUser/:userId)
            // Пока просто очистим
            userPostsList.innerHTML = `<h3>Посты пользователя ${user.username} (В разработке)</h3>`;

        } else {
            alert(data.message || 'Пользователь не найден.');
            showView('feed');
        }

    } catch (error) {
        console.error('Ошибка загрузки профиля:', error);
        showView('feed');
    }
}

async function handleFollow(targetUserId, action) {
    try {
        const response = await fetch(`${API_BASE_URL}/api/follow/${targetUserId}/${action}`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (response.ok) {
            await loadProfile(profileUsername.textContent.substring(1)); // Перезагружаем профиль
        } else {
            alert('Ошибка подписки/отписки.');
        }
    } catch (error) {
        console.error('Ошибка подписки/отписки:', error);
    }
}

function openEditProfileModal() {
    const bio = localStorage.getItem('userBio') || '';
    const avatarUrl = localStorage.getItem('avatarUrl') || '';
    const bannerUrl = localStorage.getItem('bannerUrl') || '';
    
    document.getElementById('edit-bio').value = bio === 'null' ? '' : bio;
    document.getElementById('edit-avatar-url').value = avatarUrl === 'null' ? '' : avatarUrl;
    document.getElementById('edit-banner-url').value = bannerUrl === 'null' ? '' : bannerUrl;
    editProfileModal.style.display = 'block';
}

async function handleEditProfile(event) {
    event.preventDefault();
    
    const bio = document.getElementById('edit-bio').value;
    const avatarUrl = document.getElementById('edit-avatar-url').value;
    const bannerUrl = document.getElementById('edit-banner-url').value;
    
    try {
        const response = await fetch(`${API_BASE_URL}/api/profile`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ bio, avatarUrl, bannerUrl })
        });

        if (response.ok) {
            const data = await response.json();
            const updatedUser = data.user;
            
            // Обновляем локальные данные и UI
            localStorage.setItem('userBio', updatedUser.bio);
            localStorage.setItem('avatarUrl', updatedUser.avatarUrl);
            localStorage.setItem('bannerUrl', updatedUser.bannerUrl);
            
            document.getElementById('top-bar-avatar').src = updatedUser.avatarUrl || 'https://i.ibb.co/L8229Fq/default-avatar.png';
            document.getElementById('new-post-inline-avatar').src = updatedUser.avatarUrl || 'https://i.ibb.co/L8229Fq/default-avatar.png';

            editProfileModal.style.display = 'none';
            alert('Профиль успешно обновлен!');
            loadProfile(currentUsername); 
        } else {
            alert('Ошибка при сохранении профиля.');
        }

    } catch (error) {
        console.error('Ошибка редактирования профиля:', error);
    }
}


// ===============================================
// 6. КОММЕНТАРИИ
// ===============================================

function openCommentsModal(postId) {
    currentPostIdForComments = postId;
    commentsList.innerHTML = '';
    loadComments(postId);
    commentsModal.style.display = 'block';
}

async function loadComments(postId) {
    try {
        const response = await fetch(`${API_BASE_URL}/api/posts/${postId}/comments`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const comments = await response.json();

        commentsList.innerHTML = '';
        comments.forEach(comment => {
            commentsList.appendChild(createCommentElement(comment));
        });
        commentsList.scrollTop = commentsList.scrollHeight; // Прокрутка вниз

    } catch (error) {
        console.error('Ошибка загрузки комментариев:', error);
    }
}

async function handleSubmitComment() {
    const content = commentContentInput.value.trim();
    if (!content || !currentPostIdForComments) return;

    try {
        const response = await fetch(`${API_BASE_URL}/api/posts/${currentPostIdForComments}/comments`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ content })
        });

        if (response.ok) {
            commentContentInput.value = '';
            // Комментарий будет добавлен через сокет (см. initSocketIO)
        } else {
            alert('Ошибка отправки комментария.');
        }

    } catch (error) {
        console.error('Ошибка отправки комментария:', error);
    }
}


// ===============================================
// 7. ЧАТЫ И СООБЩЕНИЯ
// ===============================================

async function loadChats() {
    chatList.innerHTML = '';
    chatWindow.style.display = 'none'; // Скрываем окно чата при загрузке списка

    try {
        const response = await fetch(`${API_BASE_URL}/api/chats`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const chats = await response.json();

        chats.forEach(chat => {
            chatList.appendChild(createChatElement(chat));
        });
    } catch (error) {
        console.error('Ошибка загрузки чатов:', error);
    }
}

async function findOrCreateChat(targetUserId) {
    try {
        const response = await fetch(`${API_BASE_URL}/api/chats/findOrCreate`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ targetUserId })
        });

        if (response.ok) {
            const data = await response.json();
            // Получаем имя собеседника
            const partner = data.chat.participants.find(p => p._id !== currentUserId);
            const partnerName = partner ? partner.username : 'Неизвестно';

            // Переходим в чат
            showView('messages');
            openChat(data.chat._id, partnerName, targetUserId);
        } else {
            alert('Ошибка при создании чата.');
        }
    } catch (error) {
        console.error('Ошибка findOrCreateChat:', error);
    }
}

async function openChat(chatId, partnerName, partnerId) {
    currentChatId = chatId;
    currentPartnerId = partnerId;
    document.getElementById('chat-partner-name').textContent = partnerName;
    
    messagesContainer.innerHTML = '';
    chatWindow.style.display = 'flex';
    messageContentInput.disabled = false;
    sendMessageButton.disabled = false;

    // Вступаем в комнату сокетов
    if (socket) {
        socket.emit('join chat', chatId);
    }

    try {
        const response = await fetch(`${API_BASE_URL}/api/chats/${chatId}/messages`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const messages = await response.json();

        messages.forEach(msg => messagesContainer.appendChild(createMessageElement(msg)));
        messagesContainer.scrollTop = messagesContainer.scrollHeight; // Прокрутка вниз
        
    } catch (error) {
        console.error('Ошибка загрузки сообщений:', error);
    }
    
    // Показываем кнопку "Назад" только на мобильных
    if (window.innerWidth < 768) {
        document.getElementById('chat-list-container').style.display = 'none';
        backToChatsButton.style.display = 'inline';
    }
}

function handleSendMessage() {
    const content = messageContentInput.value.trim();
    if (!content || !currentChatId) return;

    const messageData = {
        chatId: currentChatId,
        senderId: currentUserId,
        content: content
    };

    if (socket) {
        socket.emit('send message', messageData);
        messageContentInput.value = '';
    }
}

function handleBackToChats() {
    if (socket && currentChatId) {
        socket.emit('leave chat', currentChatId);
    }
    currentChatId = null;
    currentPartnerId = null;

    if (window.innerWidth < 768) {
        document.getElementById('chat-list-container').style.display = 'flex';
        chatWindow.style.display = 'none';
        backToChatsButton.style.display = 'none';
    }
}


// ===============================================
// 8. SOCKET.IO И РЕАЛЬНОЕ ВРЕМЯ
// ===============================================

function initSocketIO() {
    socket = io(API_BASE_URL, {
        auth: { token: token } 
    });
    
    socket.on('connect', () => {
        socket.emit('register user', currentUserId);
    });

    // Обновление ленты при новом посте
    socket.on('new post', (post) => {
        if (currentView === 'feed') {
            const element = createPostElement(post);
            postsList.prepend(element); // Добавляем сверху
        }
    });
    
    // Обновление лайков
    socket.on('post liked', ({ postId, likes }) => {
        const postElement = document.querySelector(`.post[data-post-id="${postId}"]`);
        if (postElement) {
            const likeButton = postElement.querySelector('.like-button');
            const likeCountSpan = postElement.querySelector('.like-count');
            const heartIcon = postElement.querySelector('.fa-heart');
            
            likeCountSpan.textContent = likes;
            
            // Переключаем классы
            const isLiked = likeButton.classList.contains('liked');
            if (isLiked && likes < likeCountSpan.textContent) { // Если был лайк, а стало меньше
                likeButton.classList.remove('liked');
                heartIcon.classList.remove('fa-solid');
                heartIcon.classList.add('fa-regular');
            } else if (!isLiked && likes > likeCountSpan.textContent) { // Если не было лайка, а стало больше
                 likeButton.classList.add('liked');
                heartIcon.classList.remove('fa-regular');
                heartIcon.classList.add('fa-solid');
            }
        }
    });

    // Получение нового комментария
    socket.on('new comment', (comment) => {
        if (currentPostIdForComments === comment.postId) {
            commentsList.appendChild(createCommentElement(comment));
            commentsList.scrollTop = commentsList.scrollHeight; // Прокрутка вниз
        }
    });

    // Получение нового сообщения
    socket.on('receive message', (message) => {
        if (currentChatId === message.chatId) {
            messagesContainer.appendChild(createMessageElement(message));
            messagesContainer.scrollTop = messagesContainer.scrollHeight;
        }
        // Также обновляем список чатов
        loadChats();
    });
    
    // Принудительное обновление списка чатов (когда пришло сообщение, а чат был закрыт)
    socket.on('update chat list', ({ chatId }) => {
         if (currentView === 'messages' && currentChatId !== chatId) {
             loadChats();
         }
    });

    socket.on('disconnect', () => {
        console.log('Socket disconnected');
    });
}


// ===============================================
// 9. ЗАПУСК И ОБРАБОТЧИКИ СОБЫТИЙ
// ===============================================

document.addEventListener('DOMContentLoaded', () => {
    // Проверка аутентификации при загрузке
    if (token && currentUsername) {
        showSocialScreen(currentUsername);
    } else {
        showAuthScreen();
    }

    // Переключение форм аутентификации
    showRegisterLink.addEventListener('click', (e) => {
        e.preventDefault();
        loginForm.style.display = 'none';
        registerForm.style.display = 'block';
    });
    showLoginLink.addEventListener('click', (e) => {
        e.preventDefault();
        registerForm.style.display = 'none';
        loginForm.style.display = 'block';
    });

    // Обработчики аутентификации
    loginForm.addEventListener('submit', (e) => handleAuth(e, 'login', loginError));
    registerForm.addEventListener('submit', (e) => handleAuth(e, 'register', registerError));
    
    // Обработчики выхода
    document.getElementById('logout-button').addEventListener('click', handleLogout); // Сайдбар
    document.getElementById('dropdown-logout-button').addEventListener('click', handleLogout); // Дропдаун

    // Обработчики постов
    submitPostInline.addEventListener('click', handleNewPostInline); // Инлайн-пост

    // Обработчики профиля
    editProfileForm.addEventListener('submit', handleEditProfile);

    // Обработчики комментариев
    submitCommentButton.addEventListener('click', handleSubmitComment);
    commentContentInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') handleSubmitComment();
    });
    
    // Обработчики чатов
    sendMessageButton.addEventListener('click', handleSendMessage);
    messageContentInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') handleSendMessage();
    });
    backToChatsButton.addEventListener('click', handleBackToChats);
});