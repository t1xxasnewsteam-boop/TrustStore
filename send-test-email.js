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
  <style>
    @media only screen and (max-width: 600px) {
      .email-container { width: 100% !important; max-width: 100% !important; }
      .email-padding { padding: 20px 16px !important; }
      .header-padding { padding: 20px 16px !important; }
      .header-table tr { display: block !important; }
      .header-left { display: block !important; width: 100% !important; margin-bottom: 12px !important; }
      .header-right { display: block !important; width: 100% !important; text-align: left !important; padding-left: 0 !important; padding-top: 8px !important; }
      .product-table tr { display: block !important; }
      .product-label { display: block !important; width: 100% !important; margin-bottom: 8px !important; }
      .product-name { display: block !important; width: 100% !important; padding-right: 0 !important; margin-bottom: 12px !important; }
      .product-image { display: block !important; width: 100% !important; text-align: center !important; margin-top: 12px !important; }
      .product-image img { margin: 0 auto !important; }
      .telegram-card { padding: 20px 16px !important; }
      .telegram-text { font-size: 14px !important; line-height: 1.5 !important; }
      .button-cell { padding: 10px 18px !important; }
      .button-text { font-size: 13px !important; }
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
              <div style="background:#f8f9ff;border:1px solid rgba(102,126,234,0.15);border-radius:12px;padding:20px 24px;margin:0 0 24px 0;">
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" class="product-table" style="table-layout:fixed;">
                  <tr>
                    <td class="product-label" style="font-size:14px;color:#1a1a1a;width:80px;vertical-align:middle;white-space:nowrap;">Товар:</td>
                    <td class="product-name" style="font-size:16px;color:#1a1a1a;font-weight:700;vertical-align:middle;word-wrap:break-word;word-break:break-word;padding-right:16px;">
                      ${productName}
                    </td>
                    ${productImage ? `<td class="product-image" style="text-align:right;vertical-align:middle;width:120px;white-space:nowrap;">
                      <img src="https://truststore.ru/${productImage}" alt="${productName}" style="max-width:100px;max-height:100px;width:auto;height:auto;object-fit:contain;display:block;margin-left:auto;">
                    </td>` : ''}
                  </tr>
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

