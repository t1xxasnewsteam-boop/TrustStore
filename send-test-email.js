require('dotenv').config();
const nodemailer = require('nodemailer');
const path = require('path');

// Настройка email транспортера
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

// HTML шаблон (из server.js с исправлениями)
function createOrderEmailHTML(data) {
    const { orderNumber, productName, productImage } = data;
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
              <table width="100%" cellspacing="0" cellpadding="0" style="table-layout:fixed;">
                <tr>
                  <td align="left" style="vertical-align:middle;width:auto;">
                    <table cellspacing="0" cellpadding="0" style="display:inline-table;">
                      <tr>
                        <td style="padding-right:16px;vertical-align:middle;">
                          <img src="cid:youtube-avatar" alt="Trust Store" style="display:block;max-width:60px;height:60px;border-radius:50%;border:3px solid rgba(255,255,255,0.2);">
                        </td>
                        <td style="vertical-align:middle;white-space:nowrap;">
                          <span style="color:#fff;font-size:24px;font-weight:700;letter-spacing:-0.5px;margin:0;display:inline-block;">Trust Store</span>
                          <span style="color:rgba(255,255,255,0.85);font-size:13px;margin-left:12px;display:inline-block;">магазин цифровых товаров</span>
                        </td>
                      </tr>
                    </table>
                  </td>
                  <td align="right" style="color:#fff;font-size:14px;opacity:.9;white-space:nowrap;vertical-align:middle;width:auto;">Заказ <strong style="font-weight:700;">#${orderNumber}</strong></td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding:32px;color:#1a1a1a;">
              <h1 style="margin:0 0 12px 0;font-size:22px;line-height:1.3;color:#1a1a1a;text-align:center;">Спасибо за покупку!</h1>
              <p style="margin:0 0 24px 0;font-size:14px;color:#666;text-align:center;">Ниже — данные для доступа и краткая информация по заказу.</p>
              <div style="background:#f8f9ff;border:1px solid rgba(102,126,234,0.15);border-radius:12px;padding:20px 24px;margin:0 0 24px 0;">
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="table-layout:fixed;">
                  <tr>
                    <td style="font-size:14px;color:#1a1a1a;width:80px;vertical-align:middle;white-space:nowrap;">Товар:</td>
                    <td style="font-size:16px;color:#1a1a1a;font-weight:700;vertical-align:middle;word-wrap:break-word;word-break:break-word;padding-right:16px;">
                      ${productName}
                    </td>
                    ${productImage ? `<td style="text-align:right;vertical-align:middle;width:120px;white-space:nowrap;">
                      <img src="https://truststore.ru/${productImage}" alt="${productName}" style="max-width:100px;max-height:100px;width:auto;height:auto;object-fit:contain;display:block;margin-left:auto;">
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

// Функция отправки
async function sendTestEmail() {
    try {
        const mailOptions = {
            from: process.env.EMAIL_FROM || '"Trust Store" <orders@truststore.ru>',
            to: 'tichonmarts@gmail.com',
            replyTo: 'orders@truststore.ru',
            subject: `Ваш заказ #TEST-${Date.now()} | Trust Store`,
            html: createOrderEmailHTML({
                orderNumber: `TEST-${Date.now()}`,
                productName: 'YouTube Premium (3 месяца)',
                productImage: 'youtube-image.png'
            }),
            text: `Спасибо за покупку!\n\nВаш заказ #TEST-${Date.now()}\n\nТовар: YouTube Premium (3 месяца)\n\nДля получения товара напишите @truststore_admin в Telegram: https://t.me/truststore_admin`,
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
        console.log(`✅ Тестовое письмо отправлено! (${info.messageId})`);
        return { success: true, messageId: info.messageId };
    } catch (error) {
        console.error('❌ Ошибка:', error.message);
        return { success: false, error: error.message };
    }
}

sendTestEmail();

