# 🔧 Исправление проблемы: заказ не выдан после оплаты

## 🔍 Диагностика проблемы

### 1. Проверка последнего заказа

#### Вариант А: Локальный сервер
```bash
# Если сервер запущен локально
node check-last-order.js

# Или через API (если сервер работает)
curl http://localhost:3000/api/manual-send-last-order
```

#### Вариант Б: Удаленный сервер (45.95.234.173)
```bash
# Подключись к серверу и проверь последний заказ
ssh root@45.95.234.173
cd /root/TrustStore
sqlite3 analytics.db "SELECT order_id, customer_email, status, payment_method, total_amount, created_at FROM orders ORDER BY created_at DESC LIMIT 5;"
```

### 2. Проверка логов webhook

Посмотри логи сервера на предмет ошибок обработки платежей:
```bash
# На удаленном сервере
pm2 logs trust-store --lines 100 | grep -E "webhook|payment|yoomoney|heleket|email|❌"
```

## 🚨 Возможные причины проблемы

### 1. Webhook не пришел от платежной системы
- **Симптомы**: Заказ имеет статус `pending` или не обработан
- **Решение**: Проверь настройки webhook в YooMoney/Heleket

### 2. Webhook пришел, но была ошибка отправки email
- **Симптомы**: Заказ имеет статус `paid`, но email не отправлен
- **Решение**: Проверь настройки SMTP/SendGrid в `.env`

### 3. Ошибка в коде обработки
- **Симптомы**: Ошибки в логах при обработке webhook
- **Решение**: Проверь логи и исправь ошибку

## ✅ Ручная отправка заказа

### Способ 1: Через API (рекомендуется)

#### Локально:
```bash
node manual-send-order.js [orderId]
# или для последнего заказа:
node manual-send-order.js
```

#### На удаленном сервере:
```bash
# Подключись к серверу
ssh root@45.95.234.173

# Выполни запрос через API
curl -X POST https://truststore.ru/api/manual-send-last-order \
  -H "Content-Type: application/json" \
  -d '{"orderId": "ORD-XXXX"}'

# Или для последнего заказа:
curl -X POST https://truststore.ru/api/manual-send-last-order
```

### Способ 2: Через скрипт на сервере

```bash
ssh root@45.95.234.173
cd /root/TrustStore

# Найди order_id последнего заказа
sqlite3 analytics.db "SELECT order_id FROM orders WHERE status='paid' ORDER BY created_at DESC LIMIT 1;"

# Отправь заказ
node send-specific-order.js [ORDER_ID]
```

### Способ 3: Через админ-панель

1. Открой `https://truststore.ru/admin.html`
2. Перейди в раздел "Заказы"
3. Найди заказ и нажми "Отправить вручную" (если есть такая кнопка)

## 🔍 Проверка настроек email

### Проверь `.env` файл на сервере:
```bash
ssh root@45.95.234.173
cd /root/TrustStore
cat .env | grep EMAIL
```

Должны быть настроены:
- `EMAIL_HOST` - smtp сервер
- `EMAIL_USER` - email адрес
- `EMAIL_PASSWORD` - пароль
- `EMAIL_FROM` - от кого отправлять
- `SENDGRID_API_KEY` (опционально) - для SendGrid

### Тест отправки email:
```bash
# На сервере
node send-test-email.js
```

## 📋 Чек-лист исправления

- [ ] Проверил статус последнего заказа (должен быть `paid`)
- [ ] Проверил логи webhook на ошибки
- [ ] Проверил настройки email (SMTP/SendGrid)
- [ ] Попробовал вручную отправить заказ через API
- [ ] Проверил, что email клиента корректный
- [ ] Проверил, что товары в заказе существуют в БД

## 🔄 Автоматическое исправление

Если проблема повторяется, возможно нужно:

1. **Проверить webhook URL** в настройках платежной системы:
   - YooMoney: `https://truststore.ru/api/payment/yoomoney`
   - Heleket: `https://truststore.ru/api/payment/heleket`

2. **Проверить доступность webhook** с внешних серверов:
   ```bash
   curl -X POST https://truststore.ru/api/payment/yoomoney \
     -H "Content-Type: application/json" \
     -d '{"test": "test"}'
   ```

3. **Проверить логи сервера** на предмет 500 ошибок:
   ```bash
   pm2 logs trust-store --err --lines 50
   ```

## 💡 Быстрое решение

Если нужно срочно отправить заказ:

```bash
# 1. Найди order_id последнего оплаченного заказа
# 2. Выполни:
curl -X POST https://truststore.ru/api/manual-send-last-order \
  -H "Content-Type: application/json" \
  -d "{\"orderId\": \"ORD-XXXX\"}"
```

Или используй скрипт:
```bash
SERVER_URL=https://truststore.ru node manual-send-order.js [ORDER_ID]
```

## 📞 Если ничего не помогло

1. Проверь логи PM2 на сервере: `pm2 logs trust-store --lines 200`
2. Проверь доступность сервера: `curl https://truststore.ru/api/health`
3. Проверь базу данных на наличие заказа
4. Проверь настройки email и протестируй отправку

---

**Дата создания:** $(date)
**Версия:** 1.0

