#!/bin/bash

# Настройка Telegram Webhook для обработки кнопок

TELEGRAM_BOT_TOKEN="7268320384:AAGngFsmkg_x-2rryDtoJkmYD3ymxy5gM9o"
WEBHOOK_URL="https://truststore.ru/api/telegram-webhook"

echo "🔧 Настройка Telegram Webhook..."
echo "URL: $WEBHOOK_URL"

curl -X POST "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/setWebhook" \
  -H "Content-Type: application/json" \
  -d "{\"url\": \"${WEBHOOK_URL}\"}"

echo ""
echo "✅ Готово! Проверь что webhook настроен:"
echo ""
curl "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/getWebhookInfo" | python3 -m json.tool 2>/dev/null || cat

