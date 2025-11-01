const Database = require('better-sqlite3');

const db = new Database('analytics.db');

console.log('📝 Добавление старых отзывов из Telegram...\n');

// Функция для создания Unix timestamp для конкретной даты и времени МСК
function createMoscowTimestamp(year, month, day, hour, minute) {
    // Создаем дату в UTC и вычитаем 3 часа (МСК = UTC+3)
    const date = new Date(Date.UTC(year, month - 1, day, hour - 3, minute, 0));
    return Math.floor(date.getTime() / 1000);
}

const oldReviews = [
    { name: 'Антон', text: 'Все супер. Gpt plus', id: 2001, date: createMoscowTimestamp(2024, 10, 27, 9, 52) },
    { name: 'Андрей🔥', text: 'Купил GPT PLUS все супер! Быстро, удобно, без обмана! Админ грамотно координирует) Рекомендую!', id: 2002, date: createMoscowTimestamp(2024, 10, 27, 17, 12) },
    { name: 'Rahim', text: 'Все четко быстро, знает свое дело. 👍', id: 2003, date: createMoscowTimestamp(2024, 10, 28, 11, 28) },
    { name: 'АЛЕКСАНДР💰', text: 'Спасибо, задавал много вопросов, на всё получил ответ, купил подписку chatgpt plus на 3 месяца)', id: 2004, date: createMoscowTimestamp(2024, 10, 26, 22, 17) },
    { name: 'Dmitry', text: 'Все супер!! Быстро, честно!! Рекомендую!!', id: 2005, date: createMoscowTimestamp(2024, 10, 26, 9, 34) },
    { name: 'Руслан⭐', text: 'Все работает, спасибо большое!', id: 2006, date: createMoscowTimestamp(2024, 10, 22, 11, 40) },
    { name: 'Антон🐸', text: 'Подключили gpt, все прошло быстро и просто 👍', id: 2007, date: createMoscowTimestamp(2024, 10, 22, 14, 44) },
    { name: 'DY69 <3🦄', text: 'Всё работает как часы, спасибо большое за ваш сервис🥰', id: 2008, date: createMoscowTimestamp(2024, 10, 22, 22, 23) },
    { name: 'Алёна FireOffer⭐', text: 'Всё супер, спасибо большое, быстро всё оплатили)', id: 2009, date: createMoscowTimestamp(2024, 10, 24, 16, 7) },
    { name: 'Strifa🔥', text: 'Это что за компания! Что за молниеносные решения в сторону клиента, а не тупо заработать сорвать бабок! Я спасибо говорю! Советую всем кого знаю! Вернусь через месяц как договорились!🤝', id: 2010, date: createMoscowTimestamp(2024, 10, 24, 17, 47) },
    { name: 'Денис Елфимов', text: 'Всё отлично, оплата прошла быстро. Админ всё грамотно подсказал', id: 2011, date: createMoscowTimestamp(2024, 10, 24, 20, 45) }
];

let added = 0;
let skipped = 0;

for (const review of oldReviews) {
    try {
        // Проверяем, не добавлен ли уже
        const existing = db.prepare('SELECT id FROM telegram_reviews WHERE telegram_comment_id = ?').get(review.id);
        
        if (!existing) {
            db.prepare(`
                INSERT INTO telegram_reviews (author_name, review_text, rating, telegram_comment_id, telegram_date)
                VALUES (?, ?, 5, ?, ?)
            `).run(review.name, review.text, review.id, review.date);
            
            added++;
            console.log(`✅ ${added}. ${review.name}: ${review.text.substring(0, 50)}...`);
        } else {
            skipped++;
            console.log(`⏭️  Пропущен (уже есть): ${review.name}`);
        }
    } catch (err) {
        console.error(`❌ Ошибка добавления ${review.name}:`, err.message);
    }
}

console.log(`\n📊 РЕЗУЛЬТАТ:`);
console.log(`✅ Добавлено: ${added}`);
console.log(`⏭️  Пропущено: ${skipped}`);

const total = db.prepare('SELECT COUNT(*) as count FROM telegram_reviews').get();
console.log(`📝 Всего отзывов в БД: ${total.count}`);

db.close();
console.log('\n🎉 Готово!');

