// Cart Widget functionality

// Проверка валидности промокодов в виджете корзины
async function validateWidgetPromoCodes() {
    const cart = getCart();
    let hasChanges = false;
    const invalidPromoCodes = new Set();
    
    // Проверяем каждый товар с промокодом
    const validatedCart = await Promise.all(cart.map(async (item) => {
        if (item.appliedPromo && item.appliedPromo.code) {
            try {
                const response = await fetch('/api/validate-promo', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ code: item.appliedPromo.code })
                });
                
                const data = await response.json();
                
                // Если промокод невалиден - удаляем его
                if (!data.valid) {
                    console.log(`⚠️ Промокод ${item.appliedPromo.code} больше недействителен`);
                    invalidPromoCodes.add(item.appliedPromo.code);
                    hasChanges = true;
                    // Удаляем промокод из товара
                    const { appliedPromo, ...itemWithoutPromo } = item;
                    return itemWithoutPromo;
                }
            } catch (error) {
                console.error('Ошибка проверки промокода:', error);
            }
        }
        return item;
    }));
    
    // Если были изменения - сохраняем и уведомляем
    if (hasChanges) {
        saveCart(validatedCart);
        
        // Показываем уведомление о недействительных промокодах
        if (invalidPromoCodes.size > 0) {
            const codes = Array.from(invalidPromoCodes).join(', ');
            setTimeout(() => {
                if (typeof showNotification === 'function') {
                    showNotification(`⚠️ Промокод ${codes} больше не действителен и был удален из корзины`, 'warning');
                }
            }, 500);
        }
    }
    
    return hasChanges;
}

// Toggle cart widget
function toggleCartWidget() {
    const widget = document.getElementById('cartWidget');
    const overlay = document.getElementById('cartWidgetOverlay');
    
    widget.classList.toggle('active');
    overlay.classList.toggle('active');
    
    if (widget.classList.contains('active')) {
        // Сначала проверяем промокоды, затем отображаем виджет
        validateWidgetPromoCodes().then(() => {
            displayCartWidget();
        });
    }
}

// Close cart widget
function closeCartWidget() {
    const widget = document.getElementById('cartWidget');
    const overlay = document.getElementById('cartWidgetOverlay');
    
    widget.classList.remove('active');
    overlay.classList.remove('active');
}

// Display cart items in widget
function displayCartWidget() {
    const cart = getCart();
    const itemsContainer = document.getElementById('cartWidgetItems');
    
    if (cart.length === 0) {
        itemsContainer.innerHTML = `
            <div class="cart-widget-empty">
                <div class="cart-widget-empty-icon">🛒</div>
                <h4>Корзина пуста</h4>
                <p>Добавьте товары из каталога</p>
                <button class="cart-widget-empty-btn" onclick="closeCartWidget(); window.location.href='/catalog'">
                    В каталог
                </button>
            </div>
        `;
        
        // Hide footer if empty
        document.getElementById('cartWidgetFooter').style.display = 'none';
        return;
    }
    
    // Show footer if not empty
    document.getElementById('cartWidgetFooter').style.display = 'block';
    
    // Calculate total
    let totalPrice = 0;
    
    // Calculate original total if there are promos
    let originalTotalPrice = 0;
    
    // Render items with quantity
    const itemsHTML = cart.map((item, index) => {
        const unitPrice = item.unitPrice || item.price;
        const quantity = item.quantity || 1;
        const originalPrice = unitPrice * quantity; // Цена БЕЗ промокода
        
        // Если есть промокод, показываем старую цену и новую цену со скидкой
        let priceHTML;
        let itemTotal;
        
        if (item.appliedPromo) {
            // Рассчитываем цену СО скидкой
            const discountedPrice = Math.round(originalPrice * (1 - item.appliedPromo.discount / 100));
            itemTotal = discountedPrice;
            
            priceHTML = `
                <div style="display: flex; align-items: center; gap: 6px;">
                    <div style="text-decoration: line-through; color: #999; font-size: 12px;">${originalPrice.toLocaleString('ru-RU')} ₽</div>
                    <div class="cart-widget-item-price">${discountedPrice.toLocaleString('ru-RU')} ₽</div>
                </div>
            `;
        } else {
            itemTotal = originalPrice;
            priceHTML = `<div class="cart-widget-item-price">${originalPrice.toLocaleString('ru-RU')} ₽</div>`;
        }
        
        totalPrice += itemTotal;
        originalTotalPrice += originalPrice; // Всегда добавляем цену БЕЗ промокода для итого
        
        // Создаем URL для товара
        const productUrl = getProductUrl(item.name);
        
        return `
            <div class="cart-widget-item" onclick="openProductFromWidget(event, '${productUrl}')" style="cursor: pointer;">
                <div class="cart-widget-item-image">
                    <img src="${item.image || 'logo.png'}" alt="${item.name}">
                </div>
                <div class="cart-widget-item-info">
                    <div class="cart-widget-item-title">${item.name}</div>
                    <div class="cart-widget-item-duration">${item.duration}</div>
                    <div class="cart-widget-item-bottom">
                        ${priceHTML}
                        <div class="widget-quantity-controls" onclick="event.stopPropagation()">
                            <button class="widget-quantity-btn" onclick="decreaseWidgetQuantity(${index})">−</button>
                            <input type="text" class="widget-quantity-input" value="${quantity}" 
                                   onchange="updateWidgetQuantityManual(${index}, this.value)"
                                   onkeypress="return handleQuantityKeypress(event)">
                            <button class="widget-quantity-btn" onclick="increaseWidgetQuantity(${index})">+</button>
                        </div>
                    </div>
                </div>
                <button class="cart-widget-item-remove" onclick="event.stopPropagation(); removeFromCartWidget(${index})" title="Удалить">×</button>
            </div>
        `;
    }).join('');
    
    itemsContainer.innerHTML = itemsHTML;
    
    // Update total with discount if applicable
    const totalElement = document.getElementById('cartWidgetTotalPrice');
    if (originalTotalPrice > totalPrice) {
        // Есть скидка - показываем старую и новую цену
        totalElement.innerHTML = `
            <div style="display: flex; align-items: center; gap: 8px;">
                <span style="text-decoration: line-through; color: #999; font-size: 14px;">${originalTotalPrice.toLocaleString('ru-RU')} ₽</span>
                <span style="color: #667eea; font-weight: 600;">${totalPrice.toLocaleString('ru-RU')} ₽</span>
            </div>
        `;
    } else {
        // Нет скидки - просто цена
        totalElement.textContent = `${totalPrice.toLocaleString('ru-RU')} ₽`;
    }
}

// Увеличение количества товара в виджете
function increaseWidgetQuantity(index) {
    const cart = getCart();
    if (!cart[index].quantity) cart[index].quantity = 1;
    if (!cart[index].unitPrice) cart[index].unitPrice = cart[index].price;
    
    cart[index].quantity += 1;
    saveCart(cart);
    displayCartWidget();
}

// Уменьшение количества товара в виджете
function decreaseWidgetQuantity(index) {
    const cart = getCart();
    const item = cart[index];
    
    if (!item.quantity) item.quantity = 1;
    
    // Если количество = 1, спрашиваем подтверждение
    if (item.quantity === 1) {
        if (confirm('Вы уверены, что хотите удалить товар из корзины?')) {
            removeFromCartWidget(index);
        }
        return;
    }
    
    // Уменьшаем количество
    item.quantity -= 1;
    saveCart(cart);
    displayCartWidget();
}

// Обновление количества вручную в виджете
function updateWidgetQuantityManual(index, value) {
    const cart = getCart();
    const numValue = parseInt(value);
    
    // Если введен 0 или не число, возвращаем предыдущее значение
    if (isNaN(numValue) || numValue <= 0) {
        displayCartWidget(); // Перерисовываем с исходным значением
        return;
    }
    
    if (!cart[index].quantity) cart[index].quantity = 1;
    if (!cart[index].unitPrice) cart[index].unitPrice = cart[index].price;
    
    // Обновляем количество
    cart[index].quantity = numValue;
    saveCart(cart);
    displayCartWidget();
}

// Обработка нажатий клавиш в поле количества
function handleQuantityKeypress(event) {
    const key = event.key;
    
    // Разрешаем только цифры, но запрещаем 0 как первый символ
    if (key === '0' && event.target.value === '') {
        event.preventDefault();
        return false;
    }
    
    // Разрешаем только цифры
    if (!/[0-9]/.test(key)) {
        event.preventDefault();
        return false;
    }
    
    return true;
}

// Remove item from cart (from widget)
function removeFromCartWidget(index) {
    const cart = getCart();
    cart.splice(index, 1);
    saveCart(cart); // ✅ Используем saveCart для синхронизации localStorage + cookies
    
    // Update widget
    displayCartWidget();
    
    // Show notification
    showNotification('✅ Товар удалён из корзины');
}

// Show notification
function showNotification(message) {
    const notification = document.createElement('div');
    notification.innerHTML = `
        <div style="position: fixed; bottom: 90px; right: 20px; background: white; padding: 15px 20px; border-radius: 15px; box-shadow: 0 10px 30px rgba(0,0,0,0.15); z-index: 10001; animation: slideIn 0.5s ease;">
            <div style="display: flex; align-items: center; gap: 10px;">
                <span style="font-weight: 600; color: #1a1a1a;">${message}</span>
            </div>
        </div>
    `;
    document.body.appendChild(notification);
    
    setTimeout(() => {
        notification.style.animation = 'slideOut 0.5s ease';
        setTimeout(() => notification.remove(), 500);
    }, 2000);
}

// Checkout from widget
function checkoutFromWidget() {
    const cart = getCart();
    if (cart.length === 0) return;
    
    // Перенаправляем на checkout с параметром fromCart=true
    // Checkout сам загрузит все товары из корзины
    window.location.href = '/checkout?fromCart=true';
}

// Получаем URL товара из названия
function getProductUrl(productName) {
    const urlMap = {
        'Midjourney': '/product/midjourney',
        'ChatGPT': '/product/chatgpt',
        'Claude': '/product/claude',
        'Gemini': '/product/gemini',
        'Cursor': '/product/cursor',
        'YouTube Premium': '/product/youtube',
        'Adobe': '/product/adobe',
        'CapCut': '/product/capcut',
        'VPN': '/product/vpn'
    };
    return urlMap[productName] || '/catalog';
}

// Открываем товар из виджета
function openProductFromWidget(event, productUrl) {
    // Проверяем, что клик не был по кнопкам управления
    if (event.target.closest('.widget-quantity-controls') || 
        event.target.closest('.cart-widget-item-remove')) {
        return;
    }
    
    window.location.href = productUrl;
}

// Initialize cart widget on page load
document.addEventListener('DOMContentLoaded', function() {
    // Close widget on overlay click
    const overlay = document.getElementById('cartWidgetOverlay');
    if (overlay) {
        overlay.addEventListener('click', closeCartWidget);
    }
    
    // Close widget on Escape key
    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape') {
            closeCartWidget();
        }
    });
});

