const Database = require('better-sqlite3');
const db = new Database('/root/TrustStore/analytics.db');

// Проверяем все письма
const total = db.prepare('SELECT COUNT(*) as c FROM email_messages').get();
console.log('Всего писем:', total.c);

// Проверяем письма со СПАМ
const spam = db.prepare("SELECT COUNT(*) as c FROM email_messages WHERE subject LIKE '%[СПАМ]%'").get();
console.log('Писем с [СПАМ]:', spam.c);

// Последние 10 писем
const last = db.prepare('SELECT from_email,subject,created_at FROM email_messages ORDER BY created_at DESC LIMIT 10').all();
console.log('\nПоследние 10 писем:');
last.forEach(e => {
    console.log(e.from_email + ' - ' + e.subject);
});

db.close();


