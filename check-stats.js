const Database = require('better-sqlite3');
const db = new Database('./analytics.db');

console.log('📊 ПРОВЕРКА СТАТИСТИКИ:\n');

// Сессии
const sessions = db.prepare('SELECT COUNT(*) as count FROM sessions').get();
console.log(`👥 Всего посещений (sessions): ${sessions.count}`);

// Просмотры
const visits = db.prepare('SELECT COUNT(*) as count FROM visits').get();
console.log(`👀 Просмотров страниц (visits): ${visits.count}`);

// Заказы
const allOrders = db.prepare('SELECT COUNT(*) as count, COALESCE(SUM(total_amount), 0) as revenue FROM orders').get();
console.log(`📦 Всего заказов: ${allOrders.count} (выручка: ${allOrders.revenue} ₽)`);

const paidOrders = db.prepare("SELECT COUNT(*) as count, COALESCE(SUM(total_amount), 0) as revenue FROM orders WHERE status = 'paid'").get();
console.log(`💰 Оплаченных: ${paidOrders.count} (выручка: ${paidOrders.revenue} ₽)`);

const pendingOrders = db.prepare("SELECT COUNT(*) as count, COALESCE(SUM(total_amount), 0) as revenue FROM orders WHERE status = 'pending'").get();
console.log(`⏳ В ожидании: ${pendingOrders.count} (сумма: ${pendingOrders.revenue} ₽)`);

// Клиенты
const customers = db.prepare('SELECT COUNT(*) as count FROM customers').get();
console.log(`👤 Клиентов: ${customers.count}`);

// Товары
const products = db.prepare('SELECT COUNT(*) as count FROM products').get();
console.log(`📦 Товаров: ${products.count}`);

db.close();
console.log('\n✅ Готово!');

