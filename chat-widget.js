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
                
                chatInput.focus();
            } else {
                chatWindow.classList.remove('active');
                chatButton.classList.remove('chat-open');
            }
        });
        
        // Отправка сообщения
        function sendMessage() {
            const message = chatInput.value.trim();
            
            if (message) {
                addUserMessage(message);
                chatInput.value = '';
                
                // Имитация ответа бота
                setTimeout(() => {
                    showTypingIndicator();
                    
                    setTimeout(() => {
                        hideTypingIndicator();
                        addBotMessage('Спасибо за ваше сообщение! Наш оператор скоро свяжется с вами. 😊<br><br>📱 Для наиболее быстрого ответа напишите нам в <a href="https://t.me/truststore_admin" target="_blank" style="color: #667eea; font-weight: 600; text-decoration: none;">Telegram</a>!');
                    }, 2000);
                }, 500);
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
        function addUserMessage(text) {
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

