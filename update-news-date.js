const Database = require('better-sqlite3');
const path = require('path');

const db = new Database(path.join(__dirname, 'analytics.db'));

console.log('📅 Обновление даты новости...\n');

const result = db.prepare('UPDATE news SET date = ? WHERE id = 1').run('1 ноября 2025');

console.log(`✅ Обновлено записей: ${result.changes}`);

const news = db.prepare('SELECT id, date, title FROM news WHERE id = 1').get();
console.log('\n📋 Результат:');
console.log(`   ID: ${news.id}`);
console.log(`   Дата: ${news.date}`);
console.log(`   Заголовок: ${news.title}`);

db.close();
console.log('\n✅ Готово!');

