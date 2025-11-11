#!/usr/bin/env node

const Database = require('better-sqlite3');
const path = require('path');
const https = require('https');

const db = new Database(path.join(__dirname, 'analytics.db'));

try {
    console.log('\n🔍 Поиск последнего заказа на Claude...\n');
    
    // Ищем последний заказ с Claude в названии товара
    const order = db.prepare(`
        SELECT * FROM orders 
        WHERE products LIKE '%Claude%' 
           OR products LIKE '%claude%'
        ORDER BY created_at DESC 
        LIMIT 1
    `).get();
    
    if (!order) {
        console.log('❌ Не найден заказ на Claude');
        
        // Показываем последние 5 заказов
        const recentOrders = db.prepare(`
            SELECT order_id, customer_email, status, payment_method, total_amount, created_at, products
            FROM orders 
            ORDER BY created_at DESC 
            LIMIT 5
        `).all();
        
        if (recentOrders.length > 0) {
            console.log('\n📋 Последние 5 заказов:');
            recentOrders.forEach((o, i) => {
                const products = JSON.parse(o.products || '[]');
                const productNames = products.map(p => p.name || p.productName || p.product_name).join(', ');
                console.log(`${i+1}. ${o.order_id} - ${o.status} - ${o.customer_email} - ${o.total_amount} ₽`);
                console.log(`   Товары: ${productNames}`);
                console.log(`   Дата: ${o.created_at}\n`);
            });
        }
        
        db.close();
        process.exit(1);
    }
    
    const products = JSON.parse(order.products || '[]');
    const productNames = products.map(p => p.name || p.productName || p.product_name).join(', ');
    
    console.log('✅ Найден заказ на Claude:');
    console.log(`   🆔 Order ID: ${order.order_id}`);
    console.log(`   👤 Клиент: ${order.customer_name}`);
    console.log(`   📧 Email: ${order.customer_email}`);
    console.log(`   💵 Сумма: ${order.total_amount} ₽`);
    console.log(`   💳 Метод: ${order.payment_method || 'не указан'}`);
    console.log(`   📊 Статус: ${order.status}`);
    console.log(`   📦 Товары: ${productNames}`);
    console.log(`   📅 Дата: ${order.created_at}`);
    console.log(`\n🚀 Отправка заказа через API...\n`);
    
    // Отправляем заказ через API
    const url = new URL('https://truststore.ru');
    const options = {
        hostname: url.hostname,
        port: 443,
        path: '/api/manual-send-last-order',
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(JSON.stringify({ orderId: order.order_id }))
        },
        rejectUnauthorized: false
    };
    
    const req = https.request(options, (res) => {
        let data = '';
        
        res.on('data', (chunk) => {
            data += chunk;
        });
        
        res.on('end', () => {
            try {
                const result = JSON.parse(data);
                
                if (res.statusCode === 200 && result.success) {
                    console.log('✅ ЗАКАЗ УСПЕШНО ОТПРАВЛЕН!\n');
                    console.log('📊 Результаты:');
                    console.log(`   🆔 Order ID: ${result.orderId}`);
                    console.log(`   📧 Email клиента: ${result.email}`);
                    console.log(`   ✅ Emails отправлено: ${result.emailsSent}`);
                    console.log(`   ❌ Ошибок: ${result.emailsFailed}`);
                    console.log(`   📱 Telegram: ${result.telegramSent ? '✅ отправлено' : '❌ не отправлено'}`);
                    
                    if (result.emailsFailed > 0) {
                        console.log('\n⚠️  ВНИМАНИЕ: Были ошибки при отправке email!');
                    }
                } else {
                    console.error('❌ ОШИБКА ОТПРАВКИ ЗАКАЗА\n');
                    console.error('Детали:', result);
                }
            } catch (error) {
                console.error('❌ Ошибка парсинга ответа:', error.message);
                console.error('Ответ сервера:', data);
            }
            
            db.close();
            process.exit(0);
        });
    });
    
    req.on('error', (error) => {
        console.error('❌ ОШИБКА ПОДКЛЮЧЕНИЯ К СЕРВЕРУ\n');
        console.error(`   ${error.message}\n`);
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





