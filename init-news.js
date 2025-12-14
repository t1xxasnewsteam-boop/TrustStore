const Database = require('better-sqlite3');
const db = new Database('./analytics.db');

console.log('🎉 Добавление текущих новостей в базу данных...\n');

// Проверяем, есть ли уже новости
const existingNews = db.prepare('SELECT COUNT(*) as count FROM news').get();

if (existingNews.count > 0) {
    console.log(`⚠️  В базе уже есть ${existingNews.count} новостей.`);
    console.log('Хотите очистить и добавить заново? (Ctrl+C для отмены)\n');
    // Очищаем
    db.prepare('DELETE FROM news').run();
    console.log('✅ Старые новости удалены\n');
}

// Текущие новости с сайта
const newsData = [
    {
        date: '14 декабря 2025',
        title: '🎄 С наступающим Новым годом!',
        content: 'Друзья! Поздравляем вас с наступающим Новым годом! 🎉 В честь праздника приготовили специальные предложения и скидки. Оставайтесь с нами и следите за новостями!',
        image_url: 'banner-bg.png',
        emoji: null,
        sort_order: 10
    },
    {
        date: '29 октября 2025',
        title: 'Добро пожаловать в Trust Store!',
        content: 'Рады приветствовать вас в нашем магазине цифровых товаров. Здесь вы найдете лучшие предложения на популярные сервисы и подписки.',
        image_url: null,
        emoji: '👋',
        sort_order: 3
    },
    {
        date: '23 октября 2025',
        title: '🌐 Уже попробовали Atlas?',
        content: 'Этот браузер, который думает вместе с вами, — не фантастика, а новый Atlas от OpenAI. Теперь он доступен по подписке ChatGPT Plus! 🚀 Серфите умнее, работайте быстрее, создавайте проще. Atlas полностью интегрирован с ChatGPT 5, имеет режим агента, встроенную память и может выполнять задачи за вас прямо в браузере.',
        image_url: 'atlas-image.png',
        emoji: null,
        sort_order: 2
    }
];

const stmt = db.prepare(`
    INSERT INTO news (date, title, content, image_url, emoji, sort_order)
    VALUES (?, ?, ?, ?, ?, ?)
`);

for (const news of newsData) {
    stmt.run(news.date, news.title, news.content, news.image_url, news.emoji, news.sort_order);
    console.log(`✅ Добавлена: "${news.title}"`);
}

console.log(`\n🎊 Успешно добавлено ${newsData.length} новостей!`);
console.log('📊 Текущие новости в базе:');

const allNews = db.prepare('SELECT * FROM news ORDER BY sort_order DESC').all();
allNews.forEach((news, index) => {
    console.log(`   ${index + 1}. [${news.date}] ${news.title}`);
    console.log(`      Фото: ${news.image_url || 'нет'}, Эмодзи: ${news.emoji || 'нет'}`);
});

db.close();

