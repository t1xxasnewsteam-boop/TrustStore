#!/usr/bin/env node

/**
 * Скрипт для ручной отправки заказа клиенту
 * Использование:
 *   node manual-send-order.js [orderId]
 *   node manual-send-order.js  # отправит последний оплаченный заказ
 */

const http = require('http');
const https = require('https');

const SERVER_URL = process.env.SERVER_URL || 'http://localhost:3000';
const API_ENDPOINT = '/api/manual-send-last-order';

const orderId = process.argv[2];

console.log('\n📤 РУЧНАЯ ОТПРАВКА ЗАКАЗА\n');
console.log('═══════════════════════════════════════════════════════\n');

if (orderId) {
    console.log(`🎯 Отправка заказа: ${orderId}\n`);
} else {
    console.log('🎯 Отправка последнего оплаченного заказа\n');
}

// Определяем протокол
const url = new URL(SERVER_URL);
const isHttps = url.protocol === 'https:';
const client = isHttps ? https : http;

const requestData = orderId ? JSON.stringify({ orderId }) : '{}';
const options = {
    hostname: url.hostname,
    port: url.port || (isHttps ? 443 : 80),
    path: orderId ? `${API_ENDPOINT}?orderId=${orderId}` : API_ENDPOINT,
    method: 'POST',
    headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(requestData)
    }
};

console.log(`📡 Подключение к серверу: ${SERVER_URL}`);
console.log(`🔗 Endpoint: ${API_ENDPOINT}\n`);

const req = client.request(options, (res) => {
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
                    console.log('   Проверьте настройки SMTP или SendGrid в .env');
                }
                
                console.log('\n═══════════════════════════════════════════════════════\n');
            } else {
                console.error('❌ ОШИБКА ОТПРАВКИ ЗАКАЗА\n');
                console.error('Детали:', result);
                process.exit(1);
            }
        } catch (error) {
            console.error('❌ Ошибка парсинга ответа:', error.message);
            console.error('Ответ сервера:', data);
            process.exit(1);
        }
    });
});

req.on('error', (error) => {
    console.error('❌ ОШИБКА ПОДКЛЮЧЕНИЯ К СЕРВЕРУ\n');
    console.error(`   ${error.message}\n`);
    console.error('💡 Проверьте:');
    console.error('   1. Сервер запущен? (node server.js)');
    console.error(`   2. Правильный URL? (${SERVER_URL})`);
    console.error('   3. Доступен ли сервер из сети?');
    console.error('\n   Для удаленного сервера используй:');
    console.error('   SERVER_URL=https://truststore.ru node manual-send-order.js');
    process.exit(1);
});

req.write(requestData);
req.end();

