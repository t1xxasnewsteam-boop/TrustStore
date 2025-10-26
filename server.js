const express = require('express');
const Database = require('better-sqlite3');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cookieParser = require('cookie-parser');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = 'your-secret-key-change-this-in-production'; // Измени это!

// Middleware
app.use(express.json());
app.use(cookieParser());
app.use(cors());
app.use(express.static(__dirname)); // Раздача статических файлов

// Инициализация БД
const db = new Database('analytics.db');

// Создание таблиц
db.exec(`
    CREATE TABLE IF NOT EXISTS visits (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        page TEXT NOT NULL,
        ip TEXT,
        user_agent TEXT,
        referrer TEXT,
        device_type TEXT,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS admins (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
`);

// Создаем дефолтного админа (username: admin, password: admin123)
const checkAdmin = db.prepare('SELECT * FROM admins WHERE username = ?').get('admin');
if (!checkAdmin) {
    const hashedPassword = bcrypt.hashSync('admin123', 10);
    db.prepare('INSERT INTO admins (username, password) VALUES (?, ?)').run('admin', hashedPassword);
    console.log('✅ Создан дефолтный админ: admin / admin123');
}

// Middleware для проверки JWT
const authMiddleware = (req, res, next) => {
    const token = req.cookies.token;
    
    if (!token) {
        return res.status(401).json({ error: 'Не авторизован' });
    }

    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        req.userId = decoded.id;
        next();
    } catch (error) {
        return res.status(401).json({ error: 'Невалидный токен' });
    }
};

// API Routes

// Трекинг посещений
app.post('/api/track', (req, res) => {
    try {
        const { page, referrer } = req.body;
        const ip = req.headers['x-forwarded-for'] || req.connection.remoteAddress;
        const userAgent = req.headers['user-agent'];
        
        // Определяем тип устройства
        const isMobile = /mobile|android|iphone|ipad|tablet/i.test(userAgent);
        const deviceType = isMobile ? 'Mobile' : 'Desktop';

        const stmt = db.prepare('INSERT INTO visits (page, ip, user_agent, referrer, device_type) VALUES (?, ?, ?, ?, ?)');
        stmt.run(page, ip, userAgent, referrer, deviceType);

        res.json({ success: true });
    } catch (error) {
        console.error('Ошибка трекинга:', error);
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

// Авторизация
app.post('/api/login', (req, res) => {
    try {
        const { username, password } = req.body;

        const admin = db.prepare('SELECT * FROM admins WHERE username = ?').get(username);
        
        if (!admin || !bcrypt.compareSync(password, admin.password)) {
            return res.status(401).json({ error: 'Неверные данные' });
        }

        const token = jwt.sign({ id: admin.id }, JWT_SECRET, { expiresIn: '7d' });
        
        res.cookie('token', token, {
            httpOnly: true,
            maxAge: 7 * 24 * 60 * 60 * 1000 // 7 дней
        });

        res.json({ success: true, message: 'Успешный вход' });
    } catch (error) {
        console.error('Ошибка входа:', error);
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

// Выход
app.post('/api/logout', (req, res) => {
    res.clearCookie('token');
    res.json({ success: true });
});

// Проверка авторизации
app.get('/api/check-auth', authMiddleware, (req, res) => {
    res.json({ authenticated: true });
});

// Получение статистики
app.get('/api/stats', authMiddleware, (req, res) => {
    try {
        // Общая статистика
        const totalVisits = db.prepare('SELECT COUNT(*) as count FROM visits').get();
        const uniqueIPs = db.prepare('SELECT COUNT(DISTINCT ip) as count FROM visits').get();
        
        // Посещения по страницам
        const pageViews = db.prepare(`
            SELECT page, COUNT(*) as count 
            FROM visits 
            GROUP BY page 
            ORDER BY count DESC
        `).all();

        // Посещения по дням (последние 7 дней)
        const dailyVisits = db.prepare(`
            SELECT DATE(timestamp) as date, COUNT(*) as count 
            FROM visits 
            WHERE timestamp >= datetime('now', '-7 days')
            GROUP BY DATE(timestamp)
            ORDER BY date
        `).all();

        // По типу устройств
        const deviceStats = db.prepare(`
            SELECT device_type, COUNT(*) as count 
            FROM visits 
            GROUP BY device_type
        `).all();

        // Последние посещения
        const recentVisits = db.prepare(`
            SELECT page, ip, device_type, timestamp 
            FROM visits 
            ORDER BY timestamp DESC 
            LIMIT 20
        `).all();

        res.json({
            total: totalVisits.count,
            unique: uniqueIPs.count,
            pageViews,
            dailyVisits,
            deviceStats,
            recentVisits
        });
    } catch (error) {
        console.error('Ошибка получения статистики:', error);
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

// Запуск сервера
app.listen(PORT, () => {
    console.log(`
    ✅ Сервер запущен на http://localhost:${PORT}
    📊 Админ-панель: http://localhost:${PORT}/admin.html
    👤 Логин: admin
    🔑 Пароль: admin123
    `);
});

