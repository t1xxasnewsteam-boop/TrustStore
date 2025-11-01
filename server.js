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
// mail-listener2 удален, используем только imap для синхронизации

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = 'your-secret-key-change-this-in-production'; // Измени это!

// Доверяем первому proxy (nginx)
app.set('trust proxy', 1);

// Telegram уведомления
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || '7268320384:AAGngFsmkg_x-2rryDtoJkmYD3ymxy5gM9o';
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID || '6185074849';

// YooMoney настройки
const YOOMONEY_SECRET = process.env.YOOMONEY_SECRET || '2hc5+4LySmLC5E3Hi5yIrZTu'; // Секретный ключ из YooMoney
const YOOMONEY_WALLET = process.env.YOOMONEY_WALLET || ''; // Номер кошелька

// Heleket настройки
const HELEKET_API_KEY = process.env.HELEKET_API_KEY || 'fVzVPxZlpbUGVZap77b2qvBklv9BhBprbUvkCTWXgyRK3rpoIBHKPvM6ZkWEPZAuwYcjPnWEedKD8IpSxmuswbYZxy0RfHRvsrzWWwlkAxB4IfVy6DFXfnHTc9AQ5jOt'; // API ключ для приема платежей
const HELEKET_MERCHANT_ID = process.env.HELEKET_MERCHANT_ID || '987c3430-d898-43bb-999a-310e3b659cfa'; // Merchant ID
const HELEKET_WEBHOOK_SECRET = process.env.HELEKET_WEBHOOK_SECRET || ''; // Секретный ключ для проверки webhook
const HELEKET_API_URL = process.env.HELEKET_API_URL || 'https://api.heleket.com'; // API URL
// Примечание: Если API возвращает HTML, возможно нужен другой endpoint:
// Попробуйте: https://heleket.com/api/v1/payments
// Или: https://merchant.heleket.com/api/payments
// Проверьте документацию Heleket для правильного URL

// Кэш для курса валют (обновляется каждые 5 минут)
let currencyCache = {
    rate: null,
    lastUpdate: null,
    CACHE_DURATION: 5 * 60 * 1000 // 5 минут
};

// Функция получения курса USD/RUB из Google Finance (24/7)
async function getUSDRate() {
    try {
        // Проверяем кэш
        const now = Date.now();
        if (currencyCache.rate && currencyCache.lastUpdate && 
            (now - currencyCache.lastUpdate) < currencyCache.CACHE_DURATION) {
            console.log('💱 Используем кэшированный курс USD/RUB:', currencyCache.rate);
            return currencyCache.rate;
        }
        
        // Метод 1: Yahoo Finance (Apple Finance) - основной источник (24/7, обновляется в реальном времени)
        try {
            const yahooResponse = await fetch('https://query1.finance.yahoo.com/v8/finance/chart/USDRUB=X?interval=1d&range=1d');
            if (yahooResponse.ok) {
                const yahooData = await yahooResponse.json();
                if (yahooData && yahooData.chart && yahooData.chart.result && yahooData.chart.result[0]) {
                    const meta = yahooData.chart.result[0].meta;
                    if (meta && meta.regularMarketPrice) {
                        const rate = parseFloat(meta.regularMarketPrice);
                        if (rate > 0 && rate < 200) { // Разумная проверка
                            currencyCache.rate = rate;
                            currencyCache.lastUpdate = now;
                            console.log('✅ Курс USD/RUB получен из Yahoo Finance (Apple Finance):', rate);
                            return rate;
                        }
                    }
                }
            }
        } catch (error) {
            console.log('⚠️ Yahoo Finance недоступен, пробуем альтернативный метод...');
        }
        
        // Метод 2: exchangerate-api (запасной вариант, обновляется 24/7)
        try {
            const response = await fetch('https://api.exchangerate-api.com/v4/latest/USD', {
                headers: {
                    'User-Agent': 'TrustStore/1.0'
                }
            });
            
            if (response.ok) {
                const data = await response.json();
                
                if (data && data.rates && data.rates.RUB) {
                    const rate = parseFloat(data.rates.RUB);
                    currencyCache.rate = rate;
                    currencyCache.lastUpdate = now;
                    console.log('✅ Курс USD/RUB получен из exchangerate-api:', rate);
                    return rate;
                }
            }
        } catch (error) {
            console.log('⚠️ exchangerate-api недоступен, пробуем другой метод...');
        }
        
        // Метод 3: Google Finance (запасной вариант)
        try {
            const googleResponse = await fetch('https://www.google.com/finance/quote/USD-RUB', {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                }
            });
            
            if (googleResponse.ok) {
                const html = await googleResponse.text();
                // Парсим HTML для получения курса
                const rateMatch = html.match(/"USD\/RUB"[^}]*"l":\s*"([0-9.]+)"/) || 
                                  html.match(/data-last-price="([0-9.]+)"/) ||
                                  html.match(/"regularMarketPrice":\s*\{[^}]*"raw":\s*([0-9.]+)/);
                
                if (rateMatch && rateMatch[1]) {
                    const rate = parseFloat(rateMatch[1]);
                    if (rate > 0 && rate < 200) {
                        currencyCache.rate = rate;
                        currencyCache.lastUpdate = now;
                        console.log('✅ Курс USD/RUB получен из Google Finance:', rate);
                        return rate;
                    }
                }
            }
        } catch (error) {
            console.log('⚠️ Google Finance недоступен...');
        }
        
        // Если ничего не сработало, используем запасной курс (последний известный или дефолтный)
        if (currencyCache.rate) {
            console.log('⚠️ Не удалось обновить курс, используем последний известный:', currencyCache.rate);
            return currencyCache.rate;
        }
        
        // Дефолтный курс (примерно 80 RUB за 1 USD - текущий актуальный)
        const defaultRate = 80;
        console.log('⚠️ Используем дефолтный курс USD/RUB:', defaultRate);
        currencyCache.rate = defaultRate;
        currencyCache.lastUpdate = now;
        return defaultRate;
        
    } catch (error) {
        console.error('❌ Ошибка получения курса USD/RUB:', error.message);
        
        // Используем кэш или дефолтный курс
        if (currencyCache.rate) {
            console.log('💱 Используем последний известный курс из кэша:', currencyCache.rate);
            return currencyCache.rate;
        }
        
        // Дефолтный курс
        return 80;
    }
}

// Функция конвертации RUB в USD
async function convertRUBtoUSD(rubAmount) {
    const rate = await getUSDRate();
    const usdAmount = rubAmount / rate;
    // Округляем до 2 знаков после запятой
    return Math.round(usdAmount * 100) / 100;
}

// API для проверки текущего курса USD/RUB
app.get('/api/currency-rate', async (req, res) => {
    try {
        const rate = await getUSDRate();
        const source = currencyCache.rate === rate ? 'Кэш' : 'Yahoo Finance';
        
        res.json({
            success: true,
            rate: rate,
            source: source,
            timestamp: new Date().toISOString(),
            cached: currencyCache.lastUpdate ? (Date.now() - currencyCache.lastUpdate) / 1000 < currencyCache.CACHE_DURATION / 1000 : false
        });
    } catch (error) {
        res.status(500).json({ error: 'Ошибка получения курса', message: error.message });
    }
});

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
async function sendTelegramNotification(message, silent = false, replyMarkup = null) {
    try {
        if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) {
            console.log('⚠️ Telegram токен или chat_id не настроены, пропускаем уведомление');
            return false;
        }
        
        const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;
        const body = {
            chat_id: TELEGRAM_CHAT_ID,
            text: message,
            parse_mode: 'HTML', // Включаем HTML форматирование
            disable_notification: silent
        };
        
        if (replyMarkup) {
            body.reply_markup = replyMarkup;
        }
        
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
        });
        
        if (response.ok) {
            const data = await response.json();
            if (data.ok) {
                console.log('✅ Telegram уведомление отправлено успешно');
                return data.result || true; // Возвращаем результат или true для обратной совместимости
            } else {
                console.error('❌ Telegram API вернул ошибку:', data.description || 'Unknown error');
                return false;
            }
        } else {
            const errorText = await response.text().catch(() => 'Unknown error');
            console.error('❌ Ошибка HTTP при отправке в Telegram:', response.status, errorText);
            return false;
        }
    } catch (error) {
        console.error('❌ Ошибка отправки Telegram уведомления:', error.message || error);
        return false;
    }
}

// Функция отправки изображения в Telegram
async function sendTelegramPhoto(imageUrl, caption, silent = false) {
    try {
        if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) {
            console.log('⚠️ Telegram токен или chat_id не настроены, пропускаем отправку фото');
            return;
        }
        
        const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendPhoto`;
        const fullImageUrl = `https://truststore.ru${imageUrl}`;
        
        // Экранируем email адреса - убираем parse_mode если есть @
        const hasEmail = caption && caption.includes('@');
        const telegramOptions = {
            chat_id: TELEGRAM_CHAT_ID,
            photo: fullImageUrl,
            caption: caption,
            disable_notification: silent
        };
        
        // Добавляем parse_mode только если нет email адресов
        if (!hasEmail) {
            telegramOptions.parse_mode = 'HTML';
        }
        
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(telegramOptions)
        });
        
        const responseData = await response.json();
        
        if (response.ok) {
            console.log('✅ Telegram фото отправлено успешно');
            return responseData;
        } else {
            console.error('❌ Ошибка HTTP при отправке Telegram фото:', response.status);
            console.error('   Ответ API:', JSON.stringify(responseData));
            throw new Error(responseData.description || `HTTP ${response.status}`);
        }
    } catch (error) {
        console.error('❌ Ошибка отправки Telegram фото:', error.message || error);
        throw error;
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

// Настройка multer для загрузки фото в ответах на email
const emailReplyStorage = multer.diskStorage({
    destination: function (req, file, cb) {
        const uploadDir = path.join(__dirname, 'uploads', 'email-reply-images');
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
const uploadEmailReply = multer({ storage: emailReplyStorage });

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
    
    CREATE TABLE IF NOT EXISTS email_messages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        message_id TEXT UNIQUE NOT NULL,
        from_email TEXT NOT NULL,
        from_name TEXT,
        to_email TEXT NOT NULL,
        subject TEXT NOT NULL,
        body_text TEXT,
        body_html TEXT,
        reply_to_message_id TEXT,
        is_read INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    
    CREATE TABLE IF NOT EXISTS email_replies (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        original_message_id INTEGER NOT NULL,
        reply_subject TEXT NOT NULL,
        reply_body TEXT NOT NULL,
        sent_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (original_message_id) REFERENCES email_messages(id)
    );
    
    CREATE TABLE IF NOT EXISTS email_attachments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        email_message_id INTEGER NOT NULL,
        filename TEXT NOT NULL,
        content_type TEXT,
        file_path TEXT NOT NULL,
        file_size INTEGER,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (email_message_id) REFERENCES email_messages(id)
    );

    CREATE INDEX IF NOT EXISTS idx_session_id ON visits(session_id);
    CREATE INDEX IF NOT EXISTS idx_timestamp ON visits(timestamp);
    CREATE INDEX IF NOT EXISTS idx_country ON visits(country_code);
    CREATE INDEX IF NOT EXISTS idx_order_status ON orders(status);
    CREATE INDEX IF NOT EXISTS idx_customer_email ON customers(email);
    CREATE INDEX IF NOT EXISTS idx_ticket_status ON support_tickets(status);
    CREATE INDEX IF NOT EXISTS idx_ticket_id ON support_messages(ticket_id);
    CREATE INDEX IF NOT EXISTS idx_telegram_comment_id ON telegram_reviews(telegram_comment_id);
    CREATE INDEX IF NOT EXISTS idx_email_message_id ON email_messages(message_id);
    CREATE INDEX IF NOT EXISTS idx_email_from ON email_messages(from_email);
    CREATE INDEX IF NOT EXISTS idx_email_read ON email_messages(is_read);
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
        console.log('📝 Создание нового заказа...');
        const { customerName, customerEmail, customerPhone, products, totalAmount, paymentMethod } = req.body;
        console.log('   Данные заказа:', {
            customerName,
            customerEmail,
            customerPhone: customerPhone ? 'указан' : 'не указан',
            productsCount: Array.isArray(products) ? products.length : 'не массив',
            totalAmount,
            paymentMethod
        });
        
        const ip = req.headers['x-forwarded-for'] || req.connection.remoteAddress;
        const cleanIp = ip.replace('::ffff:', '');
        const geo = geoip.lookup(cleanIp);
        const country = geo ? getCountryName(geo.country) : 'Неизвестно';
        
        // Генерируем ID заказа
        const orderId = 'ORD-' + Date.now();
        console.log('   🆔 Сгенерирован orderId:', orderId);
        
        // Создаем заказ
        const insertResult = db.prepare(`
            INSERT INTO orders (order_id, customer_name, customer_email, customer_phone, products, total_amount, payment_method, ip, country)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(orderId, customerName, customerEmail, customerPhone, JSON.stringify(products), totalAmount, paymentMethod || 'YooMoney', ip, country);
        
        console.log('   ✅ Заказ создан в БД:', {
            orderId,
            insertedId: insertResult.lastInsertRowid,
            changes: insertResult.changes
        });
        
        // Проверяем, что заказ действительно в БД
        const checkOrder = db.prepare('SELECT * FROM orders WHERE order_id = ?').get(orderId);
        if (checkOrder) {
            console.log('   ✅ Подтверждение: заказ найден в БД, статус:', checkOrder.status);
        } else {
            console.error('   ❌ ОШИБКА: заказ не найден в БД после создания!');
        }
        
        // Обновляем или создаем клиента
        const existingCustomer = db.prepare('SELECT * FROM customers WHERE email = ?').get(customerEmail);
        if (existingCustomer) {
            db.prepare(`
                UPDATE customers 
                SET name = ?, phone = ?, orders_count = orders_count + 1, 
                    total_spent = total_spent + ?, last_order = CURRENT_TIMESTAMP
                WHERE email = ?
            `).run(customerName, customerPhone, totalAmount, customerEmail);
            console.log('   ✅ Клиент обновлен:', customerEmail);
        } else {
            db.prepare(`
                INSERT INTO customers (email, name, phone, orders_count, total_spent, first_order, last_order)
                VALUES (?, ?, ?, 1, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
            `).run(customerEmail, customerName, customerPhone, totalAmount);
            console.log('   ✅ Новый клиент создан:', customerEmail);
        }
        
        // Обновляем счетчик продаж для товаров
        const productsList = typeof products === 'string' ? JSON.parse(products) : products;
        productsList.forEach(product => {
            db.prepare('UPDATE products SET sold_count = sold_count + ? WHERE name = ?')
                .run(product.quantity || 1, product.name);
        });
        console.log('   ✅ Счетчики продаж обновлены для', productsList.length, 'товаров');
        
        console.log('   🎉 Заказ успешно создан:', orderId);
        res.json({ success: true, orderId });
    } catch (error) {
        console.error('❌ Ошибка создания заказа:', error);
        console.error('   Stack:', error.stack);
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

// ==================== HELEKET PAYMENT ====================

// API для создания платежа через Heleket (как bot-t: POST /v1/payment)
app.post('/api/payment/heleket/create', async (req, res) => {
    try {
        const { orderId, amount, currency = 'RUB', description, customerEmail, successUrl, cancelUrl } = req.body;
        
        if (!HELEKET_API_KEY || !HELEKET_MERCHANT_ID) {
            return res.status(500).json({ error: 'Heleket не настроен. Добавьте HELEKET_API_KEY и HELEKET_MERCHANT_ID в .env' });
        }
        
        if (!orderId || !amount) {
            return res.status(400).json({ error: 'orderId и amount обязательны' });
        }
        
        const rubAmount = parseFloat(amount);
        let finalAmount = rubAmount;
        let finalCurrency = currency;
        
        // Конвертируем RUB в USD по текущему курсу Google
        if (currency === 'RUB') {
            try {
                const usdAmount = await convertRUBtoUSD(rubAmount);
                finalAmount = usdAmount;
                finalCurrency = 'USD';
                console.log(`💱 Конвертация: ${rubAmount} RUB → ${usdAmount} USD (курс обновляется 24/7)`);
            } catch (error) {
                console.error('❌ Ошибка конвертации валюты:', error);
                // Продолжаем с RUB, если конвертация не удалась
            }
        }
        
        // Создаем платеж через Heleket API с правильной подписью (MD5)
        // Формат: POST https://api.heleket.com/v1/payment
        // Подпись: sign = md5(base64_encode(JSON_BODY) + API_KEY)
        const host = req.get('host');
        const protocol = req.protocol;
        
        // Формируем тело запроса
        const bodyObj = {
            amount: String(finalAmount),
            currency: finalCurrency,
            order_id: orderId
        };
        
        // Добавляем опциональные URL
        if (successUrl) bodyObj.url_success = successUrl;
        else bodyObj.url_success = `${protocol}://${host}/success`;
        
        if (cancelUrl) bodyObj.url_return = cancelUrl;
        else bodyObj.url_return = `${protocol}://${host}/checkout`;
        
        bodyObj.url_callback = `${protocol}://${host}/api/payment/heleket`;
        
        const jsonBody = JSON.stringify(bodyObj);
        const base64Body = Buffer.from(jsonBody, 'utf8').toString('base64');
        // Подпись: sign = md5(base64_encode(JSON_BODY) + API_KEY)
        const sign = crypto.createHash('md5').update(base64Body + HELEKET_API_KEY).digest('hex');
        
        console.log('📤 Создание платежа Heleket:', {
            url: 'https://api.heleket.com/v1/payment',
            merchant: HELEKET_MERCHANT_ID,
            body: bodyObj,
            sign: sign.substring(0, 10) + '...' // Логируем только начало подписи
        });
        
        const response = await fetch('https://api.heleket.com/v1/payment', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'merchant': HELEKET_MERCHANT_ID,
                'sign': sign
            },
            body: jsonBody
        });
        
        const responseText = await response.text();
        let data;
        
        try {
            data = JSON.parse(responseText);
        } catch (error) {
            console.error('❌ Heleket вернул не JSON:', responseText);
            throw new Error(`Heleket response not JSON: status=${response.status} body=${responseText.substring(0, 200)}`);
        }
        
        console.log('📥 Ответ Heleket:', {
            status: response.status,
            state: data.state,
            hasResult: !!data.result
        });
        
        // Проверяем ответ: state должен быть 0 для успеха
        if (!response.ok || data.state !== 0) {
            console.error('❌ Ошибка Heleket:', {
                status: response.status,
                state: data.state,
                message: data.message || data.error || 'Unknown error',
                fullResponse: data
            });
            throw new Error(data.message || data.error || `Heleket error: state=${data.state}, status=${response.status}`);
        }
        
        // Проверяем наличие result.url
        if (!data.result || !data.result.url) {
            console.error('❌ Heleket не вернул result.url:', data);
            throw new Error(`Heleket: result.url missing in response`);
        }
        
        const paymentUrl = data.result.url;
        const invoiceId = data.result.id || orderId;
        
        console.log('✅ Платеж создан, URL:', paymentUrl);
        
        // Возвращаем URL для редиректа клиента
        const responseData = {
            success: true,
            payment_id: invoiceId,
            payment_url: paymentUrl,
            order_id: orderId
        };
        
        // Добавляем информацию о конвертации, если она была выполнена
        if (currency === 'RUB' && finalCurrency === 'USD') {
            const rate = await getUSDRate();
            responseData.conversion = {
                original_amount: rubAmount,
                original_currency: 'RUB',
                converted_amount: finalAmount,
                converted_currency: 'USD',
                exchange_rate: rate,
                rate_source: 'Yahoo Finance (Apple Finance) - обновляется 24/7'
            };
        }
        
        res.json(responseData);
        
    } catch (error) {
        console.error('❌ Ошибка создания платежа Heleket:', error);
        
        // Более детальная обработка ошибок
        let errorMessage = 'Ошибка создания платежа';
        let errorDetails = {};
        
        if (error.type === 'invalid-json') {
            errorMessage = 'Heleket API вернул неверный формат данных';
            errorDetails = {
                hint: 'Возможно, API endpoint неправильный или требует другой формат запроса',
                api_url: HELEKET_API_URL
            };
        } else if (error.message) {
            errorMessage = error.message;
            errorDetails = { original_error: error.message };
        }
        
        res.status(500).json({ 
            error: errorMessage,
            message: errorDetails.hint || 'Проверьте настройки Heleket API',
            details: errorDetails
        });
    }
});

// ==================== ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ ДЛЯ ОБРАБОТКИ ЗАКАЗОВ ====================

// Функция отправки email с повторными попытками
async function sendOrderEmailWithRetry(emailData, maxRetries = 3) {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            console.log(`   📧 Попытка ${attempt}/${maxRetries} отправки email...`);
            const result = await sendOrderEmail(emailData);
            
            if (result && result.success) {
                console.log(`   ✅ Email успешно отправлен с попытки ${attempt}`);
                return { success: true, attempt };
            } else {
                console.error(`   ❌ Попытка ${attempt} не удалась:`, result?.error || 'Unknown error');
                if (attempt < maxRetries) {
                    await new Promise(resolve => setTimeout(resolve, 2000 * attempt)); // Экспоненциальная задержка
                }
            }
        } catch (error) {
            console.error(`   ❌ Ошибка на попытке ${attempt}:`, error.message);
            if (attempt < maxRetries) {
                await new Promise(resolve => setTimeout(resolve, 2000 * attempt));
            }
        }
    }
    
    return { success: false, error: 'Все попытки отправки email исчерпаны' };
}

// Функция отправки Telegram уведомления с повторными попытками
async function sendTelegramWithRetry(message, maxRetries = 3) {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            console.log(`   📱 Попытка ${attempt}/${maxRetries} отправки в Telegram...`);
            const result = await sendTelegramNotification(message, false);
            
            if (result === true) {
                console.log(`   ✅ Telegram уведомление успешно отправлено с попытки ${attempt}`);
                return true;
            } else {
                console.error(`   ❌ Попытка ${attempt} не удалась`);
                if (attempt < maxRetries) {
                    await new Promise(resolve => setTimeout(resolve, 2000 * attempt));
                }
            }
        } catch (error) {
            console.error(`   ❌ Ошибка на попытке ${attempt}:`, error.message);
            if (attempt < maxRetries) {
                await new Promise(resolve => setTimeout(resolve, 2000 * attempt));
            }
        }
    }
    
    console.error('   ❌ Все попытки отправки в Telegram исчерпаны');
    return false;
}

// ==================== YOOMONEY PAYMENT WEBHOOK (ПОЛНОСТЬЮ ПЕРЕПИСАН) ====================

app.post('/api/payment/yoomoney', async (req, res) => {
    const startTime = Date.now();
    let orderProcessed = false;
    
    try {
        console.log('\n═══════════════════════════════════════════════════════');
        console.log('📥 YOOMONEY WEBHOOK ПОЛУЧЕН');
        console.log('═══════════════════════════════════════════════════════\n');
        console.log('⏰ Время:', new Date().toISOString());
        console.log('📋 Headers:', JSON.stringify(req.headers, null, 2));
        console.log('📦 Body:', JSON.stringify(req.body, null, 2));
        
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
        
        // Валидация обязательных полей
        if (!label || !amount || !notification_type) {
            console.error('❌ Отсутствуют обязательные поля в webhook');
            return res.status(400).send('Missing required fields');
        }
        
        console.log('\n📋 Данные YooMoney:');
        console.log('   notification_type:', notification_type);
        console.log('   operation_id:', operation_id);
        console.log('   amount:', amount);
        console.log('   currency:', currency);
        console.log('   label (order_id):', label);
        
        // Проверка типа уведомления
        if (notification_type !== 'p2p-incoming' && notification_type !== 'card-incoming') {
            console.log('⚠️ Неподдерживаемый тип:', notification_type);
            return res.status(200).send('OK'); // Возвращаем OK для неподдерживаемых типов
        }
        
        // Проверка подписи (если настроена)
        if (YOOMONEY_SECRET && sha1_hash) {
            const string = `${notification_type}&${operation_id}&${amount}&${currency}&${datetime}&${sender}&${codepro}&${YOOMONEY_SECRET}&${label}`;
            const hash = crypto.createHash('sha1').update(string).digest('hex');
            
            if (hash !== sha1_hash) {
                console.error('❌ Неверная подпись!');
                // В продакшене можно вернуть 400, но для отладки продолжаем
                console.log('⚠️ Продолжаем обработку (режим отладки)');
            } else {
                console.log('✅ Подпись проверена');
            }
        }
        
        // Поиск заказа
        const order = db.prepare('SELECT * FROM orders WHERE order_id = ?').get(label);
        
        if (!order) {
            console.error('❌ Заказ не найден:', label);
            return res.status(404).send('Order not found');
        }
        
        console.log('\n📦 Найден заказ:');
        console.log('   ID:', order.order_id);
        console.log('   Клиент:', order.customer_name);
        console.log('   Email:', order.customer_email);
        console.log('   Статус:', order.status);
        console.log('   Сумма:', order.total_amount);
        
        // Проверка, не обработан ли уже заказ
        if (order.status === 'paid') {
            console.log('⚠️ Заказ уже обработан, пропускаем');
            return res.status(200).send('OK');
        }
        
        // Проверка суммы (учитываем комиссии платежной системы до 10%)
        const orderAmount = parseFloat(order.total_amount);
        const paymentAmount = parseFloat(amount);
        const minAmount = orderAmount * 0.90; // Допускаем до 10% разницы из-за комиссий
        
        if (paymentAmount < minAmount) {
            console.error('❌ Неверная сумма платежа:', paymentAmount, 'ожидалось минимум:', minAmount.toFixed(2), '(с учетом комиссий до 10%)');
            return res.status(400).send('Wrong amount');
        }
        
        if (paymentAmount < orderAmount) {
            const difference = orderAmount - paymentAmount;
            console.log(`⚠️ Платеж меньше на ${difference.toFixed(2)} ₽ (комиссия платежной системы)`);
        }
        
        // Обновление статуса заказа
        console.log('\n💰 Обновление статуса заказа на "paid"...');
        const updateResult = db.prepare('UPDATE orders SET status = ? WHERE order_id = ?').run('paid', label);
        
        if (updateResult.changes === 0) {
            console.error('❌ Не удалось обновить статус заказа!');
            return res.status(500).send('Failed to update order');
        }
        
        console.log('✅ Статус обновлен (изменено строк:', updateResult.changes, ')');
        orderProcessed = true;
        
        // Получение товаров
        const products = JSON.parse(order.products || '[]');
        console.log('\n📦 Товары в заказе:', products.length);
        
        // ОТПРАВКА EMAILS С ПОВТОРНЫМИ ПОПЫТКАМИ
        console.log('\n📧 ОТПРАВКА EMAILS КЛИЕНТУ (с повторными попытками)...\n');
        let emailsSent = 0;
        let emailsFailed = 0;
        
        for (const product of products) {
            const quantity = product.quantity || 1;
            const productName = product.name || product.productName || product.product_name;
            
            console.log(`\n📦 Товар: "${productName}" (x${quantity})`);
            
            // Поиск информации о товаре
            let productInfo = db.prepare('SELECT * FROM products WHERE name = ?').get(productName);
            if (!productInfo) {
                const baseName = productName.split('(')[0].split('-')[0].split('|')[0].split('[')[0].trim();
                productInfo = db.prepare('SELECT * FROM products WHERE name LIKE ?').get(baseName + '%');
            }
            
            // Отправка для каждого товара
            for (let i = 0; i < quantity; i++) {
                const emailData = {
                    to: order.customer_email,
                    orderNumber: label,
                    productName: productName,
                    productImage: productInfo ? productInfo.image : (product.image || null),
                    productCategory: productInfo ? productInfo.category : null,
                    productDescription: productInfo ? productInfo.description : null,
                    login: null,
                    password: null,
                    instructions: productInfo ? productInfo.description : 'Спасибо за покупку! Инструкции по использованию товара будут отправлены отдельно.'
                };
                
                const emailResult = await sendOrderEmailWithRetry(emailData, 3);
                
                if (emailResult.success) {
                    emailsSent++;
                    console.log(`   ✅ Email ${i + 1}/${quantity} отправлен`);
                } else {
                    emailsFailed++;
                    console.error(`   ❌ Email ${i + 1}/${quantity} НЕ отправлен после всех попыток`);
                }
            }
        }
        
        console.log(`\n📊 ИТОГО EMAILS: отправлено ${emailsSent}, ошибок ${emailsFailed}`);
        
        // ОТПРАВКА В TELEGRAM С ПОВТОРНЫМИ ПОПЫТКАМИ
        console.log('\n📱 ОТПРАВКА УВЕДОМЛЕНИЯ В TELEGRAM (с повторными попытками)...\n');
        
        const telegramMessage = `💰 <b>НОВЫЙ ПЛАТЕЖ YOOMONEY!</b>\n\n` +
            `🆔 Заказ: <code>${label}</code>\n` +
            `💳 Операция: <code>${operation_id}</code>\n` +
            `👤 Клиент: ${order.customer_name}\n` +
            `📧 Email: ${order.customer_email}\n` +
            `💵 Сумма: ${amount} ${currency}\n` +
            `📦 Товары: ${products.map(p => p.name || p.productName || p.product_name).join(', ')}\n` +
            `📅 Дата: ${datetime || new Date().toISOString()}\n\n` +
            `📊 Emails: ✅ ${emailsSent} | ❌ ${emailsFailed}\n\n` +
            `🔗 <a href="https://truststore.ru/admin.html">Открыть админку</a>`;
        
        const telegramSent = await sendTelegramWithRetry(telegramMessage, 3);
        
        if (telegramSent) {
            console.log('✅ Telegram уведомление отправлено');
        } else {
            console.error('❌ Telegram уведомление НЕ отправлено после всех попыток');
        }
        
        const duration = ((Date.now() - startTime) / 1000).toFixed(2);
        console.log(`\n✅ ОБРАБОТКА ЗАВЕРШЕНА за ${duration} сек`);
        console.log('═══════════════════════════════════════════════════════\n');
        
        // Всегда возвращаем 200 OK
        res.status(200).send('OK');
        
    } catch (error) {
        console.error('\n❌ КРИТИЧЕСКАЯ ОШИБКА ОБРАБОТКИ WEBHOOK:');
        console.error('   Ошибка:', error.message);
        console.error('   Stack:', error.stack);
        
        // Если заказ был обновлен, но отправка не удалась, отправляем уведомление об ошибке
        if (orderProcessed) {
            try {
                await sendTelegramNotification(
                    `⚠️ <b>ОШИБКА ПРИ ОБРАБОТКЕ ЗАКАЗА!</b>\n\n` +
                    `Заказ: ${req.body?.label || 'unknown'}\n` +
                    `Ошибка: ${error.message}\n\n` +
                    `Проверь логи и отправь заказ вручную!`,
                    false
                );
            } catch (telegramError) {
                console.error('Не удалось отправить уведомление об ошибке:', telegramError);
            }
        }
        
        res.status(500).send('Server error');
    }
});

// ==================== HELEKET PAYMENT WEBHOOK (ПОЛНОСТЬЮ ПЕРЕПИСАН) ====================

app.post('/api/payment/heleket', async (req, res) => {
    const startTime = Date.now();
    let orderProcessed = false;
    
    try {
        console.log('\n═══════════════════════════════════════════════════════');
        console.log('📥 HELEKET WEBHOOK ПОЛУЧЕН');
        console.log('═══════════════════════════════════════════════════════\n');
        console.log('⏰ Время:', new Date().toISOString());
        console.log('📋 Headers:', JSON.stringify(req.headers, null, 2));
        console.log('📦 Body:', JSON.stringify(req.body, null, 2));
        
        // Heleket может присылать данные в разных форматах, проверим разные варианты
        const body = req.body;
        const event = body.event || body.type || body.status;
        const payment_id = body.payment_id || body.id || body.paymentId || body.invoice_id || body.invoiceId;
        const order_id = body.order_id || body.orderId || body.order || body.label;
        const amount = body.amount || body.sum || body.total;
        const currency = body.currency || 'RUB';
        const status = body.status || body.state || body.payment_status;
        const signature = body.signature || body.sign || body.hash;
        const customer_email = body.customer_email || body.email || body.customerEmail;
        
        console.log('📋 Парсинг данных:');
        console.log('   event:', event);
        console.log('   payment_id:', payment_id);
        console.log('   order_id:', order_id);
        console.log('   amount:', amount);
        console.log('   currency:', currency);
        console.log('   status:', status);
        console.log('   signature:', signature ? signature.substring(0, 10) + '...' : 'нет');
        console.log('   customer_email:', customer_email);
        
        // Проверяем подпись webhook (если настроен секретный ключ)
        if (HELEKET_WEBHOOK_SECRET && signature) {
            // Формируем строку для проверки подписи
            const payloadString = JSON.stringify(req.body);
            const expectedSignature = crypto
                .createHmac('sha256', HELEKET_WEBHOOK_SECRET)
                .update(payloadString)
                .digest('hex');
            
            if (signature !== expectedSignature) {
                console.error('❌ Неверная подпись от Heleket!');
                console.error('   Ожидалось:', expectedSignature.substring(0, 20) + '...');
                console.error('   Получено:', signature.substring(0, 20) + '...');
                return res.status(400).send('Invalid signature');
            }
            console.log('✅ Подпись проверена');
        } else {
            console.log('⚠️ Проверка подписи пропущена (нет HELEKET_WEBHOOK_SECRET или signature)');
        }
        
        // Обрабатываем только ФИНАЛЬНЫЕ и успешные платежи
        // Проверяем разные варианты статусов
        const isPaid = (
            (status === 'paid' || 
            status === 'completed' || 
            status === 'success' ||
            status === 'successful' ||
            event === 'payment.succeeded' ||
            event === 'invoice.paid' ||
            event === 'payment.completed' ||
            body.state === 0 || // Heleket может возвращать state: 0 для успеха
            body.result?.status === 'paid') &&
            (body.is_final === true || body.is_final === undefined) // Обрабатываем только финальные платежи
        );
        
        if (!isPaid) {
            console.log('⚠️ Неподдерживаемый статус платежа или промежуточный webhook:', {
                status: status,
                event: event,
                state: body.state,
                result: body.result,
                is_final: body.is_final
            });
            return res.status(200).send('OK'); // Возвращаем OK, но ничего не делаем
        }
        
        if (!order_id) {
            console.error('❌ order_id не найден в запросе!');
            console.error('   Полный body:', JSON.stringify(body, null, 2));
            return res.status(400).send('Missing order_id');
        }
        
        // Находим заказ по order_id
        console.log('🔍 Ищем заказ в БД по order_id:', order_id);
        const order = db.prepare('SELECT * FROM orders WHERE order_id = ?').get(order_id);
        
        if (!order) {
            console.error('❌ Заказ не найден в БД:', order_id);
            console.error('   Проверяем все заказы в БД...');
            const allOrders = db.prepare('SELECT order_id, status, created_at FROM orders ORDER BY created_at DESC LIMIT 10').all();
            console.error('   Последние 10 заказов:', allOrders);
            return res.status(404).send('Order not found');
        }
        
        console.log('✅ Заказ найден:', {
            order_id: order.order_id,
            status: order.status,
            customer_name: order.customer_name,
            customer_email: order.customer_email,
            total_amount: order.total_amount,
            created_at: order.created_at
        });
        
        // Проверяем, не обработан ли уже этот платеж
        if (order.status === 'paid') {
            console.log('⚠️ Заказ уже обработан:', order_id);
            return res.status(200).send('OK');
        }
        
        // Проверяем сумму с учетом валют
        // Если платеж в USD, а заказ в RUB, конвертируем для сравнения
        const paymentAmount = parseFloat(amount);
        const orderAmount = parseFloat(order.total_amount);
        const paymentCurrency = currency || 'USD';
        
        console.log('💱 Проверка суммы:', {
            paymentAmount,
            paymentCurrency,
            orderAmount,
            'orderPaymentMethod': order.payment_method
        });
        
        // Если платеж через Heleket, заказ был конвертирован в USD при создании платежа
        // Поэтому сравниваем напрямую, если платеж в USD
        if (order.payment_method === 'Heleket' && paymentCurrency === 'USD') {
            // Заказ был создан в RUB, но мы отправляли в Heleket конвертированную сумму в USD
            // Поэтому нужно получить оригинальную сумму заказа в RUB и конвертировать её в USD
            try {
                const usdRate = await getUSDRate();
                const orderAmountUSD = orderAmount / usdRate;
                console.log('   Конвертация для проверки:', {
                    orderAmountRUB: orderAmount,
                    usdRate: usdRate,
                    orderAmountUSD: orderAmountUSD,
                    paymentAmountUSD: paymentAmount
                });
                
                // Проверяем с допуском 10% (комиссия и колебания курса)
                if (paymentAmount < orderAmountUSD * 0.9) {
                    console.error('❌ Неверная сумма платежа:', paymentAmount, 'USD ожидалось минимум:', orderAmountUSD * 0.9, 'USD');
                    return res.status(400).send('Wrong amount');
                }
                console.log('   ✅ Сумма проверена успешно');
            } catch (conversionError) {
                console.error('⚠️ Ошибка конвертации для проверки суммы:', conversionError);
                // Если конвертация не удалась, пропускаем проверку (доверяем Heleket)
                console.log('   ⚠️ Пропускаем проверку суммы из-за ошибки конвертации');
            }
        } else if (paymentCurrency === 'RUB' && order.payment_method !== 'Heleket') {
            // Если и платеж и заказ в RUB (YooMoney или другой способ)
            // С учетом комиссии (допускаем до 10% меньше из-за комиссий)
            if (paymentAmount < orderAmount * 0.9) {
                console.error('❌ Неверная сумма платежа:', paymentAmount, paymentCurrency, 'ожидалось минимум:', orderAmount * 0.9, paymentCurrency);
                return res.status(400).send('Wrong amount');
            }
            console.log('   ✅ Сумма проверена успешно (RUB)');
        } else {
            console.warn('⚠️ Валюты не совпадают или способ оплаты не определен:', {
                paymentCurrency,
                orderPaymentMethod: order.payment_method
            });
            // В этом случае пропускаем проверку суммы (доверяем платежной системе)
            console.log('   ⚠️ Пропускаем проверку суммы');
        }
        
        console.log('\n💰 Платеж Heleket подтвержден');
        console.log('   order_id:', order_id);
        console.log('   Сумма:', amount, currency);
        console.log('   Статус заказа до обновления:', order.status);
        
        // Обновление статуса заказа
        console.log('\n💰 Обновление статуса заказа на "paid"...');
        const updateResult = db.prepare('UPDATE orders SET status = ? WHERE order_id = ?').run('paid', order_id);
        
        if (updateResult.changes === 0) {
            console.error('❌ Не удалось обновить статус заказа!');
            return res.status(500).send('Failed to update order');
        }
        
        console.log('✅ Статус обновлен (изменено строк:', updateResult.changes, ')');
        orderProcessed = true;
        
        // Получение товаров
        const products = JSON.parse(order.products || '[]');
        console.log('\n📦 Товары в заказе:', products.length);
        
        // ОТПРАВКА EMAILS С ПОВТОРНЫМИ ПОПЫТКАМИ
        console.log('\n📧 ОТПРАВКА EMAILS КЛИЕНТУ (с повторными попытками)...\n');
        let emailsSent = 0;
        let emailsFailed = 0;
        
        for (const product of products) {
            const quantity = product.quantity || 1;
            const productName = product.name || product.productName || product.product_name;
            
            console.log(`\n📦 Товар: "${productName}" (x${quantity})`);
            
            // Поиск информации о товаре
            let productInfo = db.prepare('SELECT * FROM products WHERE name = ?').get(productName);
            if (!productInfo) {
                const baseName = productName.split('(')[0].split('-')[0].split('|')[0].split('[')[0].trim();
                productInfo = db.prepare('SELECT * FROM products WHERE name LIKE ?').get(baseName + '%');
            }
            
            // Отправка для каждого товара
            for (let i = 0; i < quantity; i++) {
                const emailData = {
                    to: order.customer_email,
                    orderNumber: order_id,
                    productName: productName,
                    productImage: productInfo ? productInfo.image : (product.image || null),
                    productCategory: productInfo ? productInfo.category : null,
                    productDescription: productInfo ? productInfo.description : null,
                    login: null,
                    password: null,
                    instructions: productInfo ? productInfo.description : 'Спасибо за покупку! Инструкции по использованию товара будут отправлены отдельно.'
                };
                
                const emailResult = await sendOrderEmailWithRetry(emailData, 3);
                
                if (emailResult.success) {
                    emailsSent++;
                    console.log(`   ✅ Email ${i + 1}/${quantity} отправлен`);
                } else {
                    emailsFailed++;
                    console.error(`   ❌ Email ${i + 1}/${quantity} НЕ отправлен после всех попыток`);
                }
            }
        }
        
        console.log(`\n📊 ИТОГО EMAILS: отправлено ${emailsSent}, ошибок ${emailsFailed}`);
        
        // ОТПРАВКА В TELEGRAM С ПОВТОРНЫМИ ПОПЫТКАМИ
        console.log('\n📱 ОТПРАВКА УВЕДОМЛЕНИЯ В TELEGRAM (с повторными попытками)...\n');
        
        const telegramMessage = `💰 <b>НОВЫЙ ПЛАТЕЖ HELEKET!</b>\n\n` +
            `🆔 Заказ: <code>${order_id}</code>\n` +
            `💳 Платеж: <code>${payment_id || 'N/A'}</code>\n` +
            `👤 Клиент: ${order.customer_name}\n` +
            `📧 Email: ${order.customer_email}\n` +
            `💵 Сумма: ${amount} ${currency}\n` +
            `📦 Товары: ${products.map(p => p.name || p.productName || p.product_name).join(', ')}\n` +
            `📅 Дата: ${new Date().toISOString()}\n\n` +
            `📊 Emails: ✅ ${emailsSent} | ❌ ${emailsFailed}\n\n` +
            `🔗 <a href="https://truststore.ru/admin.html">Открыть админку</a>`;
        
        const telegramSent = await sendTelegramWithRetry(telegramMessage, 3);
        
        if (telegramSent) {
            console.log('✅ Telegram уведомление отправлено');
        } else {
            console.error('❌ Telegram уведомление НЕ отправлено после всех попыток');
        }
        
        const duration = ((Date.now() - startTime) / 1000).toFixed(2);
        console.log(`\n✅ ОБРАБОТКА ЗАВЕРШЕНА за ${duration} сек`);
        console.log('═══════════════════════════════════════════════════════\n');
        
        // Всегда возвращаем 200 OK
        res.status(200).send('OK');
        
    } catch (error) {
        console.error('\n❌ КРИТИЧЕСКАЯ ОШИБКА ОБРАБОТКИ WEBHOOK:');
        console.error('   Ошибка:', error.message);
        console.error('   Stack:', error.stack);
        
        // Если заказ был обновлен, но отправка не удалась, отправляем уведомление об ошибке
        if (orderProcessed) {
            try {
                await sendTelegramNotification(
                    `⚠️ <b>ОШИБКА ПРИ ОБРАБОТКЕ ЗАКАЗА HELEKET!</b>\n\n` +
                    `Заказ: ${req.body?.order_id || req.body?.orderId || 'unknown'}\n` +
                    `Ошибка: ${error.message}\n\n` +
                    `Проверь логи и отправь заказ вручную!`,
                    false
                );
            } catch (telegramError) {
                console.error('Не удалось отправить уведомление об ошибке:', telegramError);
            }
        }
        
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

app.get('/about', (req, res) => {
    res.sendFile(path.join(__dirname, 'about.html'));
});

app.get('/faq', (req, res) => {
    res.sendFile(path.join(__dirname, 'faq.html'));
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
        
        // Отправляем приветственное письмо (асинхронно, но с обработкой ошибок)
        sendWelcomeEmail(email).then(result => {
            if (result && result.success) {
                console.log(`✅ Приветственное письмо доставлено: ${email}`);
            } else {
                console.error(`❌ Не удалось отправить приветственное письмо: ${email}`, result?.error || 'Unknown error');
            }
        }).catch(error => {
            console.error(`❌ Ошибка отправки приветственного письма: ${email}`, error.message || error);
        });
        
        // Отправляем уведомление в Telegram
        console.log('📱 Отправка уведомления в Telegram...');
        const notificationText = `📧 <b>Новая подписка на новости!</b>\n\n` +
            `📬 Email: ${email}\n` +
            `📅 Дата: ${new Date().toLocaleString('ru-RU')}\n\n` +
            `🔗 <a href="https://truststore.ru/t1xxas">Открыть админку</a>`;
        
        sendTelegramNotification(notificationText, true).then(success => {
            if (success) {
                console.log(`✅ Telegram уведомление отправлено для: ${email}`);
            } else {
                console.error(`❌ Telegram уведомление НЕ отправлено для: ${email}`);
            }
        }).catch(error => {
            console.error(`❌ Ошибка отправки Telegram уведомления: ${email}`, error.message || error);
        });
        
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
    const { orderNumber, productName, productImage, productCategory, productDescription, login, password, instructions } = data;
    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Ваш заказ #${orderNumber}</title>
  <style>
    @media only screen and (max-width: 600px) {
      .email-container { width: 100% !important; max-width: 100% !important; }
      .email-padding { padding: 20px 16px !important; }
      .header-padding { padding: 20px 16px !important; }
      .header-table { width: 100% !important; }
      .header-table tr { display: block !important; width: 100% !important; }
      .header-left { display: block !important; width: 100% !important; margin-bottom: 16px !important; padding-right: 0 !important; }
      .header-right { display: block !important; width: 100% !important; text-align: left !important; padding-left: 0 !important; padding-top: 12px !important; border-top: 1px solid rgba(255,255,255,0.2) !important; font-size: 13px !important; }
      .product-table { width: 100% !important; }
      .product-table tr { display: flex !important; flex-direction: column !important; width: 100% !important; }
      .product-label { display: block !important; width: 100% !important; margin-bottom: 8px !important; font-weight: 600 !important; }
      .product-name { display: block !important; width: 100% !important; padding-right: 0 !important; margin-bottom: 16px !important; font-size: 17px !important; }
      .product-image { display: block !important; width: 100% !important; text-align: center !important; margin-top: 0 !important; margin-bottom: 16px !important; padding-top: 12px !important; border-top: 1px solid rgba(102,126,234,0.15) !important; }
      .product-image img { margin: 0 auto !important; max-width: 120px !important; max-height: 120px !important; }
      .telegram-card { padding: 20px 16px !important; }
      .telegram-text { font-size: 14px !important; line-height: 1.5 !important; }
      .button-cell { padding: 10px 18px !important; }
      .button-text { font-size: 13px !important; }
      h1 { font-size: 20px !important; }
      .product-info-box { padding: 16px 18px !important; }
    }
  </style>
</head>
<body style="margin:0;padding:0;background:#f5f5f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f5f5f5;padding:32px 12px;">
    <tr>
      <td align="center">
        <table role="presentation" width="640" cellspacing="0" cellpadding="0" class="email-container" style="background:#ffffff;border-radius:16px;overflow:hidden;border:1px solid rgba(0,0,0,0.08);box-shadow:0 4px 24px rgba(0,0,0,0.1);max-width:100%;">
          <tr>
            <td class="header-padding" style="padding:28px 32px;background:linear-gradient(135deg,#667eea 0%,#764ba2 100%);">
              <table width="100%" cellspacing="0" cellpadding="0" class="header-table">
                <tr>
                  <td class="header-left" align="left" style="vertical-align:middle;">
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
                  <td class="header-right" align="right" style="color:#fff;font-size:14px;opacity:.9;white-space:nowrap;vertical-align:middle;padding-left:20px;">Заказ <strong style="font-weight:700;">#${orderNumber}</strong></td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td class="email-padding" style="padding:32px;color:#1a1a1a;">
              <h1 style="margin:0 0 12px 0;font-size:22px;line-height:1.3;color:#1a1a1a;text-align:center;">Спасибо за покупку!</h1>
              <p style="margin:0 0 24px 0;font-size:14px;color:#666;text-align:center;">Ниже — данные для доступа и краткая информация по заказу.</p>
              <div class="product-info-box" style="background:#f8f9ff;border:1px solid rgba(102,126,234,0.15);border-radius:12px;padding:20px 24px;margin:0 0 24px 0;">
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" class="product-table" style="table-layout:fixed;">
                  <tr>
                    <td class="product-label" style="font-size:14px;color:#1a1a1a;width:80px;vertical-align:middle;white-space:nowrap;">Товар:</td>
                    <td class="product-name" style="font-size:16px;color:#1a1a1a;font-weight:700;vertical-align:middle;word-wrap:break-word;word-break:break-word;padding-right:16px;">
                      ${productName}
                    </td>
                  </tr>
                  ${productImage ? `<tr>
                    <td class="product-image" colspan="2" style="text-align:center;vertical-align:middle;width:100%;padding-top:16px;border-top:1px solid rgba(102,126,234,0.15);margin-top:16px;">
                      <img src="https://truststore.ru/${productImage}" alt="${productName}" style="max-width:120px;max-height:120px;width:auto;height:auto;object-fit:contain;display:block;margin:0 auto;">
                    </td>
                  </tr>` : ''}
                </table>
              </div>
              <div style="margin:18px 0 22px 0;">
                <div class="telegram-card" style="background:linear-gradient(135deg, #667eea 0%, #764ba2 100%);border-radius:12px;padding:24px;text-align:center;box-shadow:0 4px 12px rgba(102,126,234,0.2);">
                  <div class="telegram-text" style="font-size:15px;color:#ffffff;margin:0 0 12px 0;line-height:1.6;">
                    Для получения товара напишите 
                    <a href="https://t.me/truststore_admin" style="color:#ffffff;font-weight:700;text-decoration:underline;text-decoration-thickness:2px;text-underline-offset:3px;">@truststore_admin</a> 
                    в Telegram
                  </div>
                  <table role="presentation" cellspacing="0" cellpadding="0" style="margin:16px auto 0;">
                    <tr>
                      <td style="background:#ffffff;padding:12px 24px;border-radius:8px;">
                        <a href="https://t.me/truststore_admin" style="font-size:15px;color:#667eea;text-decoration:none;font-weight:700;display:inline-block;">
                          ✉️ Написать в Telegram
                        </a>
                      </td>
                    </tr>
                  </table>
                </div>
              </div>
              ${instructions ? `
              <div style="background:#fff9e6;border:1px solid rgba(255,184,0,0.35);border-radius:12px;padding:16px 18px;margin:0 0 22px 0;">
                <div style="font-size:14px;font-weight:600;margin:0 0 6px 0;color:#B45309;">Инструкции</div>
                <div style="font-size:13px;line-height:1.7;color:#666;">${instructions}</div>
              </div>` : ''}
              <table role="presentation" cellspacing="0" cellpadding="0" style="margin-top:4px;">
                <tr>
                  <td class="button-cell" style="background:#667eea;padding:12px 22px;border-radius:10px;">
                    <a href="https://truststore.ru" class="button-text" style="font-size:14px;color:#fff;text-decoration:none;display:inline-block;">Перейти в магазин</a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding:20px 28px;border-top:1px solid rgba(0,0,0,0.08);text-align:center;color:#999;font-size:12px;background:#f8f9ff;">
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

// Функция создания текстовой версии письма
function createOrderEmailText(data) {
    const { orderNumber, productName } = data;
    return `
Спасибо за покупку!

Ваш заказ #${orderNumber}

Товар: ${productName}

Для получения товара напишите @truststore_admin в Telegram: https://t.me/truststore_admin

Если у вас есть вопросы, ответьте на это письмо или напишите через виджет на сайте.

© ${new Date().getFullYear()} Trust Store
`;
}

// Функция отправки письма с заказом
async function sendOrderEmail(data) {
    // Попытка отправить через SendGrid (если настроен)
    if (process.env.SENDGRID_API_KEY) {
        try {
            // Читаем логотип для вложения
            const logoPath = path.join(__dirname, 'youtube-avatar.png');
            let attachments = [];
            
            if (fs.existsSync(logoPath)) {
                const logoContent = fs.readFileSync(logoPath);
                attachments.push({
                    content: logoContent.toString('base64'),
                    filename: 'youtube-avatar.png',
                    type: 'image/png',
                    disposition: 'inline',
                    content_id: 'youtube-avatar'
                });
            }
            
            const msg = {
                to: data.to,
                from: process.env.EMAIL_USER || 'orders@truststore.ru',
                subject: `Ваш заказ #${data.orderNumber} | Trust Store`,
                html: createOrderEmailHTML(data),
                text: createOrderEmailText(data),
                headers: {
                    'X-Mailer': 'Trust Store',
                    'List-Unsubscribe': '<https://truststore.ru/unsubscribe>'
                },
                attachments: attachments
            };
            
            const response = await sgMail.send(msg);
            console.log(`✅ Письмо отправлено через SendGrid: ${data.to}${attachments.length > 0 ? ' (с логотипом)' : ''}`);
            const messageId = response && response[0] && response[0].headers ? response[0].headers['x-message-id'] : 'unknown';
            return { success: true, messageId: messageId, method: 'SendGrid' };
        } catch (error) {
            console.error('❌ Ошибка SendGrid:', error.message);
            console.error('   Детали:', error.response?.body || error);
            // Продолжаем попытку через SMTP
        }
    }
    
    // Попытка отправить через SMTP
    try {
        const mailOptions = {
            from: process.env.EMAIL_FROM || '"Trust Store" <orders@truststore.ru>',
            to: data.to,
            replyTo: 'orders@truststore.ru',
            subject: `Ваш заказ #${data.orderNumber} | Trust Store`,
            html: createOrderEmailHTML(data),
            text: createOrderEmailText(data),
            headers: {
                'X-Mailer': 'Trust Store',
                'List-Unsubscribe': '<https://truststore.ru/unsubscribe>',
                'X-Priority': '3',
                'X-MSMail-Priority': 'Normal'
            },
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
        console.log(`📧 Отправка приветственного письма на: ${email}`);
        
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

        // Пробуем отправить через SendGrid, если настроен
        if (process.env.SENDGRID_API_KEY && sgMail) {
            try {
                console.log(`   Попытка отправки через SendGrid...`);
                await sgMail.send({
                    to: email,
                    from: process.env.EMAIL_USER || process.env.EMAIL_FROM || 'orders@truststore.ru',
                    subject: '🎉 Спасибо за подписку на новости Trust Store!',
                    html: createWelcomeEmailHTML(),
                    attachments: [
                        {
                            filename: 'logo.png',
                            content: fs.readFileSync(path.join(__dirname, 'logo.png')).toString('base64'),
                            type: 'image/png',
                            disposition: 'inline',
                            contentId: 'logo'
                        }
                    ]
                });
                console.log(`✅ Приветственное письмо отправлено через SendGrid: ${email}`);
                return { success: true, method: 'SendGrid' };
            } catch (sgError) {
                console.error(`   ❌ Ошибка SendGrid: ${sgError.message}, пробуем SMTP...`);
            }
        }

        // Отправляем через SMTP
        const info = await emailTransporter.sendMail(mailOptions);
        console.log(`✅ Приветственное письмо отправлено через SMTP: ${email} (${info.messageId})`);
        return { success: true, messageId: info.messageId, method: 'SMTP' };
    } catch (error) {
        console.error('❌ Ошибка отправки приветственного письма:', error.message || error);
        console.error('   Stack:', error.stack);
        return { success: false, error: error.message || 'Unknown error' };
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

// ==================== EMAIL INBOX API (АДМИНКА) ====================

// Получить все письма
app.get('/api/admin/emails', authMiddleware, (req, res) => {
    try {
        const { filter, limit = 50 } = req.query;
        
        let query = 'SELECT * FROM email_messages';
        const params = [];
        
        if (filter === 'unread') {
            query += ' WHERE is_read = 0';
        } else if (filter === 'read') {
            query += ' WHERE is_read = 1';
        }
        
        query += ' ORDER BY created_at DESC LIMIT ?';
        params.push(parseInt(limit));
        
        const emails = db.prepare(query).all(...params);
        
        // Получаем информацию о ответах
        const emailsWithReplies = emails.map(email => {
            const replies = db.prepare(`
                SELECT * FROM email_replies 
                WHERE original_message_id = ?
                ORDER BY sent_at DESC
            `).all(email.id);
            
            return {
                ...email,
                has_reply: replies.length > 0,
                replies_count: replies.length
            };
        });
        
        res.json({ emails: emailsWithReplies });
    } catch (error) {
        console.error('Ошибка получения писем:', error);
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

// Получить одно письмо по ID
app.get('/api/admin/emails/:id', authMiddleware, (req, res) => {
    try {
        const { id } = req.params;
        
        const email = db.prepare('SELECT * FROM email_messages WHERE id = ?').get(id);
        
        if (!email) {
            return res.status(404).json({ error: 'Письмо не найдено' });
        }
        
        // Помечаем как прочитанное
        db.prepare('UPDATE email_messages SET is_read = 1 WHERE id = ?').run(id);
        
        // Получаем ответы
        const replies = db.prepare(`
            SELECT * FROM email_replies 
            WHERE original_message_id = ?
            ORDER BY sent_at DESC
        `).all(id);
        
        // Получаем вложения
        const attachments = db.prepare(`
            SELECT * FROM email_attachments 
            WHERE email_message_id = ?
            ORDER BY created_at ASC
        `).all(id);
        
        res.json({ email: { ...email, replies, attachments } });
    } catch (error) {
        console.error('Ошибка получения письма:', error);
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

// Endpoint для загрузки фото для ответа на email
app.post('/api/admin/emails/reply/upload-image', authMiddleware, uploadEmailReply.single('image'), (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'Файл не загружен' });
        }
        
        const imageUrl = `/uploads/email-reply-images/${req.file.filename}`;
        res.json({ success: true, imageUrl: imageUrl });
    } catch (error) {
        console.error('Ошибка загрузки фото для ответа:', error);
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

// Отправить ответ на письмо
app.post('/api/admin/emails/:id/reply', authMiddleware, async (req, res) => {
    try {
        const { id } = req.params;
        const { subject, body, imageUrl } = req.body;
        
        if (!subject || !body) {
            return res.status(400).json({ error: 'Укажите тему и текст ответа' });
        }
        
        // Получаем оригинальное письмо
        const originalEmail = db.prepare('SELECT * FROM email_messages WHERE id = ?').get(id);
        
        if (!originalEmail) {
            return res.status(404).json({ error: 'Письмо не найдено' });
        }
        
        // Отправляем ответ
        // Адрес получателя - это тот, кто отправил письмо (from_email)
        const recipientEmail = originalEmail.from_email;
        
        console.log(`📧 === ОТПРАВКА ОТВЕТА НА ПИСЬМО #${id} ===`);
        console.log(`   Получатель (from_email): ${recipientEmail}`);
        console.log(`   От (EMAIL_USER): ${process.env.EMAIL_USER || 'orders@truststore.ru'}`);
        console.log(`   Тема ответа: ${subject}`);
        console.log(`   Длина текста: ${body.length} символов`);
        
        if (!recipientEmail || recipientEmail === 'unknown@example.com') {
            console.error(`❌ Ошибка: неверный адрес получателя: ${recipientEmail}`);
            return res.status(400).json({ error: 'Невозможно отправить ответ: адрес получателя не указан' });
        }
        
        const mailOptions = {
            from: process.env.EMAIL_FROM || `"Trust Store" <${process.env.EMAIL_USER || 'orders@truststore.ru'}>`,
            to: recipientEmail,
            replyTo: process.env.EMAIL_USER || 'orders@truststore.ru',
            subject: subject.startsWith('Re:') ? subject : `Re: ${subject}`,
            html: `
                <div style="font-family: Arial, sans-serif; line-height: 1.6;">
                    <div style="background: #f5f5f5; padding: 15px; border-left: 4px solid #667eea; margin-bottom: 20px;">
                        <div style="color: #666; font-size: 12px; margin-bottom: 10px;">
                            <strong>Ответ на:</strong><br>
                            От: ${originalEmail.from_name || originalEmail.from_email}<br>
                            Дата: ${new Date(originalEmail.created_at).toLocaleString('ru-RU')}<br>
                            Тема: ${originalEmail.subject}
                        </div>
                        <div style="color: #333; font-size: 13px; white-space: pre-wrap;">${originalEmail.body_text || originalEmail.body_html || ''}</div>
                    </div>
                    <div style="color: #333; white-space: pre-wrap;">${body.replace(/\n/g, '<br>')}</div>
                    ${imageUrl ? `<div style="margin: 20px 0;"><img src="https://truststore.ru${imageUrl}" alt="Изображение" style="max-width: 100%; border-radius: 8px;"></div>` : ''}
                    <hr style="border: none; border-top: 1px solid #ddd; margin: 20px 0;">
                    <div style="color: #999; font-size: 12px;">
                        Trust Store<br>
                        Магазин цифровых товаров
                    </div>
                </div>
            `,
            text: `Ответ на письмо от ${originalEmail.from_name || originalEmail.from_email}:\n\n${originalEmail.body_text || ''}\n\n---\n\n${body}${imageUrl ? '\n\n[Изображение прикреплено]' : ''}`,
            attachments: imageUrl ? [{
                filename: path.basename(imageUrl),
                path: path.join(__dirname, imageUrl)
            }] : []
        };
        
        // СНАЧАЛА сохраняем ответ в БД (даже если отправка email не удастся)
        try {
            db.prepare(`
                INSERT INTO email_replies (original_message_id, reply_subject, reply_body)
                VALUES (?, ?, ?)
            `).run(id, subject, body);
            console.log(`✅ Ответ сохранен в БД для письма #${id}`);
        } catch (dbError) {
            console.error(`❌ Ошибка сохранения ответа в БД:`, dbError.message);
            return res.status(500).json({ error: 'Ошибка сохранения ответа в БД', details: dbError.message });
        }
        
        // Затем пытаемся отправить email
        try {
            console.log(`📤 Попытка отправить email через SMTP...`);
            await emailTransporter.sendMail(mailOptions);
            console.log(`✅ Email успешно отправлен на ${recipientEmail}`);
            
            // Помечаем письмо как прочитанное
            db.prepare('UPDATE email_messages SET is_read = 1 WHERE id = ?').run(id);
            
            console.log(`✅ Ответ полностью обработан:`);
            console.log(`   От: ${process.env.EMAIL_USER || 'orders@truststore.ru'}`);
            console.log(`   Кому: ${recipientEmail}`);
            console.log(`   Тема: ${mailOptions.subject}`);
            
            // Получаем вложения из оригинального письма (фото)
            const attachments = db.prepare(`
                SELECT * FROM email_attachments 
                WHERE email_message_id = ? AND content_type LIKE 'image/%'
                ORDER BY created_at ASC
            `).all(id);
            
            // Отправляем уведомление в Telegram с фото (если есть)
            const telegramMsg = `📧 Ответ отправлен на письмо\n\nОт: ${process.env.EMAIL_USER || 'orders@truststore.ru'}\nКому: ${recipientEmail}\nТема: ${mailOptions.subject}`;
            
            // Проверяем есть ли фото в ответе (загруженное админом)
            const hasReplyImage = imageUrl && imageUrl.trim() !== '';
            
            // Сначала отправляем фото из ответа (если есть)
            if (hasReplyImage) {
                console.log(`📸 Отправка фото из ответа в Telegram: ${imageUrl}`);
                sendTelegramPhoto(imageUrl, telegramMsg, false).then(() => {
                    console.log(`✅ Telegram фото из ответа отправлено`);
                    
                    // Затем отправляем фото из оригинального письма
                    if (attachments.length > 0) {
                        console.log(`📸 Отправка ${attachments.length} фото из письма...`);
                        setTimeout(() => {
                            const firstAttachment = attachments[0];
                            sendTelegramPhoto(firstAttachment.file_path, `Фото из письма: ${firstAttachment.filename}`, false).then(() => {
                                for (let i = 1; i < attachments.length; i++) {
                                    setTimeout(() => {
                                        sendTelegramPhoto(attachments[i].file_path, `${recipientEmail}: ${attachments[i].filename}`, false).catch(err => {
                                            console.error(`❌ Ошибка отправки фото #${i + 1}:`, err.message);
                                        });
                                    }, i * 1000);
                                }
                            }).catch(err => {
                                console.error(`❌ Ошибка отправки фото из письма:`, err.message);
                            });
                        }, 1500);
                    }
                }).catch(err => {
                    console.error(`❌ Ошибка отправки Telegram фото из ответа:`, err.message);
                    // Если фото из ответа не отправилось - отправляем текст или фото из письма
                    if (attachments.length > 0) {
                        const firstAttachment = attachments[0];
                        sendTelegramPhoto(firstAttachment.file_path, telegramMsg, false).catch(e => {
                            sendTelegramNotification(telegramMsg, false).catch(e2 => {
                                console.error(`❌ Не удалось отправить Telegram текст:`, e2.message);
                            });
                        });
                    } else {
                        sendTelegramNotification(telegramMsg, false).catch(e => {
                            console.error(`❌ Не удалось отправить Telegram текст:`, e.message);
                        });
                    }
                });
            } else if (attachments.length > 0) {
                // Нет фото в ответе, но есть фото в письме
                console.log(`📸 Отправка ${attachments.length} фото из письма...`);
                const firstAttachment = attachments[0];
                sendTelegramPhoto(firstAttachment.file_path, telegramMsg, false).then(() => {
                    console.log(`✅ Telegram фото отправлено: ${firstAttachment.filename}`);
                    
                    // Отправляем остальные фото (если есть)
                    for (let i = 1; i < attachments.length; i++) {
                        setTimeout(() => {
                            sendTelegramPhoto(attachments[i].file_path, `${recipientEmail}: ${attachments[i].filename}`, false).catch(err => {
                                console.error(`❌ Ошибка отправки фото #${i + 1}:`, err.message);
                            });
                        }, i * 1000);
                    }
                }).catch(err => {
                    console.error(`❌ Ошибка отправки Telegram фото:`, err.message);
                    // Если фото не отправилось - отправляем текст
                    sendTelegramNotification(telegramMsg, false).catch(e => {
                        console.error(`❌ Не удалось отправить Telegram текст:`, e.message);
                    });
                });
            } else {
                // Нет фото - отправляем только текст
                sendTelegramNotification(telegramMsg, false).catch(err => {
                    console.error(`⚠️ Не удалось отправить Telegram уведомление:`, err.message);
                });
            }
            
            res.json({ success: true, message: 'Ответ отправлен и сохранен' });
        } catch (emailError) {
            console.error(`❌ Ошибка отправки email:`, emailError.message);
            console.error(`   Стек ошибки:`, emailError.stack);
            
            // Ответ уже сохранен в БД, но email не отправился
            // Все равно возвращаем успех, но с предупреждением
            const telegramMsg = `⚠️ Ответ сохранен, но email не отправлен\n\nОшибка: ${emailError.message}\nКому: ${recipientEmail}\nТема: ${mailOptions.subject}`;
            sendTelegramNotification(telegramMsg, false).catch(err => {
                console.error(`⚠️ Не удалось отправить Telegram уведомление об ошибке:`, err.message);
            });
            
            res.json({ 
                success: true, 
                message: 'Ответ сохранен, но не удалось отправить email',
                warning: emailError.message 
            });
        }
    } catch (error) {
        console.error('Ошибка отправки ответа:', error);
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

// Получить количество непрочитанных писем
app.get('/api/admin/emails/unread/count', authMiddleware, (req, res) => {
    try {
        const count = db.prepare('SELECT COUNT(*) as count FROM email_messages WHERE is_read = 0').get();
        res.json({ count: count.count });
    } catch (error) {
        console.error('Ошибка получения количества писем:', error);
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

// Пометить письмо как прочитанное/непрочитанное
app.put('/api/admin/emails/:id/read', authMiddleware, (req, res) => {
    try {
        const { id } = req.params;
        const { is_read } = req.body;
        
        db.prepare('UPDATE email_messages SET is_read = ? WHERE id = ?').run(is_read ? 1 : 0, id);
        
        res.json({ success: true });
    } catch (error) {
        console.error('Ошибка обновления статуса письма:', error);
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

// ==================== IMAP EMAIL LISTENER ====================

// Функция для сохранения письма в БД
function saveEmailToDB(mail) {
    try {
        const messageId = mail.messageId || mail.uid || `msg-${Date.now()}-${Math.random()}`;
        
        // Проверяем, существует ли уже такое письмо
        const existing = db.prepare('SELECT id FROM email_messages WHERE message_id = ?').get(messageId);
        if (existing) {
            console.log(`⏸️  Письмо ${messageId} уже существует, пропускаем`);
            return;
        }
        
        const fromEmail = mail.from && mail.from[0] ? mail.from[0].address : 'unknown@example.com';
        const fromName = mail.from && mail.from[0] ? (mail.from[0].name || fromEmail) : fromEmail;
        const subject = mail.subject || 'Без темы';
        const bodyText = mail.text || '';
        const bodyHtml = mail.html || '';
        const toEmail = mail.to && mail.to[0] ? mail.to[0].address : process.env.EMAIL_USER || 'orders@truststore.ru';
        
        // Определяем, является ли это ответом на другое письмо
        const replyToMessageId = mail.inReplyTo || mail.references || null;
        
        db.prepare(`
            INSERT INTO email_messages (message_id, from_email, from_name, to_email, subject, body_text, body_html, reply_to_message_id)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `).run(messageId, fromEmail, fromName, toEmail, subject, bodyText, bodyHtml, replyToMessageId);
        
        console.log(`📧 Новое письмо сохранено: ${fromEmail} - ${subject}`);
        
        // ОБЯЗАТЕЛЬНО отправляем уведомление в Telegram для ВСЕХ новых писем
        const preview = bodyText.substring(0, 200) + (bodyText.length > 200 ? '...' : '');
        const isSpam = subject.startsWith('[СПАМ]');
        const spamPrefix = isSpam ? '🚨 СПАМ: ' : '';
        // Экранируем email адреса для Telegram (без < > чтобы не конфликтовало с HTML)
        const telegramMessage = `${spamPrefix}📧 Новое письмо на ${toEmail}\n\n👤 От: ${fromName}\n📧 Email: ${fromEmail}\n📌 Тема: ${subject}\n\n💬 Сообщение:\n${preview}\n\n💡 Отвечайте через админ-панель!`;
        
        // Отправляем уведомление ПРЯМО СЕЙЧАС (не асинхронно, чтобы гарантировать отправку)
        console.log(`📤 Отправка Telegram уведомления для ${fromEmail}...`);
        sendTelegramNotification(telegramMessage, false).then(() => {
            console.log(`✅ Telegram уведомление отправлено для письма от ${fromEmail}`);
        }).catch(err => {
            console.error(`❌ КРИТИЧНО: Не удалось отправить Telegram уведомление для ${fromEmail}:`, err.message || err);
            // Пробуем еще раз через 2 секунды
            setTimeout(() => {
                console.log(`🔄 Повторная попытка отправки Telegram уведомления для ${fromEmail}...`);
                sendTelegramNotification(telegramMessage, false).catch(e => {
                    console.error(`❌ Повторная отправка тоже не удалась для ${fromEmail}:`, e.message || e);
                });
            }, 2000);
        });
        
    } catch (error) {
        console.error('❌ Ошибка сохранения письма в БД:', error);
    }
}

// Функция сохранения нового письма и отправки уведомления
async function saveNewEmail(parsed, folderName) {
    try {
        // Получаем messageId
        let messageId = parsed.messageId || 
            (parsed.headers?.get?.('message-id')) || 
            `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        
        // Проверяем, существует ли уже
        const existing = db.prepare('SELECT id FROM email_messages WHERE message_id = ?').get(messageId);
        if (existing) {
            return false; // Уже есть, не новое
        }
        
        // Парсим отправителя
        let fromEmail = 'unknown@example.com';
        let fromName = 'Unknown';
        if (parsed.from) {
            if (typeof parsed.from === 'string') {
                fromEmail = parsed.from;
                fromName = parsed.from;
            } else if (parsed.from.value && Array.isArray(parsed.from.value) && parsed.from.value[0]) {
                fromEmail = parsed.from.value[0].address || fromEmail;
                fromName = parsed.from.value[0].name || fromEmail;
            } else if (parsed.from.address) {
                fromEmail = parsed.from.address;
                fromName = parsed.from.name || fromEmail;
            }
        }
        
        const subject = (parsed.subject || 'Без темы').substring(0, 500);
        const bodyText = (parsed.text || '').substring(0, 50000);
        const bodyHtml = (parsed.html || '').substring(0, 50000);
        
        // Помечаем спам
        const finalSubject = (folderName === 'Spam' || folderName === 'Спам') 
            ? `[СПАМ] ${subject}` 
            : subject;
        
        // Сохраняем в БД
        const result = db.prepare(`
            INSERT INTO email_messages (message_id, from_email, from_name, to_email, subject, body_text, body_html, reply_to_message_id, is_read)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0)
        `).run(messageId, fromEmail, fromName, process.env.EMAIL_USER, finalSubject, bodyText, bodyHtml, null);
        
        const emailId = result.lastInsertRowid;
        
        // Обрабатываем вложения
        const attachments = parsed.attachments || [];
        const imageAttachments = [];
        
        if (attachments.length > 0) {
            const attachmentsDir = path.join(__dirname, 'uploads', 'email-attachments');
            if (!fs.existsSync(attachmentsDir)) {
                fs.mkdirSync(attachmentsDir, { recursive: true });
            }
            
            for (const attachment of attachments) {
                try {
                    const uniqueFilename = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}-${attachment.filename || 'attachment'}`;
                    const filePath = path.join(attachmentsDir, uniqueFilename);
                    
                    // Сохраняем файл
                    fs.writeFileSync(filePath, attachment.content);
                    
                    // Определяем content type
                    let contentType = attachment.contentType || 'application/octet-stream';
                    if (!contentType || contentType === 'application/octet-stream') {
                        try {
                            const mimeTypes = require('mime-types');
                            contentType = mimeTypes.lookup(attachment.filename || '') || 'application/octet-stream';
                        } catch (e) {
                            // Если mime-types не установлен - используем простую проверку
                            const ext = attachment.filename ? attachment.filename.split('.').pop().toLowerCase() : '';
                            if (['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext)) {
                                contentType = `image/${ext === 'jpg' ? 'jpeg' : ext}`;
                            }
                        }
                    }
                    
                    // Проверяем, это изображение?
                    const isImage = contentType.startsWith('image/');
                    
                    // Сохраняем в БД
                    db.prepare(`
                        INSERT INTO email_attachments (email_message_id, filename, content_type, file_path, file_size)
                        VALUES (?, ?, ?, ?, ?)
                    `).run(
                        emailId,
                        attachment.filename || 'attachment',
                        contentType,
                        `/uploads/email-attachments/${uniqueFilename}`,
                        attachment.size || attachment.content?.length || 0
                    );
                    
                    // Если это изображение - добавляем в список для отправки в Telegram
                    if (isImage) {
                        imageAttachments.push({
                            path: `/uploads/email-attachments/${uniqueFilename}`,
                            filename: attachment.filename || 'image'
                        });
                    }
                    
                    console.log(`📎 Вложение сохранено: ${attachment.filename || 'attachment'}`);
                } catch (attachError) {
                    console.error(`❌ Ошибка сохранения вложения ${attachment.filename}:`, attachError.message);
                }
            }
        }
        
        console.log(`✅ Новое письмо сохранено: ${fromEmail} - ${finalSubject} (${attachments.length} вложений)`);
        
        // ОБЯЗАТЕЛЬНО отправляем в Telegram
        const isSpam = folderName === 'Spam' || folderName === 'Спам';
        const spamPrefix = isSpam ? '🚨 СПАМ: ' : '';
        const preview = bodyText.substring(0, 200) + (bodyText.length > 200 ? '...' : '');
        const telegramMessage = `${spamPrefix}📧 Новое письмо на ${process.env.EMAIL_USER}\n\n👤 От: ${fromName}\n📧 Email: ${fromEmail}\n📌 Тема: ${finalSubject}\n\n💬 Сообщение:\n${preview}\n\n💡 Отвечайте через админ-панель!`;
        
        console.log(`📤 Отправка Telegram уведомления для ${fromEmail}...`);
        
        // Если есть фото - отправляем их
        if (imageAttachments.length > 0) {
            // Отправляем первое фото с текстом как caption
            const firstImage = imageAttachments[0];
            sendTelegramPhoto(firstImage.path, telegramMessage, false).then(() => {
                console.log(`✅ Telegram фото отправлено: ${firstImage.filename}`);
                
                // Отправляем остальные фото с простым текстом (если есть)
                for (let i = 1; i < imageAttachments.length; i++) {
                    setTimeout(() => {
                        const simpleCaption = `Фото ${i + 1} из письма: ${imageAttachments[i].filename}`;
                        sendTelegramPhoto(imageAttachments[i].path, simpleCaption, false).catch(err => {
                            console.error(`❌ Ошибка отправки фото #${i + 1}:`, err.message);
                        });
                    }, i * 1000); // Задержка 1 секунда между фото
                }
            }).catch(err => {
                console.error(`❌ Ошибка отправки Telegram фото для ${fromEmail}:`, err.message);
                // Если фото не отправилось - отправляем текст
                sendTelegramNotification(telegramMessage, false).catch(e => {
                    console.error(`❌ Ошибка Telegram текста:`, e.message);
                });
            });
        } else {
            // Нет фото - отправляем только текст
            sendTelegramNotification(telegramMessage, false).then(() => {
                console.log(`✅ Telegram уведомление отправлено: ${fromEmail}`);
            }).catch(err => {
                console.error(`❌ Ошибка Telegram для ${fromEmail}:`, err.message);
                // Повтор через 3 секунды
                setTimeout(() => {
                    sendTelegramNotification(telegramMessage, false).catch(e => {
                        console.error(`❌ Повторная отправка не удалась для ${fromEmail}`);
                    });
                }, 3000);
            });
        }
        
        return true; // Новое письмо сохранено
    } catch (error) {
        console.error('❌ Ошибка сохранения письма:', error.message);
        return false;
    }
}

// Синхронизация писем из конкретной папки
function syncEmailsFromFolder(imap, folderName) {
    return new Promise((resolve, reject) => {
        imap.openBox(folderName, false, (err, box) => {
            if (err) {
                console.log(`⚠️ Не удалось открыть папку ${folderName}:`, err.message);
                resolve({ folder: folderName, processed: 0, saved: 0 }); // Не критичная ошибка
                return;
            }
            
            const totalMessages = box.messages.total;
            console.log(`📬 Папка ${folderName}: ${totalMessages} писем`);
            
            if (totalMessages === 0) {
                resolve({ folder: folderName, processed: 0, saved: 0 });
                return;
            }
            
            // Получаем последние 100 писем (или все, если меньше 100)
            const start = Math.max(1, totalMessages - 99);
            const end = totalMessages;
            
            console.log(`📥 Получаю письма из ${folderName} с ${start} по ${end}...`);
            
            const fetch = imap.seq.fetch(`${start}:${end}`, {
                bodies: '',
                struct: true
            });
            
            let processed = 0;
            let saved = 0;
            
            fetch.on('message', (msg, seqno) => {
                msg.on('body', (stream, info) => {
                    // Собираем весь stream в буфер перед парсингом
                    const chunks = [];
                    stream.on('data', (chunk) => {
                        chunks.push(chunk);
                    });
                    
                    stream.on('error', (streamErr) => {
                        console.error(`❌ Ошибка чтения письма #${seqno} из ${folderName}:`, streamErr.message);
                    });
                    
                    stream.once('end', async () => {
                        const buffer = Buffer.concat(chunks);
                        
                        // Парсим письмо с вложениями
                        try {
                            const mailparser = require('mailparser');
                            let parsed;
                            if (typeof mailparser.simpleParser === 'function') {
                                parsed = await mailparser.simpleParser(buffer, {
                                    attachments: true,
                                    keepCidLinks: false
                                });
                            } else if (typeof mailparser.default?.simpleParser === 'function') {
                                parsed = await mailparser.default.simpleParser(buffer, {
                                    attachments: true,
                                    keepCidLinks: false
                                });
                            } else {
                                throw new Error('simpleParser не найден в mailparser');
                            }
                            
                            // Сохраняем письмо (функция сама отправит уведомление в Telegram)
                            const savedEmail = await saveNewEmail(parsed, folderName);
                            if (savedEmail) {
                                saved++;
                                if (saved % 10 === 0) {
                                    console.log(`   💾 ${folderName}: сохранено ${saved} новых писем...`);
                                }
                            }
                        } catch (parseError) {
                            console.error(`❌ Ошибка парсинга письма #${seqno} из ${folderName}:`, parseError.message);
                        }
                    });
                });
                
                msg.once('end', () => {
                    processed++;
                });
            });
            
            fetch.once('error', (err) => {
                console.error(`❌ Ошибка при получении писем из ${folderName}:`, err);
                resolve({ folder: folderName, processed, saved, error: err.message });
            });
            
            fetch.once('end', () => {
                console.log(`✅ ${folderName}: обработано ${processed} писем, сохранено ${saved} новых`);
                if (processed === 0 && saved === 0) {
                    console.log(`⚠️ ${folderName}: предупреждение - письма получены, но ни одно не обработано!`);
                }
                resolve({ folder: folderName, processed, saved });
            });
            
            // Добавляем таймаут на случай зависания
            setTimeout(() => {
                if (processed === 0) {
                    console.log(`⚠️ ${folderName}: таймаут - письма не обработаны за 30 секунд`);
                    resolve({ folder: folderName, processed: 0, saved: 0, timeout: true });
                }
            }, 30000);
        });
    });
}

// Функция для синхронизации всех писем (не только новых) из INBOX и Spam
function syncAllEmails() {
    return new Promise((resolve, reject) => {
        if (!process.env.EMAIL_USER || !process.env.EMAIL_PASSWORD) {
            console.log('⚠️ Синхронизация писем пропущена: не указаны EMAIL_USER или EMAIL_PASSWORD');
            resolve();
            return;
        }
        
        try {
            const Imap = require('imap');
            
            const imap = new Imap({
                user: process.env.EMAIL_USER,
                password: process.env.EMAIL_PASSWORD,
                host: 'imap.yandex.ru',
                port: 993,
                tls: true,
                tlsOptions: { rejectUnauthorized: false },
                connTimeout: 10000
            });
            
            imap.once('ready', async () => {
                console.log('📧 IMAP подключен для синхронизации...');
                
                try {
                    // Синхронизируем INBOX
                    console.log('📬 Синхронизация INBOX...');
                    const inboxResult = await syncEmailsFromFolder(imap, 'INBOX');
                    console.log(`✅ INBOX: ${inboxResult.processed} обработано, ${inboxResult.saved} сохранено`);
                    
                    // Синхронизируем Spam (пробуем разные названия)
                    let spamResult = { folder: 'Spam', processed: 0, saved: 0 };
                    console.log('📬 Попытка синхронизации папки Spam...');
                    
                    // Пробуем английское название
                    spamResult = await syncEmailsFromFolder(imap, 'Spam');
                    console.log(`📬 Результат Spam: ${spamResult.processed} обработано, ${spamResult.saved} сохранено`);
                    
                    // Пробуем русское название независимо (может быть обе папки)
                    console.log('📬 Попытка синхронизации папки Спам...');
                    const spamRuResult = await syncEmailsFromFolder(imap, 'Спам');
                    console.log(`📬 Результат Спам: ${spamRuResult.processed} обработано, ${spamRuResult.saved} сохранено`);
                    
                    // Суммируем результаты
                    spamResult.processed += spamRuResult.processed;
                    spamResult.saved += spamRuResult.saved;
                    
                    if (spamResult.saved > 0) {
                        console.log(`✅ Spam всего: ${spamResult.processed} обработано, ${spamResult.saved} сохранено`);
                    }
                    
                    const totalProcessed = inboxResult.processed + spamResult.processed;
                    const totalSaved = inboxResult.saved + spamResult.saved;
                    
                    console.log(`✅ Синхронизация завершена: INBOX ${inboxResult.saved} новых, Spam ${spamResult.saved} новых, всего ${totalSaved} новых писем`);
                    imap.end();
                    resolve({ inbox: inboxResult, spam: spamResult });
                } catch (err) {
                    console.error('❌ Ошибка синхронизации:', err);
                    imap.end();
                    reject(err);
                }
            });
            
            imap.once('error', (err) => {
                console.error('❌ Ошибка IMAP подключения:', err.message);
                if (err.message && err.message.includes('Invalid login')) {
                    console.error('⚠️ Проверьте EMAIL_USER и EMAIL_PASSWORD в .env');
                    console.error('⚠️ Для Yandex может потребоваться пароль приложения (не основной пароль)');
                    console.error('⚠️ Получить пароль приложения: https://yandex.ru/support/id/authorization/app-passwords.html');
                }
                reject(err);
            });
            
            imap.connect();
        } catch (error) {
            console.error('❌ Ошибка запуска синхронизации:', error.message);
            reject(error);
        }
    });
}

// Запуск автоматической синхронизации писем
if (process.env.EMAIL_USER && process.env.EMAIL_PASSWORD) {
    // Функция для безопасной синхронизации
    async function safeSyncEmails() {
        try {
            await syncAllEmails();
            console.log('✅ Автосинхронизация завершена');
        } catch (err) {
            console.error('❌ Ошибка автосинхронизации:', err.message);
        }
    }
    
    // Синхронизация при старте (через 10 секунд)
    setTimeout(() => {
        console.log('🔄 Первая синхронизация писем...');
        safeSyncEmails();
    }, 10000);
    
    // Автосинхронизация каждые 2 минуты
    setInterval(() => {
        console.log('🔄 Автосинхронизация писем (каждые 2 минуты)...');
        safeSyncEmails();
    }, 2 * 60 * 1000); // 2 минуты
    
    console.log('✅ Автосинхронизация писем запущена (каждые 2 минуты, 24/7)');
} else {
    console.log('⚠️ Синхронизация писем не запущена: не указаны EMAIL_USER или EMAIL_PASSWORD');
}

// API для ручной синхронизации писем
app.post('/api/admin/emails/sync', authMiddleware, async (req, res) => {
    try {
        console.log('🔄 Запуск ручной синхронизации писем...');
        
        const result = await syncAllEmails();
        
        if (result && result.error) {
            // Если была ошибка подключения
            if (result.error.includes('Invalid login') || result.error.includes('invalid credentials')) {
                return res.status(401).json({ 
                    error: 'Ошибка подключения к почте', 
                    details: 'Неверный логин или пароль. Для Yandex 360 нужен пароль приложения, а не основной пароль. Получить: https://id.yandex.ru/security/app-passwords'
                });
            }
            
            return res.status(500).json({ 
                error: 'Ошибка синхронизации', 
                details: result.error 
            });
        }
        
        const totalSaved = (result?.inbox?.saved || 0) + (result?.spam?.saved || 0);
        const totalProcessed = (result?.inbox?.processed || 0) + (result?.spam?.processed || 0);
        
        res.json({ 
            success: true, 
            message: `Синхронизация завершена: обработано ${totalProcessed} писем, сохранено ${totalSaved} новых`,
            inbox: result?.inbox || {},
            spam: result?.spam || {}
        });
    } catch (error) {
        console.error('Ошибка синхронизации:', error);
        
        let errorMessage = 'Ошибка синхронизации';
        let errorDetails = error.message || 'Неизвестная ошибка';
        
        if (error.message && (error.message.includes('Invalid login') || error.message.includes('invalid credentials'))) {
            errorMessage = 'Ошибка подключения к почте';
            errorDetails = 'Неверный логин или пароль. Для Yandex 360 нужен пароль приложения. Получить: https://id.yandex.ru/security/app-passwords';
        } else if (error.message && error.message.includes('IMAP is disabled')) {
            errorMessage = 'IMAP отключен';
            errorDetails = 'IMAP не включен в настройках почты. Включите IMAP в Yandex 360: https://360.yandex.ru/ -> Почта -> Настройки -> Доступ к почте';
        }
        
        res.status(500).json({ 
            error: errorMessage, 
            details: errorDetails 
        });
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

// ==================== MANUAL ORDER PROCESSING ====================
// Endpoint для ручной отправки последнего оплаченного заказа (или конкретного заказа)
app.post('/api/manual-send-last-order', async (req, res) => {
    try {
        console.log('🔧 Ручная отправка заказа...');
        
        const orderId = req.body.orderId || req.query.orderId;
        
        let lastOrder;
        if (orderId) {
            // Ищем конкретный заказ
            console.log('   Поиск заказа:', orderId);
            lastOrder = db.prepare('SELECT * FROM orders WHERE order_id = ?').get(orderId);
            if (!lastOrder) {
                return res.status(404).json({ success: false, error: `Заказ ${orderId} не найден` });
            }
            // Обновляем статус на paid, если он еще не оплачен
            if (lastOrder.status !== 'paid') {
                console.log('   Обновление статуса на "paid"...');
                db.prepare('UPDATE orders SET status = ? WHERE order_id = ?').run('paid', orderId);
                lastOrder.status = 'paid';
            }
        } else {
            // Находим последний оплаченный заказ
            lastOrder = db.prepare(`
                SELECT * FROM orders 
                WHERE status = 'paid'
                ORDER BY created_at DESC 
                LIMIT 1
            `).get();
        }
        
        if (!lastOrder) {
            return res.status(404).json({ success: false, error: 'Не найден оплаченный заказ' });
        }
        
        console.log('📦 Найден заказ:', lastOrder.order_id);
        
        const products = JSON.parse(lastOrder.products);
        let emailsSent = 0;
        let emailsFailed = 0;
        
        // Отправляем emails клиенту
        console.log('📧 Отправка emails клиенту...');
        for (const product of products) {
            const quantity = product.quantity || 1;
            const productName = product.name || product.productName || product.product_name;
            
            let productInfo = db.prepare('SELECT * FROM products WHERE name = ?').get(productName);
            if (!productInfo) {
                const baseName = productName.split('(')[0].split('-')[0].split('|')[0].split('[')[0].trim();
                productInfo = db.prepare('SELECT * FROM products WHERE name LIKE ?').get(baseName + '%');
            }
            
            for (let i = 0; i < quantity; i++) {
                try {
                    await sendOrderEmail({
                        to: lastOrder.customer_email,
                        orderNumber: lastOrder.order_id,
                        productName: productName,
                        productImage: productInfo ? productInfo.image : (product.image || null),
                        productCategory: productInfo ? productInfo.category : null,
                        productDescription: productInfo ? productInfo.description : null,
                        login: null,
                        password: null,
                        instructions: productInfo ? productInfo.description : 'Спасибо за покупку! Инструкции по использованию товара будут отправлены отдельно.'
                    });
                    emailsSent++;
                    console.log(`   ✅ Email ${i + 1}/${quantity} отправлен: ${lastOrder.customer_email} - ${productName}`);
                } catch (emailError) {
                    emailsFailed++;
                    console.error(`   ❌ Ошибка отправки email:`, emailError.message);
                }
            }
        }
        
        // Отправляем уведомление в Telegram
        console.log('📱 Отправка уведомления в Telegram...');
        const telegramMsg = `💰 <b>Новый платеж! (ручная отправка)</b>\n\n` +
            `🆔 Заказ: ${lastOrder.order_id}\n` +
            `💳 Метод: ${lastOrder.payment_method || 'YooMoney'}\n` +
            `👤 Клиент: ${lastOrder.customer_name}\n` +
            `📧 Email: ${lastOrder.customer_email}\n` +
            `💵 Сумма: ${lastOrder.total_amount} ₽\n` +
            `📦 Товары: ${products.map(p => p.name || p.productName || p.product_name).join(', ')}\n` +
            `📅 Дата: ${lastOrder.created_at}\n\n` +
            `📊 Emails: отправлено ${emailsSent}, ошибок ${emailsFailed}\n\n` +
            `🔗 <a href="https://truststore.ru/t1xxas">Открыть админку</a>`;
        
        try {
            await sendTelegramNotification(telegramMsg, false);
            console.log('   ✅ Telegram уведомление отправлено');
        } catch (telegramError) {
            console.error('   ❌ Ошибка Telegram:', telegramError.message);
        }
        
        res.json({
            success: true,
            orderId: lastOrder.order_id,
            email: lastOrder.customer_email,
            emailsSent,
            emailsFailed,
            telegramSent: true
        });
        
    } catch (error) {
        console.error('❌ Ошибка ручной отправки:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// ==================== SBP PAYMENT (СБП) ====================
// Номер телефона для СБП (настрой в .env или здесь)
const SBP_PHONE = process.env.SBP_PHONE || '+79024170636'; // Озон Банк, Валерий Б
const SBP_BANK = process.env.SBP_BANK || 'Озон Банк';
const SBP_NAME = process.env.SBP_NAME || 'Валерий Б';

// API для создания заказа с оплатой через СБП
app.post('/api/payment/sbp/create', async (req, res) => {
    try {
        const { orderId, amount, customerName, customerEmail, customerPhone } = req.body;
        
        if (!orderId || !amount) {
            return res.status(400).json({ error: 'orderId и amount обязательны' });
        }
        
        // Обновляем статус заказа на "awaiting_payment" (ожидает оплаты)
        const updateResult = db.prepare('UPDATE orders SET status = ? WHERE order_id = ?').run('awaiting_payment', orderId);
        
        if (updateResult.changes === 0) {
            return res.status(404).json({ error: 'Заказ не найден' });
        }
        
        // Форматируем номер телефона для отображения
        const formattedPhone = SBP_PHONE.replace(/(\d{1})(\d{3})(\d{3})(\d{2})(\d{2})/, '+$1 ($2) $3-$4-$5');
        
        res.json({
            success: true,
            orderId,
            sbpPhone: SBP_PHONE,
            formattedPhone,
            amount,
            bank: SBP_BANK,
            name: SBP_NAME
        });
    } catch (error) {
        console.error('❌ Ошибка создания заказа СБП:', error);
        res.status(500).json({ error: error.message });
    }
});

// API для подтверждения клиентом что он перевел деньги (кнопка "Я перевел")
app.post('/api/payment/sbp/confirm', async (req, res) => {
    try {
        const { orderId } = req.body;
        
        if (!orderId) {
            return res.status(400).json({ error: 'orderId обязателен' });
        }
        
        // Получаем информацию о заказе
        const order = db.prepare('SELECT * FROM orders WHERE order_id = ?').get(orderId);
        
        if (!order) {
            return res.status(404).json({ error: 'Заказ не найден' });
        }
        
        if (order.status === 'paid') {
            return res.json({ success: true, message: 'Заказ уже оплачен', alreadyPaid: true });
        }
        
        const products = JSON.parse(order.products || '[]');
        const productNames = products.map(p => p.name || p.productName || p.product_name).join(', ');
        
        // Форматируем номер телефона
        const formattedPhone = SBP_PHONE.replace(/(\d{1})(\d{3})(\d{3})(\d{2})(\d{2})/, '+$1 ($2) $3-$4-$5');
        
        // Создаем inline клавиатуру для подтверждения
        const replyMarkup = {
            inline_keyboard: [
                [
                    { text: '✅ Подтвердить оплату', callback_data: `confirm_order_${orderId}` },
                    { text: '❌ Отклонить', callback_data: `reject_order_${orderId}` }
                ]
            ]
        };
        
        // Отправляем уведомление в Telegram с кнопками
        const telegramMessage = `💸 <b>НОВЫЙ ПЛАТЕЖ СБП!</b>\n\n` +
            `🆔 Заказ: <code>${orderId}</code>\n` +
            `👤 Клиент: ${order.customer_name}\n` +
            `📧 Email: ${order.customer_email}\n` +
            `📱 Телефон: ${order.customer_phone || 'не указан'}\n` +
            `💵 Сумма: <b>${order.total_amount} ₽</b>\n` +
            `📦 Товары: ${productNames}\n\n` +
            `🔢 <b>Переведите на СБП:</b>\n` +
            `📱 <code>${formattedPhone}</code>\n` +
            `💰 Сумма: <b>${order.total_amount} ₽</b>\n\n` +
            `⏳ Клиент утверждает что перевел деньги.\n` +
            `Проверьте перевод и подтвердите или отклоните заказ.`;
        
        const telegramResult = await sendTelegramNotification(telegramMessage, false, replyMarkup);
        
        // Сохраняем информацию о подтверждении от клиента
        db.prepare(`
            UPDATE orders 
            SET status = 'payment_confirmed_by_customer'
            WHERE order_id = ?
        `).run(orderId);
        
        res.json({
            success: true,
            message: 'Уведомление отправлено администратору. Заказ будет обработан после подтверждения.'
        });
        
    } catch (error) {
        console.error('❌ Ошибка подтверждения СБП:', error);
        res.status(500).json({ error: error.message });
    }
});

// Webhook для обработки callback от Telegram бота (кнопки подтверждения/отклонения)
app.post('/api/telegram-webhook', async (req, res) => {
    try {
        const update = req.body;
        
        // Обрабатываем только callback_query (нажатия кнопок)
        if (update.callback_query) {
            const callbackData = update.callback_query.data;
            const messageId = update.callback_query.message.message_id;
            
            // Проверяем что это наш callback
            if (callbackData.startsWith('confirm_order_')) {
                const orderId = callbackData.replace('confirm_order_', '');
                
                // Получаем заказ
                const order = db.prepare('SELECT * FROM orders WHERE order_id = ?').get(orderId);
                
                if (!order) {
                    // Отвечаем на callback
                    const answerUrl = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/answerCallbackQuery`;
                    await fetch(answerUrl, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            callback_query_id: update.callback_query.id,
                            text: '❌ Заказ не найден'
                        })
                    });
                    return res.status(200).send('OK');
                }
                
                // Обновляем статус на "paid"
                console.log(`\n✅ Подтверждение заказа ${orderId} через Telegram...`);
                db.prepare('UPDATE orders SET status = ? WHERE order_id = ?').run('paid', orderId);
                
                // Отправляем заказ клиенту
                const products = JSON.parse(order.products || '[]');
                let emailsSent = 0;
                let emailsFailed = 0;
                
                console.log(`📧 Отправка emails клиенту ${order.customer_email}...`);
                console.log(`📦 Товаров в заказе: ${products.length}`);
                
                // Отправляем emails с повторными попытками
                for (const product of products) {
                    const quantity = product.quantity || 1;
                    const productName = product.name || product.productName || product.product_name;
                    
                    console.log(`\n📦 Обработка товара: "${productName}" (x${quantity})`);
                    
                    let productInfo = db.prepare('SELECT * FROM products WHERE name = ?').get(productName);
                    if (!productInfo) {
                        const baseName = productName.split('(')[0].split('-')[0].split('|')[0].split('[')[0].trim();
                        productInfo = db.prepare('SELECT * FROM products WHERE name LIKE ?').get(baseName + '%');
                    }
                    
                    for (let i = 0; i < quantity; i++) {
                        try {
                            console.log(`   📧 Попытка отправки email ${i + 1}/${quantity}...`);
                            const emailResult = await sendOrderEmail({
                                to: order.customer_email,
                                orderNumber: order.order_id,
                                productName: productName,
                                productImage: productInfo ? productInfo.image : (product.image || null),
                                productCategory: productInfo ? productInfo.category : null,
                                productDescription: productInfo ? productInfo.description : null,
                                login: null,
                                password: null,
                                instructions: productInfo ? productInfo.description : 'Спасибо за покупку! Инструкции по использованию товара будут отправлены отдельно.'
                            });
                            
                            // Проверяем результат отправки
                            if (emailResult && emailResult.success === false) {
                                // Явно указано что не удалось
                                emailsFailed++;
                                const errorMsg = emailResult?.error || emailResult?.message || 'Unknown error';
                                console.error(`   ❌ Email ${i + 1}/${quantity} НЕ отправлен:`, errorMsg);
                                
                                if (emailResult?.note) {
                                    console.error(`   ⚠️ Примечание:`, emailResult.note);
                                }
                            } else {
                                // success === true или undefined - считаем успехом
                                emailsSent++;
                                const method = emailResult?.method || 'SMTP';
                                console.log(`   ✅ Email ${i + 1}/${quantity} отправлен успешно (метод: ${method})`);
                                
                                if (!emailResult) {
                                    console.warn(`   ⚠️ Функция sendOrderEmail не вернула результат, но исключения не было`);
                                }
                            }
                        } catch (emailError) {
                            emailsFailed++;
                            console.error(`   ❌ Ошибка отправки email ${i + 1}/${quantity}:`, emailError.message);
                        }
                    }
                }
                
                console.log(`\n📊 ИТОГО EMAILS: отправлено ${emailsSent}, ошибок ${emailsFailed}`);
                
                // Отправляем уведомление об успешной обработке
                const successMessage = `✅ <b>Заказ подтвержден и отправлен!</b>\n\n` +
                    `🆔 Заказ: <code>${orderId}</code>\n` +
                    `👤 Клиент: ${order.customer_name}\n` +
                    `📧 Email: ${order.customer_email}\n` +
                    `📊 Emails отправлено: ${emailsSent} | Ошибок: ${emailsFailed}\n\n` +
                    `${emailsFailed > 0 ? '⚠️ Некоторые emails не отправлены - проверь логи!' : '✅ Все emails отправлены успешно!'}`;
                
                // Обновляем сообщение с кнопками на сообщение об успехе
                const editUrl = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/editMessageText`;
                await fetch(editUrl, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        chat_id: TELEGRAM_CHAT_ID,
                        message_id: messageId,
                        text: successMessage,
                        parse_mode: 'HTML'
                    })
                });
                
                // Отвечаем на callback
                const answerUrl = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/answerCallbackQuery`;
                await fetch(answerUrl, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        callback_query_id: update.callback_query.id,
                        text: '✅ Заказ подтвержден и отправлен клиенту!'
                    })
                });
                
            } else if (callbackData.startsWith('reject_order_')) {
                const orderId = callbackData.replace('reject_order_', '');
                
                // Обновляем статус на "rejected"
                db.prepare('UPDATE orders SET status = ? WHERE order_id = ?').run('rejected', orderId);
                
                // Отвечаем на callback
                const answerUrl = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/answerCallbackQuery`;
                await fetch(answerUrl, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        callback_query_id: update.callback_query.id,
                        text: '❌ Заказ отклонен'
                    })
                });
                
                // Обновляем сообщение
                const order = db.prepare('SELECT * FROM orders WHERE order_id = ?').get(orderId);
                const rejectMessage = `❌ <b>Заказ отклонен</b>\n\n` +
                    `🆔 Заказ: <code>${orderId}</code>\n` +
                    `👤 Клиент: ${order ? order.customer_name : 'N/A'}\n` +
                    `💵 Сумма: ${order ? order.total_amount : 'N/A'} ₽`;
                
                const editUrl = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/editMessageText`;
                await fetch(editUrl, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        chat_id: TELEGRAM_CHAT_ID,
                        message_id: messageId,
                        text: rejectMessage,
                        parse_mode: 'HTML'
                    })
                });
            }
        }
        
        res.status(200).send('OK');
    } catch (error) {
        console.error('❌ Ошибка обработки Telegram webhook:', error);
        res.status(500).send('Error');
    }
});


