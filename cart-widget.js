// Cart Widget functionality

// Toggle cart widget
function toggleCartWidget() {
    const widget = document.getElementById('cartWidget');
    const overlay = document.getElementById('cartWidgetOverlay');
    
    widget.classList.toggle('active');
    overlay.classList.toggle('active');
    
    if (widget.classList.contains('active')) {
        displayCartWidget();
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
    
    // Render items with quantity
    const itemsHTML = cart.map((item, index) => {
        const unitPrice = item.unitPrice || item.price;
        const quantity = item.quantity || 1;
        const itemTotal = unitPrice * quantity;
        totalPrice += itemTotal;
        
        // Проверяем наличие промокода у товара
        const promoHTML = item.appliedPromo ? 
            `<div style="display: inline-flex; align-items: center; gap: 4px; margin-top: 4px; padding: 3px 8px; background: linear-gradient(135deg, #26de81 0%, #20bf6b 100%); border-radius: 6px;">
                <span style="font-size: 10px; font-weight: 600; color: white;">🎫 ${item.appliedPromo.code} (-${item.appliedPromo.discount}%)</span>
            </div>` : '';
        
        // Если есть промокод, показываем старую цену и скидку
        let priceHTML;
        if (item.appliedPromo) {
            const originalPrice = Math.round(itemTotal / (1 - item.appliedPromo.discount / 100));
            priceHTML = `
                <div style="display: flex; flex-direction: column; gap: 4px; align-items: flex-start;">
                    <div style="display: flex; align-items: center; gap: 6px;">
                        <div style="text-decoration: line-through; color: #999; font-size: 12px;">${originalPrice.toLocaleString('ru-RU')} ₽</div>
                        <div style="background: linear-gradient(135deg, #26de81 0%, #20bf6b 100%); color: white; padding: 2px 6px; border-radius: 4px; font-size: 10px; font-weight: 600;">
                            -${item.appliedPromo.discount}%
                        </div>
                    </div>
                    <div class="cart-widget-item-price">${itemTotal.toLocaleString('ru-RU')} ₽</div>
                </div>
            `;
        } else {
            priceHTML = `<div class="cart-widget-item-price">${itemTotal.toLocaleString('ru-RU')} ₽</div>`;
        }
        
        return `
            <div class="cart-widget-item">
                <div class="cart-widget-item-image">
                    <img src="${item.image || 'logo.png'}" alt="${item.name}">
                </div>
                <div class="cart-widget-item-info">
                    <div class="cart-widget-item-title">${item.name}</div>
                    <div class="cart-widget-item-duration">${item.duration}</div>
                    ${promoHTML}
                    <div class="cart-widget-item-bottom">
                        ${priceHTML}
                        <div class="widget-quantity-controls">
                            <button class="widget-quantity-btn" onclick="decreaseWidgetQuantity(${index})">−</button>
                            <input type="text" class="widget-quantity-input" value="${quantity}" 
                                   onchange="updateWidgetQuantityManual(${index}, this.value)"
                                   onkeypress="return handleQuantityKeypress(event)">
                            <button class="widget-quantity-btn" onclick="increaseWidgetQuantity(${index})">+</button>
                        </div>
                    </div>
                </div>
                <button class="cart-widget-item-remove" onclick="removeFromCartWidget(${index})" title="Удалить">×</button>
            </div>
        `;
    }).join('');
    
    itemsContainer.innerHTML = itemsHTML;
    
    // Update total
    document.getElementById('cartWidgetTotalPrice').textContent = `${totalPrice.toLocaleString('ru-RU')} ₽`;
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

