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
            </div>
            
            <div class="chat-body" id="chatBody">
                <!-- Сообщения будут добавляться сюда -->
            </div>
            
            <div class="chat-footer">
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
        
        let isOpen = false;
        let botMessageShown = false;
        let ticketId = localStorage.getItem('supportTicketId') || null;
        let customerName = localStorage.getItem('customerName') || null;
        let customerEmail = localStorage.getItem('customerEmail') || null;
        let lastMessageId = 0;
        let pollingInterval = null;
        
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
                
                // Останавливаем polling
                stopPolling();
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
                            addUserMessage(msg.message, false);
                        } else if (msg.sender_type === 'admin') {
                            addAdminMessage(msg.message, msg.sender_name);
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
                                showTypingIndicator();
                                setTimeout(() => {
                                    hideTypingIndicator();
                                    addAdminMessage(msg.message, msg.sender_name);
                                    
                                    // Воспроизводим звук уведомления
                                    playNotificationSound();
                                }, 1000);
                            } else if (msg.sender_type === 'system') {
                                addSystemMessage(msg.message);
                                playNotificationSound();
                            }
                            
                            if (msg.id > lastMessageId) {
                                lastMessageId = msg.id;
                            }
                        });
                        
                        // Если есть новые сообщения и чат закрыт, показываем уведомление
                        if (newMessages.length > 0 && !isOpen) {
                            chatNotification.style.display = 'block';
                        }
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
        
        // Функция воспроизведения звука уведомления
        function playNotificationSound() {
            try {
                // Используем встроенный звук уведомления (короткий beep)
                const audio = new Audio('data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmwhBTGH0fPTgjMGHm7A7+OZURE');
                audio.volume = 0.5;
                audio.play().catch(e => console.log('Автовоспроизведение заблокировано'));
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

