#!/bin/bash

echo "📥 Обновление кода с GitHub..."
cd /root/TrustStore || exit 1
git pull origin main

echo ""
echo "🔄 Перезапуск сервера..."
pm2 restart trust-store
sleep 3

echo ""
echo "📤 Отправка заказа ORD-1762507451113..."
curl -X POST http://localhost:3000/api/manual-send-last-order \
  -H "Content-Type: application/json" \
  -d '{"orderId": "ORD-1762507451113"}' \
  -s | python3 -m json.tool 2>/dev/null || curl -X POST http://localhost:3000/api/manual-send-last-order \
  -H "Content-Type: application/json" \
  -d '{"orderId": "ORD-1762507451113"}' \
  -s

echo ""
echo ""
echo "📋 Проверка заказа в базе данных:"
sqlite3 analytics.db "SELECT order_id, customer_email, customer_name, status, payment_method, total_amount, created_at FROM orders WHERE order_id = 'ORD-1762507451113';" 2>/dev/null

echo ""
echo ""
echo "📋 Логи последних 50 строк:"
pm2 logs trust-store --lines 50 --nostream | tail -50

echo ""
echo "✅ ГОТОВО!"





