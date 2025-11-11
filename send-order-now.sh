#!/bin/bash

echo "📤 Отправка заказа ORD-1762507451113..."

cd /root/TrustStore || exit 1

curl -X POST http://localhost:3000/api/manual-send-last-order \
  -H "Content-Type: application/json" \
  -d '{"orderId": "ORD-1762507451113"}' \
  -s | python3 -m json.tool 2>/dev/null || curl -X POST http://localhost:3000/api/manual-send-last-order \
  -H "Content-Type: application/json" \
  -d '{"orderId": "ORD-1762507451113"}' \
  -s

echo ""
echo "✅ Готово!"





