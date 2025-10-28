const Database = require('better-sqlite3');

const db = new Database('analytics.db');

console.log('🗑️ Удаление демо-отзывов...');

// Удаляем все демо-отзывы (с ID 1001-1010)
const deleted = db.prepare(`
    DELETE FROM telegram_reviews 
    WHERE telegram_comment_id >= 1001 AND telegram_comment_id <= 1010
`).run();

console.log(`✅ Удалено демо-отзывов: ${deleted.changes}`);

// Показываем что осталось
const count = db.prepare('SELECT COUNT(*) as count FROM telegram_reviews').get();
console.log(`📊 Реальных отзывов осталось: ${count.count}`);

if (count.count > 0) {
    const reviews = db.prepare('SELECT author_name, review_text FROM telegram_reviews ORDER BY created_at DESC').all();
    console.log('\n📝 Все реальные отзывы:');
    reviews.forEach((r, i) => {
        console.log(`${i + 1}. ${r.author_name}: ${r.review_text.substring(0, 60)}...`);
    });
} else {
    console.log('\nℹ️ Реальных отзывов пока нет. Запускается синхронизация...');
}

db.close();
console.log('\n✅ Готово! Теперь запустится синхронизация.');

