#!/bin/bash
# Скрипт для обновления Cardlink на сервере

echo "🔄 Обновление Cardlink на сервере..."

# Коммитим и пушим изменения
cd /Users/t1xxas/Downloads/TrustStore-main
git add checkout.html server.js
git commit -m "Восстановлен Cardlink (СБП)" || echo "Нет изменений для коммита"
git push origin main

# Обновляем на сервере
echo "📡 Подключение к серверу..."
sshpass -p 'o-4zWa6SFWUGo,' ssh -o StrictHostKeyChecking=no root@45.95.234.173 << 'ENDSSH'
cd /root/TrustStore
echo "📥 Обновление кода..."
git pull origin main
echo "🔄 Перезапуск сервера..."
pm2 restart trust-store
echo "✅ Готово! Cardlink восстановлен на сервере"
ENDSSH

echo "✅ Обновление завершено!"









