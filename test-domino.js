const Database = require('better-sqlite3');
const db = new Database('analytics.db');

console.log('🎲 ТЕСТИРОВАНИЕ СИСТЕМЫ ДОМИНО\n');

// Получаем текущие отзывы
const currentReviews = db.prepare(`
    SELECT id, author_name, telegram_date, telegram_comment_id 
    FROM telegram_reviews 
    ORDER BY telegram_date DESC, id DESC
`).all();

console.log(`📊 Текущее состояние: ${currentReviews.length} отзывов\n`);

currentReviews.forEach((review, index) => {
    const date = review.telegram_date 
        ? new Date(review.telegram_date * 1000).toLocaleString('ru-RU', {timeZone: 'Europe/Moscow'})
        : 'нет даты';
    console.log(`${index + 1}. ID:${review.id} | ${review.author_name} | ${date}`);
});

// Если больше 10, удаляем лишние
if (currentReviews.length > 10) {
    console.log(`\n⚠️  Обнаружено ${currentReviews.length} отзывов (больше 10)!`);
    console.log(`🎲 ДОМИНО: Удаляем старые отзывы...`);
    
    const reviewsToDelete = currentReviews.slice(10).map(r => r.id);
    const placeholders = reviewsToDelete.map(() => '?').join(',');
    
    db.prepare(`DELETE FROM telegram_reviews WHERE id IN (${placeholders})`).run(...reviewsToDelete);
    
    console.log(`✅ Удалено: ${reviewsToDelete.length} отзывов`);
    console.log(`   Удалены ID: ${reviewsToDelete.join(', ')}\n`);
    
    // Проверяем результат
    const afterDelete = db.prepare(`
        SELECT id, author_name 
        FROM telegram_reviews 
        ORDER BY telegram_date DESC, id DESC
    `).all();
    
    console.log(`📊 После очистки: ${afterDelete.length} отзывов\n`);
    afterDelete.forEach((review, index) => {
        console.log(`${index + 1}. ID:${review.id} | ${review.author_name}`);
    });
} else {
    console.log(`\n✅ Всё в порядке! Отзывов: ${currentReviews.length}`);
}

db.close();
console.log('\n🎯 Готово!');

