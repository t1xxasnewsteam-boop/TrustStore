#!/bin/bash

echo "📤 Отправка последнего Cardlink заказа..."

curl -X POST https://truststore.ru/api/manual-send-last-order \
  -H "Content-Type: application/json" \
  -s | python3 -m json.tool 2>/dev/null || curl -X POST https://truststore.ru/api/manual-send-last-order \
  -H "Content-Type: application/json" -s

echo ""
echo "✅ Готово!"





