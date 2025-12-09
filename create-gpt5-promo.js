const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

// Путь к базе данных (проверяем несколько возможных путей)
let dbPath = path.join(__dirname, 'analytics.db');

// Если база не найдена локально, пробуем путь на сервере
if (!fs.existsSync(dbPath)) {
    dbPath = '/root/TrustStore/analytics.db';
}

if (!fs.existsSync(dbPath)) {
    console.error('❌ База данных не найдена. Убедитесь, что сервер запущен хотя бы один раз для создания базы.');
    console.log('   Локальный путь:', path.join(__dirname, 'analytics.db'));
    console.log('   Серверный путь: /root/TrustStore/analytics.db');
    process.exit(1);
}

const db = new Database(dbPath);

try {
    // Проверяем, существует ли уже промокод GPT5
    const existingPromo = db.prepare('SELECT * FROM promo_codes WHERE code = ?').get('GPT5');
    
    if (existingPromo) {
        // Если промокод существует, обновляем его
        db.prepare(`
            UPDATE promo_codes 
            SET discount = 10, 
                max_uses = 999999999, 
                expires_at = '2099-12-31 23:59:59',
                is_active = 1
            WHERE code = 'GPT5'
        `).run();
        console.log('✅ Промокод GPT5 обновлен: скидка 10%, бессрочные активации');
    } else {
        // Создаем новый промокод
        db.prepare(`
            INSERT INTO promo_codes (code, discount, max_uses, current_uses, expires_at, is_active)
            VALUES (?, ?, ?, ?, ?, ?)
        `).run('GPT5', 10, 999999999, 0, '2099-12-31 23:59:59', 1);
        console.log('✅ Промокод GPT5 создан: скидка 10%, бессрочные активации');
    }
    
    // Проверяем результат
    const promo = db.prepare('SELECT * FROM promo_codes WHERE code = ?').get('GPT5');
    console.log('\n📋 Данные промокода:');
    console.log('   Код:', promo.code);
    console.log('   Скидка:', promo.discount + '%');
    console.log('   Макс. использований:', promo.max_uses === 999999999 ? 'Бессрочно' : promo.max_uses);
    console.log('   Текущие использования:', promo.current_uses);
    console.log('   Действует до:', promo.expires_at);
    console.log('   Активен:', promo.is_active ? 'Да' : 'Нет');
    
} catch (error) {
    console.error('❌ Ошибка создания промокода:', error.message);
    process.exit(1);
} finally {
    db.close();
}

