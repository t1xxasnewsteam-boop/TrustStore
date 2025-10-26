// Trust Store Analytics Tracking
(function() {
    // Отправка данных о посещении
    function trackPageView() {
        const data = {
            page: window.location.pathname,
            referrer: document.referrer || 'direct'
        };

        fetch('/api/track', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(data)
        }).catch(err => console.log('Tracking error:', err));
    }

    // Трекаем при загрузке страницы
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', trackPageView);
    } else {
        trackPageView();
    }
})();

