// Поиск по товарам Trust Store

// База данных всех товаров
const products = [
    { 
        name: 'ChatGPT Plus', 
        url: '/product/chatgpt', 
        category: 'Подписка', 
        price: 'от 2 250 ₽', 
        image: 'gpt-image.png',
        aliases: ['чатджипити', 'чат джипити', 'чат', 'джипити', 'гпт', 'chatgpt', 'gpt', 'чатгпт', 'openai', 'опенэй', 'опенэйаи', 'нейросеть', 'нейросети', 'ai', 'ии', 'чат гпт', 'чат gpt', 'плюс', 'plus', 'чатгпт плюс']
    },
    { 
        name: 'Midjourney', 
        url: '/product/midjourney', 
        category: 'AI Генерация', 
        price: 'от 500 ₽', 
        image: 'midjourney-image.png',
        aliases: ['миджорни', 'миджёрни', 'мидджорни', 'midjourney', 'mj', 'мидж', 'миджорней', 'миджорн', 'изображения', 'генерация изображений', 'картинки', 'арт', 'рисунки', 'рисование', 'ai арт', 'нейроарт']
    },
    { 
        name: 'Личный VPN', 
        url: '/product/vpn', 
        category: 'Безопасность', 
        price: 'от 500 ₽', 
        image: 'vpn-image.png',
        aliases: ['впн', 'вин', 'vpn', 'вепеэн', 'личный впн', 'безопасность', 'защита', 'приватность', 'анонимность']
    },
    { 
        name: 'Google Gemini + Veo 3', 
        url: '/product/gemini', 
        category: 'AI Генерация', 
        price: 'от 2 250 ₽', 
        image: 'gemini-image.png',
        aliases: ['гемини', 'джемини', 'гугл гемини', 'google gemini', 'gemini', 'google', 'veo', 'вео', 'veo 3', 'вео 3', 'вео3', 'гемини вео', 'гугл', 'нейросеть гугл', 'ai гугл', 'gemini pro', 'гемини про', 'видео генерация', 'генерация видео']
    },
    { 
        name: 'Cursor AI', 
        url: '/product/cursor', 
        category: 'AI Генерация', 
        price: 'от 2 250 ₽', 
        image: 'cursor-image.png',
        aliases: ['курсор', 'курзор', 'cursor', 'кёрсор', 'cursor ai', 'курсор аи', 'код', 'программирование', 'разработка', 'редактор кода', 'ide', 'айди', 'редактор', 'автокод', 'нейрокод']
    },
    { 
        name: 'Claude AI Pro', 
        url: '/product/claude', 
        category: 'AI Генерация', 
        price: 'от 2 250 ₽', 
        image: 'claude-image.png',
        aliases: ['клод', 'клауд', 'claude', 'claude ai', 'клод аи', 'клод про', 'claude pro', 'anthropic', 'антропик', 'антропик аи', 'нейросеть', 'код', 'клод антропик']
    },
    { 
        name: 'YouTube Premium', 
        url: '/product/youtube', 
        category: 'Видео', 
        price: 'от 800 ₽', 
        image: 'youtube-image.png',
        aliases: ['ютуб', 'ютюб', 'youtube', 'ютьюб', 'youtube premium', 'ютуб премиум', 'премиум', 'без рекламы', 'офлайн', 'фоновое воспроизведение', 'музыка', 'мюзик', 'music', 'ютуб музыка', 'youtube music', 'музыка премиум', 'ютубе', 'ютуб про', 'видео', 'подписка']
    },
    { 
        name: 'Adobe Creative Cloud', 
        url: '/product/adobe', 
        category: 'Дизайн', 
        price: 'от 1 700 ₽', 
        image: 'adobe-image.png',
        aliases: ['адоб', 'адобе', 'adobe', 'adobe creative cloud', 'creative cloud', 'фотошоп', 'photoshop', 'пс', 'ps', 'иллюстратор', 'illustrator', 'ai', 'after effects', 'ae', 'премиер', 'premiere', 'pr', 'дизайн', 'графика', 'adobe cc', 'адобе цц', 'фш', 'редактор', 'монтаж']
    },
    { 
        name: 'CapCut Pro', 
        url: '/product/capcut', 
        category: 'Монтаж', 
        price: 'от 1 250 ₽', 
        image: 'capcut-image.png',
        aliases: ['капкат', 'капкут', 'capcut', 'капкат про', 'capcut pro', 'монтаж', 'видео', 'видеомонтаж', 'редактор видео', 'клипы', 'видеоредактор', 'капкат', 'кап кут', 'видео монтаж']
    },
    { 
        name: 'ElevenLabs Creator', 
        url: '/product/elevenlabs', 
        category: 'AI Голос', 
        price: 'от 2 700 ₽', 
        image: 'elevenlabs-image.png',
        aliases: ['элевенлабс', 'элевен лабс', 'elevenlabs', 'eleven labs', 'elevenlabs creator', 'элевенлабс креатор', 'голос', 'ai голос', 'озвучка', 'токены', '100000', '100к', '100 тысяч', 'синтез речи', 'tts', 'voice', 'голосовой', 'озвучивание', 'элевен']
    },
    { 
        name: 'Microsoft Office 365', 
        url: '/product/microsoft', 
        category: 'Офис', 
        price: 'от 5 000 ₽', 
        image: 'microsoft.png',
        aliases: ['микрософт', 'майкрософт', 'microsoft', 'microsoft office', 'office 365', 'office', 'офис', 'ворд', 'word', 'excel', 'эксель', 'powerpoint', 'пауэрпоинт', '365', 'офисный пакет', 'документы', 'таблицы', 'презентации', 'ms office', 'мс офис', 'офис 365', 'майкрософт офис', 'офис майкрософт']
    },
    { 
        name: 'Perplexity Pro', 
        url: '/product/perplexity', 
        category: 'AI Поиск', 
        price: 'от 2 000 ₽', 
        image: 'perplexity-image.png',
        aliases: ['перплексити', 'перплекси', 'perplexity', 'perplexity pro', 'перплексити про', 'поиск', 'ai поиск', 'умный поиск', 'ассистент', 'поисковик', 'поисковая система', 'перплекс', 'поиск аи', 'нейро поиск']
    },
    { 
        name: 'Canva Pro', 
        url: '/product/canva', 
        category: 'Дизайн', 
        price: 'от 1 200 ₽', 
        image: 'canva-image.png',
        aliases: ['канва', 'canva', 'canva pro', 'канва про', 'дизайн', 'дизайнер', 'шаблоны', 'графика', 'креатив', 'баннеры', 'соцсети', 'постеры', 'редактор', 'онлайн дизайн', 'конструктор', 'макеты']
    },
    { 
        name: 'Figma Professional', 
        url: '/product/figma', 
        category: 'Дизайн', 
        price: 'от 1 800 ₽', 
        image: 'figma-image.png',
        aliases: ['фигма', 'figma', 'figma professional', 'фигма про', 'фигма профессиональ', 'прототип', 'прототипирование', 'ui', 'ux', 'интерфейс', 'интерфейсы', 'дизайн', 'дизайнер', 'веб дизайн', 'мобильный дизайн', 'редактор', 'веб', 'сайт', 'приложение']
    }
];

// Открытие/закрытие модального окна поиска
// Ждем полной загрузки DOM перед инициализацией
document.addEventListener('DOMContentLoaded', function() {
    const searchModal = document.getElementById('search-modal');
    const searchInput = document.getElementById('searchInput') || document.getElementById('search-input');
    const searchResults = document.getElementById('searchResults') || document.getElementById('search-results');
    const closeSearchButton = document.querySelector('.search-modal-close') || document.getElementById('close-search');
    
    // Убеждаемся что модальное окно закрыто по умолчанию
    if (searchModal) {
        searchModal.style.display = 'none';
    }
    
    // Находим кнопку поиска (кнопка с иконкой 🔍)
    const searchButton = document.querySelector('.btn-icon')?.textContent?.includes('🔍') 
        ? document.querySelector('.btn-icon')
        : Array.from(document.querySelectorAll('.btn-icon')).find(btn => btn.textContent.includes('🔍'));
    
    // Открыть поиск
    if (searchButton && searchModal) {
        searchButton.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            if (searchModal) {
                // Устанавливаем flex с правильным позиционированием
                searchModal.style.display = 'flex';
                searchModal.style.justifyContent = 'center';
                searchModal.style.alignItems = 'center';
                if (searchInput) {
                    // Небольшая задержка для гарантии что modal виден
                    setTimeout(() => {
                        searchInput.focus();
                    }, 100);
                    searchInput.value = '';
                }
                if (searchResults) {
                    searchResults.innerHTML = '';
                }
            }
        });
    }

    // Закрыть поиск по кнопке
    if (closeSearchButton && searchModal) {
        closeSearchButton.addEventListener('click', () => {
            searchModal.style.display = 'none';
        });
    }
    
    // Закрыть поиск по клику вне модального окна
    if (searchModal) {
        searchModal.addEventListener('click', (e) => {
            if (e.target === searchModal) {
                searchModal.style.display = 'none';
            }
        });
    }
    
    // Закрыть поиск по ESC
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && searchModal && searchModal.style.display === 'flex') {
            searchModal.style.display = 'none';
        }
    });
    
    // Поиск по товарам
    if (searchInput && searchResults) {
        searchInput.addEventListener('input', (e) => {
            const query = e.target.value.toLowerCase().trim();
            
            if (query === '') {
                searchResults.innerHTML = '';
                return;
            }
            
            // Разбиваем запрос на слова
            const queryWords = query.split(/\s+/).filter(word => word.length > 0);
            
            // Фильтруем и ранжируем товары
            const scoredProducts = products.map(product => {
                let score = 0;
                const productName = product.name.toLowerCase();
                const productCategory = (product.category || '').toLowerCase();
                
                // Проверяем каждое слово запроса
                for (const word of queryWords) {
                    // Точное совпадение с названием (высший приоритет)
                    if (productName === word) {
                        score += 100;
                    }
                    // Название начинается со слова
                    else if (productName.startsWith(word)) {
                        score += 50;
                    }
                    // Название содержит слово
                    else if (productName.includes(word)) {
                        score += 30;
                    }
                    
                    // Проверка по алиасам
                    if (product.aliases && product.aliases.length > 0) {
                        for (const alias of product.aliases) {
                            const aliasLower = alias.toLowerCase();
                            if (aliasLower === word) {
                                score += 40;
                            } else if (aliasLower.startsWith(word)) {
                                score += 25;
                            } else if (aliasLower.includes(word)) {
                                score += 15;
                            }
                        }
                    }
                    
                    // Проверка по категории
                    if (productCategory.includes(word)) {
                        score += 10;
                    }
                }
                
                return { product, score };
            }).filter(item => item.score > 0);
            
            // Сортируем по релевантности (сначала самые релевантные)
            scoredProducts.sort((a, b) => b.score - a.score);
            
            // Убираем дубликаты (оставляем товар с наивысшим рейтингом)
            const uniqueProducts = [];
            const seenUrls = new Set();
            for (const item of scoredProducts) {
                if (!seenUrls.has(item.product.url)) {
                    seenUrls.add(item.product.url);
                    uniqueProducts.push(item.product);
                }
            }
            
            // Отображаем результаты
            if (uniqueProducts.length === 0) {
                searchResults.innerHTML = `
                    <div class="search-no-results">
                        <div class="no-results-icon">😔</div>
                        <h3>Ничего не найдено</h3>
                        <p>Попробуйте изменить запрос</p>
                    </div>
                `;
            } else {
                searchResults.innerHTML = uniqueProducts.map(product => `
                    <a href="${product.url}" class="search-result-item">
                        <img src="${product.image}" alt="${product.name}" class="search-result-image">
                        <div class="search-result-info">
                            <h4>${highlightText(product.name, query)}</h4>
                            <p><span class="search-category">${product.category}</span> • ${product.price}</p>
                        </div>
                        <div class="search-result-arrow">→</div>
                    </a>
                `).join('');
            }
        });
    }
}); // Конец DOMContentLoaded

// Подсветка совпадений в тексте
function highlightText(text, query) {
    // Разбиваем запрос на слова и экранируем спецсимволы
    const queryWords = query.split(/\s+/).filter(word => word.length > 0);
    let highlightedText = text;
    
    // Подсвечиваем каждое слово из запроса
    for (const word of queryWords) {
        const escapedWord = word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const regex = new RegExp(`(${escapedWord})`, 'gi');
        highlightedText = highlightedText.replace(regex, '<mark>$1</mark>');
    }
    
    return highlightedText;
}

