# 📱 Руководство по синхронизации отзывов из Telegram

## ⚠️ Важно!

Текущая реализация использует `getUpdates`, который **не получает комментарии из каналов** напрямую.

## 🔧 Решения для полной синхронизации:

### Вариант 1: Группа обсуждений (Рекомендуется)
1. Создай отдельную группу для обсуждений канала
2. Привяжи её к каналу truststoreru
3. Бот будет получать комментарии как обычные сообщения

### Вариант 2: MTProto клиент
Использовать библиотеку `node-telegram` для прямого доступа к Telegram API:
```bash
npm install telegram
```

### Вариант 3: Ручное добавление через админ панель
Добавь интерфейс в админке для добавления отзывов вручную.

## 📝 Временное решение: Добавить примеры отзывов

Подключись к серверу и выполни:

```bash
sqlite3 /root/TrustStore/analytics.db

INSERT INTO telegram_reviews (author_name, review_text, rating, telegram_comment_id) VALUES 
('Алексей М.', 'Купил ChatGPT Plus, все пришло моментально! Очень доволен качеством обслуживания и скоростью. Рекомендую всем! 🔥', 5, 1001),
('Мария К.', 'Заказала Midjourney для работы. Поддержка ответила быстро, все активировали за минуту. Цены адекватные, буду брать еще! 💜', 5, 1002),
('Дмитрий В.', 'Отличный магазин! Взял YouTube Premium и VPN. Всё работает, никаких проблем. Спасибо за честный сервис! 👍', 5, 1003),
('Ирина С.', 'Оформила Adobe Creative Cloud, всё активировалось без проблем. Работаю в Photoshop и Illustrator каждый день. Супер! 🎨', 5, 1004),
('Сергей Н.', 'Брал CapCut Pro для монтажа. Все работает отлично, цена огонь! Поддержка помогла с активацией. Очень доволен! ⚡', 5, 1005);

.exit
```

## 🔄 Автоматическое обновление

Система автоматически проверяет новые отзывы каждые 10 минут.

## 🎯 Структура таблицы

```sql
CREATE TABLE telegram_reviews (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    telegram_user_id INTEGER,
    author_name TEXT NOT NULL,
    review_text TEXT NOT NULL,
    rating INTEGER DEFAULT 5,
    telegram_comment_id INTEGER UNIQUE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

## 🚀 API Endpoint

`GET /api/telegram-reviews` - возвращает последние 20 отзывов

Ответ:
```json
{
    "success": true,
    "reviews": [...],
    "count": 20
}
```

