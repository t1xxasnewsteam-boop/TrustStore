// Скрипт для отправки последнего заказа ChatGPT Plus 3 месяца на указанный email
// Использование: node send-order-to-email.js

require('dotenv').config();
const Database = require('better-sqlite3');
const path = require('path');

// Копируем код отправки email из server.js
const nodemailer = require('nodemailer');
const sgMail = require('@sendgrid/mail');

if (process.env.SENDGRID_API_KEY) {
    sgMail.setApiKey(process.env.SENDGRID_API_KEY);
}

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

const db = new Database('./analytics.db');

// Email получателя
const TARGET_EMAIL = 'Aggel55555@mail.ru';
const PRODUCT_NAME = 'ChatGPT Plus';
const PRODUCT_DURATION = '3 месяц';

console.log(`🔍 Поиск последнего заказа ${PRODUCT_NAME} ${PRODUCT_DURATION}...\n`);

// Ищем последний заказ
const orders = db.prepare(`
    SELECT * FROM orders 
    WHERE products LIKE ? 
    AND products LIKE ?
    ORDER BY created_at DESC 
    LIMIT 1
`).get(`%${PRODUCT_NAME}%`, `%${PRODUCT_DURATION}%`);

if (!orders) {
    console.log(`❌ Не найден заказ ${PRODUCT_NAME} ${PRODUCT_DURATION}`);
    db.close();
    process.exit(1);
}

console.log(`✅ Заказ найден:`);
console.log(`   ID: ${orders.order_id}`);
console.log(`   Оригинальный email: ${orders.customer_email}`);
console.log(`   Дата: ${orders.created_at}`);
console.log(`   Товары: ${orders.products}`);

const products = JSON.parse(orders.products || '[]');
const chatgptProduct = products.find(p => {
    const name = (p.name || p.productName || p.product_name || '').toLowerCase();
    const duration = (p.duration || '').toLowerCase();
    return name.includes('chatgpt') && (duration.includes('3') || name.includes('3'));
});

if (!chatgptProduct) {
    console.log(`❌ Не найден товар ${PRODUCT_NAME} ${PRODUCT_DURATION} в заказе`);
    db.close();
    process.exit(1);
}

const productName = chatgptProduct.name || chatgptProduct.productName || chatgptProduct.product_name;
console.log(`\n📦 Товар: ${productName}`);
console.log(`📧 Отправка на: ${TARGET_EMAIL}\n`);

// Получаем информацию о товаре
const productInfo = db.prepare('SELECT * FROM products WHERE name LIKE ?').get('ChatGPT%');

// Загружаем функции из server.js (копируем код)
function createOrderEmailHTML(data) {
    const { orderNumber, productName, productImage, instructions } = data;
    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Ваш заказ #${orderNumber}</title>
  <style>
    body { margin:0;padding:0;background:#f5f5f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif; }
    .email-container { background:#ffffff;border-radius:16px;overflow:hidden;border:1px solid rgba(0,0,0,0.08);box-shadow:0 4px 24px rgba(0,0,0,0.1);max-width:640px;margin:32px auto; }
    .header { padding:28px 32px;background:linear-gradient(135deg,#667eea 0%,#764ba2 100%);color:#fff; }
    .content { padding:32px;color:#1a1a1a; }
    .product-box { background:#f8f9ff;border:1px solid rgba(102,126,234,0.15);border-radius:12px;padding:20px 24px;margin:0 0 24px 0; }
    .telegram-card { background:linear-gradient(135deg, #667eea 0%, #764ba2 100%);border-radius:12px;padding:24px;text-align:center;color:#fff;margin:18px 0; }
    .button { background:#667eea;padding:12px 22px;border-radius:10px;display:inline-block;color:#fff;text-decoration:none;margin-top:4px; }
  </style>
</head>
<body>
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f5f5f5;padding:32px 12px;">
    <tr>
      <td align="center">
        <div class="email-container">
          <div class="header">
            <div style="font-size:24px;font-weight:700;">Trust Store</div>
            <div style="font-size:13px;opacity:.9;margin-top:2px;">магазин цифровых товаров</div>
            <div style="text-align:right;margin-top:-30px;font-size:14px;">Заказ <strong>#${orderNumber}</strong></div>
          </div>
          <div class="content">
            <h1 style="margin:0 0 12px 0;font-size:22px;text-align:center;">Спасибо за покупку!</h1>
            <div class="product-box">
              <div style="font-size:14px;color:#1a1a1a;margin-bottom:8px;">Товар:</div>
              <div style="font-size:16px;color:#1a1a1a;font-weight:700;">${productName}</div>
              ${productImage ? `<img src="https://truststore.ru/${productImage}" alt="${productName}" style="max-width:120px;max-height:120px;margin-top:16px;display:block;">` : ''}
            </div>
            <div class="telegram-card">
              <div style="font-size:15px;margin:0 0 12px 0;">Для получения товара напишите <a href="https://t.me/truststore_admin" style="color:#fff;font-weight:700;text-decoration:underline;">@truststore_admin</a> в Telegram</div>
              <a href="https://t.me/truststore_admin" class="button">✉️ Написать в Telegram</a>
            </div>
            ${instructions ? `<div style="background:#fff9e6;border:1px solid rgba(255,184,0,0.35);border-radius:12px;padding:16px 18px;margin:0 0 22px 0;">
              <div style="font-size:14px;font-weight:600;margin:0 0 6px 0;color:#B45309;">Инструкции</div>
              <div style="font-size:13px;line-height:1.7;color:#666;">${instructions}</div>
            </div>` : ''}
            <a href="https://truststore.ru" class="button">Перейти в магазин</a>
          </div>
          <div style="padding:20px 28px;border-top:1px solid rgba(0,0,0,0.08);text-align:center;color:#999;font-size:12px;background:#f8f9ff;">
            Есть вопросы? Ответьте на это письмо или напишите через виджет на сайте.<br>© ${new Date().getFullYear()} Trust Store
          </div>
        </div>
      </td>
    </tr>
  </table>
</body>
</html>
    `;
}

function createOrderEmailText(data) {
    return `Спасибо за покупку!

Ваш заказ #${data.orderNumber}

Товар: ${data.productName}

Для получения товара напишите @truststore_admin в Telegram: https://t.me/truststore_admin

© ${new Date().getFullYear()} Trust Store`;
}

async function sendEmail() {
    const emailData = {
        to: TARGET_EMAIL,
        orderNumber: orders.order_id,
        productName: productName,
        productImage: productInfo ? productInfo.image : null,
        instructions: productInfo ? productInfo.description : 'Спасибо за покупку! Инструкции по использованию товара будут отправлены отдельно.'
    };

    // Попытка через SendGrid
    if (process.env.SENDGRID_API_KEY) {
        try {
            console.log('📧 Попытка отправки через SendGrid...');
            const logoPath = path.join(__dirname, 'youtube-avatar.png');
            let attachments = [];
            
            if (require('fs').existsSync(logoPath)) {
                const logoContent = require('fs').readFileSync(logoPath);
                attachments.push({
                    content: logoContent.toString('base64'),
                    filename: 'youtube-avatar.png',
                    type: 'image/png',
                    disposition: 'inline',
                    content_id: 'youtube-avatar'
                });
            }

            const msg = {
                to: emailData.to,
                from: process.env.EMAIL_USER || 'orders@truststore.ru',
                subject: `Ваш заказ #${emailData.orderNumber} | Trust Store`,
                html: createOrderEmailHTML(emailData),
                text: createOrderEmailText(emailData),
                attachments: attachments
            };

            await sgMail.send(msg);
            console.log(`✅ Email отправлен через SendGrid на ${TARGET_EMAIL}`);
            db.close();
            process.exit(0);
        } catch (error) {
            console.error('❌ Ошибка SendGrid:', error.message);
        }
    }

    // Попытка через SMTP
    try {
        console.log('📧 Попытка отправки через SMTP...');
        const mailOptions = {
            from: process.env.EMAIL_FROM || '"Trust Store" <orders@truststore.ru>',
            to: emailData.to,
            replyTo: 'orders@truststore.ru',
            subject: `Ваш заказ #${emailData.orderNumber} | Trust Store`,
            html: createOrderEmailHTML(emailData),
            text: createOrderEmailText(emailData),
            attachments: [
                {
                    filename: 'youtube-avatar.png',
                    path: path.join(__dirname, 'youtube-avatar.png'),
                    cid: 'youtube-avatar'
                }
            ]
        };

        const info = await emailTransporter.sendMail(mailOptions);
        console.log(`✅ Email отправлен через SMTP на ${TARGET_EMAIL} (${info.messageId})`);
    } catch (error) {
        console.error('❌ Ошибка отправки email:', error.message);
        db.close();
        process.exit(1);
    }

    db.close();
}

sendEmail();

