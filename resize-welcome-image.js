const fs = require('fs');
const { execSync } = require('child_process');

console.log('📐 Изменение размера welcome-image.png...\n');

try {
    // Используем sips (macOS) для изменения размера
    // -z 512 1280 означает: высота 512, ширина 1280
    execSync('sips -z 512 1280 welcome-image.png --out welcome-image-temp.png', { stdio: 'inherit' });
    
    // Проверяем результат
    const sizeInfo = execSync('sips -g pixelWidth -g pixelHeight welcome-image-temp.png', { encoding: 'utf-8' });
    console.log('\n📊 Размер изменен:');
    console.log(sizeInfo);
    
    // Заменяем оригинальный файл
    fs.renameSync('welcome-image-temp.png', 'welcome-image.png');
    
    console.log('\n✅ Изображение успешно изменено до 1280x512 пикселей!');
    
} catch (error) {
    console.error('❌ Ошибка при изменении размера:', error.message);
    console.log('\n💡 Попробуй вручную через онлайн-редактор или ImageMagick:');
    console.log('   convert welcome-image.png -resize 1280x512! welcome-image.png');
    process.exit(1);
}

