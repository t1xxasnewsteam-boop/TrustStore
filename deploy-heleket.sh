#!/bin/bash

# Скрипт для деплоя на сервер
# Использование: ./deploy-heleket.sh

echo "🚀 Деплой изменений на сервер..."
echo ""

SERVER="root@45.95.234.173"
PASSWORD="o-4zWa6SFWUGo,"

# Проверяем есть ли expect
if ! command -v expect &> /dev/null; then
    echo "❌ expect не установлен. Установите: brew install expect (Mac) или apt-get install expect (Linux)"
    echo ""
    echo "Или выполните вручную:"
    echo "ssh $SERVER"
    echo "cd /root/TrustStore"
    echo "git pull origin main"
    echo "pm2 restart trust-store"
    exit 1
fi

echo "📦 Подключаюсь к серверу и обновляю код..."
echo ""

expect << EOF
set timeout 30
spawn ssh -o StrictHostKeyChecking=no $SERVER

expect {
    "password:" {
        send "$PASSWORD\r"
        exp_continue
    }
    "yes/no" {
        send "yes\r"
        exp_continue
    }
    "# " {
        send "cd /root/TrustStore\r"
        expect "# "
        send "git pull origin main\r"
        expect "# "
        send "pm2 restart trust-store\r"
        expect "# "
        send "echo '✅ Деплой завершен!'\r"
        expect "# "
        send "exit\r"
    }
    timeout {
        puts "❌ Таймаут подключения"
        exit 1
    }
}

expect eof
EOF

echo ""
echo "✅ Готово! Проверь логи: ssh $SERVER 'pm2 logs trust-store --lines 20'"

