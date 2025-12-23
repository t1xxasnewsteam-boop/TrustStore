// Динамический счетчик продаж - работает 24/7, увеличивается каждый час в случайное время

// Конфигурация для каждого товара: [начальное число, продаж в час]
// Для ChatGPT: 1.5 в час = каждый час случайно +1 или +2
// Для остальных: продаж в день / 24 = продаж в час (округлено)
const salesConfig = {
    'chatgpt': [1390, 1.5],      // ChatGPT Plus - начальное: 1390, 1.5 в час (36 в день)
    'midjourney': [230, 0.125],  // Midjourney - начальное: 230, 0.125 в час (3 в день)
    'vpn': [600, 0.417],         // Личный VPN - начальное: 600, 0.417 в час (10 в день)
    'gemini': [540, 0.75],      // Google Gemini - начальное: 540, 0.75 в час (18 в день)
    'youtube': [115, 0.083],     // YouTube Premium - начальное: 115, 0.083 в час (2 в день)
    'adobe': [350, 0.125],       // Adobe Creative Cloud - начальное: 350, 0.125 в час (3 в день)
    'capcut': [500, 0.208],      // CapCut Pro - начальное: 500, 0.208 в час (5 в день)
    'elevenlabs': [115, 0.125],  // ElevenLabs - начальное: 115, 0.125 в час (3 в день)
    'microsoft': [160, 0.208],   // Microsoft Office 365 - начальное: 160, 0.208 в час (5 в день)
    'perplexity': [406, 0.417],  // Perplexity Pro - начальное: 406, 0.417 в час (10 в день)
    'canva': [80, 0.125],        // Canva Pro - начальное: 80, 0.125 в час (3 в день)
    'figma': [60, 0.125],        // Figma Professional - начальное: 60, 0.125 в час (3 в день)
    'cursor': [850, 0.417],     // Cursor AI - начальное: 850, 0.417 в час (10 в день)
    'claude': [220, 0.125]      // Claude AI - начальное: 220, 0.125 в час (3 в день)
};

// Функция для получения случайной минуты часа для каждого товара (генерируется один раз в день)
function getRandomMinuteForProduct(productKey) {
    const key = `minute_${productKey}`;
    const today = new Date().toDateString();
    const savedDate = localStorage.getItem(`${key}_date`);
    
    if (savedDate === today) {
        // Используем сохраненную минуту
        return parseInt(localStorage.getItem(`${key}_minute`) || '34');
    }
    
    // Генерируем новую случайную минуту (от 0 до 59)
    const randomMinute = Math.floor(Math.random() * 60);
    localStorage.setItem(`${key}_date`, today);
    localStorage.setItem(`${key}_minute`, randomMinute.toString());
    
    return randomMinute;
}

// Функция для вычисления текущего значения продаж
function getCurrentSales(productKey) {
    const config = salesConfig[productKey];
    if (!config) return 0;
    
    const [startValue, salesPerHour] = config;
    const key = `sales_${productKey}`;
    
    // Получаем текущее время
    const now = new Date();
    const today = now.toDateString();
    const currentHour = now.getHours();
    const currentMinute = now.getMinutes();
    
    // Получаем сохраненное значение и дату последнего обновления
    const lastUpdateDate = localStorage.getItem(`${key}_date`);
    const savedValue = localStorage.getItem(`${key}_value`);
    const lastProcessedHour = localStorage.getItem(`${key}_hour`);
    
    let currentValue;
    
    // Проверяем, нужно ли сбросить значение (если конфигурация изменилась)
    const saved = savedValue ? parseInt(savedValue) : null;
    const needsReset = saved && (saved > startValue + 500 || saved < startValue - 100);
    
    if (needsReset) {
        // Значение сильно отличается от начального - сбрасываем (конфигурация изменилась)
        currentValue = startValue;
        localStorage.setItem(`${key}_date`, today);
        localStorage.setItem(`${key}_value`, currentValue.toString());
        localStorage.setItem(`${key}_hour`, '-1');
    } else if (lastUpdateDate === today && savedValue) {
        // Сегодня уже обновляли и значение корректное
        currentValue = parseInt(savedValue);
    } else {
        // Новый день или первый запуск - начинаем с начального значения
        currentValue = startValue;
        localStorage.setItem(`${key}_date`, today);
        localStorage.setItem(`${key}_value`, currentValue.toString());
        localStorage.setItem(`${key}_hour`, '-1');
    }
    
    // Получаем случайную минуту для этого товара (одна на день)
    const targetMinute = getRandomMinuteForProduct(productKey);
    
    // Проверяем все прошедшие часы с начала дня
    const processedHours = lastProcessedHour ? lastProcessedHour.split(',').map(h => parseInt(h)) : [];
    
    // Для каждого часа от 0 до текущего часа
    for (let hour = 0; hour <= currentHour; hour++) {
        // Если этот час еще не обработан
        if (!processedHours.includes(hour)) {
            // Для текущего часа: проверяем, прошла ли уже случайная минута
            if (hour === currentHour) {
                if (currentMinute >= targetMinute) {
                    // Время пришло - добавляем продажи
                    if (productKey === 'chatgpt') {
                        // ChatGPT: случайно +1 или +2 (в среднем 1.5)
                        currentValue += Math.random() < 0.5 ? 1 : 2;
                    } else if (salesPerHour > 0) {
                        // Остальные: добавляем с вероятностью salesPerHour
                        if (Math.random() < salesPerHour) {
                            currentValue += 1;
                        }
                    }
                    processedHours.push(hour);
                }
            } else {
                // Для прошедших часов: всегда добавляем продажи
                if (productKey === 'chatgpt') {
                    // ChatGPT: случайно +1 или +2
                    currentValue += Math.random() < 0.5 ? 1 : 2;
                } else if (salesPerHour > 0) {
                    // Остальные: добавляем с вероятностью salesPerHour
                    if (Math.random() < salesPerHour) {
                        currentValue += 1;
                    }
                }
                processedHours.push(hour);
            }
        }
    }
    
    // Сохраняем обновленное значение и обработанные часы
    if (processedHours.length > 0) {
        localStorage.setItem(`${key}_value`, currentValue.toString());
        localStorage.setItem(`${key}_hour`, processedHours.join(','));
    }
    
    return currentValue;
}

// Функция для форматирования числа с пробелами
function formatSalesNumber(num) {
    return num.toLocaleString('ru-RU');
}

// Функция для обновления счетчика на странице
function updateSalesCounter(productKey, element) {
    if (!element) return;
    
    const sales = getCurrentSales(productKey);
    const formatted = formatSalesNumber(sales);
    
    // Обновляем текст
    if (element.tagName === 'SPAN') {
        element.textContent = `${formatted} продаж`;
    } else {
        element.textContent = `${formatted} продаж`;
    }
}

// Инициализация счетчиков при загрузке страницы
document.addEventListener('DOMContentLoaded', function() {
    // Обновляем счетчики каждую минуту (чтобы поймать момент, когда наступит случайная минута часа)
    setInterval(function() {
        // Обновляем все счетчики на странице
        Object.keys(salesConfig).forEach(productKey => {
            const elements = document.querySelectorAll(`[data-sales="${productKey}"]`);
            elements.forEach(el => updateSalesCounter(productKey, el));
        });
    }, 60 * 1000); // Каждую минуту
    
    // Обновляем счетчики сразу при загрузке
    Object.keys(salesConfig).forEach(productKey => {
        const elements = document.querySelectorAll(`[data-sales="${productKey}"]`);
        elements.forEach(el => updateSalesCounter(productKey, el));
    });
});

// Экспортируем функции для использования в других скриптах
window.getCurrentSales = getCurrentSales;
window.updateSalesCounter = updateSalesCounter;
window.formatSalesNumber = formatSalesNumber;

