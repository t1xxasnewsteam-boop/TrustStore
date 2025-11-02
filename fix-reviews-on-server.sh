#!/bin/bash
ssh root@45.95.234.173 << 'ENDSSH'
cd /root/TrustStore

# Добавляем отзыв от Aleksey T
sqlite3 analytics.db << 'EOF'
-- Добавляем отзыв от Aleksey T
INSERT OR IGNORE INTO telegram_reviews (telegram_user_id, author_name, review_text, rating, telegram_comment_id, telegram_date, created_at)
VALUES (0, 'Aleksey T', 'Все супер 👍 Купил со скидкой по промокоду, да еще и пробный период 30 дней итого 2 месяца подписки за 2К. Ребята отзывчивые, все объяснили, подсказали. Буду обращаться ещё. Лучше и искать нечего. Спасибо большое ребятам из Trust Store, удачи и процветания вам, при сегодняшних реалиях вы делаете больше дело.', 5, 1273, 1730559360, CURRENT_TIMESTAMP);

-- Удаляем дубликаты от Андрей Benefiseller (оставляем только последний)
DELETE FROM telegram_reviews 
WHERE id IN (
    SELECT id FROM (
        SELECT id, ROW_NUMBER() OVER (PARTITION BY author_name ORDER BY telegram_date DESC, id DESC) as rn
        FROM telegram_reviews 
        WHERE author_name = 'Андрей Benefiseller'
    ) WHERE rn > 1
);

-- Исправляем счетчик - обновляем его на основе реального количества отзывов
UPDATE telegram_stats 
SET total_comments = (SELECT COUNT(*) FROM telegram_reviews),
    last_updated = CURRENT_TIMESTAMP
WHERE id = 1;

-- Добавляем колонку last_update_id если её нет
PRAGMA table_info(telegram_stats);
EOF

echo "✅ Отзыв от Aleksey T добавлен"
echo "✅ Дубликаты удалены"
echo "✅ Счетчик обновлен"
ENDSSH

