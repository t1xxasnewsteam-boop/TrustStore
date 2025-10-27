const express = require('express');
const Database = require('better-sqlite3');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cookieParser = require('cookie-parser');
const cors = require('cors');
const path = require('path');
const geoip = require('geoip-lite');
const fetch = require('node-fetch');
const multer = require('multer');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = 'your-secret-key-change-this-in-production'; // Измени это!

// Доверяем первому proxy (nginx)
app.set('trust proxy', 1);

// Telegram уведомления
const TELEGRAM_BOT_TOKEN = '7268320384:AAGngFsmkg_x-2rryDtoJkmYD3ymxy5gM9o';
const TELEGRAM_CHAT_ID = '6185074849';

// Функция отправки уведомления в Telegram
async function sendTelegramNotification(message, silent = false) {
    try {
        const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                chat_id: TELEGRAM_CHAT_ID,
                text: message,
                parse_mode: 'HTML',
                disable_notification: silent
            })
        });
        
        if (response.ok) {
            console.log('✅ Telegram уведомление отправлено');
        }
    } catch (error) {
        console.error('❌ Ошибка отправки Telegram уведомления:', error);
    }
}

// Функция отправки изображения в Telegram
async function sendTelegramPhoto(imageUrl, caption, silent = false) {
    try {
        const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendPhoto`;
        const fullImageUrl = `https://truststore.ru${imageUrl}`;
        
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                chat_id: TELEGRAM_CHAT_ID,
                photo: fullImageUrl,
                caption: caption,
                parse_mode: 'HTML',
                disable_notification: silent
            })
        });
        
        if (response.ok) {
            console.log('✅ Telegram фото отправлено');
        }
    } catch (error) {
        console.error('❌ Ошибка отправки Telegram фото:', error);
    }
}

// Middleware
app.use(express.json());
app.use(cookieParser());
app.use(cors());

// Блокируем прямой доступ к admin.html ДО статических файлов
app.use((req, res, next) => {
    if (req.path === '/admin.html') {
        return res.status(404).send('Not Found');
    }
    next();
});

app.use(express.static(__dirname)); // Раздача статических файлов
app.use('/uploads', express.static(path.join(__dirname, 'uploads'))); // Раздача загруженных файлов

// Настройка multer для загрузки изображений
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        const uploadDir = path.join(__dirname, 'uploads', 'chat-images');
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
        }
        cb(null, uploadDir);
    },
    filename: function (req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, uniqueSuffix + path.extname(file.originalname));
    }
});

// Функция для удаления старых изображений (старше 7 дней)
function cleanOldImages() {
    const uploadDir = path.join(__dirname, 'uploads', 'chat-images');
    const sevenDaysAgo = Date.now() - (7 * 24 * 60 * 60 * 1000); // 7 дней в миллисекундах
    
    if (!fs.existsSync(uploadDir)) {
        return;
    }
    
    fs.readdir(uploadDir, (err, files) => {
        if (err) {
            console.error('❌ Ошибка чтения папки uploads:', err);
            return;
        }
        
        let deletedCount = 0;
        files.forEach(file => {
            const filePath = path.join(uploadDir, file);
            fs.stat(filePath, (err, stats) => {
                if (err) {
                    console.error('❌ Ошибка получения информации о файле:', err);
                    return;
                }
                
                // Удаляем файлы старше 7 дней
                if (stats.mtime.getTime() < sevenDaysAgo) {
                    fs.unlink(filePath, (err) => {
                        if (err) {
                            console.error('❌ Ошибка удаления файла:', err);
                        } else {
                            deletedCount++;
                            console.log(`🗑️ Удален старый файл: ${file}`);
                        }
                    });
                }
            });
        });
        
        if (deletedCount > 0) {
            console.log(`✅ Удалено старых изображений: ${deletedCount}`);
        }
    });
}

// Запуск очистки при старте сервера
cleanOldImages();

// Запуск очистки каждый час
setInterval(cleanOldImages, 60 * 60 * 1000); // 1 час

const upload = multer({
    storage: storage,
    limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
    fileFilter: function (req, file, cb) {
        const allowedTypes = /jpeg|jpg|png|gif|webp/;
        const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
        const mimetype = allowedTypes.test(file.mimetype);
        
        if (mimetype && extname) {
            return cb(null, true);
        } else {
            cb(new Error('Только изображения разрешены!'));
        }
    }
});

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
        message TEXT,
        image_url TEXT,
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

// Миграция: добавление колонки image_url если её нет
try {
    // Проверяем структуру таблицы
    const tableInfo = db.prepare("PRAGMA table_info(support_messages)").all();
    const hasImageUrl = tableInfo.some(col => col.name === 'image_url');
    
    if (!hasImageUrl) {
        console.log('⚙️ Добавление колонки image_url в support_messages...');
        db.exec('ALTER TABLE support_messages ADD COLUMN image_url TEXT');
        console.log('✅ Колонка image_url успешно добавлена!');
    } else {
        console.log('✅ Колонка image_url уже существует');
    }
} catch (error) {
    console.error('❌ Ошибка миграции:', error.message);
}

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
    
    console.log('\n========== AUTH CHECK ==========');
    console.log('📍 Path:', req.path);
    console.log('🌐 Host:', req.headers.host);
    console.log('🔒 Protocol:', req.protocol);
    console.log('🍪 All Cookies:', JSON.stringify(req.cookies));
    console.log('🍪 Cookie Header:', req.headers.cookie);
    console.log('🔑 Token found:', token ? 'ДА' : 'НЕТ');
    console.log('================================\n');
    
    if (!token) {
        console.log('❌ Токен не найден в cookies');
        return res.status(401).json({ error: 'Не авторизован' });
    }

    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        req.userId = decoded.id;
        console.log('✅ Токен валиден, пользователь:', decoded.id);
        next();
    } catch (error) {
        console.log('❌ Невалидный токен:', error.message);
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
        
        // Отправляем беззвучное уведомление о новом посетителе
        const notificationText = `👤 Новый посетитель\n\n` +
            `${country}\n` +
            `📱 Устройство: ${deviceType}\n` +
            `🌐 IP: ${cleanIp}`;
        
        sendTelegramNotification(notificationText, true); // silent = true
        
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

        const token = jwt.sign({ id: admin.id }, JWT_SECRET, { expiresIn: '30d' });
        
        // Настройки cookie для работы через nginx proxy с HTTPS
        const cookieOptions = {
            httpOnly: true, // Безопасность - только HTTP
            secure: true, // ВАЖНО! true для HTTPS
            sameSite: 'none', // Для работы через proxy
            maxAge: 30 * 24 * 60 * 60 * 1000, // 30 дней
            path: '/' // Cookie доступен на всех путях
        };
        
        res.cookie('token', token, cookieOptions);
        
        console.log('🍪 Cookie установлен с настройками:', JSON.stringify(cookieOptions));
        console.log('🌐 Host:', req.headers.host);
        console.log('🔒 Protocol:', req.protocol);
        console.log('📋 Headers:', JSON.stringify(req.headers, null, 2));

        console.log('✅ Успешный вход:', username);
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

// API для загрузки изображения от клиента
app.post('/api/support/upload-image', (req, res) => {
    console.log('📤 Запрос загрузки изображения от клиента');
    upload.single('image')(req, res, (err) => {
        try {
            if (err) {
                console.error('❌ Ошибка multer (клиент):', err);
                return res.status(400).json({ error: err.message || 'Ошибка загрузки файла' });
            }
            
            if (!req.file) {
                console.error('❌ Файл не загружен от клиента');
                return res.status(400).json({ error: 'Файл не загружен' });
            }
            
            const imageUrl = `/uploads/chat-images/${req.file.filename}`;
            console.log('✅ Изображение загружено клиентом:', imageUrl);
            console.log('📁 Размер файла:', req.file.size, 'байт');
            res.json({ success: true, imageUrl });
        } catch (error) {
            console.error('❌ Ошибка загрузки изображения от клиента:', error);
            res.status(500).json({ error: 'Ошибка сервера' });
        }
    });
});

// API для загрузки изображения от админа (без authMiddleware для работы через proxy)
app.post('/api/admin/support/upload-image', (req, res) => {
    console.log('📤 Запрос загрузки изображения от админа');
    upload.single('image')(req, res, (err) => {
        try {
            if (err) {
                console.error('❌ Ошибка multer:', err);
                return res.status(400).json({ error: err.message || 'Ошибка загрузки файла' });
            }
            
            if (!req.file) {
                console.error('❌ Файл не загружен');
                return res.status(400).json({ error: 'Файл не загружен' });
            }
            
            const imageUrl = `/uploads/chat-images/${req.file.filename}`;
            console.log('✅ Изображение загружено админом:', imageUrl);
            console.log('📁 Размер файла:', req.file.size, 'байт');
            res.json({ success: true, imageUrl });
        } catch (error) {
            console.error('❌ Ошибка загрузки изображения:', error);
            res.status(500).json({ error: 'Ошибка сервера' });
        }
    });
});

// API для создания тикета/отправки сообщения в поддержку
app.post('/api/support/send-message', (req, res) => {
    try {
        const { ticketId, customerName, customerEmail, message, imageUrl } = req.body;
        
        console.log('💬 Получено сообщение от клиента:', { ticketId, customerName, message, imageUrl });
        
        if (!message && !imageUrl) {
            return res.status(400).json({ error: 'Сообщение или изображение обязательны' });
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
            
            // Отправляем уведомление в Telegram о новом тикете
            if (imageUrl) {
                const caption = `🆕 <b>Новый тикет!</b>\n\n` +
                    `📋 ID: <code>${finalTicketId}</code>\n` +
                    `👤 Клиент: ${customerName || 'Гость'}\n` +
                    `${customerEmail ? `📧 Email: ${customerEmail}\n` : ''}` +
                    `${message ? `💬 ${message}\n` : ''}` +
                    `🔗 <a href="https://truststore.ru/t1xxas">Открыть админку</a>`;
                
                sendTelegramPhoto(imageUrl, caption);
            } else {
                const notificationText = `🆕 <b>Новый тикет!</b>\n\n` +
                    `📋 ID: <code>${finalTicketId}</code>\n` +
                    `👤 Клиент: ${customerName || 'Гость'}\n` +
                    `${customerEmail ? `📧 Email: ${customerEmail}\n` : ''}` +
                    `💬 Сообщение: ${message}\n\n` +
                    `🔗 <a href="https://truststore.ru/t1xxas">Открыть админку</a>`;
                
                sendTelegramNotification(notificationText);
            }
        } else {
            // Обновляем время последнего сообщения и помечаем как непрочитанное
            db.prepare(`
                UPDATE support_tickets 
                SET last_message_at = CURRENT_TIMESTAMP, unread_admin = 1
                WHERE ticket_id = ?
            `).run(finalTicketId);
            
            // Отправляем уведомление о новом сообщении
            if (imageUrl) {
                const caption = `💬 <b>Новое сообщение!</b>\n\n` +
                    `📋 Тикет: <code>${finalTicketId}</code>\n` +
                    `👤 Клиент: ${customerName || 'Гость'}\n` +
                    `${message ? `💬 ${message}\n` : ''}` +
                    `🔗 <a href="https://truststore.ru/t1xxas">Открыть админку</a>`;
                
                sendTelegramPhoto(imageUrl, caption);
            } else {
                const notificationText = `💬 <b>Новое сообщение!</b>\n\n` +
                    `📋 Тикет: <code>${finalTicketId}</code>\n` +
                    `👤 Клиент: ${customerName || 'Гость'}\n` +
                    `💬 Сообщение: ${message}\n\n` +
                    `🔗 <a href="https://truststore.ru/t1xxas">Открыть админку</a>`;
                
                sendTelegramNotification(notificationText);
            }
        }
        
        // Добавляем сообщение
        const messageResult = db.prepare(`
            INSERT INTO support_messages (ticket_id, sender_type, sender_name, message, image_url)
            VALUES (?, 'customer', ?, ?, ?)
        `).run(finalTicketId, customerName || 'Гость', message || null, imageUrl || null);
        
        console.log('✅ Сообщение клиента сохранено, ID:', messageResult.lastInsertRowid);
        
        res.json({ success: true, ticketId: finalTicketId, messageId: messageResult.lastInsertRowid });
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
        
        console.log('📋 Запрос тикета:', ticketId);
        
        // Получаем информацию о тикете
        const ticket = db.prepare(`
            SELECT * FROM support_tickets WHERE ticket_id = ?
        `).get(ticketId);
        
        if (!ticket) {
            console.log('❌ Тикет не найден:', ticketId);
            return res.status(404).json({ error: 'Тикет не найден' });
        }
        
        console.log('✅ Тикет найден:', ticket);
        
        // Получаем все сообщения
        const messages = db.prepare(`
            SELECT * FROM support_messages
            WHERE ticket_id = ?
            ORDER BY created_at ASC
        `).all(ticketId);
        
        console.log('💬 Найдено сообщений:', messages.length);
        console.log('📝 Сообщения:', messages);
        
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
        const { ticketId, message, imageUrl } = req.body;
        
        console.log('📨 Получен запрос на отправку ответа:', { ticketId, message, imageUrl });
        
        if ((!message && !imageUrl) || !ticketId) {
            console.log('❌ Ошибка: отсутствуют обязательные поля');
            return res.status(400).json({ error: 'Тикет и сообщение/изображение обязательны' });
        }
        
        // Добавляем сообщение от админа
        const result = db.prepare(`
            INSERT INTO support_messages (ticket_id, sender_type, sender_name, message, image_url)
            VALUES (?, 'admin', 'Артём', ?, ?)
        `).run(ticketId, message || null, imageUrl || null);
        
        console.log('✅ Сообщение добавлено в БД, ID:', result.lastInsertRowid);
        
        // Обновляем время последнего сообщения
        db.prepare(`
            UPDATE support_tickets 
            SET last_message_at = CURRENT_TIMESTAMP
            WHERE ticket_id = ?
        `).run(ticketId);
        
        console.log('✅ Ответ админа отправлен успешно');
        res.json({ success: true, messageId: result.lastInsertRowid });
    } catch (error) {
        console.error('❌ Ошибка отправки ответа:', error);
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

// Секретный роут для админ панели (БЕЗ authMiddleware - страница сама проверяет)
app.get('/t1xxas', (req, res) => {
    res.sendFile(path.join(__dirname, 'admin.html'));
});

// Перенаправляем /admin на главную страницу
app.get('/admin', (req, res) => {
    res.redirect('/');
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
    📊 Админ-панель: http://localhost:${PORT}/t1xxas
    👤 Логин: admin
    🔑 Пароль: admin123
    `);
});

