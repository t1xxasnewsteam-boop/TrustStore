const Database = require('better-sqlite3');

const db = new Database('analytics.db');

const demoReviews = [
    { name: 'Алексей М.', text: 'Купил ChatGPT Plus, все пришло моментально! Очень доволен качеством обслуживания и скоростью. Рекомендую всем! 🔥', id: 1001 },
    { name: 'Мария К.', text: 'Заказала Midjourney для работы. Поддержка ответила быстро, все активировали за минуту. Цены адекватные, буду брать еще! 💜', id: 1002 },
    { name: 'Дмитрий В.', text: 'Отличный магазин! Взял YouTube Premium и VPN. Всё работает, никаких проблем. Спасибо за честный сервис! 👍', id: 1003 },
    { name: 'Ирина С.', text: 'Оформила Adobe Creative Cloud, всё активировалось без проблем. Работаю в Photoshop и Illustrator каждый день. Супер! 🎨', id: 1004 },
    { name: 'Сергей Н.', text: 'Брал CapCut Pro для монтажа. Все работает отлично, цена огонь! Поддержка помогла с активацией. Очень доволен! ⚡', id: 1005 },
    { name: 'Анна П.', text: 'Заказала Claude Pro, все активировалось моментально. Использую для работы каждый день. Рекомендую! 🤖', id: 1006 },
    { name: 'Максим Л.', text: 'Взял Cursor Pro, все пришло за минуту! Код пишется теперь в разы быстрее. Очень крутой инструмент! 💻', id: 1007 },
    { name: 'Елена Ж.', text: 'Оформила Gemini Advanced, работает идеально! Поддержка на высоте, ответили за пару минут. Всем советую! 💎', id: 1008 },
    { name: 'Артём Б.', text: 'Купил VPN, работает стабильно на всех устройствах. Скорость отличная, цена справедливая. Буду брать еще! 🚀', id: 1009 },
    { name: 'Ольга Т.', text: 'Заказала YouTube Premium для семьи. Активировали быстро, все работает. Дети довольны, я тоже! Спасибо! 🎵', id: 1010 }
];

console.log('🔄 Добавление демо-отзывов...');

let added = 0;
for (const review of demoReviews) {
    try {
        const existing = db.prepare('SELECT id FROM telegram_reviews WHERE telegram_comment_id = ?').get(review.id);
        
        if (!existing) {
            db.prepare(`
                INSERT INTO telegram_reviews (author_name, review_text, rating, telegram_comment_id)
                VALUES (?, ?, 5, ?)
            `).run(review.name, review.text, review.id);
            
            added++;
            console.log(`✅ Добавлен отзыв от ${review.name}`);
        } else {
            console.log(`⏭️  Отзыв от ${review.name} уже существует`);
        }
    } catch (error) {
        console.error(`❌ Ошибка добавления отзыва от ${review.name}:`, error.message);
    }
}

console.log(`\n✅ Готово! Добавлено новых отзывов: ${added}`);
console.log(`📊 Всего отзывов в БД: ${db.prepare('SELECT COUNT(*) as count FROM telegram_reviews').get().count}`);

db.close();

