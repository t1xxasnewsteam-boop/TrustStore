const Database = require('better-sqlite3');
const path = require('path');

console.log('🔧 Запуск миграции базы данных...\n');

try {
    const db = new Database(path.join(__dirname, 'analytics.db'));
    
    // Проверяем текущую структуру таблицы
    console.log('📋 Проверка структуры таблицы support_messages...');
    const tableInfo = db.prepare("PRAGMA table_info(support_messages)").all();
    
    console.log('📊 Текущие колонки:');
    tableInfo.forEach(col => {
        console.log(`   - ${col.name} (${col.type})`);
    });
    
    const hasImageUrl = tableInfo.some(col => col.name === 'image_url');
    
    if (!hasImageUrl) {
        console.log('\n⚙️ Колонка image_url не найдена! Добавляем...');
        db.exec('ALTER TABLE support_messages ADD COLUMN image_url TEXT');
        console.log('✅ Колонка image_url успешно добавлена!\n');
        
        // Проверяем еще раз
        const newTableInfo = db.prepare("PRAGMA table_info(support_messages)").all();
        console.log('📊 Обновленные колонки:');
        newTableInfo.forEach(col => {
            console.log(`   - ${col.name} (${col.type})`);
        });
    } else {
        console.log('\n✅ Колонка image_url уже существует!\n');
    }
    
    db.close();
    console.log('\n✅ Миграция завершена успешно!');
    process.exit(0);
    
} catch (error) {
    console.error('❌ Ошибка миграции:', error.message);
    process.exit(1);
}

