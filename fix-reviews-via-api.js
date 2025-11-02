// Скрипт для добавления отзыва через API напрямую на сервере
// Используется через SSH выполнение на сервере

const Database = require('better-sqlite3');
const path = require('path');

const db = new Database('/root/TrustStore/analytics.db');

try {
    console.log('📝 Добавление отзыва от Aleksey T...');
    
    // Добавляем отзыв
    const result = db.prepare(`
        INSERT OR IGNORE INTO telegram_reviews 
        (telegram_user_id, author_name, review_text, rating, telegram_comment_id, telegram_date, created_at)
        VALUES (0, 'Aleksey T', ?, 5, 1273, 1730559360, CURRENT_TIMESTAMP)
    `).run('Все супер 👍 Купил со скидкой по промокоду, да еще и пробный период 30 дней итого 2 месяца подписки за 2К. Ребята отзывчивые, все объяснили, подсказали. Буду обращаться ещё. Лучше и искать нечего. Спасибо большое ребятам из Trust Store, удачи и процветания вам, при сегодняшних реалиях вы делаете больше дело.');
    
    console.log(`✅ Отзыв добавлен (изменено строк: ${result.changes})`);
    
    // Удаляем дубликаты
    const deleted = db.prepare(`
        DELETE FROM telegram_reviews 
        WHERE author_name = 'Андрей Benefiseller' 
        AND id NOT IN (
            SELECT id FROM telegram_reviews 
            WHERE author_name = 'Андрей Benefiseller' 
            ORDER BY telegram_date DESC, id DESC 
            LIMIT 1
        )
    `).run();
    
    console.log(`🗑️ Удалено дубликатов: ${deleted.changes}`);
    
    // Обновляем счетчик
    const reviewCount = db.prepare('SELECT COUNT(*) as count FROM telegram_reviews').get().count;
    
    try {
        db.exec('ALTER TABLE telegram_stats ADD COLUMN last_update_id INTEGER DEFAULT 0');
    } catch (err) {
        // Игнорируем если колонка уже есть
    }
    
    db.prepare(`
        INSERT INTO telegram_stats (id, total_comments, last_updated)
        VALUES (1, ?, CURRENT_TIMESTAMP)
        ON CONFLICT(id) DO UPDATE SET 
            total_comments = excluded.total_comments,
            last_updated = CURRENT_TIMESTAMP
    `).run(reviewCount);
    
    console.log(`📊 Счетчик обновлен: ${reviewCount} отзывов`);
    
    db.close();
    console.log('✅ Готово!');
    
} catch (error) {
    console.error('❌ Ошибка:', error.message);
    process.exit(1);
}

