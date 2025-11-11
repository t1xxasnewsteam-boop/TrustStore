#!/usr/bin/env python3
# -*- coding: utf-8 -*-
import re

with open('checkout.html', 'r', encoding='utf-8') as f:
    content = f.read()

# Удаляем блок с data-method="sbp"
# Паттерн 1: многострочный блок
pattern1 = r'<div class="payment-method"[^>]*data-method="sbp"[^>]*>.*?</div>\s*</div>'
content = re.sub(pattern1, '', content, flags=re.DOTALL)

# Паттерн 2: однострочный блок
pattern2 = r'<div class="payment-method"[^>]*data-method="sbp"[^>]*>.*?</div>'
content = re.sub(pattern2, '', content, flags=re.DOTALL)

# Удаляем пустые строки (более 2 подряд)
content = re.sub(r'\n{3,}', '\n\n', content)

with open('checkout.html', 'w', encoding='utf-8') as f:
    f.write(content)

print("✅ Блок sbp удален!")



