// Система корзины Trust Store

// Функция для сохранения в cookies
function setCookie(name, value, days) {
    const expires = new Date();
    expires.setTime(expires.getTime() + (days * 24 * 60 * 60 * 1000));
    document.cookie = name + '=' + encodeURIComponent(value) + ';expires=' + expires.toUTCString() + ';path=/';
}

// Функция для получения из cookies
function getCookie(name) {
    const nameEQ = name + "=";
    const ca = document.cookie.split(';');
    for(let i = 0; i < ca.length; i++) {
        let c = ca[i];
        while (c.charAt(0) == ' ') c = c.substring(1, c.length);
        if (c.indexOf(nameEQ) == 0) return decodeURIComponent(c.substring(nameEQ.length, c.length));
    }
    return null;
}

// Получаем корзину из localStorage И cookies (двойное хранение для надежности)
function getCart() {
    // Сначала пробуем localStorage
    let cart = localStorage.getItem('trustStoreCart');
    
    // Если в localStorage пусто, пробуем cookies
    if (!cart) {
        cart = getCookie('trustStoreCart');
    }
    
    if (cart) {
        try {
            const parsedCart = JSON.parse(cart);
            // Сохраняем в оба места для синхронизации
            if (!localStorage.getItem('trustStoreCart')) {
                localStorage.setItem('trustStoreCart', cart);
            }
            return parsedCart;
        } catch (e) {
            console.error('Ошибка парсинга корзины:', e);
            return [];
        }
    }
    
    return [];
}

// Сохраняем корзину в localStorage И cookies (двойное хранение)
function saveCart(cart) {
    const cartString = JSON.stringify(cart);
    
    // Сохраняем в localStorage
    localStorage.setItem('trustStoreCart', cartString);
    
    // Сохраняем в cookies на 30 дней
    setCookie('trustStoreCart', cartString, 30);
    
    updateCartCount();
    
    console.log('✅ Корзина сохранена! Товаров:', cart.length);
}

// Обновляем счетчик на иконке корзины
function updateCartCount() {
    const cart = getCart();
    
    // Считаем общее количество товаров (с учетом quantity)
    let totalItems = 0;
    cart.forEach(item => {
        const quantity = item.quantity || 1;
        totalItems += quantity;
    });
    
    const badges = document.querySelectorAll('.cart-count');
    
    badges.forEach(badge => {
        badge.textContent = totalItems;
    });
}

// Добавляем товар в корзину
function addToCart(product) {
    const cart = getCart();
    
    // Преобразуем цену в число
    const price = typeof product.price === 'string' ? parseInt(product.price.replace(/\s/g, '')) : product.price;
    
    // Проверяем, есть ли уже такой товар с такой же ценой и сроком
    const existingItemIndex = cart.findIndex(item => 
        item.name === product.name && 
        (item.unitPrice === price || item.price === price) && 
        item.duration === product.duration
    );
    
    if (existingItemIndex !== -1) {
        // Товар уже есть - увеличиваем количество
        if (!cart[existingItemIndex].quantity) {
            cart[existingItemIndex].quantity = 1;
        }
        if (!cart[existingItemIndex].unitPrice) {
            cart[existingItemIndex].unitPrice = cart[existingItemIndex].price;
        }
        
        cart[existingItemIndex].quantity += 1;
        
        console.log('✅ Количество товара увеличено:', product.name, '| Количество:', cart[existingItemIndex].quantity, '| Цена за шт:', price, '₽');
        
        saveCart(cart);
        showAddToCartAnimation();
        showCartNotification({...product, price});
        return;
    }
    
    // Добавляем новый товар
    const newProduct = {
        ...product,
        price: price,
        unitPrice: price,
        quantity: 1,
        id: Date.now()
    };
    
    cart.push(newProduct);
    
    console.log('✅ Товар добавлен в корзину:', newProduct.name, '| Цена:', newProduct.price, '₽ | Тариф:', newProduct.duration);
    
    saveCart(cart);
    showAddToCartAnimation();
    showCartNotification({...product, price});
}

// Анимация добавления в корзину
function showAddToCartAnimation() {
    const cartButton = document.querySelector('.cart-button');
    
    if (cartButton) {
        // Анимация увеличения
        cartButton.classList.add('cart-scale');
        
        setTimeout(() => {
            cartButton.classList.remove('cart-scale');
        }, 1000);
    }
}


// Перейти в корзину
function goToCart() {
    window.location.href = 'cart.html';
}

// Удалить товар из корзины
function removeFromCart(itemId) {
    let cart = getCart();
    cart = cart.filter(item => item.id !== itemId);
    saveCart(cart);
    
    // Обновляем страницу корзины если мы на ней
    if (window.location.pathname.includes('cart.html')) {
        renderCart();
    }
}

// Изменить количество товара
function updateQuantity(itemId, newQuantity) {
    const cart = getCart();
    const item = cart.find(item => item.id === itemId);
    
    if (item) {
        if (newQuantity <= 0) {
            removeFromCart(itemId);
        } else {
            item.quantity = newQuantity;
            saveCart(cart);
            
            // Обновляем страницу корзины
            if (window.location.pathname.includes('cart.html')) {
                renderCart();
            }
        }
    }
}

// Очистить корзину
function clearCart() {
    // Удаляем из localStorage
    localStorage.removeItem('trustStoreCart');
    
    // Удаляем из cookies
    setCookie('trustStoreCart', '', -1);
    
    updateCartCount();
    
    // Обновляем страницу корзины если мы на ней
    if (window.location.pathname.includes('cart.html')) {
        if (typeof displayCart === 'function') {
            displayCart();
        }
    }
    
    // Обновляем виджет если он открыт
    if (typeof displayCartWidget === 'function') {
        const widget = document.getElementById('cartWidget');
        if (widget && widget.classList.contains('active')) {
            displayCartWidget();
        }
    }
    
    console.log('🗑️ Корзина очищена!');
}

// Стили остались только в notification.js

// Инициализация при загрузке страницы
document.addEventListener('DOMContentLoaded', () => {
    // Инициализируем счетчик корзины
    updateCartCount();
    
    // Показываем информацию о корзине в консоли
    const cart = getCart();
    if (cart.length > 0) {
        console.log('🛒 Корзина загружена! Товаров:', cart.length);
        console.log('📦 Товары в корзине:', cart.map(item => `${item.name} (${item.price} ₽)`).join(', '));
    } else {
        console.log('🛒 Корзина пуста');
    }
    
    // Делаем иконку корзины кликабельной
    const cartButtons = document.querySelectorAll('.cart-button');
    cartButtons.forEach(btn => {
        btn.style.cursor = 'pointer';
    });
});

