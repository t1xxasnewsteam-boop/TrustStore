// Модальное окно авторизации для доступа к админ-панели

(function() {
    // Создаем HTML модального окна
    const modalHTML = `
        <div id="auth-modal" style="display: none; position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.7); z-index: 10000; justify-content: center; align-items: center;">
            <div style="background: white; padding: 40px; border-radius: 20px; max-width: 400px; width: 90%; box-shadow: 0 20px 60px rgba(0,0,0,0.3);">
                <h2 style="margin: 0 0 10px 0; font-size: 24px; color: #1a1a1a;">🔐 Вход в аккаунт</h2>
                <p style="margin: 0 0 30px 0; color: #666; font-size: 14px;">Trust Store</p>
                
                <div id="auth-error" style="display: none; background: #ffe4e1; color: #e74c3c; padding: 12px; border-radius: 8px; margin-bottom: 20px; font-size: 14px;"></div>
                
                <form id="auth-form" onsubmit="return false;">
                    <div style="margin-bottom: 20px;">
                        <label style="display: block; margin-bottom: 8px; font-weight: 600; color: #1a1a1a; font-size: 14px;">Логин</label>
                        <input type="text" id="auth-username" required style="width: 100%; padding: 12px 16px; border: 2px solid #e0e0e0; border-radius: 12px; font-size: 14px; font-family: 'Inter', sans-serif; transition: all 0.3s ease;" onfocus="this.style.borderColor='#667eea'" onblur="this.style.borderColor='#e0e0e0'">
                    </div>
                    
                    <div style="margin-bottom: 30px;">
                        <label style="display: block; margin-bottom: 8px; font-weight: 600; color: #1a1a1a; font-size: 14px;">Пароль</label>
                        <input type="password" id="auth-password" required style="width: 100%; padding: 12px 16px; border: 2px solid #e0e0e0; border-radius: 12px; font-size: 14px; font-family: 'Inter', sans-serif; transition: all 0.3s ease;" onfocus="this.style.borderColor='#667eea'" onblur="this.style.borderColor='#e0e0e0'">
                    </div>
                    
                    <div style="display: flex; gap: 10px;">
                        <button type="button" onclick="closeAuthModal()" style="flex: 1; background: #e0e0e0; color: #666; border: none; padding: 14px; border-radius: 12px; font-size: 14px; font-weight: 600; cursor: pointer; transition: all 0.3s ease;">
                            Отмена
                        </button>
                        <button type="submit" id="auth-submit-btn" style="flex: 1; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; border: none; padding: 14px; border-radius: 12px; font-size: 14px; font-weight: 600; cursor: pointer; transition: all 0.3s ease;">
                            Войти
                        </button>
                    </div>
                </form>
            </div>
        </div>
    `;

    // Добавляем модалку в body при загрузке
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initAuthModal);
    } else {
        initAuthModal();
    }

    function initAuthModal() {
        document.body.insertAdjacentHTML('beforeend', modalHTML);
        
        // Обработчик формы
        document.getElementById('auth-form').addEventListener('submit', handleLogin);
        
        // Закрытие по клику вне модалки
        document.getElementById('auth-modal').addEventListener('click', function(e) {
            if (e.target === this) {
                closeAuthModal();
            }
        });

        // Проверяем, авторизован ли пользователь
        checkAuthStatus();
    }

    async function handleLogin(e) {
        e.preventDefault();
        
        const username = document.getElementById('auth-username').value;
        const password = document.getElementById('auth-password').value;
        const submitBtn = document.getElementById('auth-submit-btn');
        const errorDiv = document.getElementById('auth-error');
        
        // Отключаем кнопку
        submitBtn.disabled = true;
        submitBtn.textContent = 'Вход...';
        errorDiv.style.display = 'none';
        
        try {
            const response = await fetch('/api/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password })
            });

            const data = await response.json();

            if (response.ok) {
                // Успешный вход
                closeAuthModal();
                updateAuthButton(true);
                
                // Показываем уведомление
                showNotification('✅ Вы успешно вошли в аккаунт', 'success');
            } else {
                // Ошибка входа
                errorDiv.textContent = data.error || 'Неверные данные';
                errorDiv.style.display = 'block';
            }
        } catch (error) {
            errorDiv.textContent = 'Ошибка подключения к серверу';
            errorDiv.style.display = 'block';
        } finally {
            submitBtn.disabled = false;
            submitBtn.textContent = 'Войти';
        }
    }

    async function checkAuthStatus() {
        try {
            const response = await fetch('/api/check-auth');
            if (response.ok) {
                updateAuthButton(true);
            } else {
                updateAuthButton(false);
            }
        } catch (error) {
            updateAuthButton(false);
        }
    }

    function updateAuthButton(isAuthenticated) {
        const authBtn = document.getElementById('auth-btn');
        if (!authBtn) return;

        if (isAuthenticated) {
            authBtn.innerHTML = '👤 Аккаунт';
            authBtn.onclick = function() {
                window.open('/admin', '_blank');
            };
        } else {
            authBtn.innerHTML = '👤 Войти';
            authBtn.onclick = openAuthModal;
        }
    }

    function showNotification(message, type) {
        const notification = document.createElement('div');
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: ${type === 'success' ? '#26de81' : '#e74c3c'};
            color: white;
            padding: 16px 24px;
            border-radius: 12px;
            font-weight: 600;
            font-size: 14px;
            box-shadow: 0 10px 30px rgba(0,0,0,0.2);
            z-index: 10001;
            animation: slideIn 0.3s ease;
        `;
        notification.textContent = message;
        document.body.appendChild(notification);

        setTimeout(() => {
            notification.style.animation = 'slideOut 0.3s ease';
            setTimeout(() => notification.remove(), 300);
        }, 3000);
    }

    // Глобальные функции для открытия/закрытия модалки
    window.openAuthModal = function() {
        document.getElementById('auth-modal').style.display = 'flex';
        document.getElementById('auth-username').focus();
    };

    window.closeAuthModal = function() {
        document.getElementById('auth-modal').style.display = 'none';
        document.getElementById('auth-error').style.display = 'none';
        document.getElementById('auth-form').reset();
    };

    // Добавляем анимации
    const style = document.createElement('style');
    style.textContent = `
        @keyframes slideIn {
            from { transform: translateX(400px); opacity: 0; }
            to { transform: translateX(0); opacity: 1; }
        }
        @keyframes slideOut {
            from { transform: translateX(0); opacity: 1; }
            to { transform: translateX(400px); opacity: 0; }
        }
    `;
    document.head.appendChild(style);
})();

