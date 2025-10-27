// Система корзины Trust Store

// Получаем корзину из localStorage
function getCart() {
    const cart = localStorage.getItem('trustStoreCart');
    return cart ? JSON.parse(cart) : [];
}

// Сохраняем корзину в localStorage
function saveCart(cart) {
    localStorage.setItem('trustStoreCart', JSON.stringify(cart));
    updateCartBadge();
}

// Обновляем счетчик на иконке корзины
function updateCartBadge() {
    const cart = getCart();
    const totalItems = cart.reduce((sum, item) => sum + item.quantity, 0);
    const badges = document.querySelectorAll('.badge');
    
    badges.forEach(badge => {
        badge.textContent = totalItems;
        if (totalItems > 0) {
            badge.style.display = 'inline-block';
        } else {
            badge.style.display = 'none';
        }
    });
}

// Добавляем товар в корзину
function addToCart(product) {
    const cart = getCart();
    
    // Проверяем, есть ли уже такой товар с такой же ценой и сроком
    const existingItem = cart.find(item => 
        item.name === product.name && 
        item.price === product.price && 
        item.duration === product.duration
    );
    
    if (existingItem) {
        existingItem.quantity += 1;
    } else {
        cart.push({
            ...product,
            quantity: 1,
            id: Date.now() // Уникальный ID
        });
    }
    
    saveCart(cart);
    showAddToCartAnimation();
    showCartNotification(product);
}

// Анимация добавления в корзину
function showAddToCartAnimation() {
    const cartIcon = document.querySelector('.btn-icon:last-child');
    
    // Анимация увеличения и тряски
    cartIcon.style.animation = 'cartBounce 0.6s ease';
    
    setTimeout(() => {
        cartIcon.style.animation = '';
    }, 600);
}

// Уведомление о добавлении товара
function showCartNotification(product) {
    // Удаляем предыдущее уведомление если есть
    const existingNotification = document.querySelector('.cart-notification');
    if (existingNotification) {
        existingNotification.remove();
    }
    
    const notification = document.createElement('div');
    notification.className = 'cart-notification';
    notification.innerHTML = `
        <div class="cart-notification-content">
            <div class="cart-notification-icon">✓</div>
            <div class="cart-notification-text">
                <h4>Товар добавлен в корзину!</h4>
                <p>${product.name}</p>
            </div>
        </div>
        <div class="cart-notification-actions">
            <button onclick="closeCartNotification()" class="btn-continue">Продолжить покупки</button>
            <button onclick="goToCart()" class="btn-go-cart">Перейти в корзину</button>
        </div>
    `;
    
    document.body.appendChild(notification);
    
    // Показываем уведомление
    setTimeout(() => {
        notification.classList.add('show');
    }, 100);
    
    // Автоматически скрываем через 5 секунд
    setTimeout(() => {
        closeCartNotification();
    }, 5000);
}

// Закрыть уведомление
function closeCartNotification() {
    const notification = document.querySelector('.cart-notification');
    if (notification) {
        notification.classList.remove('show');
        setTimeout(() => {
            notification.remove();
        }, 300);
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
    localStorage.removeItem('trustStoreCart');
    updateCartBadge();
    
    if (window.location.pathname.includes('cart.html')) {
        renderCart();
    }
}

// Анимация для иконки корзины
const style = document.createElement('style');
style.textContent = `
@keyframes cartBounce {
    0%, 100% {
        transform: scale(1);
    }
    25% {
        transform: scale(1.2) rotate(-5deg);
    }
    50% {
        transform: scale(1.3) rotate(5deg);
    }
    75% {
        transform: scale(1.2) rotate(-5deg);
    }
}

.cart-notification {
    position: fixed;
    top: 100px;
    right: 20px;
    background: white;
    border-radius: 15px;
    box-shadow: 0 15px 50px rgba(0, 0, 0, 0.2);
    padding: 20px;
    z-index: 10001;
    min-width: 350px;
    transform: translateX(400px);
    transition: all 0.3s cubic-bezier(0.68, -0.55, 0.265, 1.55);
    opacity: 0;
}

.cart-notification.show {
    transform: translateX(0);
    opacity: 1;
}

.cart-notification-content {
    display: flex;
    align-items: center;
    gap: 15px;
    margin-bottom: 15px;
}

.cart-notification-icon {
    width: 50px;
    height: 50px;
    background: linear-gradient(135deg, #26de81 0%, #20c997 100%);
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 28px;
    color: white;
    flex-shrink: 0;
    animation: iconPop 0.5s ease;
}

@keyframes iconPop {
    0% {
        transform: scale(0);
        opacity: 0;
    }
    50% {
        transform: scale(1.2);
    }
    100% {
        transform: scale(1);
        opacity: 1;
    }
}

.cart-notification-text h4 {
    margin: 0 0 5px 0;
    font-size: 16px;
    font-weight: 600;
    color: #1a1a1a;
}

.cart-notification-text p {
    margin: 0;
    font-size: 14px;
    color: #666;
}

.cart-notification-actions {
    display: flex;
    gap: 10px;
}

.btn-continue,
.btn-go-cart {
    flex: 1;
    padding: 12px 20px;
    border: none;
    border-radius: 10px;
    font-size: 14px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.3s ease;
    font-family: 'Inter', sans-serif;
}

.btn-continue {
    background: #f0f0f0;
    color: #666;
}

.btn-continue:hover {
    background: #e0e0e0;
    color: #1a1a1a;
}

.btn-go-cart {
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    color: white;
    box-shadow: 0 4px 15px rgba(102, 126, 234, 0.3);
}

.btn-go-cart:hover {
    transform: translateY(-2px);
    box-shadow: 0 6px 20px rgba(102, 126, 234, 0.4);
}

@media (max-width: 768px) {
    .cart-notification {
        right: 10px;
        left: 10px;
        min-width: auto;
    }
}
`;
document.head.appendChild(style);

// Инициализация при загрузке страницы
document.addEventListener('DOMContentLoaded', () => {
    updateCartBadge();
    
    // Делаем иконку корзины кликабельной
    const cartButtons = document.querySelectorAll('.btn-icon:last-child');
    cartButtons.forEach(btn => {
        btn.style.cursor = 'pointer';
        btn.addEventListener('click', () => {
            window.location.href = 'cart.html';
        });
    });
});

