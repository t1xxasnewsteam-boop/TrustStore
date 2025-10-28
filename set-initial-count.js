const Database = require('better-sqlite3');
const db = new Database('analytics.db');

console.log('📊 УСТАНОВКА НАЧАЛЬНОГО ЗНАЧЕНИЯ СЧЕТЧИКА\n');

const INITIAL_COUNT = 549; // Текущее количество комментариев на посте

try {
    // Устанавливаем начальное значение
    db.prepare(`
        INSERT INTO telegram_stats (id, total_comments, last_updated) 
        VALUES (1, ?, CURRENT_TIMESTAMP)
        ON CONFLICT(id) DO UPDATE SET 
            total_comments = ?,
            last_updated = CURRENT_TIMESTAMP
    `).run(INITIAL_COUNT, INITIAL_COUNT);
    
    console.log(`✅ Установлено начальное значение: ${INITIAL_COUNT} комментариев`);
    
    // Проверяем
    const result = db.prepare('SELECT * FROM telegram_stats WHERE id = 1').get();
    console.log('\n📋 Проверка:');
    console.log(`   Всего комментариев: ${result.total_comments}`);
    console.log(`   Последнее обновление: ${result.last_updated}`);
    
    console.log('\n🎯 Готово! Теперь бот будет добавлять новые комментарии к этому числу.\n');
} catch (error) {
    console.error('❌ Ошибка:', error.message);
}

db.close();

