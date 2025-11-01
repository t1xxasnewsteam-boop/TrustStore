# 📧 Email Шаблоны Trust Store

## 🎨 Доступные шаблоны:

### 1. **Письмо с заказом** (Order Email)
Отправляется клиенту после успешной оплаты заказа.

**Содержит:**
- Логотип магазина
- Номер заказа
- Название товара
- Логин и пароль для входа
- Инструкции по использованию
- Ссылка на сайт

### 2. **Рассылка новостей** (Newsletter Email)
Отправляется всем подписчикам при добавлении новой новости.

**Содержит:**
- Логотип магазина
- Заголовок новости
- Текст новости
- Кнопка "Читать на сайте"
- Кнопка отписки

---

## 🚀 Использование:

### Отправка заказа:
```javascript
await sendOrderEmail({
    to: 'client@gmail.com',
    orderNumber: '12345',
    productName: 'ChatGPT Plus 1 месяц',
    login: 'user@example.com',
    password: 'password123',
    instructions: 'Зайдите на chat.openai.com и введите данные'
});
```

### Рассылка новости:
```javascript
await sendNewsletterEmail({
    to: 'subscriber@gmail.com',
    title: 'Новая функция в магазине',
    content: 'Мы добавили новую функцию...',
    link: 'https://truststore.ru/news/123'
});
```

---

## 📝 API Endpoints:

### POST /api/admin/send-order-email
Отправка письма с заказом (админ).

**Body:**
```json
{
    "to": "client@gmail.com",
    "orderNumber": "12345",
    "productName": "ChatGPT Plus",
    "login": "user@example.com",
    "password": "password123"
}
```

### POST /api/admin/send-newsletter
Массовая рассылка новости подписчикам (админ).

**Body:**
```json
{
    "newsId": 1
}
```

---

## 🎨 Дизайн:

- **Цвета:** Фиолетовый градиент (как на сайте)
- **Логотип:** logo.png
- **Адаптивный:** Работает на мобильных
- **Кнопки:** Красивые с hover эффектами

---

**Документация:** См. функции в server.js начиная со строки ~2000

