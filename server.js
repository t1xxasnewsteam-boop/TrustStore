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
const cheerio = require('cheerio');
require('dotenv').config();
const nodemailer = require('nodemailer');
const sgMail = require('@sendgrid/mail');
const crypto = require('crypto');

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = 'your-secret-key-change-this-in-production'; // Измени это!

// Доверяем первому proxy (nginx)
app.set('trust proxy', 1);

// Telegram уведомления
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || '7268320384:AAGngFsmkg_x-2rryDtoJkmYD3ymxy5gM9o';
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID || '6185074849';

// YooMoney настройки
const YOOMONEY_SECRET = process.env.YOOMONEY_SECRET || ''; // Секретный ключ из YooMoney
const YOOMONEY_WALLET = process.env.YOOMONEY_WALLET || ''; // Номер кошелька

// ==================== EMAIL CONFIGURATION ====================
const emailTransporter = nodemailer.createTransport({
    host: process.env.EMAIL_HOST || 'smtp.yandex.ru',
    port: parseInt(process.env.EMAIL_PORT) || 465,
    secure: process.env.EMAIL_SECURE === 'true' || true,
    auth: {
        user: process.env.EMAIL_USER || 'orders@truststore.ru',
        pass: process.env.EMAIL_PASSWORD
    },
    tls: {
        rejectUnauthorized: false,
        ciphers: 'SSLv3'
    },
    connectionTimeout: 10000, // 10 секунд
    greetingTimeout: 10000,
    socketTimeout: 20000
});

// Настройка SendGrid (запасной вариант)
if (process.env.SENDGRID_API_KEY) {
    sgMail.setApiKey(process.env.SENDGRID_API_KEY);
    console.log('✅ SendGrid API настроен');
}

// Проверка подключения к email серверу (async)
emailTransporter.verify(function (error, success) {
    if (error) {
        console.log('❌ SMTP сервер недоступен:', error.message);
        if (process.env.SENDGRID_API_KEY) {
            console.log('✅ Будет использоваться SendGrid API');
        } else {
            console.log('⚠️ Для исправления: разблокируйте порты 465/587 у провайдера');
            console.log('⚠️ Или добавьте SENDGRID_API_KEY в .env');
        }
    } else {
        console.log('✅ SMTP сервер готов к отправке писем');
    }
});

// 🔥 Система защиты от дублей уведомлений
const notificationCache = new Map(); // ticketId -> { lastNotificationTime, lastMessageCount }
const NOTIFICATION_COOLDOWN = 3 * 60 * 1000; // 3 минуты между уведомлениями для одного тикета

// Проверка, можно ли отправить уведомление для тикета
function canSendNotification(ticketId) {
    const now = Date.now();
    const cached = notificationCache.get(ticketId);
    
    if (!cached) {
        // Первое уведомление для этого тикета
        notificationCache.set(ticketId, { lastNotificationTime: now, count: 1 });
        return true;
    }
    
    const timeSinceLastNotif = now - cached.lastNotificationTime;
    
    if (timeSinceLastNotif >= NOTIFICATION_COOLDOWN) {
        // Прошло достаточно времени, можно отправить
        notificationCache.set(ticketId, { lastNotificationTime: now, count: cached.count + 1 });
        return true;
    }
    
    // Слишком рано для нового уведомления
    console.log(`⏸️  Уведомление для тикета ${ticketId} пропущено (cooldown: ${Math.round(timeSinceLastNotif / 1000)}с / ${NOTIFICATION_COOLDOWN / 1000}с)`);
    return false;
}

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

// Функция отправки документа (PDF) в Telegram
async function sendTelegramDocument(documentUrl, caption, silent = false) {
    try {
        const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendDocument`;
        const fullDocumentUrl = `https://truststore.ru${documentUrl}`;
        
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                chat_id: TELEGRAM_CHAT_ID,
                document: fullDocumentUrl,
                caption: caption,
                parse_mode: 'HTML',
                disable_notification: silent
            })
        });
        
        if (response.ok) {
            console.log('✅ Telegram документ отправлен');
        } else {
            const errorData = await response.json();
            console.error('❌ Ошибка отправки документа:', errorData);
        }
    } catch (error) {
        console.error('❌ Ошибка отправки Telegram документа:', error);
    }
}

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true })); // Для YooMoney form-data
app.use(cookieParser());
app.use(cors());

// Блокируем прямой доступ к admin.html ДО статических файлов
app.use((req, res, next) => {
    if (req.path === '/admin.html') {
        return res.status(404).send('Not Found');
    }
    next();
});

// 🔥 Middleware для удаления .html из URL
app.use((req, res, next) => {
    // Если URL заканчивается на .html - редирект на версию без .html
    if (req.path.endsWith('.html')) {
        const newPath = req.path.slice(0, -5); // Убираем .html
        return res.redirect(301, newPath + (req.url.includes('?') ? req.url.slice(req.url.indexOf('?')) : ''));
    }
    
    // Если запрашивается путь без расширения - пытаемся найти .html версию
    if (!path.extname(req.path) && req.path !== '/') {
        const htmlPath = path.join(__dirname, req.path + '.html');
        if (fs.existsSync(htmlPath)) {
            return res.sendFile(htmlPath);
        }
    }
    
    // Для корневого пути отправляем main.html
    if (req.path === '/') {
        const mainPath = path.join(__dirname, 'main.html');
        if (fs.existsSync(mainPath)) {
            return res.sendFile(mainPath);
        }
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

// Функция для удаления старых файлов (изображения и PDF старше 7 дней)
function cleanOldFiles() {
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
                
                // Удаляем файлы старше 7 дней (изображения и PDF)
                if (stats.mtime.getTime() < sevenDaysAgo) {
                    fs.unlink(filePath, (err) => {
                        if (err) {
                            console.error('❌ Ошибка удаления файла:', err);
                        } else {
                            deletedCount++;
                            const fileType = file.toLowerCase().endsWith('.pdf') ? 'PDF' : 'изображение';
                            console.log(`🗑️ Удалено старое ${fileType}: ${file}`);
                        }
                    });
                }
            });
        });
        
        if (deletedCount > 0) {
            console.log(`✅ Удалено старых файлов: ${deletedCount}`);
        }
    });
}

// Запуск очистки при старте сервера
cleanOldFiles();

// Запуск очистки каждый час
setInterval(cleanOldFiles, 60 * 60 * 1000); // 1 час

const upload = multer({
    storage: storage,
    limits: { fileSize: 20 * 1024 * 1024 }, // 20MB
    fileFilter: function (req, file, cb) {
        console.log('📤 Загрузка файла:', file.originalname);
        console.log('📝 MIME type:', file.mimetype);
        console.log('📝 Extension:', path.extname(file.originalname).toLowerCase());
        
        // Разрешенные расширения и MIME типы (изображения + PDF)
        const allowedExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.pdf'];
        const allowedMimeTypes = [
            'image/jpeg',
            'image/jpg', 
            'image/png',
            'image/gif',
            'image/webp',
            'application/pdf'
        ];
        
        const fileExtension = path.extname(file.originalname).toLowerCase();
        const isValidExtension = allowedExtensions.includes(fileExtension);
        const isValidMimeType = allowedMimeTypes.includes(file.mimetype.toLowerCase());
        
        console.log('✅ Расширение валидно:', isValidExtension);
        console.log('✅ MIME type валиден:', isValidMimeType);
        
        if (isValidExtension && isValidMimeType) {
            console.log('✅ Файл принят!');
            return cb(null, true);
        } else {
            console.log('❌ Файл отклонен!');
            cb(new Error(`Недопустимый формат файла. Разрешены: JPG, JPEG, PNG, GIF, WEBP, PDF`));
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

    CREATE TABLE IF NOT EXISTS product_suggestions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        product_name TEXT NOT NULL,
        description TEXT,
        email TEXT,
        status TEXT DEFAULT 'new',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS promo_codes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        code TEXT UNIQUE NOT NULL,
        discount INTEGER NOT NULL,
        max_uses INTEGER NOT NULL,
        current_uses INTEGER DEFAULT 0,
        expires_at DATETIME NOT NULL,
        is_active INTEGER DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS telegram_reviews (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        telegram_user_id INTEGER,
        author_name TEXT NOT NULL,
        review_text TEXT NOT NULL,
        rating INTEGER DEFAULT 5,
        telegram_comment_id INTEGER UNIQUE,
        telegram_date INTEGER,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    
    CREATE TABLE IF NOT EXISTS telegram_stats (
        id INTEGER PRIMARY KEY CHECK (id = 1),
        total_comments INTEGER DEFAULT 0,
        last_updated DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    
    CREATE TABLE IF NOT EXISTS newsletter_subscribers (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        email TEXT UNIQUE NOT NULL,
        subscribed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        status TEXT DEFAULT 'active'
    );
    
    CREATE TABLE IF NOT EXISTS news (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        date TEXT NOT NULL,
        title TEXT NOT NULL,
        content TEXT NOT NULL,
        image_url TEXT,
        emoji TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        sort_order INTEGER DEFAULT 0
    );
    
    CREATE TABLE IF NOT EXISTS product_inventory (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        product_name TEXT NOT NULL,
        login TEXT NOT NULL,
        password TEXT NOT NULL,
        instructions TEXT,
        status TEXT DEFAULT 'available',
        order_id TEXT,
        sold_at DATETIME,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_session_id ON visits(session_id);
    CREATE INDEX IF NOT EXISTS idx_timestamp ON visits(timestamp);
    CREATE INDEX IF NOT EXISTS idx_country ON visits(country_code);
    CREATE INDEX IF NOT EXISTS idx_order_status ON orders(status);
    CREATE INDEX IF NOT EXISTS idx_customer_email ON customers(email);
    CREATE INDEX IF NOT EXISTS idx_ticket_status ON support_tickets(status);
    CREATE INDEX IF NOT EXISTS idx_ticket_id ON support_messages(ticket_id);
    CREATE INDEX IF NOT EXISTS idx_telegram_comment_id ON telegram_reviews(telegram_comment_id);
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

// Миграция: добавление колонки telegram_date если её нет
try {
    const reviewsTableInfo = db.prepare("PRAGMA table_info(telegram_reviews)").all();
    const hasTelegramDate = reviewsTableInfo.some(col => col.name === 'telegram_date');
    
    if (!hasTelegramDate) {
        console.log('⚙️ Добавление колонки telegram_date в telegram_reviews...');
        db.exec('ALTER TABLE telegram_reviews ADD COLUMN telegram_date INTEGER');
        console.log('✅ Колонка telegram_date успешно добавлена!');
    }
} catch (error) {
    console.error('❌ Ошибка миграции telegram_date:', error.message);
}

// Миграция 4: Добавляем колонку status в orders
try {
    const ordersTableInfo = db.pragma('table_info(orders)');
    const hasStatus = ordersTableInfo.some(col => col.name === 'status');
    
    if (!hasStatus) {
        console.log('⚙️ Добавление колонки status в orders...');
        db.exec('ALTER TABLE orders ADD COLUMN status TEXT DEFAULT "pending"');
        console.log('✅ Колонка status успешно добавлена!');
        
        // Обновляем существующие заказы (считаем их оплаченными)
        const existingOrders = db.prepare('SELECT COUNT(*) as count FROM orders').get();
        if (existingOrders.count > 0) {
            db.exec('UPDATE orders SET status = "paid" WHERE status IS NULL');
            console.log(`✅ Обновлено ${existingOrders.count} существующих заказов`);
        }
    } else {
        console.log('✅ Колонка status уже существует');
    }
} catch (error) {
    console.error('❌ Ошибка миграции status:', error.message);
}

// Создаем дефолтного админа (username: t1xxas, password: Gaga00723)
const checkAdmin = db.prepare('SELECT * FROM admins WHERE username = ?').get('t1xxas');
if (!checkAdmin) {
    const hashedPassword = bcrypt.hashSync('Gaga00723', 10);
    db.prepare('INSERT INTO admins (username, password) VALUES (?, ?)').run('t1xxas', hashedPassword);
    console.log('✅ Создан дефолтный админ: t1xxas / Gaga00723');
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
        let isNewTicket = false;
        
        // Если есть ticketId, проверяем существует ли он в базе
        if (ticketId) {
            const existingTicket = db.prepare('SELECT * FROM support_tickets WHERE ticket_id = ?').get(ticketId);
            
            if (!existingTicket) {
                console.log('⚠️ Тикет не найден в базе:', ticketId, '→ Создаем новый');
                finalTicketId = null; // Сбрасываем чтобы создать новый
            }
        }
        
        // Если нет ticketId или тикет не существует, создаем новый
        if (!finalTicketId) {
            finalTicketId = 'TKT-' + Date.now();
            isNewTicket = true;
            
            db.prepare(`
                INSERT INTO support_tickets (ticket_id, customer_name, customer_email, unread_admin)
                VALUES (?, ?, ?, 1)
            `).run(finalTicketId, customerName || 'Гость', customerEmail || null);
            
            console.log('✅ Создан новый тикет:', finalTicketId);
            
            // Отправляем уведомление в Telegram о новом тикете (с проверкой на дубли)
            if (canSendNotification(finalTicketId)) {
                if (imageUrl) {
                    const caption = `🆕 <b>Новый тикет!</b>\n\n` +
                        `📋 ID: <code>${finalTicketId}</code>\n` +
                        `👤 Клиент: ${customerName || 'Гость'}\n` +
                        `${customerEmail ? `📧 Email: ${customerEmail}\n` : ''}` +
                        `${message ? `💬 ${message}\n` : ''}` +
                        `🔗 <a href="https://truststore.ru/t1xxas">Открыть админку</a>`;
                    
                    const isPDF = imageUrl.toLowerCase().endsWith('.pdf');
                    if (isPDF) {
                        sendTelegramDocument(imageUrl, caption);
                    } else {
                        sendTelegramPhoto(imageUrl, caption);
                    }
                } else {
                    const notificationText = `🆕 <b>Новый тикет!</b>\n\n` +
                        `📋 ID: <code>${finalTicketId}</code>\n` +
                        `👤 Клиент: ${customerName || 'Гость'}\n` +
                        `${customerEmail ? `📧 Email: ${customerEmail}\n` : ''}` +
                        `💬 Сообщение: ${message}\n\n` +
                        `🔗 <a href="https://truststore.ru/t1xxas">Открыть админку</a>`;
                    
                    sendTelegramNotification(notificationText);
                }
            }
        }
        
        // Если это существующий тикет, обновляем его
        if (!isNewTicket) {
            // Обновляем время последнего сообщения и помечаем как непрочитанное
            db.prepare(`
                UPDATE support_tickets 
                SET last_message_at = CURRENT_TIMESTAMP, unread_admin = 1
                WHERE ticket_id = ?
            `).run(finalTicketId);
            
            // Отправляем уведомление о новом сообщении (с проверкой на дубли)
            if (canSendNotification(finalTicketId)) {
                if (imageUrl) {
                    const caption = `💬 <b>Новое сообщение!</b>\n\n` +
                        `📋 Тикет: <code>${finalTicketId}</code>\n` +
                        `👤 Клиент: ${customerName || 'Гость'}\n` +
                        `${message ? `💬 ${message}\n` : ''}` +
                        `🔗 <a href="https://truststore.ru/t1xxas">Открыть админку</a>`;
                    
                    const isPDF = imageUrl.toLowerCase().endsWith('.pdf');
                    if (isPDF) {
                        sendTelegramDocument(imageUrl, caption);
                    } else {
                        sendTelegramPhoto(imageUrl, caption);
                    }
                } else {
                    const notificationText = `💬 <b>Новое сообщение!</b>\n\n` +
                        `📋 Тикет: <code>${finalTicketId}</code>\n` +
                        `👤 Клиент: ${customerName || 'Гость'}\n` +
                        `💬 Сообщение: ${message}\n\n` +
                        `🔗 <a href="https://truststore.ru/t1xxas">Открыть админку</a>`;
                    
                    sendTelegramNotification(notificationText);
                }
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
        const productsList = typeof products === 'string' ? JSON.parse(products) : products;
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

// ==================== YOOMONEY PAYMENT WEBHOOK ====================

// YooMoney webhook для уведомлений об оплате
app.post('/api/payment/yoomoney', async (req, res) => {
    try {
        console.log('📥 Получено уведомление от YooMoney:', req.body);
        
        const {
            notification_type,
            operation_id,
            amount,
            currency,
            datetime,
            sender,
            codepro,
            label,
            sha1_hash
        } = req.body;
        
        // Проверяем, что это уведомление об успешном переводе
        if (notification_type !== 'p2p-incoming') {
            console.log('⚠️ Неподдерживаемый тип уведомления:', notification_type);
            return res.status(400).send('Wrong notification type');
        }
        
        // Проверяем подпись (если есть секретный ключ)
        if (YOOMONEY_SECRET) {
            const string = `${notification_type}&${operation_id}&${amount}&${currency}&${datetime}&${sender}&${codepro}&${YOOMONEY_SECRET}&${label}`;
            const hash = crypto.createHash('sha1').update(string).digest('hex');
            
            if (hash !== sha1_hash) {
                console.error('❌ Неверная подпись от YooMoney!');
                return res.status(400).send('Invalid signature');
            }
            console.log('✅ Подпись проверена');
        }
        
        // Находим заказ по label (order_id)
        const order = db.prepare('SELECT * FROM orders WHERE order_id = ?').get(label);
        
        if (!order) {
            console.error('❌ Заказ не найден:', label);
            return res.status(404).send('Order not found');
        }
        
        // Проверяем, не обработан ли уже этот платеж
        if (order.status === 'paid') {
            console.log('⚠️ Заказ уже обработан:', label);
            return res.status(200).send('OK');
        }
        
        // Проверяем сумму
        if (parseFloat(amount) < order.total_amount) {
            console.error('❌ Неверная сумма платежа:', amount, 'ожидалось:', order.total_amount);
            return res.status(400).send('Wrong amount');
        }
        
        console.log('💰 Платеж подтвержден:', label, 'Сумма:', amount);
        
        // Обновляем статус заказа
        db.prepare('UPDATE orders SET status = ? WHERE order_id = ?').run('paid', label);
        
        // Получаем товары из заказа
        const products = JSON.parse(order.products);
        
        // Обрабатываем каждый товар
        for (const product of products) {
            const quantity = product.quantity || 1;
            
            // Получаем доступные товары из инвентаря
            for (let i = 0; i < quantity; i++) {
                const availableItem = db.prepare(`
                    SELECT * FROM product_inventory 
                    WHERE product_name = ? AND status = 'available'
                    LIMIT 1
                `).get(product.name);
                
                if (availableItem) {
                    // Помечаем товар как проданный
                    db.prepare(`
                        UPDATE product_inventory 
                        SET status = 'sold', order_id = ?, sold_at = CURRENT_TIMESTAMP
                        WHERE id = ?
                    `).run(label, availableItem.id);
                    
                    // Отправляем email с товаром
                    try {
                        await sendOrderEmail({
                            to: order.customer_email,
                            orderNumber: label,
                            productName: product.name,
                            login: availableItem.login,
                            password: availableItem.password,
                            instructions: availableItem.instructions || 'Используйте эти данные для входа в сервис.'
                        });
                        
                        console.log(`✅ Email отправлен: ${order.customer_email} - ${product.name}`);
                    } catch (emailError) {
                        console.error('❌ Ошибка отправки email:', emailError);
                    }
                } else {
                    console.error(`⚠️ Товар не найден в инвентаре: ${product.name}`);
                    
                    // Отправляем уведомление админу в Telegram
                    const notificationText = `⚠️ <b>ВНИМАНИЕ! Товара нет в наличии!</b>\n\n` +
                        `📦 Товар: ${product.name}\n` +
                        `🆔 Заказ: ${label}\n` +
                        `👤 Клиент: ${order.customer_name}\n` +
                        `📧 Email: ${order.customer_email}\n` +
                        `💰 Сумма: ${order.total_amount} ₽\n\n` +
                        `⚡ СРОЧНО ДОБАВЬ ТОВАР В ИНВЕНТАРЬ!`;
                    
                    sendTelegramNotification(notificationText, false);
                }
            }
        }
        
        // Отправляем уведомление об успешной оплате в Telegram
        const successNotification = `💰 <b>Новый платеж!</b>\n\n` +
            `🆔 Заказ: ${label}\n` +
            `👤 Клиент: ${order.customer_name}\n` +
            `📧 Email: ${order.customer_email}\n` +
            `💵 Сумма: ${amount} ${currency}\n` +
            `📦 Товары: ${products.map(p => p.name).join(', ')}\n` +
            `📅 Дата: ${datetime}\n\n` +
            `🔗 <a href="https://truststore.ru/t1xxas">Открыть админку</a>`;
        
        sendTelegramNotification(successNotification, false);
        
        res.status(200).send('OK');
        
    } catch (error) {
        console.error('❌ Ошибка обработки YooMoney webhook:', error);
        res.status(500).send('Server error');
    }
});

// API для предложения товара
app.post('/api/suggest-product', async (req, res) => {
    try {
        const { product_name, description, email } = req.body;
        
        if (!product_name) {
            return res.status(400).json({ error: 'Название товара обязательно' });
        }
        
        db.prepare(`
            INSERT INTO product_suggestions (product_name, description, email)
            VALUES (?, ?, ?)
        `).run(product_name, description || '', email || '');
        
        console.log(`💡 Новое предложение товара: ${product_name}`);
        
        // Отправляем уведомление в Telegram
        const telegramMessage = `
💡 <b>НОВОЕ ПРЕДЛОЖЕНИЕ ТОВАРА</b>

📦 <b>Товар:</b> ${product_name}
${description ? `📝 <b>Описание:</b> ${description}\n` : ''}${email ? `📧 <b>Email:</b> ${email}\n` : ''}
⏰ <b>Время:</b> ${new Date().toLocaleString('ru-RU')}
        `.trim();
        
        await sendTelegramNotification(telegramMessage);
        
        res.json({ success: true });
    } catch (error) {
        console.error('Ошибка сохранения предложения:', error);
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

// API для получения предложений товаров (админ)
app.get('/api/product-suggestions', authMiddleware, (req, res) => {
    try {
        const suggestions = db.prepare(`
            SELECT * FROM product_suggestions 
            ORDER BY created_at DESC
        `).all();
        
        res.json(suggestions);
    } catch (error) {
        console.error('Ошибка получения предложений:', error);
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

// API для обновления статуса предложения (админ)
app.post('/api/product-suggestion-status', authMiddleware, (req, res) => {
    try {
        const { id, status } = req.body;
        
        db.prepare(`
            UPDATE product_suggestions 
            SET status = ?
            WHERE id = ?
        `).run(status, id);
        
        res.json({ success: true });
    } catch (error) {
        console.error('Ошибка обновления статуса:', error);
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

// === ПРОМОКОДЫ ===

// Создание промокода (админ)
app.post('/api/promo-codes', authMiddleware, (req, res) => {
    try {
        const { code, discount, max_uses, expires_at } = req.body;
        
        if (!code || !discount || !max_uses || !expires_at) {
            return res.status(400).json({ error: 'Все поля обязательны' });
        }
        
        db.prepare(`
            INSERT INTO promo_codes (code, discount, max_uses, expires_at)
            VALUES (?, ?, ?, ?)
        `).run(code.toUpperCase(), discount, max_uses, expires_at);
        
        console.log(`🎫 Создан промокод: ${code} (-${discount}%)`);
        res.json({ success: true });
    } catch (error) {
        if (error.message.includes('UNIQUE')) {
            res.status(400).json({ error: 'Промокод уже существует' });
        } else {
            console.error('Ошибка создания промокода:', error);
            res.status(500).json({ error: 'Ошибка сервера' });
        }
    }
});

// Получение всех промокодов (админ)
app.get('/api/promo-codes', authMiddleware, (req, res) => {
    try {
        const promoCodes = db.prepare(`
            SELECT * FROM promo_codes 
            ORDER BY created_at DESC
        `).all();
        
        res.json(promoCodes);
    } catch (error) {
        console.error('Ошибка получения промокодов:', error);
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

// Проверка промокода (клиент)
app.post('/api/validate-promo', (req, res) => {
    try {
        const { code } = req.body;
        
        if (!code) {
            return res.status(400).json({ error: 'Промокод не указан' });
        }
        
        const promoCode = db.prepare(`
            SELECT * FROM promo_codes 
            WHERE code = ? AND is_active = 1
        `).get(code.toUpperCase());
        
        if (!promoCode) {
            return res.json({ valid: false, message: 'Промокод не найден' });
        }
        
        // Проверяем срок действия
        const now = new Date();
        const expiresAt = new Date(promoCode.expires_at);
        if (now > expiresAt) {
            return res.json({ valid: false, message: 'Промокод истек' });
        }
        
        // Проверяем количество использований
        if (promoCode.current_uses >= promoCode.max_uses) {
            return res.json({ valid: false, message: 'Промокод исчерпан' });
        }
        
        res.json({ 
            valid: true, 
            discount: promoCode.discount,
            code: promoCode.code
        });
    } catch (error) {
        console.error('Ошибка проверки промокода:', error);
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

// Применение промокода (увеличение счетчика использований)
app.post('/api/apply-promo', (req, res) => {
    try {
        const { code } = req.body;
        
        db.prepare(`
            UPDATE promo_codes 
            SET current_uses = current_uses + 1
            WHERE code = ?
        `).run(code.toUpperCase());
        
        console.log(`🎫 Промокод ${code} использован`);
        res.json({ success: true });
    } catch (error) {
        console.error('Ошибка применения промокода:', error);
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

// Удаление промокода (админ)
app.delete('/api/promo-codes/:id', authMiddleware, (req, res) => {
    try {
        const { id } = req.params;
        
        db.prepare('DELETE FROM promo_codes WHERE id = ?').run(id);
        
        res.json({ success: true });
    } catch (error) {
        console.error('Ошибка удаления промокода:', error);
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

// Переключение активности промокода (админ)
app.post('/api/promo-codes/:id/toggle', authMiddleware, (req, res) => {
    try {
        const { id } = req.params;
        
        db.prepare(`
            UPDATE promo_codes 
            SET is_active = 1 - is_active
            WHERE id = ?
        `).run(id);
        
        res.json({ success: true });
    } catch (error) {
        console.error('Ошибка переключения промокода:', error);
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

// Получение расширенной статистики для новой админ-панели
app.get('/api/admin-stats', authMiddleware, (req, res) => {
    try {
        console.log('📊 Loading admin stats...');
        // Сессии
        const totalSessions = db.prepare('SELECT COUNT(*) as count FROM sessions').get();
        const totalPageViews = db.prepare('SELECT COUNT(*) as count FROM visits').get();
        
        // Заказы (только оплаченные)
        const totalOrders = db.prepare("SELECT COUNT(*) as count, COALESCE(SUM(total_amount), 0) as revenue FROM orders WHERE status = 'paid'").get();
        const ordersThisMonth = db.prepare(`
            SELECT COUNT(*) as count, COALESCE(SUM(total_amount), 0) as revenue 
            FROM orders 
            WHERE status = 'paid'
            AND created_at >= datetime('now', 'start of month')
        `).get();
        
        const ordersLastMonth = db.prepare(`
            SELECT COUNT(*) as count, COALESCE(SUM(total_amount), 0) as revenue 
            FROM orders 
            WHERE status = 'paid'
            AND created_at >= datetime('now', '-1 month', 'start of month')
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
        console.log('✅ Admin stats loaded successfully');
    } catch (error) {
        console.error('❌ Ошибка получения админ статистики:', error);
        res.status(500).json({ error: 'Ошибка сервера', details: error.message });
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

// API для получения отзывов из Telegram
app.get('/api/telegram-reviews', (req, res) => {
    try {
        // Сортируем по дате из Telegram (новые первыми), потом по ID
        const reviews = db.prepare(`
            SELECT * FROM telegram_reviews 
            ORDER BY telegram_date DESC, id DESC 
            LIMIT 10
        `).all();
        
        // Получаем общее количество комментариев
        const stats = db.prepare('SELECT total_comments FROM telegram_stats WHERE id = 1').get();
        const totalComments = stats ? stats.total_comments : reviews.length;
        
        res.json({ 
            success: true, 
            reviews, 
            count: reviews.length,
            totalComments: totalComments 
        });
    } catch (error) {
        console.error('Ошибка получения отзывов:', error);
        res.status(500).json({ success: false, error: 'Ошибка сервера' });
    }
});

// Функция синхронизации отзывов из Telegram (через getUpdates)
async function syncTelegramReviews() {
    try {
        console.log('🔄 Синхронизация отзывов из Telegram через getUpdates...');
        
        // Получаем обновления от бота (максимум возможных)
        const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/getUpdates?limit=100`;
        const response = await fetch(url);
        
        if (!response.ok) {
            console.error('❌ Ошибка запроса к Telegram API');
            return;
        }
        
        const data = await response.json();
        
        if (!data.ok || !data.result) {
            console.error('❌ Некорректный ответ от Telegram API');
            return;
        }
        
        console.log(`📨 Получено обновлений: ${data.result.length}`);
        
        let added = 0; // Счетчик только НОВЫХ комментариев
        const TARGET_POST_ID = 15; // ID сообщения в группе обсуждений (пост #19 в канале = сообщение #15 в группе)
        
        // Обрабатываем каждое сообщение
        for (const update of data.result) {
            // Проверяем что это сообщение из группы обсуждений
            if (update.message && update.message.chat && update.message.from) {
                const message = update.message;
                
                // ВАЖНО: Проверяем что это комментарий ТОЛЬКО к нужному посту
                if (!message.reply_to_message || message.reply_to_message.message_id !== TARGET_POST_ID) {
                    continue; // Пропускаем все сообщения НЕ под нужным постом
                }
                
                // Пропускаем сообщения от ботов
                if (message.from.is_bot) continue;
                
                // Пропускаем сообщения от самого канала (официальные ответы магазина)
                if (message.from.username && message.from.username.toLowerCase() === 'truststoreru') {
                    console.log('⏭️ Пропущен ответ от канала Trust Store');
                    continue;
                }
                
                // Получаем автора
                const firstName = message.from.first_name || '';
                const lastName = message.from.last_name || '';
                const author = (firstName + ' ' + lastName).trim();
                
                // Получаем текст
                const text = message.text || message.caption || '';
                
                // Пропускаем пустые сообщения и технические (с паролями)
                if (!text.trim() || text.length < 5 || text.includes('o-4zWa6SFWUGo')) continue;
                
                // Черный список старых сообщений Maria (message_id)
                const BLACKLISTED_MESSAGES = [1239, 1241, 1242, 1246];
                if (BLACKLISTED_MESSAGES.includes(message.message_id)) {
                    continue; // Пропускаем заблокированные сообщения
                }
                
                // Проверяем, не добавлен ли уже этот комментарий
                const existing = db.prepare('SELECT id FROM telegram_reviews WHERE telegram_comment_id = ?').get(message.message_id);
                
                if (!existing) {
                    try {
                        // Получаем timestamp из Telegram (Unix timestamp в секундах)
                        const telegramDate = message.date || Math.floor(Date.now() / 1000);
                        
                        db.prepare(`
                            INSERT INTO telegram_reviews (telegram_user_id, author_name, review_text, rating, telegram_comment_id, telegram_date)
                            VALUES (?, ?, ?, 5, ?, ?)
                        `).run(message.from.id, author, text, message.message_id, telegramDate);
                        
                        added++;
                        console.log(`✅ Добавлен отзыв от ${author}: "${text.substring(0, 50)}..."`);
                        
                        // 🔄 СИСТЕМА "ДОМИНО": Оставляем только 10 последних отзывов
                        const totalReviews = db.prepare('SELECT COUNT(*) as count FROM telegram_reviews').get();
                        if (totalReviews.count > 10) {
                            // Удаляем самый старый отзыв (по telegram_date)
                            const oldestReview = db.prepare(`
                                SELECT id, author_name FROM telegram_reviews 
                                ORDER BY telegram_date ASC 
                                LIMIT 1
                            `).get();
                            
                            if (oldestReview) {
                                db.prepare('DELETE FROM telegram_reviews WHERE id = ?').run(oldestReview.id);
                                console.log(`🗑️ Удален старый отзыв от ${oldestReview.author_name} (система домино)`);
                            }
                        }
                    } catch (err) {
                        // Игнорируем дубли (UNIQUE constraint)
                        if (!err.message.includes('UNIQUE')) {
                            console.error(`❌ Ошибка добавления отзыва:`, err.message);
                        }
                    }
                }
            }
        }
        
        // 📊 Обновляем счетчик комментариев (добавляем ТОЛЬКО новые)
        try {
            // Получаем текущее значение
            const currentStats = db.prepare('SELECT total_comments FROM telegram_stats WHERE id = 1').get();
            const currentTotal = currentStats ? currentStats.total_comments : 0;
            
            // Добавляем только НОВЫЕ комментарии к существующему числу
            const newTotal = currentTotal + added;
            
            db.prepare(`
                INSERT INTO telegram_stats (id, total_comments, last_updated) 
                VALUES (1, ?, CURRENT_TIMESTAMP)
                ON CONFLICT(id) DO UPDATE SET 
                    total_comments = excluded.total_comments,
                    last_updated = CURRENT_TIMESTAMP
            `).run(newTotal);
            
            console.log(`📊 Комментариев: ${currentTotal} + ${added} новых = ${newTotal} всего`);
        } catch (err) {
            console.error('❌ Ошибка сохранения статистики:', err.message);
        }
        
        if (added > 0) {
            console.log(`🎉 Синхронизация завершена! Добавлено новых отзывов: ${added}`);
            
            // 🎲 СИСТЕМА ДОМИНО: Оставляем только последние 10 отзывов
            try {
                const allReviews = db.prepare(`
                    SELECT id FROM telegram_reviews 
                    ORDER BY telegram_date DESC, id DESC
                `).all();
                
                if (allReviews.length > 10) {
                    // Берем ID отзывов, которые нужно удалить (все после 10-го)
                    const reviewsToDelete = allReviews.slice(10).map(r => r.id);
                    const placeholders = reviewsToDelete.map(() => '?').join(',');
                    
                    db.prepare(`DELETE FROM telegram_reviews WHERE id IN (${placeholders})`).run(...reviewsToDelete);
                    
                    console.log(`🎲 ДОМИНО: Удалено старых отзывов: ${reviewsToDelete.length} (осталось 10)`);
                    console.log(`   Удалены ID: ${reviewsToDelete.join(', ')}`);
                }
            } catch (err) {
                console.error('❌ Ошибка очистки старых отзывов:', err.message);
            }
        } else {
            console.log('ℹ️ Новых отзывов не обнаружено');
        }
        
    } catch (error) {
        console.error('❌ Ошибка синхронизации отзывов:', error.message);
    }
}

// Запускаем синхронизацию при старте сервера
syncTelegramReviews();

// Автоматическая синхронизация каждые 10 минут
setInterval(syncTelegramReviews, 10 * 60 * 1000);

// Секретный роут для админ панели (БЕЗ authMiddleware - страница сама проверяет)
app.get('/t1xxas', (req, res) => {
    res.sendFile(path.join(__dirname, 'admin.html'));
});

// Перенаправляем /admin на главную страницу
app.get('/admin', (req, res) => {
    res.redirect('/');
});

// API для подписки на новости
app.post('/api/newsletter/subscribe', (req, res) => {
    try {
        const { email } = req.body;
        
        if (!email || !email.includes('@')) {
            return res.status(400).json({ error: 'Некорректный email' });
        }
        
        // Проверяем, не подписан ли уже
        const existing = db.prepare('SELECT * FROM newsletter_subscribers WHERE email = ?').get(email);
        
        if (existing) {
            if (existing.status === 'active') {
                return res.json({ success: true, message: 'Вы уже подписаны!' });
            } else {
                // Реактивируем подписку
                db.prepare('UPDATE newsletter_subscribers SET status = ? WHERE email = ?').run('active', email);
                return res.json({ success: true, message: 'Подписка активирована!' });
            }
        }
        
        // Добавляем нового подписчика
        db.prepare('INSERT INTO newsletter_subscribers (email) VALUES (?)').run(email);
        
        console.log('📧 Новый подписчик:', email);
        
        // Отправляем приветственное письмо (асинхронно)
        sendWelcomeEmail(email).then(result => {
            if (result.success) {
                console.log(`✅ Приветственное письмо доставлено: ${email}`);
            } else {
                console.error(`❌ Не удалось отправить приветственное письмо: ${email}`);
            }
        });
        
        // Отправляем беззвучное уведомление в Telegram
        const notificationText = `📧 <b>Новая подписка на новости!</b>\n\n` +
            `📬 Email: ${email}\n` +
            `📅 Дата: ${new Date().toLocaleString('ru-RU')}\n\n` +
            `🔗 <a href="https://truststore.ru/t1xxas">Открыть админку</a>`;
        
        sendTelegramNotification(notificationText, true);
        
        res.json({ success: true, message: 'Спасибо за подписку! Проверьте почту 📬' });
    } catch (error) {
        console.error('Ошибка подписки:', error);
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

// API для админа: получение списка подписчиков
app.get('/api/admin/newsletter/subscribers', authMiddleware, (req, res) => {
    try {
        const subscribers = db.prepare(`
            SELECT * FROM newsletter_subscribers 
            ORDER BY subscribed_at DESC
        `).all();
        
        res.json({ subscribers });
    } catch (error) {
        console.error('Ошибка получения подписчиков:', error);
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

// API для админа: удаление подписчика
app.delete('/api/admin/newsletter/subscribers/:id', authMiddleware, (req, res) => {
    try {
        const { id } = req.params;
        db.prepare('DELETE FROM newsletter_subscribers WHERE id = ?').run(id);
        res.json({ success: true });
    } catch (error) {
        console.error('Ошибка удаления подписчика:', error);
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

// API для админа: массовая рассылка всем подписчикам
app.post('/api/admin/newsletter/send-bulk', authMiddleware, async (req, res) => {
    try {
        const { title, content } = req.body;
        
        if (!title || !content) {
            return res.status(400).json({ error: 'Заполните заголовок и текст рассылки' });
        }
        
        // Получаем всех активных подписчиков
        const subscribers = db.prepare(`
            SELECT email FROM newsletter_subscribers 
            WHERE status = 'active'
        `).all();
        
        if (subscribers.length === 0) {
            return res.json({ 
                success: true, 
                message: 'Нет активных подписчиков',
                sent: 0,
                failed: 0
            });
        }
        
        console.log(`📧 Начинаем массовую рассылку ${subscribers.length} подписчикам...`);
        
        let sent = 0;
        let failed = 0;
        
        // Отправляем письма всем подписчикам (последовательно, чтобы не перегружать SMTP)
        for (const subscriber of subscribers) {
            try {
                await sendNewsletterEmail({
                    to: subscriber.email,
                    title: title,
                    content: content,
                    date: new Date().toLocaleDateString('ru-RU', { 
                        day: 'numeric', 
                        month: 'long',
                        year: 'numeric' 
                    })
                });
                sent++;
                console.log(`✅ Отправлено ${sent}/${subscribers.length}: ${subscriber.email}`);
                
                // Небольшая задержка между письмами (чтобы не попасть в спам-фильтры)
                await new Promise(resolve => setTimeout(resolve, 500));
            } catch (error) {
                failed++;
                console.error(`❌ Ошибка отправки ${subscriber.email}:`, error.message);
            }
        }
        
        console.log(`📊 Рассылка завершена: отправлено ${sent}, ошибок ${failed}`);
        
        // Отправляем уведомление в Telegram
        const notificationText = `📬 <b>Рассылка завершена!</b>\n\n` +
            `✉️ Заголовок: ${title}\n` +
            `✅ Отправлено: ${sent}\n` +
            `❌ Ошибок: ${failed}\n` +
            `📊 Всего подписчиков: ${subscribers.length}`;
        
        sendTelegramNotification(notificationText, true);
        
        res.json({ 
            success: true, 
            message: `Рассылка завершена: отправлено ${sent} из ${subscribers.length}`,
            sent: sent,
            failed: failed,
            total: subscribers.length
        });
        
    } catch (error) {
        console.error('Ошибка массовой рассылки:', error);
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

// ==================== NEWS API ====================

// Получить все новости (публичный endpoint)
app.get('/api/news', (req, res) => {
    try {
        const news = db.prepare(`
            SELECT * FROM news 
            ORDER BY sort_order DESC, created_at DESC
            LIMIT 3
        `).all();
        
        res.json({ news });
    } catch (error) {
        console.error('Ошибка получения новостей:', error);
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

// Добавить новость (админ) с системой ДОМИНО
app.post('/api/admin/news', authMiddleware, (req, res) => {
    try {
        const { date, title, content, image_url, emoji } = req.body;
        
        if (!date || !title || !content) {
            return res.status(400).json({ error: 'Заполните все обязательные поля' });
        }
        
        // Получаем максимальный sort_order
        const maxOrder = db.prepare('SELECT MAX(sort_order) as max FROM news').get();
        const newSortOrder = (maxOrder.max || 0) + 1;
        
        // Добавляем новость
        const result = db.prepare(`
            INSERT INTO news (date, title, content, image_url, emoji, sort_order)
            VALUES (?, ?, ?, ?, ?, ?)
        `).run(date, title, content, image_url || null, emoji || null, newSortOrder);
        
        console.log(`✅ Добавлена новость: "${title}"`);
        
        // 🔄 СИСТЕМА "ДОМИНО": Оставляем только 3 последние новости
        const totalNews = db.prepare('SELECT COUNT(*) as count FROM news').get();
        if (totalNews.count > 3) {
            // Удаляем самую старую новость (по sort_order)
            const oldestNews = db.prepare(`
                SELECT id, title FROM news 
                ORDER BY sort_order ASC 
                LIMIT 1
            `).get();
            
            if (oldestNews) {
                db.prepare('DELETE FROM news WHERE id = ?').run(oldestNews.id);
                console.log(`🗑️ Удалена старая новость: "${oldestNews.title}" (система домино)`);
            }
        }
        
        // Отправляем уведомление в Telegram
        const notificationText = `🎉 Новая новость на сайте!\n\n📅 ${date}\n📰 ${title}\n\n${content.substring(0, 200)}${content.length > 200 ? '...' : ''}`;
        sendTelegramNotification(notificationText, true);
        
        res.json({ success: true, id: result.lastInsertRowid });
    } catch (error) {
        console.error('Ошибка добавления новости:', error);
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

// Удалить новость (админ)
app.delete('/api/admin/news/:id', authMiddleware, (req, res) => {
    try {
        const { id } = req.params;
        db.prepare('DELETE FROM news WHERE id = ?').run(id);
        console.log(`🗑️ Удалена новость ID: ${id}`);
        res.json({ success: true });
    } catch (error) {
        console.error('Ошибка удаления новости:', error);
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

// 🔥 Роутинг для /product/:name (в самом конце, чтобы не перехватывать другие страницы)
app.get('/product/:productName', (req, res) => {
    const productName = req.params.productName;
    
    // Ищем файл в папке product/
    const productFile = path.join(__dirname, 'product', `${productName}.html`);
    
    if (fs.existsSync(productFile)) {
        return res.sendFile(productFile);
    }
    
    res.status(404).send('Product not found');
});

// ==================== EMAIL FUNCTIONS ====================

// Функция создания HTML шаблона для письма с заказом
function createOrderEmailHTML(data) {
    const { orderNumber, productName, login, password, instructions } = data;
    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Ваш заказ #${orderNumber}</title>
</head>
<body style="margin:0;padding:0;background:#0f1220;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#0f1220;padding:32px 12px;">
    <tr>
      <td align="center">
        <table role="presentation" width="640" cellspacing="0" cellpadding="0" style="background:#111528;border-radius:16px;overflow:hidden;border:1px solid rgba(255,255,255,0.06);">
          <tr>
            <td style="padding:28px 32px;background:linear-gradient(135deg,#667eea 0%,#764ba2 100%);">
              <table width="100%" cellspacing="0" cellpadding="0">
                <tr>
                  <td align="left" style="vertical-align:middle;">
                    <table cellspacing="0" cellpadding="0">
                      <tr>
                        <td style="padding-right:16px;vertical-align:middle;">
                          <img src="cid:youtube-avatar" alt="Trust Store" style="display:block;max-width:60px;height:60px;border-radius:50%;border:3px solid rgba(255,255,255,0.2);">
                        </td>
                        <td style="vertical-align:middle;">
                          <div style="color:#fff;font-size:24px;font-weight:700;letter-spacing:-0.5px;margin:0;">Trust Store</div>
                          <div style="color:rgba(255,255,255,0.85);font-size:13px;margin-top:2px;">магазин цифровых товаров</div>
                        </td>
                      </tr>
                    </table>
                  </td>
                  <td align="right" style="color:#fff;font-size:14px;opacity:.9;white-space:nowrap;vertical-align:middle;">Заказ <strong style="font-weight:700;">#${orderNumber}</strong></td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding:32px;color:#E5E7EB;">
              <h1 style="margin:0 0 12px 0;font-size:22px;line-height:1.3;color:#fff;">Спасибо за покупку!</h1>
              <p style="margin:0 0 24px 0;font-size:14px;color:#A7B0C0;">Ниже — данные для доступа и краткая информация по заказу.</p>
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#0f1220;border:1px solid rgba(255,255,255,0.06);border-radius:12px;margin:0 0 16px 0;">
                <tr>
                  <td style="padding:16px 18px;font-size:13px;color:#A7B0C0;width:38%;">Товар</td>
                  <td style="padding:16px 18px;font-size:15px;color:#C7D2FE;font-weight:700;">${productName}</td>
                </tr>
              </table>
              <div style="margin:18px 0 22px 0;">
                <div style="background:#0f1220;border:1px solid rgba(102,126,234,.35);border-radius:12px;padding:16px 18px;margin:0 0 10px 0;">
                  <div style="font-size:11px;color:#A7B0C0;margin:0 0 6px 0;letter-spacing:.4px;">ЛОГИН</div>
                  <div style="font-size:15px;color:#fff;word-break:break-all;">${login}</div>
                </div>
                <div style="background:#0f1220;border:1px solid rgba(102,126,234,.35);border-radius:12px;padding:16px 18px;">
                  <div style="font-size:11px;color:#A7B0C0;margin:0 0 6px 0;letter-spacing:.4px;">ПАРОЛЬ</div>
                  <div style="font-size:15px;color:#fff;word-break:break-all;">${password}</div>
                </div>
              </div>
              ${instructions ? `
              <div style="background:rgba(255,184,0,.08);border:1px solid rgba(255,184,0,.35);color:#FDE68A;border-radius:12px;padding:16px 18px;margin:0 0 22px 0;">
                <div style="font-size:14px;font-weight:600;margin:0 0 6px 0;color:#FDE68A;">Инструкции</div>
                <div style="font-size:13px;line-height:1.7;color:#E5E7EB;">${instructions}</div>
              </div>` : ''}
              <table role="presentation" cellspacing="0" cellpadding="0" style="margin-top:4px;">
                <tr>
                  <td style="background:#667eea;padding:12px 22px;border-radius:10px;">
                    <a href="https://truststore.ru" style="font-size:14px;color:#fff;text-decoration:none;display:inline-block;">Перейти в магазин</a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding:20px 28px;border-top:1px solid rgba(255,255,255,0.06);text-align:center;color:#8A94A7;font-size:12px;background:#0f1220;">
              Есть вопросы? Ответьте на это письмо или напишите через виджет на сайте.<br>© ${new Date().getFullYear()} Trust Store
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
    `;
}

// Функция отправки письма с заказом
async function sendOrderEmail(data) {
    // Попытка отправить через SendGrid (если настроен)
    if (process.env.SENDGRID_API_KEY) {
        try {
            const msg = {
                to: data.to,
                from: process.env.EMAIL_USER || 'orders@truststore.ru',
                subject: `✅ Ваш заказ #${data.orderNumber} | Trust Store`,
                html: createOrderEmailHTML(data)
            };
            
            const response = await sgMail.send(msg);
            console.log(`✅ Письмо отправлено через SendGrid: ${data.to}`);
            return { success: true, messageId: response[0].headers['x-message-id'], method: 'SendGrid' };
        } catch (error) {
            console.error('❌ Ошибка SendGrid:', error.message);
            // Продолжаем попытку через SMTP
        }
    }
    
    // Попытка отправить через SMTP
    try {
        const mailOptions = {
            from: process.env.EMAIL_FROM || '"Trust Store" <orders@truststore.ru>',
            to: data.to,
            subject: `✅ Ваш заказ #${data.orderNumber} | Trust Store`,
            html: createOrderEmailHTML(data),
            attachments: [
                {
                    filename: 'youtube-avatar.png',
                    path: path.join(__dirname, 'youtube-avatar.png'),
                    cid: 'youtube-avatar'
                }
            ]
        };

        const info = await emailTransporter.sendMail(mailOptions);
        console.log(`✅ Письмо отправлено через SMTP: ${data.to} (${info.messageId})`);
        return { success: true, messageId: info.messageId, method: 'SMTP' };
    } catch (error) {
        console.error('❌ Ошибка отправки письма (SMTP):', error.message);
        return { success: false, error: error.message, note: 'Проверьте настройки SMTP или добавьте SENDGRID_API_KEY' };
    }
}

// Функция создания HTML для приветственного письма при подписке
function createWelcomeEmailHTML() {
    return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Добро пожаловать в Trust Store!</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif; background: #f5f5f5;">
    <table width="100%" cellpadding="0" cellspacing="0" style="background: #f5f5f5; padding: 40px 20px;">
        <tr>
            <td align="center">
                <table width="600" cellpadding="0" cellspacing="0" style="background: white; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 24px rgba(0,0,0,0.1);">
                    <!-- Header with Logo -->
                    <tr>
                        <td style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 40px; text-align: center;">
                            <img src="cid:logo" alt="Trust Store" style="max-width: 180px; height: auto; margin-bottom: 16px;" />
                            <h1 style="color: white; margin: 0; font-size: 28px; font-weight: 700;">Trust Store</h1>
                            <p style="color: rgba(255,255,255,0.9); margin: 8px 0 0 0; font-size: 16px;">Ваш магазин цифровых товаров</p>
                        </td>
                    </tr>
                    
                    <!-- Welcome Content -->
                    <tr>
                        <td style="padding: 40px;">
                            <h2 style="color: #1a1a1a; margin: 0 0 24px 0; font-size: 24px;">Спасибо за подписку! 🎉</h2>
                            
                            <div style="background: #f8f9ff; border-left: 4px solid #667eea; padding: 24px; margin-bottom: 24px; border-radius: 8px;">
                                <p style="margin: 0 0 16px 0; color: #1a1a1a; font-size: 16px; line-height: 1.6;">
                                    Рады приветствовать вас в числе наших подписчиков! 
                                </p>
                                <p style="margin: 0; color: #666; font-size: 16px; line-height: 1.6;">
                                    Теперь вы будете первыми узнавать о <b style="color: #667eea;">специальных предложениях</b>, 
                                    <b style="color: #667eea;">скидках</b> и <b style="color: #667eea;">новинках</b> нашего магазина!
                                </p>
                            </div>
                            
                            <div style="background: linear-gradient(135deg, rgba(102, 126, 234, 0.1) 0%, rgba(118, 75, 162, 0.1) 100%); border-radius: 12px; padding: 24px; margin-bottom: 24px;">
                                <p style="margin: 0 0 12px 0; color: #1a1a1a; font-size: 18px; font-weight: 600;">🎁 Что вас ждет:</p>
                                <ul style="margin: 0; padding-left: 24px; color: #666; font-size: 15px; line-height: 2;">
                                    <li>Эксклюзивные скидки для подписчиков</li>
                                    <li>Первыми узнавайте о новых товарах</li>
                                    <li>Специальные акции и предложения</li>
                                    <li>Полезные новости из мира цифровых сервисов</li>
                                </ul>
                            </div>
                            
                            <div style="text-align: center; margin-top: 32px;">
                                <a href="https://truststore.ru" style="display: inline-block; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; text-decoration: none; padding: 16px 48px; border-radius: 12px; font-size: 16px; font-weight: 600; box-shadow: 0 4px 16px rgba(102, 126, 234, 0.3);">
                                    Перейти в магазин
                                </a>
                            </div>
                        </td>
                    </tr>
                    
                    <!-- Footer -->
                    <tr>
                        <td style="background: #f8f9ff; padding: 32px; text-align: center; border-top: 1px solid #e0e0e0;">
                            <p style="margin: 0 0 12px 0; color: #1a1a1a; font-size: 16px; font-weight: 600;">Есть вопросы?</p>
                            <p style="margin: 0 0 16px 0; color: #666; font-size: 14px;">Напишите нам через виджет на сайте</p>
                            <p style="margin: 0; color: #999; font-size: 12px;">© ${new Date().getFullYear()} Trust Store. Все права защищены.</p>
                        </td>
                    </tr>
                </table>
            </td>
        </tr>
    </table>
</body>
</html>
    `;
}

// Функция отправки приветственного письма
async function sendWelcomeEmail(email) {
    try {
        const mailOptions = {
            from: process.env.EMAIL_FROM || '"Trust Store" <orders@truststore.ru>',
            to: email,
            subject: '🎉 Спасибо за подписку на новости Trust Store!',
            html: createWelcomeEmailHTML(),
            attachments: [
                {
                    filename: 'logo.png',
                    path: path.join(__dirname, 'logo.png'),
                    cid: 'logo'
                }
            ]
        };

        const info = await emailTransporter.sendMail(mailOptions);
        console.log(`✅ Приветственное письмо отправлено: ${email} (${info.messageId})`);
        return { success: true, messageId: info.messageId };
    } catch (error) {
        console.error('❌ Ошибка отправки приветственного письма:', error.message);
        return { success: false, error: error.message };
    }
}

// Функция создания HTML для рассылки новостей
function createNewsletterHTML(data) {
    const { title, content, date, unsubscribeLink } = data;
    
    return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${title}</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif; background: #f5f5f5;">
    <table width="100%" cellpadding="0" cellspacing="0" style="background: #f5f5f5; padding: 40px 20px;">
        <tr>
            <td align="center">
                <table width="600" cellpadding="0" cellspacing="0" style="background: white; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 24px rgba(0,0,0,0.1);">
                    <!-- Header -->
                    <tr>
                        <td style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 32px; text-align: center;">
                            <img src="cid:logo" alt="Trust Store" style="max-width: 140px; height: auto;" />
                        </td>
                    </tr>
                    
                    <!-- Content -->
                    <tr>
                        <td style="padding: 40px;">
                            <p style="margin: 0 0 16px 0; color: #667eea; font-size: 14px; font-weight: 600; text-transform: uppercase;">📰 Новости</p>
                            <h1 style="margin: 0 0 16px 0; color: #1a1a1a; font-size: 28px; font-weight: 700; line-height: 1.3;">${title}</h1>
                            ${date ? `<p style="margin: 0 0 24px 0; color: #999; font-size: 14px;">📅 ${date}</p>` : ''}
                            
                            <div style="color: #666; font-size: 16px; line-height: 1.8; margin-bottom: 32px;">
                                ${content}
                            </div>
                            
                            <div style="text-align: center;">
                                <a href="https://truststore.ru" style="display: inline-block; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; text-decoration: none; padding: 16px 48px; border-radius: 12px; font-size: 16px; font-weight: 600;">
                                    Перейти на сайт
                                </a>
                            </div>
                        </td>
                    </tr>
                    
                    <!-- Footer -->
                    <tr>
                        <td style="background: #f8f9ff; padding: 24px; text-align: center; border-top: 1px solid #e0e0e0;">
                            <p style="margin: 0 0 12px 0; color: #666; font-size: 14px;">Trust Store — Ваш магазин цифровых товаров</p>
                            ${unsubscribeLink ? `<p style="margin: 0; font-size: 12px;"><a href="${unsubscribeLink}" style="color: #999; text-decoration: underline;">Отписаться от рассылки</a></p>` : ''}
                        </td>
                    </tr>
                </table>
            </td>
        </tr>
    </table>
</body>
</html>
    `;
}

// Функция отправки рассылки
async function sendNewsletterEmail(data) {
    try {
        const mailOptions = {
            from: process.env.EMAIL_FROM || '"Trust Store" <orders@truststore.ru>',
            to: data.to,
            subject: `📰 ${data.title} | Trust Store`,
            html: createNewsletterHTML(data),
            attachments: [
                {
                    filename: 'logo.png',
                    path: path.join(__dirname, 'logo.png'),
                    cid: 'logo'
                }
            ]
        };

        const info = await emailTransporter.sendMail(mailOptions);
        console.log(`✅ Рассылка отправлена: ${data.to}`);
        return { success: true, messageId: info.messageId };
    } catch (error) {
        console.error('❌ Ошибка рассылки:', error.message);
        return { success: false, error: error.message };
    }
}

// ==================== EMAIL API ENDPOINTS ====================

// Тестовая отправка письма (админ)
app.post('/api/admin/test-email', authMiddleware, async (req, res) => {
    try {
        const { to } = req.body;
        
        const result = await sendOrderEmail({
            to: to || process.env.EMAIL_USER,
            orderNumber: 'TEST-' + Date.now(),
            productName: 'ChatGPT Plus 1 месяц (тестовый заказ)',
            login: 'test@example.com',
            password: 'TestPassword123',
            instructions: 'Это тестовое письмо. Перейдите на chat.openai.com и введите данные для входа.'
        });
        
        res.json(result);
    } catch (error) {
        console.error('Ошибка тестовой отправки:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Отправка письма с заказом (админ)
app.post('/api/admin/send-order-email', authMiddleware, async (req, res) => {
    try {
        const { to, orderNumber, productName, login, password, instructions } = req.body;
        
        if (!to || !orderNumber || !productName || !login || !password) {
            return res.status(400).json({ error: 'Не все поля заполнены' });
        }
        
        const result = await sendOrderEmail({
            to,
            orderNumber,
            productName,
            login,
            password,
            instructions
        });
        
        res.json(result);
    } catch (error) {
        console.error('Ошибка отправки заказа:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Рассылка новости всем подписчикам (админ)
app.post('/api/admin/send-newsletter', authMiddleware, async (req, res) => {
    try {
        const { newsId } = req.body;
        
        if (!newsId) {
            return res.status(400).json({ error: 'Не указан ID новости' });
        }
        
        // Получаем новость из базы
        const news = db.prepare('SELECT * FROM news WHERE id = ?').get(newsId);
        
        if (!news) {
            return res.status(404).json({ error: 'Новость не найдена' });
        }
        
        // Получаем всех активных подписчиков
        const subscribers = db.prepare(`
            SELECT * FROM newsletter_subscribers 
            WHERE status = 'active'
        `).all();
        
        if (subscribers.length === 0) {
            return res.json({ success: true, sent: 0, message: 'Нет активных подписчиков' });
        }
        
        let sent = 0;
        let failed = 0;
        
        // Отправляем рассылку
        for (const subscriber of subscribers) {
            const result = await sendNewsletterEmail({
                to: subscriber.email,
                title: news.title,
                content: news.content,
                date: news.date,
                unsubscribeLink: `https://truststore.ru/unsubscribe?email=${encodeURIComponent(subscriber.email)}`
            });
            
            if (result.success) {
                sent++;
            } else {
                failed++;
            }
            
            // Задержка между отправками (чтобы не попасть в спам)
            await new Promise(resolve => setTimeout(resolve, 1000));
        }
        
        // Отправляем уведомление в Telegram
        const notificationText = `📧 Рассылка новости завершена!\n\n📰 ${news.title}\n\n✅ Отправлено: ${sent}\n❌ Ошибок: ${failed}`;
        sendTelegramNotification(notificationText, true);
        
        res.json({ success: true, sent, failed, total: subscribers.length });
    } catch (error) {
        console.error('Ошибка рассылки:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// ==================== PRODUCT INVENTORY API (АДМИНКА) ====================

// Получить весь инвентарь товаров
app.get('/api/admin/inventory', authMiddleware, (req, res) => {
    try {
        const inventory = db.prepare(`
            SELECT * FROM product_inventory 
            ORDER BY created_at DESC
        `).all();
        
        res.json({ inventory });
    } catch (error) {
        console.error('Ошибка получения инвентаря:', error);
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

// Добавить товар в инвентарь
app.post('/api/admin/inventory', authMiddleware, (req, res) => {
    try {
        const { product_name, login, password, instructions } = req.body;
        
        if (!product_name || !login || !password) {
            return res.status(400).json({ error: 'Заполните все обязательные поля' });
        }
        
        db.prepare(`
            INSERT INTO product_inventory (product_name, login, password, instructions)
            VALUES (?, ?, ?, ?)
        `).run(product_name, login, password, instructions || '');
        
        console.log('📦 Товар добавлен в инвентарь:', product_name);
        
        res.json({ success: true, message: 'Товар добавлен в инвентарь' });
    } catch (error) {
        console.error('Ошибка добавления товара:', error);
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

// Удалить товар из инвентаря
app.delete('/api/admin/inventory/:id', authMiddleware, (req, res) => {
    try {
        const { id } = req.params;
        
        db.prepare('DELETE FROM product_inventory WHERE id = ?').run(id);
        
        res.json({ success: true });
    } catch (error) {
        console.error('Ошибка удаления товара:', error);
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

// Получить статистику инвентаря по товарам
app.get('/api/admin/inventory/stats', authMiddleware, (req, res) => {
    try {
        const stats = db.prepare(`
            SELECT 
                product_name,
                COUNT(*) as total,
                SUM(CASE WHEN status = 'available' THEN 1 ELSE 0 END) as available,
                SUM(CASE WHEN status = 'sold' THEN 1 ELSE 0 END) as sold
            FROM product_inventory
            GROUP BY product_name
        `).all();
        
        res.json({ stats });
    } catch (error) {
        console.error('Ошибка получения статистики:', error);
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

// Запуск сервера
app.listen(PORT, () => {
    console.log(`
    ✅ Сервер запущен на http://localhost:${PORT}
    📊 Админ-панель: http://localhost:${PORT}/t1xxas
    👤 Логин: t1xxas
    🔑 Пароль: Gaga00723
    `);
});

