const Database = require('better-sqlite3');
const path = require('path');

// Подключаемся к БД
const dbPath = path.join(__dirname, 'analytics.db');
const db = new Database(dbPath);

console.log('\n🔍 ПРОВЕРКА ПОСЛЕДНИХ ЗАКАЗОВ\n');
console.log('═══════════════════════════════════════════════════════\n');

// Получаем последние 5 заказов
const recentOrders = db.prepare(`
    SELECT 
        order_id,
        customer_name,
        customer_email,
        customer_phone,
        status,
        payment_method,
        total_amount,
        created_at,
        products
    FROM orders 
    ORDER BY created_at DESC 
    LIMIT 5
`).all();

if (recentOrders.length === 0) {
    console.log('❌ Заказы не найдены');
    db.close();
    process.exit(1);
}

console.log('📦 ПОСЛЕДНИЕ 5 ЗАКАЗОВ:\n');

recentOrders.forEach((order, index) => {
    const products = JSON.parse(order.products || '[]');
    const productsList = products.map(p => p.name || p.productName || p.product_name).join(', ');
    
    console.log(`${index + 1}. Заказ: ${order.order_id}`);
    console.log(`   👤 Клиент: ${order.customer_name}`);
    console.log(`   📧 Email: ${order.customer_email}`);
    console.log(`   📱 Телефон: ${order.customer_phone || 'не указан'}`);
    console.log(`   💵 Сумма: ${order.total_amount} ₽`);
    console.log(`   💳 Метод оплаты: ${order.payment_method || 'не указан'}`);
    console.log(`   📊 Статус: ${order.status === 'paid' ? '✅ ОПЛАЧЕН' : '❌ НЕ ОПЛАЧЕН'}`);
    console.log(`   📅 Дата: ${order.created_at}`);
    console.log(`   📦 Товары: ${productsList || 'нет товаров'}`);
    console.log(`   📊 Количество товаров: ${products.length}`);
    
    // Проверяем статус оплаты
    if (order.status === 'paid') {
        console.log(`   ⚠️  ВНИМАНИЕ: Заказ оплачен, но нужно проверить, был ли отправлен email`);
    }
    
    console.log('');
});

// Находим последний оплаченный заказ
const lastPaidOrder = db.prepare(`
    SELECT 
        order_id,
        customer_name,
        customer_email,
        status,
        payment_method,
        total_amount,
        created_at,
        products
    FROM orders 
    WHERE status = 'paid'
    ORDER BY created_at DESC 
    LIMIT 1
`).get();

if (lastPaidOrder) {
    console.log('═══════════════════════════════════════════════════════\n');
    console.log('💰 ПОСЛЕДНИЙ ОПЛАЧЕННЫЙ ЗАКАЗ:\n');
    console.log(`   🆔 Order ID: ${lastPaidOrder.order_id}`);
    console.log(`   👤 Клиент: ${lastPaidOrder.customer_name}`);
    console.log(`   📧 Email: ${lastPaidOrder.customer_email}`);
    console.log(`   💵 Сумма: ${lastPaidOrder.total_amount} ₽`);
    console.log(`   💳 Метод: ${lastPaidOrder.payment_method || 'не указан'}`);
    console.log(`   📅 Дата создания: ${lastPaidOrder.created_at}`);
    
    const products = JSON.parse(lastPaidOrder.products || '[]');
    console.log(`\n   📦 Товары (${products.length}):`);
    products.forEach((p, i) => {
        const name = p.name || p.productName || p.product_name;
        const qty = p.quantity || 1;
        console.log(`      ${i + 1}. ${name} (x${qty})`);
    });
    
    console.log('\n   ✅ Этот заказ готов к отправке!');
    console.log('\n   💡 Для отправки используй:');
    console.log(`      node send-specific-order.js ${lastPaidOrder.order_id}`);
    console.log(`   или открой в браузере:`);
    console.log(`      http://localhost:3000/api/manual-send-last-order?orderId=${lastPaidOrder.order_id}`);
} else {
    console.log('\n⚠️  Не найдено оплаченных заказов');
}

// Проверяем заказы со статусом pending
const pendingOrders = db.prepare(`
    SELECT COUNT(*) as count 
    FROM orders 
    WHERE status = 'pending'
`).get();

if (pendingOrders && pendingOrders.count > 0) {
    console.log(`\n⚠️  Найдено ${pendingOrders.count} заказов со статусом 'pending' (ожидают оплаты)`);
}

db.close();
console.log('\n═══════════════════════════════════════════════════════\n');

