// Красивое уведомление для добавления товара в корзину
function showCartNotification(product) {
    // Удаляем предыдущее если есть
    const existing = document.querySelector('.beautiful-notification');
    if (existing) existing.remove();
    
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
            <div class="notification-price">${product.price.toLocaleString('ru-RU')} ₽</div>
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
`;
document.head.appendChild(notifStyle);

