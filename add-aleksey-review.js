const Database = require('better-sqlite3');
const path = require('path');

// Используем базу на сервере (если запускаем там)
// Или локальную для теста
const dbPath = process.env.DB_PATH || path.join(__dirname, 'analytics.db');
const db = new Database(dbPath);

try {
    console.log('📝 Добавление отзыва от Aleksey T...');
    
    // Добавляем отзыв
    db.prepare(`
        INSERT OR IGNORE INTO telegram_reviews 
        (telegram_user_id, author_name, review_text, rating, telegram_comment_id, telegram_date, created_at)
        VALUES (0, 'Aleksey T', ?, 5, 1273, 1730559360, CURRENT_TIMESTAMP)
    `).run('Все супер 👍 Купил со скидкой по промокоду, да еще и пробный период 30 дней итого 2 месяца подписки за 2К. Ребята отзывчивые, все объяснили, подсказали. Буду обращаться ещё. Лучше и искать нечего. Спасибо большое ребятам из Trust Store, удачи и процветания вам, при сегодняшних реалиях вы делаете больше дело.');
    
    console.log('✅ Отзыв от Aleksey T добавлен');
    
    // Удаляем дубликаты от Андрей Benefiseller (оставляем только последний)
    const deleted = db.prepare(`
        DELETE FROM telegram_reviews 
        WHERE id IN (
            SELECT id FROM telegram_reviews 
            WHERE author_name = 'Андрей Benefiseller' 
            AND id NOT IN (
                SELECT id FROM telegram_reviews 
                WHERE author_name = 'Андрей Benefiseller' 
                ORDER BY telegram_date DESC, id DESC 
                LIMIT 1
            )
        )
    `).run();
    
    console.log(`🗑️ Удалено дубликатов: ${deleted.changes}`);
    
    // Обновляем счетчик на основе реального количества
    const reviewCount = db.prepare('SELECT COUNT(*) as count FROM telegram_reviews').get().count;
    
    // Добавляем колонку last_update_id если её нет
    try {
        db.exec('ALTER TABLE telegram_stats ADD COLUMN last_update_id INTEGER DEFAULT 0');
        console.log('✅ Колонка last_update_id добавлена');
    } catch (err) {
        if (!err.message.includes('duplicate column')) {
            console.log('ℹ️ Колонка last_update_id уже существует');
        }
    }
    
    db.prepare(`
        INSERT INTO telegram_stats (id, total_comments, last_updated)
        VALUES (1, ?, CURRENT_TIMESTAMP)
        ON CONFLICT(id) DO UPDATE SET 
            total_comments = excluded.total_comments,
            last_updated = CURRENT_TIMESTAMP
    `).run(reviewCount);
    
    console.log(`📊 Счетчик обновлен: ${reviewCount} отзывов`);
    
    // Показываем результат
    const reviews = db.prepare(`
        SELECT author_name, telegram_comment_id, telegram_date 
        FROM telegram_reviews 
        ORDER BY telegram_date DESC 
        LIMIT 5
    `).all();
    
    console.log('\n📝 Последние 5 отзывов:');
    reviews.forEach((r, i) => {
        console.log(`${i+1}. ${r.author_name} (ID: ${r.telegram_comment_id})`);
    });
    
    db.close();
    console.log('\n✅ Готово!');
    
} catch (error) {
    console.error('❌ Ошибка:', error.message);
    db.close();
    process.exit(1);
}

