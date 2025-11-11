#!/bin/bash
# Скрипт для удаления способа оплаты "Перевод" (sbp) с сервера

echo "Подключение к серверу и удаление блока 'Перевод'..."

sshpass -p 'o-4zWa6SFWUGo,' ssh -o StrictHostKeyChecking=no root@45.95.234.173 << 'ENDSSH'
cd /root/TrustStore

echo "=== ТЕКУЩЕЕ СОСТОЯНИЕ ==="
echo "Методы оплаты:"
grep 'data-method=' checkout.html

echo ""
echo "Поиск блока 'Перевод':"
grep -n 'Перевод\|data-method.*sbp' checkout.html | head -5

echo ""
echo "=== УДАЛЕНИЕ БЛОКА ==="
# Создаем временный файл без блока sbp
python3 << 'PYTHON'
import re

with open('checkout.html', 'r', encoding='utf-8') as f:
    content = f.read()

# Удаляем блок с data-method="sbp" (от открывающего div до закрывающего)
# Ищем паттерн: <div class="payment-method" data-method="sbp"...>...до соответствующего </div>
pattern = r'<div class="payment-method"[^>]*data-method="sbp"[^>]*>.*?</div>\s*</div>'
content = re.sub(pattern, '', content, flags=re.DOTALL)

# Также удаляем если блок в одну строку
pattern2 = r'<div class="payment-method"[^>]*data-method="sbp"[^>]*>.*?</div>'
content = re.sub(pattern2, '', content, flags=re.DOTALL)

# Удаляем пустые строки (более 2 подряд)
content = re.sub(r'\n{3,}', '\n\n', content)

with open('checkout.html', 'w', encoding='utf-8') as f:
    f.write(content)

print("✅ Блок удален через Python")
PYTHON

echo ""
echo "=== ПРОВЕРКА ==="
echo "Методы оплаты после удаления:"
grep 'data-method=' checkout.html

echo ""
echo "Поиск 'Перевод':"
grep -n 'Перевод' checkout.html || echo "✅ Блок 'Перевод' не найден!"

echo ""
echo "=== ОБНОВЛЕНИЕ ИЗ GIT ==="
git pull origin main

echo ""
echo "=== ПЕРЕЗАПУСК ==="
pm2 restart trust-store

echo ""
echo "✅ ГОТОВО! Проверь сайт."
ENDSSH

echo ""
echo "Скрипт выполнен!"



