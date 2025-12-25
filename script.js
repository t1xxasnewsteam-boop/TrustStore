// Slow smooth scroll for navigation links
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
        e.preventDefault();
        const target = document.querySelector(this.getAttribute('href'));
        if (target) {
            // Специальные offsets для разных секций
            let offset = 0;
            if (target.id === 'plan-comparison') {
                offset = 200; // Для секции сравнения планов
            } else if (target.id === 'pricing-section') {
                offset = 250; // Для секции выбора тарифов
            } else if (target.id === 'apps-list') {
                offset = 100; // Для списка приложений Adobe
            } else if (target.id === 'functions-list') {
                offset = 100; // Для списка функций CapCut
            }
            const targetPosition = target.getBoundingClientRect().top + window.pageYOffset - offset;
            const startPosition = window.pageYOffset;
            const distance = targetPosition - startPosition;
            const duration = 2000; // 2 секунды - медленная прокрутка
            let start = null;
            
            function animation(currentTime) {
                if (start === null) start = currentTime;
                const timeElapsed = currentTime - start;
                const run = ease(timeElapsed, startPosition, distance, duration);
                window.scrollTo(0, run);
                if (timeElapsed < duration) requestAnimationFrame(animation);
            }
            
            // Easing функция для плавности
            function ease(t, b, c, d) {
                t /= d / 2;
                if (t < 1) return c / 2 * t * t * t + b;
                t -= 2;
                return c / 2 * (t * t * t + 2) + b;
            }
            
            requestAnimationFrame(animation);
        }
    });
});

// Shopping cart functionality removed - moved to cart.js

function showNotification(message) {
    // Remove existing notification if any
    const existingNotification = document.querySelector('.notification');
    if (existingNotification) {
        existingNotification.remove();
    }
    
    // Create notification
    const notification = document.createElement('div');
    notification.className = 'notification';
    notification.textContent = message;
    notification.style.cssText = `
        position: fixed;
        top: 100px;
        right: 20px;
        background: linear-gradient(135deg, #26de81 0%, #20bf6b 100%);
        color: white;
        padding: 15px 25px;
        border-radius: 50px;
        box-shadow: 0 10px 30px rgba(38, 222, 129, 0.3);
        z-index: 10000;
        animation: slideInRight 0.3s ease, slideOutRight 0.3s ease 2.7s;
        font-weight: 600;
    `;
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
        notification.remove();
    }, 3000);
}

// Add CSS for notification animations
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

// Product card click effect
document.querySelectorAll('.product-card').forEach(card => {
    card.addEventListener('click', function() {
        const title = this.querySelector('.product-title').textContent;
        console.log('Clicked on:', title);
    });
});

// Scroll animations for product cards
const observerOptions = {
    threshold: 0.1,
    rootMargin: '0px 0px -50px 0px'
};

const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry, index) => {
        if (entry.isIntersecting) {
            setTimeout(() => {
                entry.target.style.opacity = '1';
                entry.target.style.transform = 'translateY(0)';
            }, index * 100);
            observer.unobserve(entry.target);
        }
    });
}, observerOptions);

// Initialize card animations
document.querySelectorAll('.product-card').forEach(card => {
    card.style.opacity = '0';
    card.style.transform = 'translateY(30px)';
    card.style.transition = 'opacity 0.6s ease, transform 0.6s ease';
    observer.observe(card);
});

// Feature cards animation
document.querySelectorAll('.feature-card').forEach(card => {
    card.style.opacity = '0';
    card.style.transform = 'translateY(30px)';
    card.style.transition = 'opacity 0.6s ease, transform 0.6s ease';
    observer.observe(card);
});

// Parallax effect for hero section
window.addEventListener('scroll', () => {
    const scrolled = window.pageYOffset;
    const hero = document.querySelector('.hero');
    if (hero) {
        hero.style.transform = `translateY(${scrolled * 0.5}px)`;
    }
});

// Ripple effect removed per user request

// Определение активной ссылки навигации
document.addEventListener('DOMContentLoaded', function() {
    const currentPath = window.location.pathname;
    const currentFile = window.location.pathname.split('/').pop() || 'index.html';
    const navLinks = document.querySelectorAll('.nav-link');
    
    navLinks.forEach(link => {
        const linkPath = link.getAttribute('href');
        // Убираем класс active со всех ссылок
        link.classList.remove('active');
        
        // Проверяем, соответствует ли путь ссылки текущему пути
        if (linkPath === '/') {
            // Для главной страницы
            if (currentPath === '/' || currentPath === '/index.html' || currentFile === 'index.html' || currentFile === 'main.html') {
                link.classList.add('active');
            }
        } else if (linkPath === '/catalog' || linkPath === '/catalog.html') {
            // Для каталога
            if (currentPath.includes('catalog') || currentFile === 'catalog.html') {
                link.classList.add('active');
            }
        } else if (linkPath === '/socials' || linkPath === '/socials.html') {
            // Для соцсетей
            if (currentPath.includes('socials') || currentFile === 'socials.html') {
                link.classList.add('active');
            }
        }
    });
    
    // Плавный переход между страницами
    const allLinks = document.querySelectorAll('a[href]');
    
    allLinks.forEach(link => {
        const href = link.getAttribute('href');
        
        // Пропускаем якорные ссылки, внешние ссылки и специальные протоколы
        if (!href || 
            href.startsWith('#') || 
            href.startsWith('http://') ||
            href.startsWith('https://') ||
            href.startsWith('mailto:') ||
            href.startsWith('tel:') ||
            href.startsWith('javascript:')) {
            return;
        }
        
        // Пропускаем ссылки на файлы (например, .pdf, .jpg)
        if (href.match(/\.(pdf|jpg|jpeg|png|gif|zip|rar|doc|docx|xls|xlsx)$/i)) {
            return;
        }
        
        link.addEventListener('click', function(e) {
            // Проверяем, что это действительно внутренняя ссылка
            if (href.startsWith('/') || 
                href.endsWith('.html') || 
                href === 'catalog' || 
                href === 'socials' ||
                href === 'main' ||
                href === 'index') {
                
                e.preventDefault();
                
                // Плавное исчезновение страницы перед переходом
                document.body.style.opacity = '0';
                document.body.style.transition = 'opacity 0.25s ease';
                
                // Небольшая задержка для плавности
                setTimeout(() => {
                    window.location.href = href;
                }, 250);
            }
        });
    });
});

console.log('Trust Store загружен успешно! 🎉');

