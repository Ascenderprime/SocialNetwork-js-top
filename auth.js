// auth.js
const API_URL = 'http://localhost:3001';

class AuthService {
    constructor() {
        this.token = localStorage.getItem('chat_token');
        this.user = JSON.parse(localStorage.getItem('chat_user') || 'null');
    }

    // Регистрация
    async register(username, avatar, password) {
        try {
            const response = await fetch(`${API_URL}/api/register`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    username,
                    avatar,
                    email: null,
                    password: password
                })
            });

            const data = await response.json();
            
            if (data.success) {
                this.saveAuthData(data.token, data.user);
                return { success: true, user: data.user };
            } else {
                return { success: false, error: data.error };
            }
        } catch (error) {
            console.error('Registration error:', error);
            return { success: false, error: 'Ошибка соединения с сервером' };
        }
    }

    // Вход
    async login(username, password) {
        try {
            const response = await fetch(`${API_URL}/api/login`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    username,
                    password: password
                })
            });

            if (response.ok) {
                const data = await response.json();
                this.saveAuthData(data.token, data.user);
                return { success: true, user: data.user };
            } else {
                const errorData = await response.json();
                return { success: false, error: errorData.error || 'Неверные учетные данные' };
            }
        } catch (error) {
            console.error('Login error:', error);
            return { success: false, error: 'Ошибка соединения с сервером' };
        }
    }

    // Проверка токена
    async verifyToken() {
        if (!this.token) return false;

        try {
            const response = await fetch(`${API_URL}/api/verify-token`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ token: this.token })
            });

            if (response.ok) {
                const data = await response.json();
                this.user = data.user;
                localStorage.setItem('chat_user', JSON.stringify(data.user));
                return true;
            }
        } catch (error) {
            console.error('Token verification error:', error);
        }

        this.clearAuthData();
        return false;
    }

    // Сохранение данных авторизации
    saveAuthData(token, user) {
        this.token = token;
        this.user = user;
        localStorage.setItem('chat_token', token);
        localStorage.setItem('chat_user', JSON.stringify(user));
    }

    // Очистка данных авторизации
    clearAuthData() {
        this.token = null;
        this.user = null;
        localStorage.removeItem('chat_token');
        localStorage.removeItem('chat_user');
    }

    // Получение токена
    getToken() {
        return this.token;
    }

    // Получение пользователя
    getUser() {
        return this.user;
    }

    // Проверка авторизации
    isAuthenticated() {
        return !!this.token && !!this.user;
    }

    // Выход
    logout() {
        this.clearAuthData();
    }
}

// Экспортируем singleton экземпляр
export const authService = new AuthService();