require('dotenv').config();
const Database = require('better-sqlite3');
const db = new Database('analytics.db');

// Получаем функцию sendOrderEmail из server.js
const fs = require('fs');
const serverCode = fs.readFileSync('server.js', 'utf8');

// Загружаем зависимости
const sgMail = require('@sendgrid/mail');
const nodemailer = require('nodemailer');
const path = require('path');

// Настраиваем email транспортер (как в server.js)
const emailTransporter = nodemailer.createTransport({
    host: process.env.EMAIL_HOST || 'smtp.yandex.ru',
    port: parseInt(process.env.EMAIL_PORT) || 465,
    secure: process.env.EMAIL_SECURE === 'true' || true,
    auth: {
        user: process.env.EMAIL_USER || 'orders@truststore.ru',
        pass: process.env.EMAIL_PASSWORD
    }
});

if (process.env.SENDGRID_API_KEY) {
    sgMail.setApiKey(process.env.SENDGRID_API_KEY);
}

// Функция создания HTML письма (скопирована из server.js)
function createOrderEmailHTML(data) {
    const { orderNumber, productName, productImage, productCategory, productDescription, login, password, instructions } = data;
    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Ваш заказ #${orderNumber}</title>
  <style>
    @media only screen and (max-width: 600px) {
      .email-container { width: 100% !important; max-width: 100% !important; }
      .email-padding { padding: 20px 16px !important; }
      .header-padding { padding: 20px 16px !important; }
      .header-table { width: 100% !important; }
      .header-table tr { display: block !important; width: 100% !important; }
      .header-left { display: block !important; width: 100% !important; margin-bottom: 16px !important; padding-right: 0 !important; }
      .header-right { display: block !important; width: 100% !important; text-align: left !important; padding-left: 0 !important; padding-top: 12px !important; border-top: 1px solid rgba(255,255,255,0.2) !important; font-size: 13px !important; }
      .product-table { width: 100% !important; }
      .product-table tr { display: flex !important; flex-direction: column !important; width: 100% !important; }
      .product-label { display: block !important; width: 100% !important; margin-bottom: 8px !important; font-weight: 600 !important; }
      .product-name { display: block !important; width: 100% !important; padding-right: 0 !important; margin-bottom: 16px !important; font-size: 17px !important; }
      .product-image { display: block !important; width: 100% !important; text-align: center !important; margin-top: 0 !important; margin-bottom: 16px !important; padding-top: 12px !important; border-top: 1px solid rgba(102,126,234,0.15) !important; }
      .product-image img { margin: 0 auto !important; max-width: 120px !important; max-height: 120px !important; }
      .telegram-card { padding: 20px 16px !important; }
      .telegram-text { font-size: 14px !important; line-height: 1.5 !important; }
      .button-cell { padding: 10px 18px !important; }
      .button-text { font-size: 13px !important; }
      h1 { font-size: 20px !important; }
      .product-info-box { padding: 16px 18px !important; }
    }
  </style>
</head>
<body style="margin:0;padding:0;background:#f5f5f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f5f5f5;padding:32px 12px;">
    <tr>
      <td align="center">
        <table role="presentation" width="640" cellspacing="0" cellpadding="0" class="email-container" style="background:#ffffff;border-radius:16px;overflow:hidden;border:1px solid rgba(0,0,0,0.08);box-shadow:0 4px 24px rgba(0,0,0,0.1);max-width:100%;">
          <tr>
            <td class="header-padding" style="padding:28px 32px;background:linear-gradient(135deg,#667eea 0%,#764ba2 100%);">
              <table width="100%" cellspacing="0" cellpadding="0" class="header-table">
                <tr>
                  <td class="header-left" align="left" style="vertical-align:middle;">
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
                  <td class="header-right" align="right" style="color:#fff;font-size:14px;opacity:.9;white-space:nowrap;vertical-align:middle;padding-left:20px;">Заказ <strong style="font-weight:700;">#${orderNumber}</strong></td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td class="email-padding" style="padding:32px;color:#1a1a1a;">
              <h1 style="margin:0 0 12px 0;font-size:22px;line-height:1.3;color:#1a1a1a;text-align:center;">Спасибо за покупку!</h1>
              <p style="margin:0 0 24px 0;font-size:14px;color:#666;text-align:center;">Ниже — данные для доступа и краткая информация по заказу.</p>
              <div class="product-info-box" style="background:#f8f9ff;border:1px solid rgba(102,126,234,0.15);border-radius:12px;padding:20px 24px;margin:0 0 24px 0;">
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" class="product-table" style="table-layout:fixed;">
                  <tr>
                    <td class="product-label" style="font-size:14px;color:#1a1a1a;width:80px;vertical-align:middle;white-space:nowrap;">Товар:</td>
                    <td class="product-name" style="font-size:16px;color:#1a1a1a;font-weight:700;vertical-align:middle;word-wrap:break-word;word-break:break-word;padding-right:16px;">
                      ${productName}
                    </td>
                  </tr>
                  ${productImage ? `<tr>
                    <td class="product-image" colspan="2" style="text-align:center;vertical-align:middle;width:100%;padding-top:16px;border-top:1px solid rgba(102,126,234,0.15);margin-top:16px;">
                      <img src="https://truststore.ru/${productImage}" alt="${productName}" style="max-width:120px;max-height:120px;width:auto;height:auto;object-fit:contain;display:block;margin:0 auto;">
                    </td>
                  </tr>` : ''}
                </table>
              </div>
              <div style="margin:18px 0 22px 0;">
                <div class="telegram-card" style="background:linear-gradient(135deg, #667eea 0%, #764ba2 100%);border-radius:12px;padding:24px;text-align:center;box-shadow:0 4px 12px rgba(102,126,234,0.2);">
                  <div class="telegram-text" style="font-size:15px;color:#ffffff;margin:0 0 12px 0;line-height:1.6;">
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
              ${instructions ? `
              <div style="background:#fff9e6;border:1px solid rgba(255,184,0,0.35);border-radius:12px;padding:16px 18px;margin:0 0 22px 0;">
                <div style="font-size:14px;font-weight:600;margin:0 0 6px 0;color:#B45309;">Инструкции</div>
                <div style="font-size:13px;line-height:1.7;color:#666;">${instructions}</div>
              </div>` : ''}
              <table role="presentation" cellspacing="0" cellpadding="0" style="margin-top:4px;">
                <tr>
                  <td class="button-cell" style="background:#667eea;padding:12px 22px;border-radius:10px;">
                    <a href="https://truststore.ru" class="button-text" style="font-size:14px;color:#fff;text-decoration:none;display:inline-block;">Перейти в магазин</a>
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

async function sendOrderEmail(data) {
    // Попытка отправить через SendGrid (если настроен)
    if (process.env.SENDGRID_API_KEY) {
        try {
            const msg = {
                to: data.to,
                from: process.env.EMAIL_USER || 'orders@truststore.ru',
                subject: `Ваш заказ #${data.orderNumber} | Trust Store`,
                html: createOrderEmailHTML(data),
                text: createOrderEmailText(data),
                headers: {
                    'X-Mailer': 'Trust Store',
                    'List-Unsubscribe': '<https://truststore.ru/unsubscribe>'
                }
            };
            
            const response = await sgMail.send(msg);
            console.log(`✅ Письмо отправлено через SendGrid: ${data.to}`);
            return { success: true, messageId: response[0].headers['x-message-id'], method: 'SendGrid' };
        } catch (error) {
            console.error('❌ Ошибка SendGrid:', error.message);
        }
    }
    
    // Попытка отправить через SMTP
    try {
        const mailOptions = {
            from: process.env.EMAIL_FROM || '"Trust Store" <orders@truststore.ru>',
            to: data.to,
            replyTo: 'orders@truststore.ru',
            subject: `Ваш заказ #${data.orderNumber} | Trust Store`,
            html: createOrderEmailHTML(data),
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

        const info = await emailTransporter.sendMail(mailOptions);
        console.log(`✅ Письмо отправлено через SMTP: ${data.to} (${info.messageId})`);
        return { success: true, messageId: info.messageId, method: 'SMTP' };
    } catch (error) {
        console.error('❌ Ошибка отправки письма (SMTP):', error.message);
        return { success: false, error: error.message };
    }
}

// Отправляем тестовое письмо
(async () => {
    try {
        const orderNumber = 'ORD-TEST-' + Date.now();
        const result = await sendOrderEmail({
            to: 'tichonmarts@gmail.com',
            orderNumber: orderNumber,
            productName: 'VPN на 1 месяц',
            productImage: 'vpn-image.png',
            productCategory: null,
            productDescription: 'Персональный VPN на 1 месяц с неограниченным трафиком',
            login: null,
            password: null,
            instructions: 'Спасибо за покупку! Для получения доступа к VPN напишите @truststore_admin в Telegram.'
        });
        
        console.log('\n✅ Тестовое письмо отправлено:', result);
        process.exit(0);
    } catch (error) {
        console.error('❌ Ошибка:', error);
        process.exit(1);
    }
})();

