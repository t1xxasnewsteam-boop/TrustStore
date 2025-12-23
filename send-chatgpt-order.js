const Database = require('better-sqlite3');
const path = require('path');
require('dotenv').config();

// Импортируем функции отправки email из server.js
const db = new Database('./analytics.db');

console.log('🔍 Поиск последнего заказа ChatGPT Plus 3 месяца...\n');

// Ищем последний заказ с ChatGPT Plus 3 месяца
const orders = db.prepare(`
    SELECT * FROM orders 
    WHERE products LIKE '%ChatGPT%' 
    AND products LIKE '%3 месяц%'
    ORDER BY created_at DESC 
    LIMIT 10
`).all();

if (orders.length === 0) {
    console.log('❌ Не найдено заказов ChatGPT Plus на 3 месяца');
    process.exit(1);
}

console.log(`✅ Найдено ${orders.length} заказов. Последний заказ:`);
const lastOrder = orders[0];

console.log(`   ID: ${lastOrder.order_id}`);
console.log(`   Email: ${lastOrder.customer_email}`);
console.log(`   Дата: ${lastOrder.created_at}`);
console.log(`   Товары: ${lastOrder.products}`);

const products = JSON.parse(lastOrder.products || '[]');
const chatgptProduct = products.find(p => {
    const name = (p.name || p.productName || p.product_name || '').toLowerCase();
    return name.includes('chatgpt') && name.includes('3 месяц');
});

if (!chatgptProduct) {
    console.log('❌ Не найден товар ChatGPT Plus 3 месяца в заказе');
    process.exit(1);
}

console.log(`\n📦 Товар для отправки: ${chatgptProduct.name || chatgptProduct.productName || chatgptProduct.product_name}`);
console.log(`📧 Email получателя: Aggel55555@gmail.com\n`);

// Загружаем server.js чтобы использовать функции отправки
const serverPath = path.join(__dirname, 'server.js');
console.log('⏳ Загрузка функций отправки из server.js...');

// Используем прямое подключение к SMTP/SendGrid
const nodemailer = require('nodemailer');
const sgMail = require('@sendgrid/mail');

if (process.env.SENDGRID_API_KEY) {
    sgMail.setApiKey(process.env.SENDGRID_API_KEY);
}

// Создаем транспортер для SMTP
const emailTransporter = nodemailer.createTransport({
    host: process.env.EMAIL_HOST || 'smtp.yandex.ru',
    port: parseInt(process.env.EMAIL_PORT) || 465,
    secure: process.env.EMAIL_SECURE === 'true' || true,
    auth: {
        user: process.env.EMAIL_USER || 'orders@truststore.ru',
        pass: process.env.EMAIL_PASSWORD
    },
    tls: {
        rejectUnauthorized: false,
        ciphers: 'SSLv3'
    }
});

// Получаем информацию о товаре из базы
const productInfo = db.prepare('SELECT * FROM products WHERE name LIKE ?').get('ChatGPT%');

// Функция создания HTML письма (упрощенная версия)
function createOrderEmailHTML(data) {
    return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
        .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
        .order-info { background: white; padding: 20px; border-radius: 8px; margin: 20px 0; }
        .product { background: white; padding: 20px; border-radius: 8px; margin: 20px 0; }
        .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>Ваш заказ #${data.orderNumber}</h1>
            <p>Спасибо за покупку!</p>
        </div>
        <div class="content">
            <div class="order-info">
                <h2>Информация о заказе</h2>
                <p><strong>Номер заказа:</strong> ${data.orderNumber}</p>
                <p><strong>Товар:</strong> ${data.productName}</p>
            </div>
            <div class="product">
                <h2>${data.productName}</h2>
                ${data.instructions ? `<p>${data.instructions}</p>` : '<p>Инструкции по использованию будут отправлены отдельно.</p>'}
            </div>
        </div>
        <div class="footer">
            <p>© ${new Date().getFullYear()} Trust Store. Все права защищены.</p>
        </div>
    </div>
</body>
</html>
    `;
}

// Функция отправки email
async function sendEmail() {
    const emailData = {
        to: 'Aggel55555@gmail.com',
        orderNumber: lastOrder.order_id,
        productName: chatgptProduct.name || chatgptProduct.productName || chatgptProduct.product_name,
        productImage: productInfo ? productInfo.image : null,
        productCategory: productInfo ? productInfo.category : null,
        productDescription: productInfo ? productInfo.description : null,
        login: null,
        password: null,
        instructions: productInfo ? productInfo.description : 'Спасибо за покупку! Инструкции по использованию товара будут отправлены отдельно.'
    };

    // Попытка через SendGrid
    if (process.env.SENDGRID_API_KEY) {
        try {
            const msg = {
                to: emailData.to,
                from: process.env.EMAIL_USER || 'orders@truststore.ru',
                subject: `Ваш заказ #${emailData.orderNumber} | Trust Store`,
                html: createOrderEmailHTML(emailData),
                text: `Ваш заказ #${emailData.orderNumber}\n\nТовар: ${emailData.productName}\n\nСпасибо за покупку!`
            };

            await sgMail.send(msg);
            console.log('✅ Email отправлен через SendGrid');
            db.close();
            process.exit(0);
        } catch (error) {
            console.error('❌ Ошибка SendGrid:', error.message);
        }
    }

    // Попытка через SMTP
    try {
        const mailOptions = {
            from: process.env.EMAIL_FROM || '"Trust Store" <orders@truststore.ru>',
            to: emailData.to,
            replyTo: 'orders@truststore.ru',
            subject: `Ваш заказ #${emailData.orderNumber} | Trust Store`,
            html: createOrderEmailHTML(emailData),
            text: `Ваш заказ #${emailData.orderNumber}\n\nТовар: ${emailData.productName}\n\nСпасибо за покупку!`
        };

        const info = await emailTransporter.sendMail(mailOptions);
        console.log(`✅ Email отправлен через SMTP (${info.messageId})`);
    } catch (error) {
        console.error('❌ Ошибка отправки email:', error.message);
        process.exit(1);
    }

    db.close();
}

sendEmail();
