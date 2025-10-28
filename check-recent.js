const fetch = require('node-fetch');
const TOKEN = '7268320384:AAGngFsmkg_x-2rryDtoJkmYD3ymxy5gM9o';

async function checkRecent() {
    const url = `https://api.telegram.org/bot${TOKEN}/getUpdates?limit=100`;
    const response = await fetch(url);
    const data = await response.json();
    
    if (!data.ok) {
        console.log('❌ ОШИБКА API:', data.description);
        return;
    }
    
    console.log('\n🔍 ПРОВЕРЯЮ ПОСЛЕДНИЕ 5 МИНУТ:\n');
    
    const now = Math.floor(Date.now() / 1000); // Текущее время в Unix
    const fiveMinutesAgo = now - (5 * 60); // 5 минут назад
    
    // Фильтруем только сообщения за последние 5 минут
    const recentMessages = data.result.filter(update => {
        if (!update.message) return false;
        return update.message.date >= fiveMinutesAgo;
    });
    
    console.log(`⏰ Текущее время: ${new Date().toLocaleString('ru-RU', {timeZone: 'Europe/Moscow'})}`);
    console.log(`📨 Всего обновлений: ${data.result.length}`);
    console.log(`🆕 За последние 5 минут: ${recentMessages.length}\n`);
    
    if (recentMessages.length === 0) {
        console.log('❌ НЕТ СООБЩЕНИЙ ЗА ПОСЛЕДНИЕ 5 МИНУТ\n');
        return;
    }
    
    console.log('💬 СООБЩЕНИЯ ЗА ПОСЛЕДНИЕ 5 МИНУТ:\n');
    
    recentMessages.forEach((update, i) => {
        const msg = update.message;
        const from = msg.from.first_name + ' ' + (msg.from.last_name || '');
        const text = (msg.text || msg.caption || '').substring(0, 80);
        const replyTo = msg.reply_to_message ? msg.reply_to_message.message_id : 'НЕТ';
        const chatTitle = msg.chat.title || msg.chat.type;
        const isBot = msg.from.is_bot ? '🤖 БОТ' : '👤 Человек';
        const messageTime = new Date(msg.date * 1000).toLocaleString('ru-RU', {timeZone: 'Europe/Moscow'});
        const secondsAgo = now - msg.date;
        
        console.log(`${i+1}. ${isBot} | От: ${from}`);
        console.log(`   ⏰ Время: ${messageTime} (${secondsAgo} сек назад)`);
        console.log(`   📱 Чат: ${chatTitle}`);
        console.log(`   💬 Текст: "${text}"`);
        console.log(`   🔗 Ответ на пост: ${replyTo}`);
        
        // Проверяем, подходит ли под критерии бота (пост #15)
        const isTrustStoreChannel = msg.from.username && msg.from.username.toLowerCase() === 'truststoreru';
        
        if (isTrustStoreChannel) {
            console.log(`   ⏭️ ОТВЕТ ОТ КАНАЛА - будет пропущен`);
        } else if (msg.reply_to_message && msg.reply_to_message.message_id === 15 && !msg.from.is_bot && text.length >= 5) {
            console.log(`   ✅ ЭТОТ КОММЕНТАРИЙ БУДЕТ ДОБАВЛЕН!`);
        } else if (msg.reply_to_message) {
            console.log(`   ❌ Ответ на пост #${msg.reply_to_message.message_id}, а не #15`);
        } else {
            console.log(`   ❌ Не ответ на пост`);
        }
        console.log('');
    });
    
    // Считаем сколько будет добавлено
    const willBeAdded = recentMessages.filter(update => {
        const msg = update.message;
        const text = msg.text || msg.caption || '';
        const isTrustStoreChannel = msg.from.username && msg.from.username.toLowerCase() === 'truststoreru';
        
        return msg.reply_to_message 
            && msg.reply_to_message.message_id === 15
            && !msg.from.is_bot
            && !isTrustStoreChannel
            && text.length >= 5
            && !text.includes('o-4zWa6SFWUGo');
    });
    
    console.log('\n📊 ИТОГ ЗА ПОСЛЕДНИЕ 5 МИНУТ:');
    console.log(`   Всего сообщений: ${recentMessages.length}`);
    console.log(`   Будет добавлено: ${willBeAdded.length}\n`);
    
    if (willBeAdded.length > 0) {
        console.log('✅ КОММЕНТАРИИ, КОТОРЫЕ БУДУТ ДОБАВЛЕНЫ:\n');
        willBeAdded.forEach((update, i) => {
            const msg = update.message;
            const from = msg.from.first_name + ' ' + (msg.from.last_name || '');
            const text = msg.text || msg.caption || '';
            console.log(`${i+1}. ${from}: "${text}"`);
        });
        console.log('');
    } else {
        console.log('❌ НЕТ КОММЕНТАРИЕВ ДЛЯ ДОБАВЛЕНИЯ\n');
    }
}

checkRecent();

