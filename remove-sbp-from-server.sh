#!/bin/bash
# Скрипт для удаления способа оплаты "Перевод" (sbp) с сервера

sshpass -p 'o-4zWa6SFWUGo,' ssh -o StrictHostKeyChecking=no root@45.95.234.173 << 'ENDSSH'
cd /root/TrustStore

echo "=== Проверка перед удалением ==="
grep -n 'data-method.*sbp\|Перевод по номеру' checkout.html | head -10

echo ""
echo "=== Удаление блока sbp ==="
# Удаляем блок с data-method="sbp" (открывающий тег до закрывающего)
sed -i '/<div class="payment-method" data-method="sbp"/,/<\/div>/d' checkout.html

echo "=== Проверка после удаления ==="
grep -n 'data-method.*sbp\|Перевод по номеру' checkout.html || echo "✅ Блок 'Перевод' удален!"

echo ""
echo "=== Обновление из git ==="
git pull origin main

echo ""
echo "=== Перезапуск сервера ==="
pm2 restart trust-store

echo "✅ Готово!"
ENDSSH



