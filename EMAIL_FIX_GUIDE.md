# 🔧 Проблема с SMTP и решение

## ❌ Проблема
Провайдер сервера **БЛОКИРУЕТ порты 465 и 587** (SMTP).

Проверено через:
```bash
nc -vz smtp.yandex.ru 465  # timeout
nc -vz smtp.yandex.ru 587  # timeout
```

---

## ✅ РЕШЕНИЕ 1: Разблокировать порты у провайдера (ЛУЧШЕЕ)

### Напиши в поддержку хостинга:
```
Добрый день!

Прошу разблокировать исходящие подключения на порты 465 и 587 
для SMTP-отправки писем с сервера 45.95.234.173

Для работы с smtp.yandex.ru (Яндекс 360)

Спасибо!
```

**После разблокировки:**
```bash
pm2 restart trust-store
```

И все заработает! ✅

---

## ✅ РЕШЕНИЕ 2: SendGrid HTTP API (ОБХОДНОЙ ПУТЬ)

Если провайдер не разблокирует порты, используем SendGrid (работает через HTTPS - порт 443).

### Установка:
```bash
npm install @sendgrid/mail
```

### Настройка в `.env`:
```env
SENDGRID_API_KEY=твой_ключ_от_sendgrid
```

### Код в `server.js`:
```javascript
const sgMail = require('@sendgrid/mail');
sgMail.setApiKey(process.env.SENDGRID_API_KEY);

async function sendEmailViaSendGrid(data) {
    const msg = {
        to: data.to,
        from: 'orders@truststore.ru',
        subject: `✅ Ваш заказ #${data.orderNumber}`,
        html: createOrderEmailHTML(data)
    };
    
    await sgMail.send(msg);
}
```

---

## ✅ РЕШЕНИЕ 3: Mail.ru Cloud SMTP

Mail.ru НЕ блокирует подключения с серверов.

### Настройки:
```env
EMAIL_HOST=smtp.mail.ru
EMAIL_PORT=465
EMAIL_SECURE=true
EMAIL_USER=твой@mail.ru
EMAIL_PASSWORD=пароль_приложения
```

---

## 🎯 Рекомендация:

1. **Сначала:** Напиши в поддержку хостинга - они разблокируют за 30 минут
2. **Если отказали:** Используй SendGrid (100 писем/день бесплатно)
3. **Альтернатива:** Mail.ru SMTP (работает с VPS)

---

**Текущий статус:** Ждем разблокировки портов от провайдера.

