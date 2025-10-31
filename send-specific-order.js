require('dotenv').config();
const Database = require('better-sqlite3');
const path = require('path');

// Загружаем переменные окружения
require('./server.js'); // Загружаем функции из server.js

const db = new Database(path.join(__dirname, 'analytics.db'));

// Находим конкретный заказ
const orderId = process.argv[2] || 'ORD-1761931550925';
const order = db.prepare('SELECT * FROM orders WHERE order_id = ?').get(orderId);

if (!order) {
    console.log('❌ Заказ не найден:', orderId);
    db.close();
    process.exit(1);
}

console.log('📦 Заказ найден:');
console.log('   Order ID:', order.order_id);
console.log('   Статус:', order.status);
console.log('   Email:', order.customer_email);
console.log('   Имя:', order.customer_name);
console.log('   Сумма:', order.total_amount);
console.log('   Метод:', order.payment_method);

// Если заказ не оплачен, обновляем статус
if (order.status !== 'paid') {
    console.log('\n⚠️ Заказ не оплачен, обновляем статус на "paid"...');
    db.prepare('UPDATE orders SET status = ? WHERE order_id = ?').run('paid', orderId);
    console.log('✅ Статус обновлен на "paid"');
}

// Используем endpoint для отправки
const http = require('http');
const options = {
    hostname: 'localhost',
    port: 3000,
    path: '/api/manual-send-last-order',
    method: 'POST'
};

const req = http.request(options, (res) => {
    let data = '';
    res.on('data', (chunk) => { data += chunk; });
    res.on('end', () => {
        console.log('\n📤 Результат отправки:');
        console.log(data);
        db.close();
        process.exit(0);
    });
});

req.on('error', (error) => {
    console.error('❌ Ошибка запроса:', error);
    db.close();
    process.exit(1);
});

req.end();

