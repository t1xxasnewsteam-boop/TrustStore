#!/usr/bin/env node

const https = require('https');

const SERVER_URL = 'https://truststore.ru';
const API_ENDPOINT = '/api/manual-send-last-order';

console.log('\n📤 ОТПРАВКА ПОСЛЕДНЕГО ЗАКАЗА (Cardlink)\n');
console.log('═══════════════════════════════════════════════════════\n');

const url = new URL(SERVER_URL);
const options = {
    hostname: url.hostname,
    port: url.port || 443,
    path: API_ENDPOINT,
    method: 'POST',
    headers: {
        'Content-Type': 'application/json',
        'Content-Length': 2
    },
    rejectUnauthorized: false // Для самоподписанных сертификатов
};

console.log(`📡 Подключение к серверу: ${SERVER_URL}`);
console.log(`🔗 Endpoint: ${API_ENDPOINT}\n`);

const req = https.request(options, (res) => {
    let data = '';
    
    console.log(`📥 Статус ответа: ${res.statusCode} ${res.statusMessage}\n`);
    
    res.on('data', (chunk) => {
        data += chunk;
    });
    
    res.on('end', () => {
        try {
            const result = JSON.parse(data);
            console.log('📤 Результат:');
            console.log(JSON.stringify(result, null, 2));
            
            if (result.success) {
                console.log(`\n✅ Заказ успешно отправлен!`);
                console.log(`   📧 Emails отправлено: ${result.emailsSent || 0}`);
                console.log(`   ❌ Emails ошибок: ${result.emailsFailed || 0}`);
                if (result.orderId) {
                    console.log(`   🆔 Order ID: ${result.orderId}`);
                }
            } else {
                console.log(`\n❌ Ошибка отправки: ${result.error || 'Unknown error'}`);
            }
        } catch (e) {
            console.log('\n📤 Ответ сервера (не JSON):');
            console.log(data);
        }
        
        process.exit(0);
    });
});

req.on('error', (error) => {
    console.error('❌ Ошибка запроса:', error.message);
    process.exit(1);
});

req.write('{}');
req.end();

