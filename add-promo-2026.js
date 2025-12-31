const Database = require('better-sqlite3');
const path = require('path');

const db = new Database('./analytics.db');

console.log('🎫 Создание промокода 2026...\n');

try {
    // Проверяем, существует ли уже промокод
    const existing = db.prepare('SELECT * FROM promo_codes WHERE code = ?').get('2026');
    
    if (!existing) {
        // Создаем новый промокод
        // discount = 10 (скидка 10%)
        // max_uses = 999999999 (без лимита)
        // expires_at = NULL (бессрочный)
        // is_active = 1 (активен)
        db.prepare(`
            INSERT INTO promo_codes (code, discount, max_uses, current_uses, expires_at, is_active)
            VALUES (?, ?, ?, ?, ?, ?)
        `).run('2026', 10, 999999999, 0, '2099-12-31 23:59:59', 1);
        
        console.log('✅ Промокод 2026 создан:');
        console.log('   • Скидка: 10%');
        console.log('   • Лимит использований: без лимита');
        console.log('   • Срок действия: бессрочный');
        console.log('   • Статус: активен');
    } else {
        // Обновляем существующий промокод
        db.prepare(`
            UPDATE promo_codes 
            SET discount = 10, 
                max_uses = 999999999,
                expires_at = '2099-12-31 23:59:59',
                is_active = 1
            WHERE code = '2026'
        `).run();
        
        console.log('✅ Промокод 2026 обновлен:');
        console.log('   • Скидка: 10%');
        console.log('   • Лимит использований: без лимита');
        console.log('   • Срок действия: бессрочный');
        console.log('   • Статус: активен');
    }
    
    // Проверяем результат
    const promo = db.prepare('SELECT * FROM promo_codes WHERE code = ?').get('2026');
    console.log('\n📊 Текущие параметры промокода:');
    console.log(`   • Код: ${promo.code}`);
    console.log(`   • Скидка: ${promo.discount}%`);
    console.log(`   • Макс. использований: ${promo.max_uses === 999999999 ? 'без лимита' : promo.max_uses}`);
    console.log(`   • Текущих использований: ${promo.current_uses}`);
    console.log(`   • Срок действия: ${promo.expires_at ? new Date(promo.expires_at).toLocaleDateString('ru-RU') : 'бессрочный'}`);
    console.log(`   • Активен: ${promo.is_active ? 'да' : 'нет'}`);
    
    db.close();
    console.log('\n✅ Готово!');
    process.exit(0);
} catch (error) {
    console.error('❌ Ошибка:', error.message);
    db.close();
    process.exit(1);
}

