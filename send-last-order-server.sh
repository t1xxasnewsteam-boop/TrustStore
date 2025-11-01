#!/bin/bash
# Скрипт для отправки последнего заказа на сервере

echo "🔍 Поиск последнего оплаченного заказа..."
cd /root/TrustStore || exit 1

# Находим последний оплаченный заказ
ORDER_ID=$(sqlite3 analytics.db "SELECT order_id FROM orders WHERE status='paid' ORDER BY created_at DESC LIMIT 1;" 2>/dev/null)

if [ -z "$ORDER_ID" ]; then
    echo "❌ Не найден оплаченный заказ"
    exit 1
fi

echo "✅ Найден заказ: $ORDER_ID"
echo ""
echo "📤 Отправка заказа через API..."

# Отправляем через API
curl -X POST http://localhost:3000/api/manual-send-last-order \
  -H "Content-Type: application/json" \
  -d "{\"orderId\": \"$ORDER_ID\"}" \
  -s | python3 -m json.tool

echo ""
echo "✅ Готово!"

