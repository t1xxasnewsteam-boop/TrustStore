// Поиск по товарам Trust Store

// База данных всех товаров
const products = [
    { 
        name: 'ChatGPT Plus', 
        url: '/product/chatgpt', 
        category: 'AI Генерация', 
        price: 'от 2 250 ₽', 
        image: 'gpt-image.png',
        aliases: ['чатджипити', 'чат джипити', 'чат', 'джипити', 'гпт', 'chatgpt', 'gpt']
    },
    { 
        name: 'Midjourney', 
        url: '/product/midjourney', 
        category: 'AI Генерация', 
        price: 'от 500 ₽', 
        image: 'midjourney-image.png',
        aliases: ['миджорни', 'миджёрни', 'мидджорни', 'midjourney', 'mj']
    },
    { 
        name: 'Личный VPN', 
        url: '/product/vpn', 
        category: 'Безопасность', 
        price: 'от 500 ₽', 
        image: 'vpn-image.png',
        aliases: ['впн', 'вин', 'vpn', 'вепеэн']
    },
    { 
        name: 'Google Gemini', 
        url: '/product/gemini', 
        category: 'AI Генерация', 
        price: 'от 2 250 ₽', 
        image: 'gemini-image.png',
        aliases: ['гемини', 'джемини', 'гугл', 'gemini', 'google']
    },
    { 
        name: 'Gemini Veo 3', 
        url: '/product/gemini', 
        category: 'AI Генерация', 
        price: 'от 2 250 ₽', 
        image: 'gemini-image.png',
        aliases: ['гемини', 'джемини', 'гугл', 'veo', 'вео']
    },
    { 
        name: 'Cursor AI Pro', 
        url: '/product/cursor', 
        category: 'AI Генерация', 
        price: 'от 2 250 ₽', 
        image: 'cursor-image.png',
        aliases: ['курсор', 'курзор', 'cursor', 'кёрсор']
    },
    { 
        name: 'Claude AI Pro', 
        url: '/product/claude', 
        category: 'AI Генерация', 
        price: 'от 2 250 ₽', 
        image: 'claude-image.png',
        aliases: ['клод', 'клауд', 'claude']
    },
    { 
        name: 'YouTube Premium', 
        url: '/product/youtube', 
        category: 'Видео', 
        price: 'от 800 ₽', 
        image: 'youtube-image.png',
        aliases: ['ютуб', 'ютюб', 'youtube', 'ютьюб', 'музыка']
    },
    { 
        name: 'Music Premium', 
        url: '/product/youtube', 
        category: 'Видео', 
        price: 'от 800 ₽', 
        image: 'youtube-image.png',
        aliases: ['музыка', 'мюзик', 'music', 'ютуб музыка']
    },
    { 
        name: 'Adobe Creative Cloud', 
        url: '/product/adobe', 
        category: 'Дизайн', 
        price: 'от 1 700 ₽', 
        image: 'adobe-image.png',
        aliases: ['адоб', 'адобе', 'adobe', 'фотошоп', 'photoshop']
    },
    { 
        name: 'CapCut Pro', 
        url: '/product/capcut', 
        category: 'Монтаж', 
        price: 'от 1 250 ₽', 
        image: 'capcut-image.png',
        aliases: ['капкат', 'капкут', 'capcut', 'монтаж']
    },
    { 
        name: 'VPN', 
        url: '/product/vpn', 
        category: 'Безопасность', 
        price: 'от 500 ₽', 
        image: 'vpn-image.png',
        aliases: ['впн', 'вин', 'vpn', 'вепеэн']
    },
    { 
        name: 'ElevenLabs Creator', 
        url: '/product/elevenlabs', 
        category: 'AI Голос', 
        price: 'от 2 700 ₽', 
        image: 'elevenlabs-image.png',
        aliases: ['элевенлабс', 'элевен лабс', 'elevenlabs', 'eleven labs', 'голос', 'ai голос', 'озвучка', 'токены', '100000']
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
            
            // Фильтруем товары (ищем по названию, категории и алиасам)
            const filteredProducts = products.filter(product => {
                const nameMatch = product.name.toLowerCase().includes(query);
                const categoryMatch = product.category && product.category.toLowerCase().includes(query);
                const aliasMatch = product.aliases && product.aliases.some(alias => 
                    alias.toLowerCase().includes(query)
                );
                return nameMatch || categoryMatch || aliasMatch;
            });
            
            // Отображаем результаты
            if (filteredProducts.length === 0) {
                searchResults.innerHTML = `
                    <div class="search-no-results">
                        <div class="no-results-icon">😔</div>
                        <h3>Ничего не найдено</h3>
                        <p>Попробуйте изменить запрос</p>
                    </div>
                `;
            } else {
                searchResults.innerHTML = filteredProducts.map(product => `
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
    const regex = new RegExp(`(${query})`, 'gi');
    return text.replace(regex, '<mark>$1</mark>');
}

