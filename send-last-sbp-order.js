const Database = require('better-sqlite3');
const path = require('path');

const db = new Database('/root/TrustStore/analytics.db');

try {
    console.log('🔍 Ищем последний заказ СБП для обработки...');
    
    // Находим последний заказ СБП со статусом payment_confirmed_by_customer
    const order = db.prepare(`
        SELECT * FROM orders 
        WHERE payment_method = 'SBP' 
        AND status = 'payment_confirmed_by_customer'
        ORDER BY created_at DESC 
        LIMIT 1
    `).get();
    
    if (!order) {
        console.log('❌ Не найден заказ СБП со статусом payment_confirmed_by_customer');
        
        // Пробуем найти последний заказ СБП в принципе
        const lastOrder = db.prepare(`
            SELECT * FROM orders 
            WHERE payment_method = 'SBP'
            ORDER BY created_at DESC 
            LIMIT 1
        `).get();
        
        if (lastOrder) {
            console.log(`\n📋 Последний заказ СБП:`);
            console.log(`   ID: ${lastOrder.order_id}`);
            console.log(`   Статус: ${lastOrder.status}`);
            console.log(`   Клиент: ${lastOrder.customer_name}`);
            console.log(`   Email: ${lastOrder.customer_email}`);
            console.log(`   Сумма: ${lastOrder.total_amount} ₽`);
            console.log(`   Дата: ${lastOrder.created_at}`);
        } else {
            console.log('❌ Не найдено ни одного заказа СБП');
        }
        
        process.exit(1);
    }
    
    console.log(`✅ Найден заказ: ${order.order_id}`);
    console.log(`   Клиент: ${order.customer_name}`);
    console.log(`   Email: ${order.customer_email}`);
    console.log(`   Сумма: ${order.total_amount} ₽`);
    console.log(`   Статус: ${order.status}`);
    console.log(`\n🚀 Обрабатываем заказ...`);
    
    // Обновляем статус на "paid"
    db.prepare('UPDATE orders SET status = ? WHERE order_id = ?').run('paid', order.order_id);
    console.log(`✅ Статус обновлен на "paid"`);
    
    console.log(`\n📧 Для отправки emails нужно вызвать API /api/manual-send-last-order`);
    console.log(`   Или заказ будет отправлен автоматически через Telegram бота`);
    
    console.log(`\n✅ Заказ ${order.order_id} готов к отправке!`);
    
    db.close();
    
} catch (error) {
    console.error('❌ Ошибка:', error.message);
    db.close();
    process.exit(1);
}

