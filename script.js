// script.js
import { authService } from './auth.js';

let socket = null;
let currentUser = null;
let typingTimeout = null;
let typingUsers = [];
let currentChat = 'global';
let privateChats = new Map();
let stickersPanel = null;
let chatsPanel = null;
let profileModal = null;
let viewedUserProfileId = null;

// Элементы DOM
const loginScreen = document.getElementById('loginScreen');
const chatScreen = document.getElementById('chatScreen');
const loginForm = document.getElementById('loginForm');
const registerForm = document.getElementById('registerForm');
const loginUsername = document.getElementById('loginUsername');
const loginPassword = document.getElementById('loginPassword');
const registerUsername = document.getElementById('registerUsername');
const registerPassword = document.getElementById('registerPassword');
const registerConfirmPassword = document.getElementById('registerConfirmPassword');
const avatarGrid = document.getElementById('avatarGrid');
const loginBtn = document.getElementById('loginBtn');
const registerBtn = document.getElementById('registerBtn');
const switchToRegister = document.getElementById('switchToRegister');
const switchToLogin = document.getElementById('switchToLogin');

const sidebar = document.getElementById('sidebar');
const toggleSidebarBtn = document.getElementById('toggleSidebar');
const usersList = document.getElementById('usersList');
const usersTitle = document.getElementById('usersTitle');
const onlineCount = document.getElementById('onlineCount');
const currentUserAvatar = document.getElementById('currentUserAvatar');
const currentUsername = document.getElementById('currentUsername');
const leaveBtn = document.getElementById('leaveBtn');
const toggleChatsBtn = document.getElementById('toggleChatsBtn');
const chatTitle = document.getElementById('chatTitle');
const chatTypeIndicator = document.getElementById('chatTypeIndicator');

const messagesContainer = document.getElementById('messagesContainer');
const messagesList = document.getElementById('messagesList');
const typingIndicator = document.getElementById('typingIndicator');
const typingText = document.getElementById('typingText');
const messageForm = document.getElementById('messageForm');
const messageInput = document.getElementById('messageInput');
const sendBtn = document.getElementById('sendBtn');
const emojiBtn = document.getElementById('emojiBtn');
const notifications = document.getElementById('notifications');
const closeChatsBtn = document.getElementById('closeChatsBtn');
const closeProfileBtn = document.getElementById('closeProfile');
const startPrivateChatBtn = document.getElementById('startPrivateChatBtn');

// Аватары для выбора
const avatars = ['👤', '🦸', '🎭', '🐱', '🦄', '🌟', '🎪', '🚀', '🎨', '🎵', '🌈', '🔥'];

// Стикеры
const stickers = {
    'emotions': ['😀', '😂', '🥰', '😎', '🤔', '😢', '🤯', '🥳', '😴', '🤮'],
    'animals': ['🐶', '🐱', '🐭', '🐹', '🐰', '🦊', '🐻', '🐼', '🐨', '🐯'],
    'food': ['🍕', '🍔', '🍟', '🌭', '🍿', '🧁', '🍩', '🍪', '🍎', '🍇'],
    'objects': ['📱', '💻', '🎮', '📷', '🎸', '🎨', '⚽', '🎯', '🎁', '💎'],
    'signs': ['❤️', '👍', '👎', '✨', '🔥', '💯', '🎉', '🚀', '⭐', '💪']
};

// Текущий выбранный аватар для регистрации
let selectedAvatar = '👤';

// Инициализация при загрузке
document.addEventListener('DOMContentLoaded', async () => {
    initializeAvatars();
    setupEventListeners();
    initPanels();
    
    // Проверяем существующую авторизацию
    const isAuthenticated = await authService.verifyToken();
    if (isAuthenticated) {
        const user = authService.getUser();
        currentUser = {
            id: user.id,
            username: user.username,
            avatar: user.avatar
        };
        showChatScreen();
        connectToChat();
    }
});

// Инициализация аватаров
function initializeAvatars() {
    avatarGrid.innerHTML = '';
    avatars.forEach(avatar => {
        const avatarElement = document.createElement('div');
        avatarElement.className = 'avatar-option';
        avatarElement.textContent = avatar;
        avatarElement.addEventListener('click', () => {
            document.querySelectorAll('.avatar-option').forEach(el => {
                el.classList.remove('selected');
            });
            avatarElement.classList.add('selected');
            selectedAvatar = avatar;
            validateRegisterForm();
        });
        avatarGrid.appendChild(avatarElement);
    });
    
    // Выбираем первый аватар по умолчанию
    if (avatars.length > 0) {
        avatarGrid.children[0].classList.add('selected');
    }
}

// Настройка обработчиков событий
function setupEventListeners() {
    // Переключение между формами
    switchToRegister.addEventListener('click', () => {
        loginForm.classList.add('hidden');
        registerForm.classList.remove('hidden');
        validateRegisterForm();
    });
    
    switchToLogin.addEventListener('click', () => {
        registerForm.classList.add('hidden');
        loginForm.classList.remove('hidden');
        validateLoginForm();
    });
    
    // Авторизация
    loginForm.addEventListener('submit', handleLogin);
    loginUsername.addEventListener('input', validateLoginForm);
    loginPassword.addEventListener('input', validateLoginForm);
    
    // Регистрация
    registerForm.addEventListener('submit', handleRegister);
    registerUsername.addEventListener('input', validateRegisterForm);
    registerPassword.addEventListener('input', validateRegisterForm);
    registerConfirmPassword.addEventListener('input', validateRegisterForm);
    
    // Навигация чата
    toggleSidebarBtn.addEventListener('click', toggleSidebar);
    toggleChatsBtn.addEventListener('click', toggleChatsPanel);
    closeChatsBtn.addEventListener('click', () => {
        chatsPanel.classList.add('hidden');
    });
    leaveBtn.addEventListener('click', leaveChat);

    // Сообщения
    messageForm.addEventListener('submit', sendMessage);
    messageInput.addEventListener('input', handleTyping);
    messageInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage(e);
        }
    });

    // Стикеры
    emojiBtn.addEventListener('click', toggleStickersPanel);

    // Профиль
    closeProfileBtn.addEventListener('click', () => {
        profileModal.classList.add('hidden');
    });
    startPrivateChatBtn.addEventListener('click', () => {
        if (viewedUserProfileId) {
            startPrivateChat(viewedUserProfileId);
        }
    });

    // Клики вне панелей
    document.addEventListener('click', handleDocumentClick);
}

// Инициализация панелей
function initPanels() {
    stickersPanel = document.getElementById('stickersPanel');
    chatsPanel = document.getElementById('chatsPanel');
    profileModal = document.getElementById('profileModal');
    
    // Категории стикеров
    document.querySelectorAll('.sticker-category').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const category = e.target.dataset.category;
            showStickersCategory(category);
        });
    });
    
    // Показать первую категорию стикеров
    showStickersCategory('emotions');
}

// Проверка формы входа
function validateLoginForm() {
    const username = loginUsername.value.trim();
    const password = loginPassword.value.trim();
    loginBtn.disabled = !username || !password;
}

// Проверка формы регистрации
function validateRegisterForm() {
    const username = registerUsername.value.trim();
    const password = registerPassword.value.trim();
    const confirmPassword = registerConfirmPassword.value.trim();
    const isAvatarSelected = selectedAvatar !== null;
    
    // Проверяем минимальную длину пароля
    const isPasswordValid = password.length >= 6;
    const doPasswordsMatch = password === confirmPassword;
    
    registerBtn.disabled = !username || !password || !confirmPassword || !isPasswordValid || !doPasswordsMatch || !isAvatarSelected;
}

// Обработка входа
async function handleLogin(e) {
    e.preventDefault();
    const username = loginUsername.value.trim();
    const password = loginPassword.value.trim();
    
    if (username && password) {
        try {
            loginBtn.disabled = true;
            loginBtn.textContent = 'Вход...';
            
            const result = await authService.login(username, password);
            
            if (result.success) {
                currentUser = {
                    id: result.user.id,
                    username: result.user.username,
                    avatar: result.user.avatar
                };
                showChatScreen();
                connectToChat();
            } else {
                showNotification(result.error || 'Ошибка входа');
                loginBtn.disabled = false;
                loginBtn.textContent = 'Войти';
            }
        } catch (error) {
            console.error('Login error:', error);
            showNotification('Ошибка соединения с сервером');
            loginBtn.disabled = false;
            loginBtn.textContent = 'Войти';
        }
    }
}

// Обработка регистрации
async function handleRegister(e) {
    e.preventDefault();
    const username = registerUsername.value.trim();
    const password = registerPassword.value.trim();
    const confirmPassword = registerConfirmPassword.value.trim();
    
    if (password !== confirmPassword) {
        showNotification('Пароли не совпадают');
        return;
    }
    
    if (password.length < 6) {
        showNotification('Пароль должен содержать минимум 6 символов');
        return;
    }
    
    if (username && password && selectedAvatar) {
        try {
            registerBtn.disabled = true;
            registerBtn.textContent = 'Регистрация...';
            
            const result = await authService.register(username, selectedAvatar, password);
            
            if (result.success) {
                showNotification('Регистрация успешна!');
                // Переключаемся на форму входа
                registerForm.classList.add('hidden');
                loginForm.classList.remove('hidden');
                loginUsername.value = username;
                loginPassword.value = '';
                validateLoginForm();
            } else {
                showNotification(result.error || 'Ошибка регистрации');
            }
        } catch (error) {
            console.error('Registration error:', error);
            showNotification('Ошибка соединения с сервером');
        } finally {
            registerBtn.disabled = false;
            registerBtn.textContent = 'Зарегистрироваться';
        }
    }
}

// Подключение к чату
function connectToChat() {
    const authToken = authService.getToken();
    
    socket = io('http://localhost:3001', {
        auth: {
            token: authToken
        }
    });
    
    socket.on('connect', () => {
        // Отправляем данные пользователя
        socket.emit('user_join', currentUser);
        showNotification('Вы успешно подключились к чату');
    });
    
    // Ошибка аутентификации
    socket.on('connect_error', (error) => {
        console.error('Connection error:', error);
        if (error.message.includes('Требуется авторизация') || 
            error.message.includes('Неверный токен')) {
            showNotification('Ошибка авторизации. Пожалуйста, войдите снова.');
            authService.logout();
            leaveChat();
        }
    });
    
    // Сообщения общего чата
    socket.on('previous_messages', (messages) => {
        displayMessages(messages);
    });
    
    socket.on('new_message', (message) => {
        addMessage(message);
        scrollToBottom();
    });
    
    // Пользователи
    socket.on('users_update', (users) => {
        updateUsersList(users);
    });
    
    socket.on('user_joined', (data) => {
        showNotification(`${data.username} присоединился к чату`);
    });
    
    socket.on('user_left', (data) => {
        showNotification(`${data.username} покинул чат`);
    });
    
    // Печатают
    socket.on('user_typing', (data) => {
        handleUserTyping(data);
    });
    
    // Приватные сообщения
    socket.on('private_messages_history', (data) => {
        privateChats.set(data.targetUser.id, data.messages);
        showPrivateChat(data.targetUser.id);
    });
    
    socket.on('new_private_message', (message) => {
        const otherUserId = message.from.id === socket.id ? message.to.id : message.from.id;
        
        if (!privateChats.has(otherUserId)) {
            privateChats.set(otherUserId, []);
        }
        privateChats.get(otherUserId).push(message);
        
        if (currentChat === otherUserId) {
            addPrivateMessage(message);
            scrollToBottom();
        } else {
            showNotification(`Новое сообщение от ${message.from.username}`);
            updateChatsList();
        }
    });
    
    socket.on('private_chat_opened', (data) => {
        showNotification(`${data.username} открыл приватный чат с вами`);
    });
    
    // Профиль
    socket.on('user_profile', (user) => {
        showUserProfile(user);
    });
    
    // Непрочитанные
    socket.on('unread_update', (data) => {
        updateChatsList();
    });
    
    socket.on('unread_cleared', (data) => {
        updateChatsList();
    });
    
    // Отключение
    socket.on('disconnect', () => {
        showNotification('Соединение потеряно');
    });
}

// Показать экран чата
function showChatScreen() {
    loginScreen.classList.add('hidden');
    chatScreen.classList.remove('hidden');
    
    currentUserAvatar.textContent = currentUser.avatar;
    currentUsername.textContent = currentUser.username;
    
    messageInput.focus();
}

// Открыть/закрыть боковую панель
function toggleSidebar() {
    sidebar.classList.toggle('open');
}

// Открыть/закрыть панель чатов
function toggleChatsPanel() {
    chatsPanel.classList.toggle('hidden');
    if (!chatsPanel.classList.contains('hidden')) {
        updateChatsList();
    }
}

// Выйти из чата
function leaveChat() {
    if (socket) {
        socket.disconnect();
    }

    authService.logout();
    
    currentUser = null;
    currentChat = 'global';
    typingUsers = [];
    privateChats.clear();
    messagesList.innerHTML = '';
    usersList.innerHTML = '';
    
    chatScreen.classList.add('hidden');
    loginScreen.classList.remove('hidden');
    
    // Сброс форм
    loginUsername.value = '';
    loginPassword.value = '';
    registerUsername.value = '';
    registerPassword.value = '';
    registerConfirmPassword.value = '';
    
    // Сброс аватаров
    document.querySelectorAll('.avatar-option').forEach(el => {
        el.classList.remove('selected');
    });
    if (avatars.length > 0) {
        avatarGrid.children[0].classList.add('selected');
    }
    selectedAvatar = '👤';
    
    // Переключение на форму входа
    registerForm.classList.add('hidden');
    loginForm.classList.remove('hidden');
    
    validateLoginForm();
    
    loginBtn.disabled = false;
    loginBtn.textContent = 'Войти';
    registerBtn.disabled = false;
    registerBtn.textContent = 'Зарегистрироваться';
}

// Отобразить сообщения
function displayMessages(messages) {
    messagesList.innerHTML = '';
    messages.forEach(message => addMessage(message));
    scrollToBottom();
}

// Добавить сообщение общего чата
function addMessage(message) {
    const messageElement = document.createElement('div');
    messageElement.className = `message ${message.userId === currentUser.id ? 'own' : ''}`;
    
    const isOwn = message.userId === currentUser.id;
    const showAvatar = shouldShowAvatar(message);
    
    messageElement.innerHTML = `
        <div class="message-content">
            <div class="message-avatar" style="${showAvatar ? '' : 'visibility: hidden;'}">
                ${message.avatar}
            </div>
            <div class="message-bubble">
                ${!isOwn && showAvatar ? `
                    <div class="message-header">
                        <div class="message-username">${message.username}</div>
                    </div>
                ` : ''}
                <div class="message-text ${message.isSticker ? 'sticker' : ''}">
                    ${message.isSticker ? message.text : escapeHtml(message.text)}
                </div>
                <div class="message-time">${formatTime(message.timestamp)}</div>
            </div>
        </div>
    `;
    
    messagesList.appendChild(messageElement);
}

// Добавить приватное сообщение
function addPrivateMessage(message) {
    const messageElement = document.createElement('div');
    messageElement.className = `message private ${message.from.id === currentUser.id ? 'own' : ''}`;
    
    const isOwn = message.from.id === currentUser.id;
    const showAvatar = true; // Всегда показывать аватар в приватных
    
    messageElement.innerHTML = `
        <div class="message-content">
            <div class="message-avatar">
                ${isOwn ? message.from.avatar : message.to.avatar}
            </div>
            <div class="message-bubble">
                <div class="message-header">
                    <div class="message-username">${isOwn ? message.from.username : message.to.username}</div>
                </div>
                <div class="message-text ${message.isSticker ? 'sticker' : ''}">
                    ${message.isSticker ? message.text : escapeHtml(message.text)}
                </div>
                <div class="message-time">${formatTime(message.timestamp)}</div>
            </div>
        </div>
    `;
    
    messagesList.appendChild(messageElement);
    scrollToBottom();
}

// Проверка, нужно ли показывать аватар
function shouldShowAvatar(message) {
    const messages = messagesList.children;
    if (messages.length === 0) return true;
    
    const lastMessage = messages[messages.length - 1];
    const lastMessageIsOwn = lastMessage.classList.contains('own');
    const currentIsOwn = message.userId === currentUser.id;
    
    return lastMessageIsOwn !== currentIsOwn;
}

// Отправить сообщение
function sendMessage(e) {
    e.preventDefault();
    const text = messageInput.value.trim();
    
    if (text && socket) {
        if (currentChat === 'global') {
            socket.emit('send_message', { 
                text: text,
                isSticker: false 
            });
        } else {
            socket.emit('send_private_message', {
                targetUserId: currentChat,
                text: text,
                isSticker: false
            });
        }
        
        messageInput.value = '';
        sendBtn.disabled = true;
        
        if (typingTimeout) {
            clearTimeout(typingTimeout);
            socket.emit('typing_stop');
        }
    }
}

// Обработка печати
function handleTyping() {
    const text = messageInput.value.trim();
    sendBtn.disabled = !text;
    
    if (socket && text) {
        socket.emit('typing_start');
        
        if (typingTimeout) {
            clearTimeout(typingTimeout);
        }
        
        typingTimeout = setTimeout(() => {
            socket.emit('typing_stop');
        }, 1000);
    }
}

// Обработка печати других пользователей
function handleUserTyping(data) {
    if (data.isTyping) {
        if (!typingUsers.includes(data.username)) {
            typingUsers.push(data.username);
        }
    } else {
        typingUsers = typingUsers.filter(user => user !== data.username);
    }
    
    updateTypingIndicator();
}

// Обновить индикатор печати
function updateTypingIndicator() {
    if (typingUsers.length === 0) {
        typingIndicator.classList.add('hidden');
        return;
    }
    
    let text = '';
    if (typingUsers.length === 1) {
        text = `${typingUsers[0]} печатает...`;
    } else if (typingUsers.length === 2) {
        text = `${typingUsers[0]} и ${typingUsers[1]} печатают...`;
    } else {
        text = `${typingUsers[0]} и еще ${typingUsers.length - 1} печатают...`;
    }
    
    typingText.textContent = text;
    typingIndicator.classList.remove('hidden');
}

// Обновить список пользователей
function updateUsersList(users) {
    usersList.innerHTML = '';
    const onlineUsers = users.filter(user => user.id !== currentUser.id);
    usersTitle.textContent = `Пользователи онлайн (${onlineUsers.length})`;
    onlineCount.textContent = `${onlineUsers.length + 1} пользователей онлайн`;
    
    onlineUsers.forEach(user => {
        const userElement = document.createElement('div');
        userElement.className = 'user-item';
        userElement.innerHTML = `
            <div class="user-avatar">${user.avatar}</div>
            <div class="user-details">
                <div class="user-name">${escapeHtml(user.username)}</div>
                <div class="user-time">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <circle cx="12" cy="12" r="10"/>
                        <polyline points="12,6 12,12 16,14"/>
                    </svg>
                    присоединился ${formatDate(user.joinedAt)}
                </div>
            </div>
            <div class="user-actions">
                <button class="icon-btn small profile-btn" data-userid="${user.id}" title="Профиль">
                    👤
                </button>
                <button class="icon-btn small chat-btn" data-userid="${user.id}" title="Написать">
                    💬
                </button>
            </div>
            <div class="online-indicator"></div>
        `;
        usersList.appendChild(userElement);
    });
    
    // Обработчики для кнопок пользователей
    document.querySelectorAll('.profile-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const userId = e.target.closest('.profile-btn').dataset.userid;
            viewUserProfile(userId);
        });
    });
    
    document.querySelectorAll('.chat-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const userId = e.target.closest('.chat-btn').dataset.userid;
            startPrivateChat(userId);
        });
    });
}

// Показать профиль пользователя
function viewUserProfile(userId) {
    viewedUserProfileId = userId;
    if (socket) {
        socket.emit('get_user_profile', userId);
    }
}

// Показать профиль в модальном окне
function showUserProfile(user) {
    document.getElementById('profileAvatar').textContent = user.avatar;
    document.getElementById('profileUsername').textContent = user.username;
    document.getElementById('profileStatus').textContent = user.online ? 'В сети' : 'Не в сети';
    document.getElementById('profileStatus').className = user.online ? 'status-online' : 'status-offline';
    document.getElementById('profileJoined').textContent = `Присоединился: ${formatDate(user.joinedAt)}`;
    
    profileModal.classList.remove('hidden');
}

// Начать приватный чат
function startPrivateChat(targetUserId) {
    if (socket) {
        socket.emit('start_private_chat', targetUserId);
        currentChat = targetUserId;
        
        // Обновить UI
        chatTitle.textContent = 'Приватный чат';
        chatTypeIndicator.textContent = 'Приватный';
        chatTypeIndicator.classList.remove('hidden');
        
        // Загружаем историю приватного чата
        const messages = privateChats.get(targetUserId) || [];
        messagesList.innerHTML = '';
        messages.forEach(message => addPrivateMessage(message));
        scrollToBottom();
        
        // Закрыть панели
        chatsPanel.classList.add('hidden');
        profileModal.classList.add('hidden');
        
        // Пометка как прочитанных
        socket.emit('mark_as_read', targetUserId);
    }
}

// Показать приватный чат
function showPrivateChat(userId) {
    messagesList.innerHTML = '';
    const messages = privateChats.get(userId) || [];
    messages.forEach(message => addPrivateMessage(message));
    
    // Пометка как прочитанных
    if (socket) {
        socket.emit('mark_as_read', userId);
    }
    
    scrollToBottom();
}

// Переключиться на общий чат
function switchToGlobalChat() {
    currentChat = 'global';
    chatTitle.textContent = 'Общий чат';
    chatTypeIndicator.textContent = 'Общий';
    chatTypeIndicator.classList.remove('hidden');
    chatsPanel.classList.add('hidden');
    
    // Очищаем список сообщений
    messagesList.innerHTML = '';
}

// Панель стикеров
function toggleStickersPanel() {
    stickersPanel.classList.toggle('hidden');
}

function showStickersCategory(category) {
    // Обновить активную категорию
    document.querySelectorAll('.sticker-category').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.category === category);
    });
    
    // Показать стикеры выбранной категории
    const stickersToShow = stickers[category];
    const container = document.getElementById('stickersContainer');
    container.innerHTML = '';
    
    stickersToShow.forEach(sticker => {
        const stickerElement = document.createElement('div');
        stickerElement.className = 'sticker-item';
        stickerElement.textContent = sticker;
        stickerElement.addEventListener('click', () => {
            sendSticker(sticker);
            stickersPanel.classList.add('hidden');
        });
        container.appendChild(stickerElement);
    });
}

function sendSticker(sticker) {
    if (socket) {
        if (currentChat === 'global') {
            socket.emit('send_message', { 
                text: sticker,
                isSticker: true 
            });
        } else {
            socket.emit('send_private_message', {
                targetUserId: currentChat,
                text: sticker,
                isSticker: true
            });
        }
    }
}

// Обновить список чатов
function updateChatsList() {
    const chatsList = document.getElementById('chatsList');
    chatsList.innerHTML = '';
    
    // Общий чат
    const globalChat = document.createElement('div');
    globalChat.className = `chat-item ${currentChat === 'global' ? 'active' : ''}`;
    globalChat.innerHTML = `
        <div class="user-avatar">👥</div>
        <div class="chat-details">
            <div class="chat-name">Общий чат</div>
            <div class="chat-preview">Все пользователи</div>
        </div>
    `;
    globalChat.addEventListener('click', switchToGlobalChat);
    chatsList.appendChild(globalChat);
    
    // Приватные чаты
    privateChats.forEach((messages, userId) => {
        if (messages.length === 0) return;
        
        const lastMessage = messages[messages.length - 1];
        const unreadCount = messages.filter(msg => 
            msg.to.id === currentUser.id && !msg.read
        ).length;
        
        const otherUser = lastMessage.from.id === currentUser.id ? lastMessage.to : lastMessage.from;
        
        const chatItem = document.createElement('div');
        chatItem.className = `chat-item ${currentChat === userId ? 'active' : ''} ${unreadCount > 0 ? 'unread' : ''}`;
        chatItem.innerHTML = `
            <div class="user-avatar">${otherUser.avatar}</div>
            <div class="chat-details">
                <div class="chat-name">${otherUser.username}</div>
                <div class="chat-preview">${lastMessage.isSticker ? 'Стикер' : (lastMessage.text.length > 20 ? lastMessage.text.substring(0, 20) + '...' : lastMessage.text)}</div>
            </div>
            ${unreadCount > 0 ? `<div class="unread-badge">${unreadCount}</div>` : ''}
        `;
        chatItem.addEventListener('click', () => startPrivateChat(userId));
        chatsList.appendChild(chatItem);
    });
}

// Обработчик кликов вне панелей
function handleDocumentClick(e) {
    if (stickersPanel && !stickersPanel.contains(e.target) && !e.target.closest('#emojiBtn')) {
        stickersPanel.classList.add('hidden');
    }
}

// Показать уведомление
function showNotification(text) {
    const notification = document.createElement('div');
    notification.className = 'notification';
    notification.textContent = text;
    
    notifications.appendChild(notification);
    
    setTimeout(() => {
        if (notification.parentNode) {
            notification.parentNode.removeChild(notification);
        }
    }, 3000);
}

// Прокрутить вниз
function scrollToBottom() {
    setTimeout(() => {
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }, 100);
}

// Форматирование времени
function formatTime(timestamp) {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('ru-RU', {
        hour: '2-digit',
        minute: '2-digit'
    });
}

// Форматирование даты
function formatDate(timestamp) {
    const date = new Date(timestamp);
    const now = new Date();
    const diffTime = Math.abs(now - date);
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) {
        return 'сегодня';
    } else if (diffDays === 1) {
        return 'вчера';
    } else if (diffDays < 7) {
        return `${diffDays} дней назад`;
    } else {
        return date.toLocaleDateString('ru-RU');
    }
}

// Экранирование HTML
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Экспорт для тестирования
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        escapeHtml,
        formatTime,
        formatDate,
        showNotification
    };
}