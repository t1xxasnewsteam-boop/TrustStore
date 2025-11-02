const fetch = require('node-fetch');
const Database = require('better-sqlite3');
const path = require('path');

const db = new Database(path.join(__dirname, 'analytics.db'));

// Получаем последние отзывы из базы
console.log('\n📝 ПОСЛЕДНИЕ ОТЗЫВЫ В БАЗЕ:\n');
const reviews = db.prepare(`
    SELECT * FROM telegram_reviews 
    ORDER BY telegram_date DESC, id DESC 
    LIMIT 5
`).all();

reviews.forEach((review, i) => {
    const date = new Date(review.telegram_date * 1000).toLocaleString('ru-RU', {timeZone: 'Europe/Moscow'});
    console.log(`${i+1}. ${review.author_name} (ID: ${review.telegram_comment_id})`);
    console.log(`   Дата: ${date}`);
    console.log(`   Текст: ${review.review_text.substring(0, 60)}...`);
    console.log('');
});

// Проверяем статистику
const stats = db.prepare('SELECT * FROM telegram_stats WHERE id = 1').get();
console.log('📊 СТАТИСТИКА:');
console.log(`   Всего комментариев: ${stats?.total_comments || 0}`);
console.log(`   last_update_id: ${stats?.last_update_id || 0}`);
console.log(`   Последнее обновление: ${stats?.last_updated || 'нет'}`);

db.close();

