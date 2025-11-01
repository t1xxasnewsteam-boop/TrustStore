const Database = require('better-sqlite3');
const path = require('path');

const dbPath = process.argv[2] || path.join(__dirname, 'analytics.db');
const db = new Database(dbPath);

console.log('=== Проверка писем в БД ===\n');

// Всего писем
const total = db.prepare('SELECT COUNT(*) as c FROM email_messages').get();
console.log('Всего писем:', total.c);

// Писем со СПАМ
const spam = db.prepare("SELECT COUNT(*) as c FROM email_messages WHERE subject LIKE '%[СПАМ]%'").get();
console.log('Писем с [СПАМ]:', spam.c);

// Последние 10 писем
const last = db.prepare(`
    SELECT 
        id,
        from_email, 
        subject, 
        created_at,
        is_read,
        CASE WHEN subject LIKE '%[СПАМ]%' THEN 'ДА' ELSE 'НЕТ' END as is_spam
    FROM email_messages 
    ORDER BY created_at DESC 
    LIMIT 10
`).all();

console.log('\nПоследние 10 писем:');
console.log('─'.repeat(100));
last.forEach((e, i) => {
    const date = new Date(e.created_at).toLocaleString('ru-RU');
    const read = e.is_read ? '✅' : '❌';
    const spamMark = e.is_spam === 'ДА' ? '🚨' : '📧';
    console.log(`${i+1}. ${spamMark} ${read} ${e.from_email}`);
    console.log(`   Тема: ${e.subject}`);
    console.log(`   Дата: ${date}`);
    console.log('');
});

db.close();


