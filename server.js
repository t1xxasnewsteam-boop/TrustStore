const express = require('express');
const Database = require('better-sqlite3');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cookieParser = require('cookie-parser');
const cors = require('cors');
const path = require('path');
const geoip = require('geoip-lite');

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
        session_id TEXT NOT NULL,
        page TEXT NOT NULL,
        ip TEXT,
        user_agent TEXT,
        referrer TEXT,
        device_type TEXT,
        country TEXT,
        country_code TEXT,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS sessions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        session_id TEXT UNIQUE NOT NULL,
        ip TEXT,
        user_agent TEXT,
        country TEXT,
        country_code TEXT,
        device_type TEXT,
        first_visit DATETIME DEFAULT CURRENT_TIMESTAMP,
        last_visit DATETIME DEFAULT CURRENT_TIMESTAMP,
        pages_count INTEGER DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS orders (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        order_id TEXT UNIQUE NOT NULL,
        customer_name TEXT NOT NULL,
        customer_email TEXT NOT NULL,
        customer_phone TEXT,
        products TEXT NOT NULL,
        total_amount REAL NOT NULL,
        payment_method TEXT,
        status TEXT DEFAULT 'pending',
        ip TEXT,
        country TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS products (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        category TEXT,
        price REAL NOT NULL,
        description TEXT,
        image TEXT,
        sold_count INTEGER DEFAULT 0,
        status TEXT DEFAULT 'active',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS customers (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        email TEXT UNIQUE NOT NULL,
        name TEXT,
        phone TEXT,
        orders_count INTEGER DEFAULT 0,
        total_spent REAL DEFAULT 0,
        first_order DATETIME,
        last_order DATETIME,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS support_tickets (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        ticket_id TEXT UNIQUE NOT NULL,
        customer_name TEXT,
        customer_email TEXT,
        status TEXT DEFAULT 'open',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        last_message_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        unread_admin INTEGER DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS support_messages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        ticket_id TEXT NOT NULL,
        sender_type TEXT NOT NULL,
        sender_name TEXT,
        message TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (ticket_id) REFERENCES support_tickets(ticket_id)
    );

    CREATE TABLE IF NOT EXISTS admins (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_session_id ON visits(session_id);
    CREATE INDEX IF NOT EXISTS idx_timestamp ON visits(timestamp);
    CREATE INDEX IF NOT EXISTS idx_country ON visits(country_code);
    CREATE INDEX IF NOT EXISTS idx_order_status ON orders(status);
    CREATE INDEX IF NOT EXISTS idx_customer_email ON customers(email);
    CREATE INDEX IF NOT EXISTS idx_ticket_status ON support_tickets(status);
    CREATE INDEX IF NOT EXISTS idx_ticket_id ON support_messages(ticket_id);
`);

// Создаем дефолтного админа (username: admin, password: admin123)
const checkAdmin = db.prepare('SELECT * FROM admins WHERE username = ?').get('admin');
if (!checkAdmin) {
    const hashedPassword = bcrypt.hashSync('admin123', 10);
    db.prepare('INSERT INTO admins (username, password) VALUES (?, ?)').run('admin', hashedPassword);
    console.log('✅ Создан дефолтный админ: admin / admin123');
}

// Добавляем товары если их нет
const productsCount = db.prepare('SELECT COUNT(*) as count FROM products').get();
if (productsCount.count === 0) {
    const products = [
        { name: 'ChatGPT Plus', category: 'AI Генерация', price: 2250, image: 'chatgpt.png', description: 'Доступ к ChatGPT Plus на 1 месяц' },
        { name: 'Midjourney Pro', category: 'AI Генерация', price: 3500, image: 'midjourney.png', description: 'Подписка Midjourney Pro на 1 месяц' },
        { name: 'Claude AI Pro', category: 'AI Генерация', price: 2050, image: 'claude.png', description: 'Claude AI Pro на 1 месяц' },
        { name: 'YouTube Premium', category: 'Видео', price: 249, image: 'youtube.png', description: 'YouTube Premium + Music на 1 месяц' },
        { name: 'VPN Premium', category: 'Безопасность', price: 315, image: 'vpn.png', description: 'Личный VPN на 1 месяц' },
        { name: 'Adobe Creative Cloud', category: 'Дизайн', price: 4200, image: 'adobe.png', description: 'Adobe Creative Cloud All Apps' },
        { name: 'CapCut Pro', category: 'Монтаж', price: 1890, image: 'capcut.png', description: 'CapCut Pro на 1 месяц' },
        { name: 'Cursor AI', category: 'AI Генерация', price: 1850, image: 'cursor.png', description: 'Cursor AI Pro на 1 месяц' },
        { name: 'Google Gemini', category: 'AI Генерация', price: 1750, image: 'gemini.png', description: 'Google Gemini + Veo 3' }
    ];
    
    const stmt = db.prepare('INSERT INTO products (name, category, price, image, description) VALUES (?, ?, ?, ?, ?)');
    products.forEach(p => stmt.run(p.name, p.category, p.price, p.image, p.description));
    console.log('✅ Добавлено товаров:', products.length);
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

// Функция для получения или создания сессии
function getOrCreateSession(ip, userAgent) {
    const crypto = require('crypto');
    
    // Определяем тип устройства
    const isMobile = /mobile|android|iphone|ipad|tablet/i.test(userAgent);
    const deviceType = isMobile ? 'Mobile' : 'Desktop';
    
    // Определяем страну по IP
    const cleanIp = ip.replace('::ffff:', '');
    const geo = geoip.lookup(cleanIp);
    const country = geo ? getCountryName(geo.country) : 'Неизвестно';
    const countryCode = geo ? geo.country : 'XX';
    
    // Ищем активную сессию (последние 30 минут)
    const existingSession = db.prepare(`
        SELECT * FROM sessions 
        WHERE ip = ? AND user_agent = ? 
        AND datetime(last_visit) >= datetime('now', '-30 minutes')
        ORDER BY last_visit DESC
        LIMIT 1
    `).get(ip, userAgent);
    
    if (existingSession) {
        // Обновляем существующую сессию
        db.prepare(`
            UPDATE sessions 
            SET last_visit = CURRENT_TIMESTAMP, pages_count = pages_count + 1
            WHERE session_id = ?
        `).run(existingSession.session_id);
        
        return {
            sessionId: existingSession.session_id,
            deviceType,
            country,
            countryCode
        };
    } else {
        // Создаем новую сессию
        const sessionId = crypto.randomBytes(16).toString('hex');
        
        db.prepare(`
            INSERT INTO sessions (session_id, ip, user_agent, country, country_code, device_type)
            VALUES (?, ?, ?, ?, ?, ?)
        `).run(sessionId, ip, userAgent, country, countryCode, deviceType);
        
        return {
            sessionId,
            deviceType,
            country,
            countryCode
        };
    }
}

// Функция для получения названия страны
function getCountryName(code) {
    const countries = {
        'RU': '🇷🇺 Россия',
        'UA': '🇺🇦 Украина',
        'BY': '🇧🇾 Беларусь',
        'KZ': '🇰🇿 Казахстан',
        'US': '🇺🇸 США',
        'DE': '🇩🇪 Германия',
        'GB': '🇬🇧 Великобритания',
        'FR': '🇫🇷 Франция',
        'TR': '🇹🇷 Турция',
        'CN': '🇨🇳 Китай',
        'JP': '🇯🇵 Япония',
        'IN': '🇮🇳 Индия',
        'BR': '🇧🇷 Бразилия',
        'CA': '🇨🇦 Канада',
        'AU': '🇦🇺 Австралия',
        'IT': '🇮🇹 Италия',
        'ES': '🇪🇸 Испания',
        'PL': '🇵🇱 Польша',
        'NL': '🇳🇱 Нидерланды',
        'SE': '🇸🇪 Швеция'
    };
    return countries[code] || `🌍 ${code}`;
}

// Трекинг посещений
app.post('/api/track', (req, res) => {
    try {
        const { page, referrer } = req.body;
        const ip = req.headers['x-forwarded-for'] || req.connection.remoteAddress;
        const userAgent = req.headers['user-agent'];
        
        // Получаем или создаем сессию
        const { sessionId, deviceType, country, countryCode } = getOrCreateSession(ip, userAgent);

        // Записываем посещение страницы
        const stmt = db.prepare(`
            INSERT INTO visits (session_id, page, ip, user_agent, referrer, device_type, country, country_code) 
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `);
        stmt.run(sessionId, page, ip, userAgent, referrer, deviceType, country, countryCode);

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

// Получение статистики (для старой админ-панели)
app.get('/api/stats', authMiddleware, (req, res) => {
    try {
        // Общая статистика - считаем сессии
        const totalSessions = db.prepare('SELECT COUNT(*) as count FROM sessions').get();
        const uniqueIPs = db.prepare('SELECT COUNT(DISTINCT ip) as count FROM sessions').get();
        
        // Посещения по страницам
        const pageViews = db.prepare(`
            SELECT page, COUNT(DISTINCT session_id) as count 
            FROM visits 
            GROUP BY page 
            ORDER BY count DESC
        `).all();

        // Сессии по дням (последние 7 дней)
        const dailyVisits = db.prepare(`
            SELECT DATE(first_visit) as date, COUNT(*) as count 
            FROM sessions 
            WHERE first_visit >= datetime('now', '-7 days')
            GROUP BY DATE(first_visit)
            ORDER BY date
        `).all();

        // По типу устройств
        const deviceStats = db.prepare(`
            SELECT device_type, COUNT(*) as count 
            FROM sessions 
            GROUP BY device_type
        `).all();

        // Последние посещения
        const recentVisits = db.prepare(`
            SELECT v.page, v.ip, v.device_type, v.timestamp, v.country 
            FROM visits v
            ORDER BY v.timestamp DESC 
            LIMIT 20
        `).all();

        res.json({
            total: totalSessions.count,
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

// API для создания тикета/отправки сообщения в поддержку
app.post('/api/support/send-message', (req, res) => {
    try {
        const { ticketId, customerName, customerEmail, message } = req.body;
        
        if (!message) {
            return res.status(400).json({ error: 'Сообщение не может быть пустым' });
        }
        
        let finalTicketId = ticketId;
        
        // Если нет ticketId, создаем новый тикет
        if (!ticketId) {
            finalTicketId = 'TKT-' + Date.now();
            
            db.prepare(`
                INSERT INTO support_tickets (ticket_id, customer_name, customer_email, unread_admin)
                VALUES (?, ?, ?, 1)
            `).run(finalTicketId, customerName || 'Гость', customerEmail || null);
            
            console.log('✅ Создан новый тикет:', finalTicketId);
        } else {
            // Обновляем время последнего сообщения и помечаем как непрочитанное
            db.prepare(`
                UPDATE support_tickets 
                SET last_message_at = CURRENT_TIMESTAMP, unread_admin = 1
                WHERE ticket_id = ?
            `).run(finalTicketId);
        }
        
        // Добавляем сообщение
        db.prepare(`
            INSERT INTO support_messages (ticket_id, sender_type, sender_name, message)
            VALUES (?, 'customer', ?, ?)
        `).run(finalTicketId, customerName || 'Гость', message);
        
        res.json({ success: true, ticketId: finalTicketId });
    } catch (error) {
        console.error('Ошибка отправки сообщения:', error);
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

// API для получения истории сообщений тикета (для клиента)
app.get('/api/support/messages/:ticketId', (req, res) => {
    try {
        const { ticketId } = req.params;
        
        const messages = db.prepare(`
            SELECT * FROM support_messages
            WHERE ticket_id = ?
            ORDER BY created_at ASC
        `).all(ticketId);
        
        res.json({ messages });
    } catch (error) {
        console.error('Ошибка получения сообщений:', error);
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

// API для админа: получение всех тикетов
app.get('/api/admin/support/tickets', authMiddleware, (req, res) => {
    try {
        const tickets = db.prepare(`
            SELECT t.*, 
                   (SELECT COUNT(*) FROM support_messages WHERE ticket_id = t.ticket_id) as messages_count,
                   (SELECT message FROM support_messages WHERE ticket_id = t.ticket_id ORDER BY created_at DESC LIMIT 1) as last_message
            FROM support_tickets t
            ORDER BY t.last_message_at DESC
        `).all();
        
        res.json({ tickets });
    } catch (error) {
        console.error('Ошибка получения тикетов:', error);
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

// API для админа: получение сообщений конкретного тикета
app.get('/api/admin/support/ticket/:ticketId', authMiddleware, (req, res) => {
    try {
        const { ticketId } = req.params;
        
        // Получаем информацию о тикете
        const ticket = db.prepare(`
            SELECT * FROM support_tickets WHERE ticket_id = ?
        `).get(ticketId);
        
        if (!ticket) {
            return res.status(404).json({ error: 'Тикет не найден' });
        }
        
        // Получаем все сообщения
        const messages = db.prepare(`
            SELECT * FROM support_messages
            WHERE ticket_id = ?
            ORDER BY created_at ASC
        `).all(ticketId);
        
        // Помечаем как прочитанное админом
        db.prepare(`
            UPDATE support_tickets 
            SET unread_admin = 0
            WHERE ticket_id = ?
        `).run(ticketId);
        
        res.json({ ticket, messages });
    } catch (error) {
        console.error('Ошибка получения тикета:', error);
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

// API для админа: отправка ответа
app.post('/api/admin/support/reply', authMiddleware, (req, res) => {
    try {
        const { ticketId, message } = req.body;
        
        if (!message || !ticketId) {
            return res.status(400).json({ error: 'Тикет и сообщение обязательны' });
        }
        
        // Добавляем сообщение от админа
        db.prepare(`
            INSERT INTO support_messages (ticket_id, sender_type, sender_name, message)
            VALUES (?, 'admin', 'Поддержка Trust Store', ?)
        `).run(ticketId, message);
        
        // Обновляем время последнего сообщения
        db.prepare(`
            UPDATE support_tickets 
            SET last_message_at = CURRENT_TIMESTAMP
            WHERE ticket_id = ?
        `).run(ticketId);
        
        res.json({ success: true });
    } catch (error) {
        console.error('Ошибка отправки ответа:', error);
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

// API для админа: закрытие тикета
app.post('/api/admin/support/close/:ticketId', authMiddleware, (req, res) => {
    try {
        const { ticketId } = req.params;
        
        db.prepare(`
            UPDATE support_tickets 
            SET status = 'closed'
            WHERE ticket_id = ?
        `).run(ticketId);
        
        res.json({ success: true });
    } catch (error) {
        console.error('Ошибка закрытия тикета:', error);
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

// API для админа: открытие тикета
app.post('/api/admin/support/open/:ticketId', authMiddleware, (req, res) => {
    try {
        const { ticketId } = req.params;
        
        db.prepare(`
            UPDATE support_tickets 
            SET status = 'open', unread_admin = 1
            WHERE ticket_id = ?
        `).run(ticketId);
        
        res.json({ success: true });
    } catch (error) {
        console.error('Ошибка открытия тикета:', error);
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

// API для админа: отправка системного сообщения
app.post('/api/admin/support/system-message', authMiddleware, (req, res) => {
    try {
        const { ticketId, message } = req.body;
        
        if (!message || !ticketId) {
            return res.status(400).json({ error: 'Тикет и сообщение обязательны' });
        }
        
        // Добавляем системное сообщение
        db.prepare(`
            INSERT INTO support_messages (ticket_id, sender_type, sender_name, message)
            VALUES (?, 'system', 'Система', ?)
        `).run(ticketId, message);
        
        // Обновляем время последнего сообщения
        db.prepare(`
            UPDATE support_tickets 
            SET last_message_at = CURRENT_TIMESTAMP
            WHERE ticket_id = ?
        `).run(ticketId);
        
        res.json({ success: true });
    } catch (error) {
        console.error('Ошибка отправки системного сообщения:', error);
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

// API для создания заказа
app.post('/api/create-order', (req, res) => {
    try {
        const { customerName, customerEmail, customerPhone, products, totalAmount, paymentMethod } = req.body;
        const ip = req.headers['x-forwarded-for'] || req.connection.remoteAddress;
        const cleanIp = ip.replace('::ffff:', '');
        const geo = geoip.lookup(cleanIp);
        const country = geo ? getCountryName(geo.country) : 'Неизвестно';
        
        // Генерируем ID заказа
        const orderId = 'ORD-' + Date.now();
        
        // Создаем заказ
        db.prepare(`
            INSERT INTO orders (order_id, customer_name, customer_email, customer_phone, products, total_amount, payment_method, ip, country)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(orderId, customerName, customerEmail, customerPhone, JSON.stringify(products), totalAmount, paymentMethod || 'YooMoney', ip, country);
        
        // Обновляем или создаем клиента
        const existingCustomer = db.prepare('SELECT * FROM customers WHERE email = ?').get(customerEmail);
        if (existingCustomer) {
            db.prepare(`
                UPDATE customers 
                SET name = ?, phone = ?, orders_count = orders_count + 1, 
                    total_spent = total_spent + ?, last_order = CURRENT_TIMESTAMP
                WHERE email = ?
            `).run(customerName, customerPhone, totalAmount, customerEmail);
        } else {
            db.prepare(`
                INSERT INTO customers (email, name, phone, orders_count, total_spent, first_order, last_order)
                VALUES (?, ?, ?, 1, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
            `).run(customerEmail, customerName, customerPhone, totalAmount);
        }
        
        // Обновляем счетчик продаж для товаров
        const productsList = JSON.parse(products);
        productsList.forEach(product => {
            db.prepare('UPDATE products SET sold_count = sold_count + ? WHERE name = ?')
                .run(product.quantity || 1, product.name);
        });
        
        res.json({ success: true, orderId });
    } catch (error) {
        console.error('Ошибка создания заказа:', error);
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

// Получение расширенной статистики для новой админ-панели
app.get('/api/admin-stats', authMiddleware, (req, res) => {
    try {
        // Сессии
        const totalSessions = db.prepare('SELECT COUNT(*) as count FROM sessions').get();
        const totalPageViews = db.prepare('SELECT COUNT(*) as count FROM visits').get();
        
        // Заказы
        const totalOrders = db.prepare('SELECT COUNT(*) as count, SUM(total_amount) as revenue FROM orders').get();
        const ordersThisMonth = db.prepare(`
            SELECT COUNT(*) as count, SUM(total_amount) as revenue 
            FROM orders 
            WHERE created_at >= datetime('now', 'start of month')
        `).get();
        
        const ordersLastMonth = db.prepare(`
            SELECT COUNT(*) as count, SUM(total_amount) as revenue 
            FROM orders 
            WHERE created_at >= datetime('now', '-1 month', 'start of month')
            AND created_at < datetime('now', 'start of month')
        `).get();
        
        // Клиенты
        const totalCustomers = db.prepare('SELECT COUNT(*) as count FROM customers').get();
        const newCustomersThisMonth = db.prepare(`
            SELECT COUNT(*) as count FROM customers 
            WHERE created_at >= datetime('now', 'start of month')
        `).get();
        
        // Товары
        const allProducts = db.prepare('SELECT * FROM products ORDER BY sold_count DESC').all();
        const topProducts = allProducts.slice(0, 5);
        
        // Последние заказы
        const recentOrders = db.prepare(`
            SELECT * FROM orders 
            ORDER BY created_at DESC 
            LIMIT 10
        `).all().map(order => ({
            ...order,
            products: JSON.parse(order.products)
        }));
        
        // Все заказы для раздела Orders
        const allOrders = db.prepare(`
            SELECT * FROM orders 
            ORDER BY created_at DESC
        `).all().map(order => ({
            ...order,
            products: JSON.parse(order.products)
        }));
        
        // Все клиенты
        const allCustomers = db.prepare(`
            SELECT * FROM customers 
            ORDER BY total_spent DESC
        `).all();
        
        // Статистика по странам
        const countryStats = db.prepare(`
            SELECT country, country_code, COUNT(*) as sessions, 
                   SUM(pages_count) as pageviews
            FROM sessions 
            WHERE country_code != 'XX'
            GROUP BY country_code 
            ORDER BY sessions DESC
            LIMIT 10
        `).all();

        // Сессии по дням (последние 7 дней)
        const dailySessions = db.prepare(`
            SELECT DATE(first_visit) as date, COUNT(*) as count 
            FROM sessions 
            WHERE first_visit >= datetime('now', '-7 days')
            GROUP BY DATE(first_visit)
            ORDER BY date
        `).all();
        
        // Продажи по дням (последние 7 дней)
        const dailySales = db.prepare(`
            SELECT DATE(created_at) as date, SUM(total_amount) as revenue, COUNT(*) as orders
            FROM orders 
            WHERE created_at >= datetime('now', '-7 days')
            GROUP BY DATE(created_at)
            ORDER BY date
        `).all();

        // По типу устройств
        const deviceStats = db.prepare(`
            SELECT device_type, COUNT(*) as count 
            FROM sessions 
            GROUP BY device_type
        `).all();

        // Популярные страницы
        const popularPages = db.prepare(`
            SELECT 
                REPLACE(REPLACE(page, 'index.html', 'Главная'), '.html', '') as page,
                COUNT(DISTINCT session_id) as sessions
            FROM visits 
            GROUP BY page 
            ORDER BY sessions DESC
            LIMIT 5
        `).all();

        // Последние посещения с деталями
        const recentVisits = db.prepare(`
            SELECT 
                v.page, 
                v.ip, 
                v.device_type, 
                v.country,
                v.timestamp,
                CASE 
                    WHEN v.user_agent LIKE '%Chrome%' THEN 'Chrome'
                    WHEN v.user_agent LIKE '%Firefox%' THEN 'Firefox'
                    WHEN v.user_agent LIKE '%Safari%' AND v.user_agent NOT LIKE '%Chrome%' THEN 'Safari'
                    WHEN v.user_agent LIKE '%Edge%' THEN 'Edge'
                    ELSE 'Other'
                END as browser
            FROM visits v
            ORDER BY v.timestamp DESC 
            LIMIT 20
        `).all();

        // Топ 5 стран с долями
        const topCountries = countryStats.slice(0, 5);
        const countriesWithShare = topCountries.map(c => ({
            ...c,
            share: ((c.sessions / totalSessions.count) * 100).toFixed(1) + '%'
        }));
        
        // Расчет изменений
        const revenueChange = ordersLastMonth.revenue > 0 
            ? (((ordersThisMonth.revenue || 0) - ordersLastMonth.revenue) / ordersLastMonth.revenue * 100).toFixed(1)
            : 100;
        
        const ordersChange = ordersLastMonth.count > 0
            ? (((ordersThisMonth.count || 0) - ordersLastMonth.count) / ordersLastMonth.count * 100).toFixed(1)
            : 100;

        res.json({
            revenue: {
                total: totalOrders.revenue || 0,
                today: 0, // TODO: добавить расчет за сегодня
                week: 0,  // TODO: добавить расчет за неделю
                month: ordersThisMonth.revenue || 0,
                change: revenueChange
            },
            orders: {
                total: totalOrders.count || 0,
                recent: recentOrders,
                all: allOrders,
                change: ordersChange
            },
            customers: {
                total: totalCustomers.count || 0,
                new: newCustomersThisMonth.count || 0,
                all: allCustomers,
                repeat: totalCustomers.count > 0 ? ((allCustomers.filter(c => c.orders_count > 1).length / totalCustomers.count) * 100).toFixed(0) : 0,
                change: 0 // TODO
            },
            products: {
                all: allProducts,
                top: topProducts
            },
            sessions: {
                total: totalSessions.count,
                unique: totalSessions.count,
                desktop: deviceStats.find(d => d.device_type === 'Desktop')?.count || 0,
                mobile: deviceStats.find(d => d.device_type === 'Mobile')?.count || 0,
                change: 0 // TODO
            },
            pageviews: totalPageViews.count,
            countries: countriesWithShare,
            dailySessions,
            dailySales,
            popularPages,
            recentVisits,
            analytics: {
                conversion: totalSessions.count > 0 ? ((totalOrders.count / totalSessions.count) * 100).toFixed(1) : 0,
                avgOrder: totalOrders.count > 0 ? Math.round(totalOrders.revenue / totalOrders.count) : 0,
                bounceRate: 42.5 // TODO: реальный расчет
            }
        });
    } catch (error) {
        console.error('Ошибка получения админ статистики:', error);
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

// Красивые URL без .html
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'main.html'));
});

app.get('/main', (req, res) => {
    res.sendFile(path.join(__dirname, 'main.html'));
});

app.get('/catalog', (req, res) => {
    res.sendFile(path.join(__dirname, 'catalog.html'));
});

app.get('/cart', (req, res) => {
    res.sendFile(path.join(__dirname, 'cart.html'));
});

app.get('/checkout', (req, res) => {
    res.sendFile(path.join(__dirname, 'checkout.html'));
});

app.get('/success', (req, res) => {
    res.sendFile(path.join(__dirname, 'success.html'));
});

app.get('/socials', (req, res) => {
    res.sendFile(path.join(__dirname, 'socials.html'));
});

app.get('/admin', (req, res) => {
    res.sendFile(path.join(__dirname, 'admin.html'));
});

// Товары с красивыми URL
app.get('/product/chatgpt', (req, res) => {
    res.sendFile(path.join(__dirname, 'product.html'));
});

app.get('/product/midjourney', (req, res) => {
    res.sendFile(path.join(__dirname, 'midjourney.html'));
});

app.get('/product/vpn', (req, res) => {
    res.sendFile(path.join(__dirname, 'vpn.html'));
});

app.get('/product/youtube', (req, res) => {
    res.sendFile(path.join(__dirname, 'youtube.html'));
});

app.get('/product/adobe', (req, res) => {
    res.sendFile(path.join(__dirname, 'adobe.html'));
});

app.get('/product/capcut', (req, res) => {
    res.sendFile(path.join(__dirname, 'capcut.html'));
});

app.get('/product/gemini', (req, res) => {
    res.sendFile(path.join(__dirname, 'gemini.html'));
});

app.get('/product/cursor', (req, res) => {
    res.sendFile(path.join(__dirname, 'cursor.html'));
});

app.get('/product/claude', (req, res) => {
    res.sendFile(path.join(__dirname, 'claude.html'));
});

// Запуск сервера
app.listen(PORT, () => {
    console.log(`
    ✅ Сервер запущен на http://localhost:${PORT}
    📊 Админ-панель: http://localhost:${PORT}/admin
    👤 Логин: admin
    🔑 Пароль: admin123
    `);
});

