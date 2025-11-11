#!/bin/bash

echo "🔍 Поиск последнего заказа на Claude..."

cd /root/TrustStore || exit 1

# Находим последний заказ с Claude
ORDER_ID=$(sqlite3 analytics.db "SELECT order_id FROM orders WHERE (products LIKE '%Claude%' OR products LIKE '%claude%') ORDER BY created_at DESC LIMIT 1;" 2>/dev/null)

if [ -z "$ORDER_ID" ]; then
    echo "❌ Заказ на Claude не найден"
    echo ""
    echo "Последние 5 заказов:"
    sqlite3 analytics.db "SELECT order_id, customer_email, status, payment_method, total_amount, created_at FROM orders ORDER BY created_at DESC LIMIT 5;" 2>/dev/null
    exit 1
fi

echo "✅ Найден заказ: $ORDER_ID"
echo ""
echo "Информация о заказе:"
sqlite3 analytics.db "SELECT order_id, customer_email, customer_name, status, payment_method, total_amount, created_at FROM orders WHERE order_id = '$ORDER_ID';" 2>/dev/null
echo ""

echo "📤 Отправка заказа..."
curl -X POST http://localhost:3000/api/manual-send-last-order \
  -H "Content-Type: application/json" \
  -d "{\"orderId\": \"$ORDER_ID\"}" \
  -s | python3 -m json.tool 2>/dev/null || curl -X POST http://localhost:3000/api/manual-send-last-order \
  -H "Content-Type: application/json" \
  -d "{\"orderId\": \"$ORDER_ID\"}" \
  -s

echo ""
echo "✅ Готово!"





