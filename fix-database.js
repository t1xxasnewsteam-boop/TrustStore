const Database = require('better-sqlite3');
const db = new Database('./analytics.db');

console.log('🔍 Проверяем структуру таблицы orders...');

// Проверяем текущую структуру
const columns = db.prepare("PRAGMA table_info(orders)").all();
console.log('📋 Текущие колонки:', columns.map(c => c.name).join(', '));

const hasStatus = columns.some(col => col.name === 'status');

if (!hasStatus) {
    console.log('⚠️ Колонка status отсутствует! Добавляем...');
    try {
        db.exec("ALTER TABLE orders ADD COLUMN status TEXT DEFAULT 'pending'");
        console.log('✅ Колонка status успешно добавлена!');
        
        // Обновляем существующие записи
        const result = db.prepare("UPDATE orders SET status = 'paid' WHERE status IS NULL").run();
        console.log(`✅ Обновлено ${result.changes} существующих заказов`);
    } catch (error) {
        console.error('❌ Ошибка:', error.message);
    }
} else {
    console.log('✅ Колонка status уже существует!');
}

// Проверяем финальную структуру
const finalColumns = db.prepare("PRAGMA table_info(orders)").all();
console.log('📋 Итоговые колонки:', finalColumns.map(c => c.name).join(', '));

// Проверяем данные
const ordersCount = db.prepare('SELECT COUNT(*) as count FROM orders').get();
console.log(`📊 Всего заказов: ${ordersCount.count}`);

if (ordersCount.count > 0) {
    const paidCount = db.prepare("SELECT COUNT(*) as count FROM orders WHERE status = 'paid'").get();
    console.log(`💰 Оплаченных: ${paidCount.count}`);
}

db.close();
console.log('✅ Готово!');

