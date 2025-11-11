#!/bin/bash
# Удаление блока "Перевод" (sbp) с сервера

sshpass -p 'o-4zWa6SFWUGo,' ssh -o StrictHostKeyChecking=no root@45.95.234.173 << 'ENDSSH'
cd /root/TrustStore

echo "=== ДО УДАЛЕНИЯ ==="
grep 'data-method=' checkout.html

echo ""
echo "=== УДАЛЕНИЕ БЛОКА ==="
python3 << 'PYTHON'
import re

with open('checkout.html', 'r', encoding='utf-8') as f:
    content = f.read()

# Удаляем блок с data-method="sbp"
content = re.sub(r'<div class="payment-method"[^>]*data-method="sbp"[^>]*>.*?</div>\s*</div>', '', content, flags=re.DOTALL)
content = re.sub(r'<div class="payment-method"[^>]*data-method="sbp"[^>]*>.*?</div>', '', content, flags=re.DOTALL)

with open('checkout.html', 'w', encoding='utf-8') as f:
    f.write(content)

print("✅ Удалено!")
PYTHON

echo ""
echo "=== ПОСЛЕ УДАЛЕНИЯ ==="
grep 'data-method=' checkout.html

echo ""
echo "=== ПЕРЕЗАПУСК ==="
pm2 restart trust-store

echo "✅ ГОТОВО!"
ENDSSH



