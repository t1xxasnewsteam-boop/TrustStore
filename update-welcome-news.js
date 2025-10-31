const Database = require('better-sqlite3');
const path = require('path');

const db = new Database(path.join(__dirname, 'analytics.db'));

console.log('📰 Обновление новости "Добро пожаловать"...\n');

// Обновляем новость ID=1
const result = db.prepare(`
    UPDATE news 
    SET image_url = 'welcome-image.png', emoji = NULL 
    WHERE id = 1
`).run();

console.log(`✅ Обновлено записей: ${result.changes}`);

// Проверяем результат
const news = db.prepare('SELECT id, date, title, image_url, emoji FROM news WHERE id = 1').get();
console.log('\n📋 Результат:');
console.log(`   ID: ${news.id}`);
console.log(`   Дата: ${news.date}`);
console.log(`   Заголовок: ${news.title}`);
console.log(`   Изображение: ${news.image_url || 'нет'}`);
console.log(`   Эмодзи: ${news.emoji || 'нет'}`);

db.close();
console.log('\n✅ Готово!');

