require('dotenv').config();
const Database = require('better-sqlite3');
const path = require('path');
const fetch = require('node-fetch');
const nodemailer = require('nodemailer');
const sgMail = require('@sendgrid/mail');
const fs = require('fs');

// Настройки
if (process.env.SENDGRID_API_KEY) {
    sgMail.setApiKey(process.env.SENDGRID_API_KEY);
}

const emailTransporter = nodemailer.createTransporter({
    host: process.env.EMAIL_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.EMAIL_PORT || '587'),
    secure: process.env.EMAIL_SECURE === 'true',
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
    }
});

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || '7268320384:AAGngFsmkg_x-2rryDtoJkmYD3ymxy5gM9o';
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID || '6185074849';

// Подключаемся к БД
const db = new Database(path.join(__dirname, 'analytics.db'));

// Находим последний оплаченный заказ
const lastOrder = db.prepare(`
    SELECT * FROM orders 
    WHERE status = 'paid'
    ORDER BY created_at DESC 
    LIMIT 1
`).get();

if (!lastOrder) {
    console.log('❌ Не найден оплаченный заказ');
    db.close();
    process.exit(1);
}

console.log('📦 Последний оплаченный заказ:');
console.log('   Order ID:', lastOrder.order_id);
console.log('   Email:', lastOrder.customer_email);
console.log('   Имя:', lastOrder.customer_name);
console.log('   Сумма:', lastOrder.total_amount);
console.log('   Метод:', lastOrder.payment_method);

const products = JSON.parse(lastOrder.products);
console.log('   Товары:', products.map(p => p.name || p.productName || p.product_name).join(', '));

// Загружаем createOrderEmailHTML из server.js через eval (временное решение)
// Сначала попробуем загрузить функции через другой способ
// Создаем VM для выполнения кода из server.js
const vm = require('vm');
const serverCode = fs.readFileSync(path.join(__dirname, 'server.js'), 'utf8');

// Создаем контекст для выполнения
const context = {
    require: require,
    module: { exports: {} },
    exports: {},
    console: console,
    process: process,
    Buffer: Buffer,
    __dirname: __dirname,
    __filename: path.join(__dirname, 'server.js'),
    global: global,
    setTimeout: setTimeout,
    setInterval: setInterval,
    clearTimeout: clearTimeout,
    clearInterval: clearInterval
};

// Выполняем код server.js в изолированном контексте, но только функции для email
// Проще всего - создать упрощенную версию или использовать API endpoint

// Вместо этого, просто используем упрощенную версию отправки
async function sendOrderEmail(data) {
    // Загружаем шаблон email из server.js через require (если возможно)
    // Но проще использовать прямое создание HTML
    
    const html = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin:0;padding:0;font-family:Arial,sans-serif;background:#f5f5f5">
    <table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f5f5;padding:40px 20px">
        <tr><td align="center">
            <table width="600" cellpadding="0" cellspacing="0" style="background:white;border-radius:16px;overflow:hidden">
                <tr><td style="background:linear-gradient(135deg,#667eea 0%,#764ba2 100%);padding:40px;text-align:center">
                    <h1 style="color:white;margin:0;font-size:28px">Trust Store</h1>
                </td></tr>
                <tr><td style="padding:40px">
                    <h2 style="color:#1a1a1a;margin:0 0 20px">Спасибо за покупку!</h2>
                    <p style="color:#666;line-height:1.6;margin:0 0 20px">Ваш заказ <strong>#${data.orderNumber}</strong> успешно оплачен.</p>
                    <p style="color:#666;line-height:1.6;margin:0 0 20px"><strong>Товар:</strong> ${data.productName}</p>
                    <p style="color:#666;line-height:1.6;margin:0 0 40px">Инструкции по использованию будут отправлены отдельно.</p>
                    <p style="color:#999;font-size:14px;margin:0">С уважением,<br>Trust Store</p>
                </td></tr>
            </table>
        </td></tr>
    </table>
</body>
</html>
    `;
    
    // Отправка через SendGrid
    if (process.env.SENDGRID_API_KEY) {
        try {
            await sgMail.send({
                to: data.to,
                from: process.env.EMAIL_USER || 'orders@truststore.ru',
                subject: `Ваш заказ #${data.orderNumber} | Trust Store`,
                html
            });
            console.log(`✅ Email отправлен через SendGrid: ${data.to}`);
            return { success: true };
        } catch (error) {
            console.error('❌ Ошибка SendGrid:', error.message);
        }
    }
    
    // Отправка через SMTP
    try {
        await emailTransporter.sendMail({
            from: process.env.EMAIL_FROM || '"Trust Store" <orders@truststore.ru>',
            to: data.to,
            subject: `Ваш заказ #${data.orderNumber} | Trust Store`,
            html
        });
        console.log(`✅ Email отправлен через SMTP: ${data.to}`);
        return { success: true };
    } catch (error) {
        console.error('❌ Ошибка SMTP:', error.message);
        return { success: false, error: error.message };
    }
}

async function sendTelegram(message) {
    try {
        const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                chat_id: TELEGRAM_CHAT_ID,
                text: message,
                parse_mode: 'HTML'
            })
        });
        const data = await response.json();
        return data.ok;
    } catch (error) {
        console.error('❌ Ошибка Telegram:', error.message);
        return false;
    }
}

async function main() {
    console.log('\n📧 ОТПРАВКА EMAIL КЛИЕНТУ...');
    console.log('─────────────────────────────────');
    
    for (const product of products) {
        const quantity = product.quantity || 1;
        const productName = product.name || product.productName || product.product_name;
        
        // Получаем информацию о товаре
        let productInfo = db.prepare('SELECT * FROM products WHERE name = ?').get(productName);
        if (!productInfo) {
            const baseName = productName.split('(')[0].split('-')[0].split('|')[0].split('[')[0].trim();
            productInfo = db.prepare('SELECT * FROM products WHERE name LIKE ?').get(baseName + '%');
        }
        
        for (let i = 0; i < quantity; i++) {
            const result = await sendOrderEmail({
                to: lastOrder.customer_email,
                orderNumber: lastOrder.order_id,
                productName: productName,
                productImage: productInfo ? productInfo.image : (product.image || null),
                productCategory: productInfo ? productInfo.category : null,
                productDescription: productInfo ? productInfo.description : null,
                login: null,
                password: null,
                instructions: productInfo ? productInfo.description : 'Спасибо за покупку! Инструкции по использованию товара будут отправлены отдельно.'
            });
            
            if (result && result.success) {
                console.log(`   ✅ Email ${i + 1}/${quantity} отправлен на ${lastOrder.customer_email}`);
            } else {
                console.log(`   ❌ Email ${i + 1}/${quantity} НЕ отправлен`);
            }
        }
    }
    
    console.log('\n📱 ОТПРАВКА В TELEGRAM...');
    console.log('─────────────────────────────────');
    
    const telegramMsg = `💰 <b>Новый платеж! (ручная отправка)</b>\n\n` +
        `🆔 Заказ: ${lastOrder.order_id}\n` +
        `💳 Метод: ${lastOrder.payment_method || 'YooMoney'}\n` +
        `👤 Клиент: ${lastOrder.customer_name}\n` +
        `📧 Email: ${lastOrder.customer_email}\n` +
        `💵 Сумма: ${lastOrder.total_amount} ₽\n` +
        `📦 Товары: ${products.map(p => p.name || p.productName || p.product_name).join(', ')}\n` +
        `📅 Дата: ${lastOrder.created_at}\n\n` +
        `🔗 <a href="https://truststore.ru/t1xxas">Открыть админку</a>`;
    
    const telegramSent = await sendTelegram(telegramMsg);
    if (telegramSent) {
        console.log('   ✅ Telegram уведомление отправлено!');
    } else {
        console.log('   ❌ Telegram уведомление НЕ отправлено (проверь настройки)');
    }
    
    db.close();
    console.log('\n✅ ГОТОВО! Все отправлено.');
    process.exit(0);
}

main().catch(error => {
    console.error('\n❌ КРИТИЧЕСКАЯ ОШИБКА:', error);
    console.error(error.stack);
    db.close();
    process.exit(1);
});
