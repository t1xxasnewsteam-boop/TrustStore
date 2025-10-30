require('dotenv').config();
const nodemailer = require('nodemailer');
const path = require('path');

// Статические данные о продуктах (из БД или код)
const productInfo = {
    'ChatGPT Plus': { image: 'gpt-image.png', category: 'AI Генерация', description: 'Доступ к ChatGPT Plus' },
    'Midjourney': { image: 'midjourney-image.png', category: 'AI Генерация', description: 'Подписка Midjourney' },
    'Claude AI Pro': { image: 'claude-image.png', category: 'AI Генерация', description: 'Claude AI Pro' },
    'Cursor AI': { image: 'cursor-image.png', category: 'AI Генерация', description: 'Cursor AI Pro' },
    'Google Gemini': { image: 'gemini-image.png', category: 'AI Генерация', description: 'Google Gemini + Veo 3' },
    'YouTube Premium': { image: 'youtube-image.png', category: 'Видео', description: 'YouTube Premium + Music' },
    'VPN Premium': { image: 'vpn-image.png', category: 'Безопасность', description: 'Личный VPN' },
    'Adobe Creative Cloud': { image: 'adobe-image.png', category: 'Дизайн', description: 'Adobe Creative Cloud All Apps' },
    'CapCut Pro': { image: 'capcut-image.png', category: 'Монтаж', description: 'CapCut Pro' }
};

// Настройка email транспортера (как в server.js)
const emailTransporter = nodemailer.createTransport({
    host: process.env.EMAIL_HOST || 'smtp.yandex.ru',
    port: parseInt(process.env.EMAIL_PORT) || 465,
    secure: true,
    auth: {
        user: process.env.EMAIL_USER || 'orders@truststore.ru',
        pass: process.env.EMAIL_PASSWORD || ''
    },
    tls: {
        rejectUnauthorized: false,
        ciphers: 'SSLv3'
    },
    connectionTimeout: 10000,
    greetingTimeout: 10000,
    socketTimeout: 10000
});

// Копируем функцию создания HTML из server.js
function createOrderEmailHTML(data) {
    const { orderNumber, productName, productImage, productCategory, productDescription } = data;
    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Ваш заказ #${orderNumber}</title>
</head>
<body style="margin:0;padding:0;background:#f5f5f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f5f5f5;padding:32px 12px;">
    <tr>
      <td align="center">
        <table role="presentation" width="640" cellspacing="0" cellpadding="0" style="background:#ffffff;border-radius:16px;overflow:hidden;border:1px solid rgba(0,0,0,0.08);box-shadow:0 4px 24px rgba(0,0,0,0.1);">
          <tr>
            <td style="padding:28px 32px;background:linear-gradient(135deg,#667eea 0%,#764ba2 100%);">
              <table width="100%" cellspacing="0" cellpadding="0">
                <tr>
                  <td align="left" style="vertical-align:middle;">
                    <table cellspacing="0" cellpadding="0">
                      <tr>
                        <td style="padding-right:16px;vertical-align:middle;">
                          <img src="cid:youtube-avatar" alt="Trust Store" style="display:block;max-width:60px;height:60px;border-radius:50%;border:3px solid rgba(255,255,255,0.2);">
                        </td>
                        <td style="vertical-align:middle;">
                          <div style="color:#fff;font-size:24px;font-weight:700;letter-spacing:-0.5px;margin:0;">Trust Store</div>
                          <div style="color:rgba(255,255,255,0.85);font-size:13px;margin-top:2px;">магазин цифровых товаров</div>
                        </td>
                      </tr>
                    </table>
                  </td>
                  <td align="right" style="color:#fff;font-size:14px;opacity:.9;white-space:nowrap;vertical-align:middle;">Заказ <strong style="font-weight:700;">#${orderNumber}</strong></td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding:32px;color:#1a1a1a;">
              <h1 style="margin:0 0 12px 0;font-size:22px;line-height:1.3;color:#1a1a1a;text-align:center;">Спасибо за покупку!</h1>
              <p style="margin:0 0 24px 0;font-size:14px;color:#666;text-align:center;">Ниже — данные для доступа и краткая информация по заказу.</p>
              <div style="background:#f8f9ff;border:1px solid rgba(102,126,234,0.15);border-radius:12px;padding:20px 24px;margin:0 0 24px 0;">
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                  <tr>
                    <td style="font-size:14px;color:#1a1a1a;width:100px;vertical-align:middle;">Товар:</td>
                    <td style="font-size:16px;color:#1a1a1a;font-weight:700;vertical-align:middle;">
                      ${productImage ? `<img src="cid:product-image" alt="${productName}" style="max-width:40px;max-height:40px;width:auto;height:auto;object-fit:contain;vertical-align:middle;margin-right:10px;display:inline-block;">` : ''}
                      ${productName}
                    </td>
                    ${productImage ? `<td style="text-align:right;vertical-align:middle;width:100px;">
                      <img src="cid:product-image-large" alt="${productName}" style="max-width:100px;max-height:100px;width:auto;height:auto;object-fit:contain;display:block;margin-left:auto;">
                    </td>` : ''}
                  </tr>
                </table>
              </div>
              <div style="margin:18px 0 22px 0;">
                <div style="background:linear-gradient(135deg, #667eea 0%, #764ba2 100%);border-radius:12px;padding:24px;text-align:center;box-shadow:0 4px 12px rgba(102,126,234,0.2);">
                  <div style="font-size:15px;color:#ffffff;margin:0 0 12px 0;line-height:1.6;">
                    Для получения товара напишите 
                    <a href="https://t.me/truststore_admin" style="color:#ffffff;font-weight:700;text-decoration:underline;text-decoration-thickness:2px;text-underline-offset:3px;">@truststore_admin</a> 
                    в Telegram
                  </div>
                  <table role="presentation" cellspacing="0" cellpadding="0" style="margin:16px auto 0;">
                    <tr>
                      <td style="background:#ffffff;padding:12px 24px;border-radius:8px;">
                        <a href="https://t.me/truststore_admin" style="font-size:15px;color:#667eea;text-decoration:none;font-weight:700;display:inline-block;">
                          ✉️ Написать в Telegram
                        </a>
                      </td>
                    </tr>
                  </table>
                </div>
              </div>
              <table role="presentation" cellspacing="0" cellpadding="0" style="margin-top:4px;">
                <tr>
                  <td style="background:#667eea;padding:12px 22px;border-radius:10px;">
                    <a href="https://truststore.ru" style="font-size:14px;color:#fff;text-decoration:none;display:inline-block;">Перейти в магазин</a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding:20px 28px;border-top:1px solid rgba(0,0,0,0.08);text-align:center;color:#999;font-size:12px;background:#f8f9ff;">
              Есть вопросы? Ответьте на это письмо или напишите через виджет на сайте.<br>© ${new Date().getFullYear()} Trust Store
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
    `;
}

// Функция создания текстовой версии
function createOrderEmailText(data) {
    const { orderNumber, productName } = data;
    return `
Спасибо за покупку!

Ваш заказ #${orderNumber}

Товар: ${productName}

Для получения товара напишите @truststore_admin в Telegram: https://t.me/truststore_admin

Если у вас есть вопросы, ответьте на это письмо или напишите через виджет на сайте.

© ${new Date().getFullYear()} Trust Store
`;
}

// Функция отправки письма
async function sendOrderEmail(data) {
    try {
        // Определяем базовое название товара (убираем тариф из скобок)
        const baseProductName = data.productName.split(' (')[0];
        const product = productInfo[baseProductName] || { image: null, category: null, description: null };
        
        const mailOptions = {
            from: process.env.EMAIL_FROM || '"Trust Store" <orders@truststore.ru>',
            to: data.to,
            replyTo: 'orders@truststore.ru',
            subject: `Ваш заказ #${data.orderNumber} | Trust Store`,
            html: createOrderEmailHTML({
                ...data,
                productImage: product.image || null,
                productCategory: product.category || null,
                productDescription: product.description || null
            }),
            text: createOrderEmailText(data),
            headers: {
                'X-Mailer': 'Trust Store',
                'List-Unsubscribe': '<https://truststore.ru/unsubscribe>',
                'X-Priority': '3',
                'X-MSMail-Priority': 'Normal'
            },
            attachments: [
                {
                    filename: 'youtube-avatar.png',
                    path: path.join(__dirname, 'youtube-avatar.png'),
                    cid: 'youtube-avatar'
                }
            ]
        };
        
        // Добавляем изображение товара, если есть
        if (product && product.image) {
            const imagePath = path.join(__dirname, product.image);
            try {
                const fs = require('fs');
                if (fs.existsSync(imagePath)) {
                    mailOptions.attachments.push({
                        filename: product.image,
                        path: imagePath,
                        cid: 'product-image'
                    });
                    mailOptions.attachments.push({
                        filename: product.image,
                        path: imagePath,
                        cid: 'product-image-large'
                    });
                }
            } catch (e) {
                console.log(`⚠️ Изображение не найдено: ${product.image}`);
            }
        }
        
        const info = await emailTransporter.sendMail(mailOptions);
        return { success: true, messageId: info.messageId };
    } catch (error) {
        return { success: false, error: error.message };
    }
}

// Все 32 комбинации товар+тариф
const allProducts = [
    { name: 'ChatGPT Plus', tariffs: ['1 месяц', '3 месяца', '6 месяцев', '12 месяцев'] },
    { name: 'Midjourney', tariffs: ['Standard Plan', 'Pro Plan'] },
    { name: 'Claude AI Pro', tariffs: ['1 месяц', '3 месяца', '6 месяцев', '12 месяцев'] },
    { name: 'Cursor AI', tariffs: ['1 месяц', '3 месяца', '6 месяцев', '12 месяцев'] },
    { name: 'Google Gemini', tariffs: ['1 месяц', '12 месяцев'] },
    { name: 'YouTube Premium', tariffs: ['1 месяц', '3 месяца', '6 месяцев', '12 месяцев'] },
    { name: 'VPN Premium', tariffs: ['1 месяц', '3 месяца', '12 месяцев', 'Навсегда'] },
    { name: 'Adobe Creative Cloud', tariffs: ['1 месяц', '3 месяца', '6 месяцев', '12 месяцев'] },
    { name: 'CapCut Pro', tariffs: ['1 месяц', '3 месяца', '6 месяцев', '12 месяцев'] }
];

console.log('📧 Отправка всех 32 писем о покупке...\n');
console.log('='.repeat(60));

const targetEmail = 'tichonmarts@gmail.com';
let sentCount = 0;
let failedCount = 0;

// Асинхронная функция для отправки всех писем
(async () => {
    // Отправляем все письма
    for (const product of allProducts) {
        for (const tariff of product.tariffs) {
            const orderNumber = `TEST-${Date.now()}-${sentCount + 1}`;
            const fullProductName = `${product.name} (${tariff})`;
            
            console.log(`📤 [${sentCount + 1}/32] Отправка: ${fullProductName}...`);
            
            const result = await sendOrderEmail({
                to: targetEmail,
                orderNumber: orderNumber,
                productName: fullProductName
            });
            
            if (result.success) {
                console.log(`   ✅ Успешно отправлено (ID: ${result.messageId?.substring(0, 20) || 'N/A'}...)`);
                sentCount++;
            } else {
                console.log(`   ❌ Ошибка: ${result.error}`);
                failedCount++;
            }
            
        // Увеличенная задержка между отправками (чтобы не попасть в спам)
        await new Promise(resolve => setTimeout(resolve, 3000));
        }
    }
    
    console.log('\n' + '='.repeat(60));
    console.log(`✅ Успешно отправлено: ${sentCount}/32`);
    console.log(`❌ Ошибок: ${failedCount}/32`);
    console.log(`📧 Получатель: ${targetEmail}`);
})();

