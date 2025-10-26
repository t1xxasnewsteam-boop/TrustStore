// Скрипт для смены логина и пароля админа
const Database = require('better-sqlite3');
const bcrypt = require('bcryptjs');
const readline = require('readline');

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

console.log('\n🔐 Смена логина и пароля админа\n');

function question(query) {
    return new Promise(resolve => rl.question(query, resolve));
}

async function changeCredentials() {
    try {
        // Запрашиваем новый логин
        const newUsername = await question('Введи новый логин: ');
        
        if (!newUsername || newUsername.length < 3) {
            console.log('❌ Логин должен быть минимум 3 символа!');
            rl.close();
            return;
        }

        // Запрашиваем новый пароль
        const newPassword = await question('Введи новый пароль: ');
        
        if (!newPassword || newPassword.length < 6) {
            console.log('❌ Пароль должен быть минимум 6 символов!');
            rl.close();
            return;
        }

        // Подтверждение пароля
        const confirmPassword = await question('Повтори пароль: ');
        
        if (newPassword !== confirmPassword) {
            console.log('❌ Пароли не совпадают!');
            rl.close();
            return;
        }

        // Открываем БД
        const db = new Database('analytics.db');

        // Хешируем пароль
        const hashedPassword = bcrypt.hashSync(newPassword, 10);

        // Обновляем данные админа
        const updateStmt = db.prepare('UPDATE admins SET username = ?, password = ? WHERE id = 1');
        updateStmt.run(newUsername, hashedPassword);

        console.log('\n✅ Успешно! Новые данные:');
        console.log(`👤 Логин: ${newUsername}`);
        console.log(`🔑 Пароль: ${newPassword}`);
        console.log('\n💾 Данные сохранены в базе!');
        console.log('\nТеперь можешь войти с новыми данными 🎉\n');

        db.close();
        rl.close();
    } catch (error) {
        console.error('❌ Ошибка:', error.message);
        rl.close();
    }
}

changeCredentials();

