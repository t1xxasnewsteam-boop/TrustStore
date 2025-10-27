// Виджет чата поддержки
(function() {
    // Создаем HTML структуру чата
    const chatHTML = `
        <!-- Кнопка чата -->
        <button class="chat-widget-button" id="chatButton">
            <svg viewBox="0 0 24 24">
                <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/>
            </svg>
            <div class="chat-notification" id="chatNotification" style="display: none;"></div>
        </button>

        <!-- Окно чата -->
        <div class="chat-widget-window" id="chatWindow">
            <div class="chat-header">
                <div class="chat-avatar">
                    <img src="support-image.png" alt="Support" style="width: 100%; height: 100%; object-fit: cover; border-radius: 50%;">
                </div>
                <div class="chat-header-info">
                    <h3>Поддержка Trust Store</h3>
                    <p class="chat-status">
                        <span class="chat-status-dot"></span>
                        Онлайн
                    </p>
                </div>
                <button class="chat-close-btn" id="chatCloseBtn">×</button>
            </div>
            
            <div class="chat-body" id="chatBody">
                <!-- Сообщения будут добавляться сюда -->
            </div>
            
            <div class="chat-footer">
                <input 
                    type="file" 
                    id="chatImageInput" 
                    accept="image/*" 
                    style="display: none;"
                >
                <button class="chat-image-btn" id="chatImageBtn" title="Прикрепить изображение">
                    📷
                </button>
                <input 
                    type="text" 
                    class="chat-input" 
                    id="chatInput" 
                    placeholder="Напишите сообщение..."
                    autocomplete="off"
                >
                <button class="chat-send-btn" id="chatSendBtn">
                    ➤
                </button>
            </div>
        </div>
    `;

    // Добавляем чат в body
    document.addEventListener('DOMContentLoaded', function() {
        document.body.insertAdjacentHTML('beforeend', chatHTML);
        
        // Элементы
        const chatButton = document.getElementById('chatButton');
        const chatWindow = document.getElementById('chatWindow');
        const chatBody = document.getElementById('chatBody');
        const chatInput = document.getElementById('chatInput');
        const chatSendBtn = document.getElementById('chatSendBtn');
        const chatNotification = document.getElementById('chatNotification');
        const chatCloseBtn = document.getElementById('chatCloseBtn');
        const chatImageBtn = document.getElementById('chatImageBtn');
        const chatImageInput = document.getElementById('chatImageInput');
        
        let isOpen = false;
        let botMessageShown = false;
        let ticketId = localStorage.getItem('supportTicketId') || null;
        let customerName = localStorage.getItem('customerName') || null;
        let customerEmail = localStorage.getItem('customerEmail') || null;
        let lastMessageId = 0;
        let pollingInterval = null;
        
        // Закрытие чата по крестику
        chatCloseBtn.addEventListener('click', function(e) {
            e.stopPropagation();
            chatWindow.classList.remove('active');
            chatButton.classList.remove('chat-open');
            isOpen = false;
        });
        
        // Открытие/закрытие чата
        chatButton.addEventListener('click', function() {
            isOpen = !isOpen;
            
            if (isOpen) {
                chatWindow.classList.add('active');
                chatButton.classList.add('chat-open');
                chatNotification.style.display = 'none';
                
                // Показываем приветственное сообщение бота
                if (!botMessageShown) {
                    setTimeout(() => {
                        showTypingIndicator();
                        
                        setTimeout(() => {
                            hideTypingIndicator();
                            addBotMessage('Привет! Чем могу помочь? 😊');
                            
                            setTimeout(() => {
                                addBotMessage('Напишите свой вопрос, и я быстро отвечу!', true);
                            }, 800);
                        }, 1500);
                    }, 500);
                    
                    botMessageShown = true;
                }
                
                // Если есть тикет, загружаем историю сообщений
                if (ticketId) {
                    loadChatHistory();
                }
                
                // Запускаем polling для получения новых сообщений
                startPolling();
                
                chatInput.focus();
            } else {
                chatWindow.classList.remove('active');
                chatButton.classList.remove('chat-open');
                
                // НЕ останавливаем polling - продолжаем слушать даже когда чат закрыт
                // stopPolling();
            }
        });
        
        // Отправка сообщения
        async function sendMessage() {
            const message = chatInput.value.trim();
            
            if (message) {
                addUserMessage(message);
                chatInput.value = '';
                
                // Если это первое сообщение, запрашиваем имя и email
                if (!ticketId && !customerName) {
                    // Просто отправляем сообщение без данных клиента
                    customerName = 'Гость';
                }
                
                try {
                    // Отправляем сообщение на сервер
                    const response = await fetch('/api/support/send-message', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            ticketId: ticketId,
                            customerName: customerName,
                            customerEmail: customerEmail,
                            message: message
                        })
                    });
                    
                    const data = await response.json();
                    
                    if (data.success && data.ticketId) {
                        ticketId = data.ticketId;
                        localStorage.setItem('supportTicketId', ticketId);
                        console.log('✅ Сообщение отправлено, тикет:', ticketId);
                        
                        // Если это первое сообщение, запускаем polling
                        if (!pollingInterval) {
                            startPolling();
                        }
                    }
                } catch (error) {
                    console.error('Ошибка отправки сообщения:', error);
                }
            }
        }
        
        // Отправка изображения
        async function sendImage(file) {
            try {
                // Создаем имя клиента если его нет
                if (!ticketId && !customerName) {
                    customerName = 'Гость';
                }
                
                // Показываем предпросмотр изображения сразу
                const reader = new FileReader();
                reader.onload = function(e) {
                    addUserImage(e.target.result);
                };
                reader.readAsDataURL(file);
                
                // Загружаем изображение на сервер
                const formData = new FormData();
                formData.append('image', file);
                
                const uploadResponse = await fetch('/api/support/upload-image', {
                    method: 'POST',
                    body: formData
                });
                
                const uploadData = await uploadResponse.json();
                
                if (!uploadData.success) {
                    console.error('Ошибка загрузки изображения');
                    return;
                }
                
                const imageUrl = uploadData.imageUrl;
                
                // Отправляем сообщение с изображением
                const response = await fetch('/api/support/send-message', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        ticketId: ticketId,
                        customerName: customerName,
                        customerEmail: customerEmail,
                        message: '📷 Изображение',
                        imageUrl: imageUrl
                    })
                });
                
                const data = await response.json();
                
                if (data.success && data.ticketId) {
                    ticketId = data.ticketId;
                    localStorage.setItem('supportTicketId', ticketId);
                    console.log('✅ Изображение отправлено, тикет:', ticketId);
                    
                    // Если это первое сообщение, запускаем polling
                    if (!pollingInterval) {
                        startPolling();
                    }
                }
            } catch (error) {
                console.error('Ошибка отправки изображения:', error);
            }
        }
        
        // Загрузка истории чата
        async function loadChatHistory() {
            if (!ticketId) return;
            
            try {
                const response = await fetch(`/api/support/messages/${ticketId}`);
                if (response.ok) {
                    const data = await response.json();
                    
                    // Очищаем чат (кроме приветственных сообщений)
                    const messages = chatBody.querySelectorAll('.chat-message');
                    messages.forEach(msg => {
                        if (!msg.classList.contains('welcome-message')) {
                            msg.remove();
                        }
                    });
                    
                    // Отображаем все сообщения
                    data.messages.forEach(msg => {
                        if (msg.sender_type === 'customer') {
                            if (msg.image_url) {
                                addUserImage(msg.image_url, false);
                            } else {
                                addUserMessage(msg.message, false);
                            }
                        } else if (msg.sender_type === 'admin') {
                            if (msg.image_url) {
                                addAdminImage(msg.image_url, msg.sender_name);
                            } else {
                                addAdminMessage(msg.message, msg.sender_name);
                            }
                        } else if (msg.sender_type === 'system') {
                            addSystemMessage(msg.message);
                        }
                        
                        if (msg.id > lastMessageId) {
                            lastMessageId = msg.id;
                        }
                    });
                }
            } catch (error) {
                console.error('Ошибка загрузки истории:', error);
            }
        }
        
        // Polling для получения новых сообщений
        function startPolling() {
            // Запускаем polling даже если нет ticketId (он может появиться)
            if (pollingInterval) {
                clearInterval(pollingInterval);
            }
            
            // Проверяем каждые 3 секунды
            pollingInterval = setInterval(async () => {
                if (!ticketId) return; // Пропускаем если еще нет тикета
                
                try {
                    const response = await fetch(`/api/support/messages/${ticketId}`);
                    if (response.ok) {
                        const data = await response.json();
                        
                        // Показываем только новые сообщения
                        const newMessages = data.messages.filter(msg => msg.id > lastMessageId);
                        
                        newMessages.forEach(msg => {
                            if (msg.sender_type === 'admin') {
                                // Если чат открыт - показываем сообщение в чате
                                if (isOpen) {
                                    showTypingIndicator();
                                    setTimeout(() => {
                                        hideTypingIndicator();
                                        if (msg.image_url) {
                                            addAdminImage(msg.image_url, msg.sender_name);
                                        } else {
                                            addAdminMessage(msg.message, msg.sender_name);
                                        }
                                    }, 1000);
                                }
                                
                                // Воспроизводим звук и показываем уведомление
                                playNotificationSound();
                                
                                // Если чат закрыт - показываем уведомление на сайте
                                if (!isOpen) {
                                    const shortMessage = msg.image_url ? '📷 Вам отправили изображение' : (msg.message.length > 80 
                                        ? msg.message.substring(0, 80) + '...' 
                                        : msg.message);
                                    showSiteNotification(shortMessage);
                                    chatNotification.style.display = 'block';
                                }
                            } else if (msg.sender_type === 'system') {
                                if (isOpen) {
                                    addSystemMessage(msg.message);
                                }
                                playNotificationSound();
                            }
                            
                            if (msg.id > lastMessageId) {
                                lastMessageId = msg.id;
                            }
                        });
                    }
                } catch (error) {
                    console.error('Ошибка polling:', error);
                }
            }, 3000);
        }
        
        function stopPolling() {
            if (pollingInterval) {
                clearInterval(pollingInterval);
                pollingInterval = null;
            }
        }
        
        // Функция показа уведомления НА сайте
        function showSiteNotification(message) {
            // Создаем контейнер для уведомления если его нет
            let notifContainer = document.getElementById('chat-notification-popup');
            if (!notifContainer) {
                notifContainer = document.createElement('div');
                notifContainer.id = 'chat-notification-popup';
                notifContainer.style.cssText = `
                    position: fixed;
                    top: 20px;
                    right: 20px;
                    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                    color: white;
                    padding: 20px 25px;
                    border-radius: 15px;
                    box-shadow: 0 10px 40px rgba(102, 126, 234, 0.4);
                    z-index: 999999;
                    max-width: 350px;
                    cursor: pointer;
                    animation: slideInRight 0.4s ease-out;
                    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
                `;
                document.body.appendChild(notifContainer);
                
                // Добавляем анимацию
                const style = document.createElement('style');
                style.textContent = `
                    @keyframes slideInRight {
                        from {
                            transform: translateX(400px);
                            opacity: 0;
                        }
                        to {
                            transform: translateX(0);
                            opacity: 1;
                        }
                    }
                    @keyframes slideOutRight {
                        from {
                            transform: translateX(0);
                            opacity: 1;
                        }
                        to {
                            transform: translateX(400px);
                            opacity: 0;
                        }
                    }
                `;
                document.head.appendChild(style);
            }
            
            // Контент уведомления
            notifContainer.innerHTML = `
                <div style="display: flex; align-items: flex-start; gap: 15px;">
                    <div style="font-size: 32px;">💬</div>
                    <div style="flex: 1;">
                        <div style="font-weight: 700; font-size: 16px; margin-bottom: 5px;">
                            Вам ответили в чате
                        </div>
                        <div style="font-size: 14px; opacity: 0.95; line-height: 1.4;">
                            ${message}
                        </div>
                        <div style="font-size: 12px; opacity: 0.8; margin-top: 8px;">
                            Нажмите чтобы открыть
                        </div>
                    </div>
                    <button onclick="event.stopPropagation(); this.closest('#chat-notification-popup').remove();" style="background: rgba(255,255,255,0.2); border: none; color: white; width: 24px; height: 24px; border-radius: 50%; cursor: pointer; font-size: 16px; line-height: 1;">×</button>
                </div>
            `;
            
            // При клике открываем чат
            notifContainer.onclick = function() {
                if (!isOpen) {
                    chatButton.click();
                }
                notifContainer.style.animation = 'slideOutRight 0.3s ease-in';
                setTimeout(() => notifContainer.remove(), 300);
            };
            
            // Автоматически скрываем через 8 секунд
            setTimeout(() => {
                if (notifContainer && notifContainer.parentNode) {
                    notifContainer.style.animation = 'slideOutRight 0.3s ease-in';
                    setTimeout(() => {
                        if (notifContainer && notifContainer.parentNode) {
                            notifContainer.remove();
                        }
                    }, 300);
                }
            }, 8000);
        }
        
        // Функция воспроизведения звука уведомления
        function playNotificationSound() {
            try {
                const audio = new Audio('notification.mp3');
                audio.volume = 0.5; // Громкость 50%
                audio.play().catch(err => console.log('Звук не воспроизведен:', err));
            } catch (error) {
                console.log('Звук не воспроизведен:', error);
            }
        }
        
        chatSendBtn.addEventListener('click', sendMessage);
        
        chatInput.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
                sendMessage();
            }
        });
        
        // Обработчик кнопки прикрепления изображения
        chatImageBtn.addEventListener('click', function() {
            chatImageInput.click();
        });
        
        // Обработчик выбора файла
        chatImageInput.addEventListener('change', async function(e) {
            const file = e.target.files[0];
            if (!file) return;
            
            // Проверка размера (макс 5 МБ)
            if (file.size > 5 * 1024 * 1024) {
                alert('Размер файла не должен превышать 5 МБ');
                chatImageInput.value = '';
                return;
            }
            
            // Проверка типа
            if (!file.type.startsWith('image/')) {
                alert('Можно загружать только изображения');
                chatImageInput.value = '';
                return;
            }
            
            await sendImage(file);
            chatImageInput.value = '';
        });
        
        // Функция добавления сообщения бота
        function addBotMessage(text, withButtons = false) {
            const time = new Date().toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
            
            const messageHTML = `
                <div class="chat-message bot">
                    <div class="chat-message-avatar">
                        <img src="support-image.png" alt="Bot" style="width: 100%; height: 100%; object-fit: cover; border-radius: 50%;">
                    </div>
                    <div class="chat-message-content">
                        <div class="chat-message-bubble">${text}</div>
                        <div class="chat-message-time">${time}</div>
                        ${withButtons ? `
                            <div class="quick-replies">
                                <button class="quick-reply-btn" onclick="handleQuickReply('payment')">
                                    💳 Вопрос по оплате
                                </button>
                                <button class="quick-reply-btn" onclick="handleQuickReply('order')">
                                    📦 Статус заказа
                                </button>
                                <button class="quick-reply-btn" onclick="handleQuickReply('other')">
                                    ❓ Другой вопрос
                                </button>
                            </div>
                        ` : ''}
                    </div>
                </div>
            `;
            
            chatBody.insertAdjacentHTML('beforeend', messageHTML);
            scrollToBottom();
        }
        
        // Функция добавления сообщения пользователя
        function addUserMessage(text, shouldScroll = true) {
            const time = new Date().toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
            
            const messageHTML = `
                <div class="chat-message user">
                    <div class="chat-message-avatar">👤</div>
                    <div class="chat-message-content">
                        <div class="chat-message-bubble">${text}</div>
                        <div class="chat-message-time">${time}</div>
                    </div>
                </div>
            `;
            
            chatBody.insertAdjacentHTML('beforeend', messageHTML);
            if (shouldScroll) scrollToBottom();
        }
        
        // Функция добавления изображения пользователя
        function addUserImage(imageUrl, shouldScroll = true) {
            const time = new Date().toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
            
            const messageHTML = `
                <div class="chat-message user">
                    <div class="chat-message-avatar">👤</div>
                    <div class="chat-message-content">
                        <div class="chat-message-bubble" style="padding: 4px;">
                            <img src="${imageUrl}" alt="Изображение" style="max-width: 100%; border-radius: 10px; cursor: pointer;" onclick="window.open('${imageUrl}', '_blank')">
                        </div>
                        <div class="chat-message-time">${time}</div>
                    </div>
                </div>
            `;
            
            chatBody.insertAdjacentHTML('beforeend', messageHTML);
            if (shouldScroll) scrollToBottom();
        }
        
        // Функция добавления сообщения от админа
        function addAdminMessage(text, senderName = 'Поддержка') {
            const time = new Date().toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
            
            const messageHTML = `
                <div class="chat-message bot">
                    <div class="chat-message-avatar">
                        <img src="support-image.png" alt="Support" style="width: 100%; height: 100%; object-fit: cover; border-radius: 50%;">
                    </div>
                    <div class="chat-message-content">
                        <div style="font-size: 11px; color: #667eea; font-weight: 600; margin-bottom: 4px;">
                            ${senderName}
                        </div>
                        <div class="chat-message-bubble">${text}</div>
                        <div class="chat-message-time">${time}</div>
                    </div>
                </div>
            `;
            
            chatBody.insertAdjacentHTML('beforeend', messageHTML);
            scrollToBottom();
        }
        
        // Функция добавления изображения от админа
        function addAdminImage(imageUrl, senderName = 'Поддержка') {
            const time = new Date().toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
            
            const messageHTML = `
                <div class="chat-message bot">
                    <div class="chat-message-avatar">
                        <img src="support-image.png" alt="Support" style="width: 100%; height: 100%; object-fit: cover; border-radius: 50%;">
                    </div>
                    <div class="chat-message-content">
                        <div style="font-size: 11px; color: #667eea; font-weight: 600; margin-bottom: 4px;">
                            ${senderName}
                        </div>
                        <div class="chat-message-bubble" style="padding: 4px;">
                            <img src="${imageUrl}" alt="Изображение" style="max-width: 100%; border-radius: 10px; cursor: pointer;" onclick="window.open('${imageUrl}', '_blank')">
                        </div>
                        <div class="chat-message-time">${time}</div>
                    </div>
                </div>
            `;
            
            chatBody.insertAdjacentHTML('beforeend', messageHTML);
            scrollToBottom();
        }
        
        // Функция добавления системного сообщения
        function addSystemMessage(text) {
            const time = new Date().toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
            
            const messageHTML = `
                <div style="text-align: center; margin: 15px 0;">
                    <div style="display: inline-block; background: #f0f0f0; color: #666; padding: 8px 16px; border-radius: 20px; font-size: 12px; font-weight: 500;">
                        ${text}
                    </div>
                    <div style="font-size: 10px; color: #999; margin-top: 4px;">${time}</div>
                </div>
            `;
            
            chatBody.insertAdjacentHTML('beforeend', messageHTML);
            scrollToBottom();
        }
        
        // Индикатор печатания
        let typingIndicator;
        
        function showTypingIndicator() {
            const indicatorHTML = `
                <div class="chat-message bot">
                    <div class="chat-message-avatar">
                        <img src="support-image.png" alt="Bot" style="width: 100%; height: 100%; object-fit: cover; border-radius: 50%;">
                    </div>
                    <div class="chat-message-content">
                        <div class="typing-indicator active">
                            <div class="typing-dot"></div>
                            <div class="typing-dot"></div>
                            <div class="typing-dot"></div>
                        </div>
                    </div>
                </div>
            `;
            
            chatBody.insertAdjacentHTML('beforeend', indicatorHTML);
            typingIndicator = chatBody.lastElementChild;
            scrollToBottom();
        }
        
        function hideTypingIndicator() {
            if (typingIndicator) {
                typingIndicator.remove();
                typingIndicator = null;
            }
        }
        
        // Прокрутка вниз
        function scrollToBottom() {
            setTimeout(() => {
                chatBody.scrollTop = chatBody.scrollHeight;
            }, 100);
        }
        
        // Показать уведомление через 5 секунд после загрузки
        setTimeout(() => {
            if (!isOpen) {
                chatNotification.style.display = 'block';
            }
        }, 5000);
        
        // Если есть тикет, запускаем polling сразу при загрузке страницы
        if (ticketId) {
            startPolling();
        }
        
        // Глобальная функция для быстрых ответов
        window.handleQuickReply = function(type) {
            const replies = {
                payment: 'Вопрос по оплате',
                order: 'Узнать статус заказа',
                other: 'У меня другой вопрос'
            };
            
            addUserMessage(replies[type]);
            
            setTimeout(() => {
                showTypingIndicator();
                
                setTimeout(() => {
                    hideTypingIndicator();
                    
                    const responses = {
                        payment: 'Мы принимаем оплату через ЮMoney и Тинькофф. Оплата безопасна и мгновенна! 💳',
                        order: 'Пожалуйста, укажите номер вашего заказа или email, на который оформляли покупку. 📧',
                        other: 'Опишите ваш вопрос, и я постараюсь помочь! Если нужно, подключу оператора. 👨‍💼'
                    };
                    
                    addBotMessage(responses[type]);
                }, 1500);
            }, 300);
        };
    });
})();

