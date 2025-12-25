// Красивое уведомление для добавления товара в корзину
function showCartNotification(product) {
    // Удаляем предыдущее если есть
    const existing = document.querySelector('.beautiful-notification');
    if (existing) existing.remove();
    
    // Рассчитываем финальную цену с учетом промокода
    let finalPrice = product.price;
    let priceHTML = '';
    
    if (product.appliedPromo) {
        // Есть промокод - показываем старую и новую цену
        const discountedPrice = Math.round(product.price * (1 - product.appliedPromo.discount / 100));
        priceHTML = `
            <div style="display: flex; flex-direction: column; align-items: flex-end; gap: 4px;">
                <div style="text-decoration: line-through; color: #999; font-size: 14px;">${product.price.toLocaleString('ru-RU')} ₽</div>
                <div class="notification-price">${discountedPrice.toLocaleString('ru-RU')} ₽</div>
            </div>
        `;
    } else {
        // Нет промокода - просто цена
        priceHTML = `<div class="notification-price">${product.price.toLocaleString('ru-RU')} ₽</div>`;
    }
    
    // Создаем уведомление
    const notification = document.createElement('div');
    notification.className = 'beautiful-notification';
    notification.innerHTML = `
        <div class="notification-content">
            <div class="notification-icon">
                <svg width="40" height="40" viewBox="0 0 40 40" fill="none">
                    <circle cx="20" cy="20" r="20" fill="#10b981"/>
                    <path d="M12 20L17 25L28 14" stroke="white" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
            </div>
            <div class="notification-text">
                <h4>✓ Добавлено в корзину</h4>
                <p class="product-name">${product.name}</p>
            </div>
            ${priceHTML}
        </div>
        <div class="notification-actions">
            <button onclick="this.parentElement.parentElement.remove()" class="btn-close-notif">
                ← Продолжить покупки
            </button>
            <button onclick="toggleCartWidget(); this.parentElement.parentElement.remove();" class="btn-view-cart-notif">
                🛒 Перейти в корзину
            </button>
        </div>
    `;
    
    document.body.appendChild(notification);
    
    // Автоматически убираем через 5 секунд
    setTimeout(() => {
        notification.classList.add('fade-out');
        setTimeout(() => notification.remove(), 800);
    }, 5000);
}

// Добавляем стили для уведомления
const notifStyle = document.createElement('style');
notifStyle.textContent = `
    .beautiful-notification {
        position: fixed;
        top: 60px;
        left: 50%;
        transform: translateX(-50%) translateY(-150%);
        background: linear-gradient(135deg, #ffffff 0%, #f8f9ff 100%);
        border: 1px solid rgba(102, 126, 234, 0.2);
        border-radius: 20px;
        box-shadow: 0 20px 60px rgba(102, 126, 234, 0.25), 0 0 0 1px rgba(255, 255, 255, 0.5) inset;
        padding: 20px 30px;
        z-index: 10000;
        min-width: 600px;
        max-width: 90vw;
        animation: slideDownNotif 0.6s cubic-bezier(0.68, -0.55, 0.265, 1.55) forwards;
        backdrop-filter: blur(10px);
    }
    
    @keyframes slideDownNotif {
        from {
            transform: translateX(-50%) translateY(-150%);
            opacity: 0;
        }
        to {
            transform: translateX(-50%) translateY(0);
            opacity: 1;
        }
    }
    
    .beautiful-notification.fade-out {
        animation: slideUpNotif 0.8s ease-in-out forwards;
    }
    
    @keyframes slideUpNotif {
        to {
            transform: translateX(-50%) translateY(-150%);
            opacity: 0;
        }
    }
    
    .notification-content {
        display: flex;
        gap: 18px;
        align-items: center;
        margin-bottom: 16px;
        padding-bottom: 16px;
        border-bottom: 1px solid rgba(102, 126, 234, 0.1);
    }
    
    .notification-icon {
        flex-shrink: 0;
        animation: iconPop 0.6s cubic-bezier(0.68, -0.55, 0.265, 1.55) 0.3s both;
    }
    
    .notification-icon svg {
        filter: drop-shadow(0 4px 12px rgba(16, 185, 129, 0.4));
    }
    
    @keyframes iconPop {
        0% {
            transform: scale(0) rotate(-45deg);
            opacity: 0;
        }
        100% {
            transform: scale(1) rotate(0deg);
            opacity: 1;
        }
    }
    
    .notification-text {
        flex: 1;
    }
    
    .notification-text h4 {
        margin: 0 0 6px 0;
        font-size: 16px;
        font-weight: 700;
        color: #10b981;
        letter-spacing: -0.3px;
    }
    
    .notification-text .product-name {
        margin: 0;
        font-size: 15px;
        color: #4b5563;
        font-weight: 500;
    }
    
    .notification-price {
        font-size: 24px;
        font-weight: 800;
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        -webkit-background-clip: text;
        -webkit-text-fill-color: transparent;
        background-clip: text;
        flex-shrink: 0;
        letter-spacing: -0.5px;
    }
    
    .notification-actions {
        display: flex;
        gap: 10px;
        justify-content: space-between;
    }
    
    .btn-close-notif {
        background: transparent;
        color: #6b7280;
        border: 1.5px solid #e5e7eb;
        padding: 11px 22px;
        border-radius: 12px;
        font-size: 14px;
        font-weight: 600;
        cursor: pointer;
        transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        white-space: nowrap;
        flex: 1;
    }
    
    .btn-close-notif:hover {
        background: #f9fafb;
        border-color: #d1d5db;
        color: #374151;
        transform: translateY(-2px);
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
    }
    
    .btn-view-cart-notif {
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        color: white;
        border: none;
        padding: 12px 24px;
        border-radius: 12px;
        font-size: 14px;
        font-weight: 600;
        cursor: pointer;
        transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        white-space: nowrap;
        box-shadow: 0 4px 14px rgba(102, 126, 234, 0.3);
        flex: 1;
    }
    
    .btn-view-cart-notif:hover {
        transform: translateY(-2px);
        box-shadow: 0 8px 24px rgba(102, 126, 234, 0.4);
    }
    
    .btn-view-cart-notif:active {
        transform: translateY(0);
    }
    
    @media (max-width: 768px) {
        .beautiful-notification {
            min-width: auto;
            width: calc(100% - 40px);
            padding: 18px 20px;
        }
        
        .notification-content {
            flex-direction: row;
            gap: 12px;
        }
        
        .notification-icon svg {
            width: 36px;
            height: 36px;
        }
        
        .notification-price {
            font-size: 20px;
        }
        
        .notification-text h4 {
            font-size: 15px;
        }
        
        .notification-text .product-name {
            font-size: 13px;
        }
        
        .notification-actions {
            flex-direction: column;
            gap: 8px;
        }
        
        .btn-close-notif,
        .btn-view-cart-notif {
            padding: 10px 18px;
            font-size: 13px;
        }
    }
    
    /* Универсальное уведомление */
    .simple-notification {
        position: fixed;
        top: 80px;
        left: 50%;
        transform: translateX(-50%) translateY(-150%);
        background: white;
        border-radius: 16px;
        box-shadow: 0 20px 60px rgba(0, 0, 0, 0.2);
        padding: 16px 24px;
        z-index: 10001;
        min-width: 400px;
        max-width: 90vw;
        animation: slideDownNotif 0.6s cubic-bezier(0.68, -0.55, 0.265, 1.55) forwards;
        display: flex;
        align-items: center;
        gap: 12px;
    }
    
    .simple-notification.warning {
        border-left: 4px solid #f59e0b;
    }
    
    .simple-notification.error {
        border-left: 4px solid #ef4444;
    }
    
    .simple-notification.success {
        border-left: 4px solid #10b981;
    }
    
    .simple-notification.info {
        border-left: 4px solid #3b82f6;
    }
    
    .simple-notification-text {
        flex: 1;
        font-size: 14px;
        font-weight: 500;
        color: #374151;
    }
    
    .simple-notification-close {
        background: transparent;
        border: none;
        font-size: 20px;
        color: #9ca3af;
        cursor: pointer;
        padding: 0;
        width: 24px;
        height: 24px;
        display: flex;
        align-items: center;
        justify-content: center;
        border-radius: 6px;
        transition: all 0.2s;
    }
    
    .simple-notification-close:hover {
        background: #f3f4f6;
        color: #374151;
    }
    
    @media (max-width: 768px) {
        .simple-notification {
            min-width: auto;
            width: calc(100% - 40px);
        }
    }
    
    /* Темная тема для уведомления */
    body.dark-theme .beautiful-notification {
        background: linear-gradient(135deg, #0a0a0a 0%, #1a1a1a 100%);
        border: 1px solid rgba(0, 255, 136, 0.3);
        box-shadow: 0 20px 60px rgba(0, 255, 136, 0.15), 
                    0 0 0 1px rgba(0, 255, 136, 0.1) inset,
                    0 0 30px rgba(0, 255, 136, 0.1);
    }
    
    body.dark-theme .notification-content {
        border-bottom: 1px solid rgba(0, 255, 136, 0.2);
    }
    
    body.dark-theme .notification-text h4 {
        color: #00ff88;
    }
    
    body.dark-theme .notification-text .product-name {
        color: #e5e5e5;
    }
    
    body.dark-theme .notification-price {
        background: linear-gradient(135deg, #00ff88 0%, #00cc6a 100%);
        -webkit-background-clip: text;
        -webkit-text-fill-color: transparent;
        background-clip: text;
    }
    
    body.dark-theme .btn-close-notif {
        background: transparent;
        color: #e5e5e5;
        border: 1.5px solid rgba(0, 255, 136, 0.3);
    }
    
    body.dark-theme .btn-close-notif:hover {
        background: rgba(0, 255, 136, 0.1);
        border-color: #00ff88;
        color: #ffffff;
        box-shadow: 0 4px 12px rgba(0, 255, 136, 0.2);
    }
    
    body.dark-theme .btn-view-cart-notif {
        background: linear-gradient(135deg, #00ff88 0%, #00cc6a 100%);
        color: #000000;
        box-shadow: 0 4px 14px rgba(0, 255, 136, 0.4);
    }
    
    body.dark-theme .btn-view-cart-notif:hover {
        background: linear-gradient(135deg, #00ff99 0%, #00dd77 100%);
        box-shadow: 0 8px 24px rgba(0, 255, 136, 0.5);
    }
    
    body.dark-theme .simple-notification {
        background: #0a0a0a;
        border-left: 4px solid #00ff88;
        color: #ffffff;
    }
    
    body.dark-theme .simple-notification-text {
        color: #e5e5e5;
    }
    
    body.dark-theme .simple-notification-close {
        color: #888888;
    }
    
    body.dark-theme .simple-notification-close:hover {
        background: rgba(0, 255, 136, 0.1);
        color: #00ff88;
    }
`;
document.head.appendChild(notifStyle);

// Универсальная функция для показа уведомлений
function showNotification(message, type = 'info') {
    // Удаляем предыдущее если есть
    const existing = document.querySelector('.simple-notification');
    if (existing) existing.remove();
    
    // Создаем уведомление
    const notification = document.createElement('div');
    notification.className = `simple-notification ${type}`;
    notification.innerHTML = `
        <div class="simple-notification-text">${message}</div>
        <button class="simple-notification-close" onclick="this.parentElement.remove()">×</button>
    `;
    
    document.body.appendChild(notification);
    
    // Автоматически убираем через 5 секунд
    setTimeout(() => {
        notification.classList.add('fade-out');
        setTimeout(() => notification.remove(), 800);
    }, 5000);
}

