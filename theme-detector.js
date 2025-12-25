/**
 * Автоматическое определение системной темы устройства
 * Сканирует системную тему ТОЛЬКО при первом входе
 * Если пользователь выбрал противоположный цвет один раз - сохраняется навсегда
 */
(function() {
    'use strict';
    
    // Функция для определения системной темы
    function getSystemTheme() {
        if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
            return 'dark-theme';
        }
        return 'light-theme';
    }
    
    // Функция для применения темы
    function applyTheme(theme) {
        const body = document.body;
        const html = document.documentElement;
        
        if (theme === 'light-theme' || theme === 'light') {
            body.classList.remove('dark-theme');
            body.classList.add('light-theme');
            html.style.backgroundColor = '#ffffff';
            body.style.backgroundColor = '#ffffff';
            body.style.color = '#1a1a1a';
        } else {
            body.classList.remove('light-theme');
            body.classList.add('dark-theme');
            html.style.backgroundColor = '#0a0a0a';
            body.style.backgroundColor = '#0a0a0a';
            body.style.color = '#e5e5e5';
        }
        
        // Обновляем состояние тумблера
        const themeToggle = document.getElementById('theme-toggle');
        if (themeToggle) {
            themeToggle.checked = (theme === 'dark-theme' || theme === 'dark');
        }
    }
    
    // Функция для инициализации темы
    function initTheme() {
        const savedTheme = localStorage.getItem('theme');
        const userHasChangedTheme = localStorage.getItem('userThemeChanged') === 'true';
        
        if (userHasChangedTheme && savedTheme) {
            // Пользователь вручную переключил тему - используем сохраненную НАВСЕГДА
            // Больше не сканируем системную тему
            applyTheme(savedTheme);
        } else if (savedTheme) {
            // Есть сохраненная тема, но пользователь не менял вручную
            // Это значит, что это была системная тема при первом входе
            // Используем сохраненную
            applyTheme(savedTheme);
        } else {
            // ПЕРВЫЙ ВХОД - определяем системную тему
            const systemTheme = getSystemTheme();
            applyTheme(systemTheme);
            localStorage.setItem('theme', systemTheme);
        }
    }
    
    // Применяем тему сразу при загрузке скрипта (до загрузки DOM)
    // Это предотвращает белую вспышку
    if (document.readyState === 'loading') {
        const savedTheme = localStorage.getItem('theme');
        const userHasChangedTheme = localStorage.getItem('userThemeChanged') === 'true';
        
        if (userHasChangedTheme && savedTheme) {
            // Пользователь выбрал тему вручную - используем сохраненную
            if (savedTheme === 'dark-theme' || savedTheme === 'dark') {
                document.documentElement.style.backgroundColor = '#0a0a0a';
            } else {
                document.documentElement.style.backgroundColor = '#ffffff';
            }
        } else if (savedTheme) {
            // Есть сохраненная тема (системная при первом входе)
            if (savedTheme === 'dark-theme' || savedTheme === 'dark') {
                document.documentElement.style.backgroundColor = '#0a0a0a';
            } else {
                document.documentElement.style.backgroundColor = '#ffffff';
            }
        } else {
            // ПЕРВЫЙ ВХОД - определяем системную тему
            const systemTheme = getSystemTheme();
            const html = document.documentElement;
            if (systemTheme === 'dark-theme') {
                html.style.backgroundColor = '#0a0a0a';
            } else {
                html.style.backgroundColor = '#ffffff';
            }
        }
    }
    
    // Инициализируем тему при загрузке DOM
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initTheme);
    } else {
        initTheme();
    }
    
    // НЕ слушаем изменения системной темы - если пользователь выбрал тему вручную,
    // она сохраняется навсегда, пока он не поменяет обратно
    
    // Перехватываем переключение темы через тумблер
    // Помечаем, что пользователь вручную изменил тему
    document.addEventListener('DOMContentLoaded', function() {
        const themeToggle = document.getElementById('theme-toggle');
        if (themeToggle) {
            // Сохраняем оригинальный обработчик, если он есть
            const originalHandler = themeToggle.onchange;
            
            themeToggle.addEventListener('change', function() {
                // Помечаем, что пользователь вручную изменил тему
                // Это сохранится навсегда, пока он не поменяет обратно
                localStorage.setItem('userThemeChanged', 'true');
                
                // Вызываем оригинальный обработчик, если он есть
                if (originalHandler) {
                    originalHandler.call(this);
                }
            });
        }
    });
})();

