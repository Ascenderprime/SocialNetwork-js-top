
let socket = null;
let currentUser = null;
let typingTimeout = null;
let typingUsers = [];


const loginScreen = document.getElementById('loginScreen');
const chatScreen = document.getElementById('chatScreen');
const loginForm = document.getElementById('loginForm');
const usernameInput = document.getElementById('usernameInput');
const avatarGrid = document.getElementById('avatarGrid');
const loginBtn = document.getElementById('loginBtn');

const sidebar = document.getElementById('sidebar');
const toggleSidebarBtn = document.getElementById('toggleSidebar');
const usersList = document.getElementById('usersList');
const usersTitle = document.getElementById('usersTitle');
const onlineCount = document.getElementById('onlineCount');
const currentUserAvatar = document.getElementById('currentUserAvatar');
const currentUsername = document.getElementById('currentUsername');
const leaveBtn = document.getElementById('leaveBtn');

const messagesContainer = document.getElementById('messagesContainer');
const messagesList = document.getElementById('messagesList');
const typingIndicator = document.getElementById('typingIndicator');
const typingText = document.getElementById('typingText');
const messageForm = document.getElementById('messageForm');
const messageInput = document.getElementById('messageInput');
const sendBtn = document.getElementById('sendBtn');
const notifications = document.getElementById('notifications');


const avatars = ['👤', '🦸', '🎭', '🐱', '🦄', '🌟', '🎪', '🚀', '🎨', '🎵', '🌈', '🔥'];


document.addEventListener('DOMContentLoaded', () => {
    initializeAvatars();
    setupEventListeners();
});


function initializeAvatars() {
    avatars.forEach(avatar => {
        const avatarElement = document.createElement('div');
        avatarElement.className = 'avatar-option';
        avatarElement.textContent = avatar;
        avatarElement.addEventListener('click', () => selectAvatar(avatarElement, avatar));
        avatarGrid.appendChild(avatarElement);
    });
}


function setupEventListeners() {
    loginForm.addEventListener('submit', handleLogin);
    usernameInput.addEventListener('input', validateLoginForm);
    
    toggleSidebarBtn.addEventListener('click', toggleSidebar);
    leaveBtn.addEventListener('click', leaveChat);

    messageForm.addEventListener('submit', sendMessage);
    messageInput.addEventListener('input', handleTyping);
    messageInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage(e);
        }
    });
}


function selectAvatar(element, avatar) {
    document.querySelectorAll('.avatar-option').forEach(el => {
        el.classList.remove('selected');
    });
    
    element.classList.add('selected');
    currentUser = { ...currentUser, avatar };
    validateLoginForm();
}


function validateLoginForm() {
    const username = usernameInput.value.trim();
    const hasAvatar = currentUser && currentUser.avatar;
    loginBtn.disabled = !username || !hasAvatar;
}


function handleLogin(e) {
    e.preventDefault();
    const username = usernameInput.value.trim();
    
    if (username && currentUser && currentUser.avatar) {
        currentUser.username = username;
        connectToChat();
    }
}

// Connect to chat
function connectToChat() {
    socket = io('http://localhost:3001');
    
    socket.on('connect', () => {
        socket.emit('user_join', currentUser);
        showChatScreen();
    });
    
    socket.on('previous_messages', (messages) => {
        displayMessages(messages);
    });
    
    socket.on('new_message', (message) => {
        addMessage(message);
        scrollToBottom();
    });
    
    socket.on('users_update', (users) => {
        updateUsersList(users);
    });
    
    socket.on('user_joined', (data) => {
        showNotification(`${data.username} присоединился к чату`);
    });
    
    socket.on('user_left', (data) => {
        showNotification(`${data.username} покинул чат`);
    });
    
    socket.on('user_typing', (data) => {
        handleUserTyping(data);
    });
    
    socket.on('disconnect', () => {
        showNotification('Соединение потеряно');
    });
}


function showChatScreen() {
    loginScreen.classList.add('hidden');
    chatScreen.classList.remove('hidden');
    
    currentUserAvatar.textContent = currentUser.avatar;
    currentUsername.textContent = currentUser.username;
    
    messageInput.focus();
}


function toggleSidebar() {
    sidebar.classList.toggle('open');
}

function leaveChat() {
    if (socket) {
        socket.disconnect();
    }

    currentUser = null;
    typingUsers = [];
    messagesList.innerHTML = '';
    usersList.innerHTML = '';
    
    chatScreen.classList.add('hidden');
    loginScreen.classList.remove('hidden');
    
    usernameInput.value = '';
    messageInput.value = '';
    document.querySelectorAll('.avatar-option').forEach(el => {
        el.classList.remove('selected');
    });
    validateLoginForm();
}


function displayMessages(messages) {
    messagesList.innerHTML = '';
    messages.forEach(message => addMessage(message));
    scrollToBottom();
}

function addMessage(message) {
    const messageElement = document.createElement('div');
    messageElement.className = `message ${message.userId === socket.id ? 'own' : ''}`;
    
    const isOwn = message.userId === socket.id;
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
                <div class="message-text">${escapeHtml(message.text)}</div>
                <div class="message-time">${formatTime(message.timestamp)}</div>
            </div>
        </div>
    `;
    
    messagesList.appendChild(messageElement);
}


function shouldShowAvatar(message) {
    const messages = messagesList.children;
    if (messages.length === 0) return true;
    
    const lastMessage = messages[messages.length - 1];
    const lastMessageUserId = lastMessage.querySelector('.message-content').dataset.userId;
    
    return lastMessageUserId !== message.userId;
}


function sendMessage(e) {
    e.preventDefault();
    const text = messageInput.value.trim();
    
    if (text && socket) {
        socket.emit('send_message', { text });
        messageInput.value = '';
        sendBtn.disabled = true;
        
        if (typingTimeout) {
            clearTimeout(typingTimeout);
        }
        socket.emit('typing_stop');
    }
}


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


function updateUsersList(users) {
    usersList.innerHTML = '';
    usersTitle.textContent = `Пользователи онлайн (${users.length})`;
    onlineCount.textContent = `${users.length} пользователей онлайн`;
    
    users.forEach(user => {
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
                    присоединился в ${formatTime(user.joinedAt)}
                </div>
            </div>
            <div class="online-indicator"></div>
        `;
        usersList.appendChild(userElement);
    });
}


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


function scrollToBottom() {
    setTimeout(() => {
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }, 100);
}

function formatTime(timestamp) {
    return new Date(timestamp).toLocaleTimeString('ru-RU', {
        hour: '2-digit',
        minute: '2-digit'
    });
}


function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}