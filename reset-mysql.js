// reset-mysql.js
import mysql from 'mysql2/promise';
import 'dotenv/config';

async function resetMySQLDatabase() {
    let connection;
    
    try {
        console.log('🔄 Сброс MySQL базы данных...');
        
        // Подключаемся к системной базе данных
        connection = await mysql.createConnection({
            host: process.env.MYSQL_HOST || 'localhost',
            port: parseInt(process.env.MYSQL_PORT) || 3306,
            user: process.env.MYSQL_USER || 'root',
            password: process.env.MYSQL_PASSWORD || '',
            multipleStatements: true
        });
        
        const dbName = process.env.MYSQL_DATABASE || 'chat_app';
        
        // Удаляем старую базу данных если существует
        await connection.query(`DROP DATABASE IF EXISTS \`${dbName}\``);
        
        // Создаем новую базу данных
        await connection.query(`CREATE DATABASE \`${dbName}\``);
        
        // Используем новую базу данных
        await connection.query(`USE \`${dbName}\``);
        
        console.log('✅ MySQL база данных сброшена!');
    } catch (error) {
        console.error('❌ Ошибка сброса MySQL БД:', error.message);
    } finally {
        if (connection) {
            await connection.end();
        }
    }
}

resetMySQLDatabase();