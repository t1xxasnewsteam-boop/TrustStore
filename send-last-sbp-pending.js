// Скрипт для отправки последнего СБП заказа со статусом payment_confirmed_by_customer

const Database = require('better-sqlite3');
const path = require('path');
const http = require('http');

const db = new Database(path.join(__dirname, 'analytics.db'));

try {
    console.log('🔍 Поиск последнего СБП заказа со статусом payment_confirmed_by_customer...');
    
    // Находим последний СБП заказ со статусом payment_confirmed_by_customer
    const order = db.prepare(`
        SELECT * FROM orders 
        WHERE payment_method = 'SBP' 
        AND status = 'payment_confirmed_by_customer'
        ORDER BY created_at DESC 
        LIMIT 1
    `).get();
    
    if (!order) {
        console.log('❌ Не найден СБП заказ со статусом payment_confirmed_by_customer');
        
        // Показываем все СБП заказы
        const allSbpOrders = db.prepare(`
            SELECT order_id, status, customer_email, total_amount, created_at 
            FROM orders 
            WHERE payment_method = 'SBP'
            ORDER BY created_at DESC 
            LIMIT 5
        `).all();
        
        if (allSbpOrders.length > 0) {
            console.log('\n📋 Последние 5 СБП заказов:');
            allSbpOrders.forEach((o, i) => {
                console.log(`${i+1}. ${o.order_id} - ${o.status} - ${o.customer_email} - ${o.total_amount} ₽ - ${o.created_at}`);
            });
        }
        
        db.close();
        process.exit(1);
    }
    
    console.log(`✅ Найден заказ: ${order.order_id}`);
    console.log(`   Клиент: ${order.customer_name}`);
    console.log(`   Email: ${order.customer_email}`);
    console.log(`   Сумма: ${order.total_amount} ₽`);
    console.log(`   Статус: ${order.status}`);
    console.log(`\n🚀 Отправка заказа через API...`);
    
    // Отправляем через API
    const options = {
        hostname: 'localhost',
        port: 3000,
        path: '/api/manual-send-last-order',
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        }
    };
    
    const req = http.request(options, (res) => {
        let data = '';
        res.on('data', (chunk) => { data += chunk; });
        res.on('end', () => {
            try {
                const result = JSON.parse(data);
                console.log('\n📤 Результат:');
                console.log(JSON.stringify(result, null, 2));
                
                if (result.success) {
                    console.log(`\n✅ Заказ ${order.order_id} успешно отправлен!`);
                    console.log(`   Emails отправлено: ${result.emailsSent || 0}`);
                    console.log(`   Emails ошибок: ${result.emailsFailed || 0}`);
                } else {
                    console.log(`\n❌ Ошибка отправки: ${result.error || 'Unknown error'}`);
                }
            } catch (e) {
                console.log('\n📤 Ответ сервера:');
                console.log(data);
            }
            
            db.close();
            process.exit(0);
        });
    });
    
    req.on('error', (error) => {
        console.error('❌ Ошибка запроса:', error.message);
        db.close();
        process.exit(1);
    });
    
    req.write(JSON.stringify({ orderId: order.order_id }));
    req.end();
    
} catch (error) {
    console.error('❌ Ошибка:', error.message);
    db.close();
    process.exit(1);
}

