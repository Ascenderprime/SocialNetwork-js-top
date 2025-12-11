// database.js
import mysql from 'mysql2/promise';

class Database {
    constructor() {
        this.pool = null;
    }

    async connect() {
        try {
            this.pool = mysql.createPool({
                host: process.env.MYSQL_HOST || 'localhost',
                port: parseInt(process.env.MYSQL_PORT) || 3306,
                database: process.env.MYSQL_DATABASE || 'chat_app',
                user: process.env.MYSQL_USER || 'root',
                password: process.env.MYSQL_PASSWORD || '',
                connectionLimit: 10,
                waitForConnections: true,
            });

            await this.initTables();
            console.log('✅ MySQL connected successfully');
        } catch (error) {
            console.error('❌ MySQL connection error:', error);
            throw error;
        }
    }

    async initTables() {
        const queries = [
            `CREATE TABLE IF NOT EXISTS users (
                id INT AUTO_INCREMENT PRIMARY KEY,
                username VARCHAR(50) UNIQUE NOT NULL,
                email VARCHAR(100) UNIQUE,
                password VARCHAR(255),
                avatar VARCHAR(10) DEFAULT '👤',
                is_online BOOLEAN DEFAULT FALSE,
                last_seen TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                socket_id VARCHAR(100)
            )`,
            `CREATE TABLE IF NOT EXISTS messages (
                id INT AUTO_INCREMENT PRIMARY KEY,
                sender_id INT NOT NULL,
                room_type ENUM('global', 'private') DEFAULT 'global',
                receiver_id INT,
                text TEXT NOT NULL,
                is_sticker BOOLEAN DEFAULT FALSE,
                read_status BOOLEAN DEFAULT FALSE,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (sender_id) REFERENCES users(id) ON DELETE CASCADE,
                FOREIGN KEY (receiver_id) REFERENCES users(id) ON DELETE CASCADE
            )`,
            `CREATE TABLE IF NOT EXISTS chat_rooms (
                id INT AUTO_INCREMENT PRIMARY KEY,
                type ENUM('global', 'private') DEFAULT 'global',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )`,
            `CREATE TABLE IF NOT EXISTS chat_participants (
                user_id INT NOT NULL,
                room_id INT NOT NULL,
                last_read_message_id INT,
                joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                PRIMARY KEY (user_id, room_id),
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
                FOREIGN KEY (room_id) REFERENCES chat_rooms(id) ON DELETE CASCADE
            )`
        ];

        for (const query of queries) {
            try {
                await this.pool.execute(query);
            } catch (error) {
                console.warn('Table creation warning:', error.message);
            }
        }
    }

    // User methods
    async createUser(username, avatar, email = null, password = null) {
        const [result] = await this.pool.execute(
            'INSERT INTO users (username, avatar, email, password) VALUES (?, ?, ?, ?)',
            [username, avatar, email, password]
        );
        return result.insertId;
    }

    async findUserByUsername(username) {
        const [rows] = await this.pool.execute(
            'SELECT * FROM users WHERE username = ?',
            [username]
        );
        return rows[0];
    }

    async findUserById(id) {
        const [rows] = await this.pool.execute(
            'SELECT * FROM users WHERE id = ?',
            [id]
        );
        return rows[0];
    }

    async updateUserOnlineStatus(userId, isOnline, socketId = null) {
        await this.pool.execute(
            'UPDATE users SET is_online = ?, socket_id = ?, last_seen = CURRENT_TIMESTAMP WHERE id = ?',
            [isOnline, socketId, userId]
        );
    }

    async getAllOnlineUsers() {
        const [rows] = await this.pool.execute(
            'SELECT id, username, avatar, created_at FROM users WHERE is_online = TRUE ORDER BY username'
        );
        return rows;
    }

    // Message methods
    async saveMessage(senderId, text, isSticker = false, roomType = 'global', receiverId = null) {
        const [result] = await this.pool.execute(
            'INSERT INTO messages (sender_id, room_type, receiver_id, text, is_sticker) VALUES (?, ?, ?, ?, ?)',
            [senderId, roomType, receiverId, text, isSticker]
        );
        return result.insertId;
    }

    async getGlobalMessages(limit = 100) {
        const [rows] = await this.pool.execute(`
            SELECT m.*, u.username, u.avatar 
            FROM messages m 
            JOIN users u ON m.sender_id = u.id 
            WHERE m.room_type = 'global' 
            ORDER BY m.created_at DESC 
            LIMIT ?
        `, [limit]);
        return rows.reverse();
    }

    async getPrivateMessages(user1Id, user2Id, limit = 100) {
        const [rows] = await this.pool.execute(`
            SELECT m.*, u.username, u.avatar 
            FROM messages m 
            JOIN users u ON m.sender_id = u.id 
            WHERE m.room_type = 'private' 
            AND ((m.sender_id = ? AND m.receiver_id = ?) OR (m.sender_id = ? AND m.receiver_id = ?))
            ORDER BY m.created_at DESC 
            LIMIT ?
        `, [user1Id, user2Id, user2Id, user1Id, limit]);
        return rows.reverse();
    }

    async markMessagesAsRead(senderId, receiverId) {
        await this.pool.execute(`
            UPDATE messages 
            SET read_status = TRUE 
            WHERE sender_id = ? AND receiver_id = ? AND read_status = FALSE
        `, [senderId, receiverId]);
    }

    async getUnreadCount(userId) {
        const [rows] = await this.pool.execute(`
            SELECT COUNT(*) as count 
            FROM messages 
            WHERE receiver_id = ? AND read_status = FALSE
        `, [userId]);
        return rows[0].count;
    }

    async close() {
        if (this.pool) {
            await this.pool.end();
        }
    }
}

export default new Database();