const Database = require('better-sqlite3');
const db = new Database('analytics.db');

console.log('🔧 Удаление старого админа...');
db.prepare("DELETE FROM admins WHERE username = 'admin'").run();
console.log('✅ Старый админ удалён!');

db.close();
