const Database = require('better-sqlite3');

const db = new Database('analytics.db');

console.log('🗑️ Удаление сообщения от Trust Seller...');

// Удаляем сообщение
const result = db.prepare(`
    DELETE FROM telegram_reviews 
    WHERE author_name LIKE '%Trust Seller%' 
    OR author_name LIKE '%Артём%' 
    OR review_text LIKE '%o-4zWa6SFWUGo%'
`).run();

console.log(`✅ Удалено строк: ${result.changes}`);

// Проверяем сколько осталось
const count = db.prepare('SELECT COUNT(*) as count FROM telegram_reviews').get();
console.log(`📊 Отзывов осталось: ${count.count}`);

// Показываем последние 3
const reviews = db.prepare('SELECT author_name, review_text FROM telegram_reviews ORDER BY created_at DESC LIMIT 3').all();
console.log('\n📝 Последние отзывы:');
reviews.forEach((r, i) => {
    console.log(`${i + 1}. ${r.author_name}: ${r.review_text.substring(0, 50)}...`);
});

db.close();

