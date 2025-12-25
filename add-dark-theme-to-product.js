#!/usr/bin/env node
/**
 * Скрипт для автоматического добавления темной темы на страницы товаров
 * 
 * Использование:
 *   node add-dark-theme-to-product.js <путь_к_файлу>
 * 
 * Или для всех файлов в папке product:
 *   node add-dark-theme-to-product.js
 */

const fs = require('fs');
const path = require('path');

// Шаблон скрипта для head
const HEAD_SCRIPT = `    <script>
        // Предотвращение белой вспышки - применяем фон сразу
        (function() {
            const savedTheme = localStorage.getItem('theme');
            document.documentElement.style.backgroundColor = '#0a0a0a'; // Default to dark for html
            
            if (savedTheme === 'light-theme' || savedTheme === 'light') {
                // Светлая тема
                document.body.style.backgroundColor = '#ffffff';
                document.body.style.color = '#1a1a1a';
                document.documentElement.style.backgroundColor = '#ffffff'; // Also set html to white for light theme
            } else {
                // Темная тема по умолчанию
                document.body.style.backgroundColor = '#0a0a0a';
                document.body.style.color = '#e5e5e5';
            }
        })();
    </script>`;

// HTML для переключателя темы
const THEME_TOGGLE_HTML = `                    <div class="theme-toggle-wrapper">
                        <input type="checkbox" id="theme-toggle" class="theme-toggle">
                        <label for="theme-toggle" class="theme-toggle-label">
                            <span class="theme-icon theme-icon-sun">☀️</span>
                            <span class="theme-icon theme-icon-moon">🌙</span>
                            <span class="theme-toggle-slider"></span>
                        </label>
                    </div>`;

// CSS стили для темной темы (читаем из gemini.html)
function getDarkThemeCSS() {
    const geminiPath = path.join(__dirname, 'product', 'gemini.html');
    if (fs.existsSync(geminiPath)) {
        const content = fs.readFileSync(geminiPath, 'utf-8');
        const cssStart = content.indexOf('/* Стили для переключателя темы */');
        const cssEnd = content.indexOf('    </style>', cssStart);
        if (cssStart !== -1 && cssEnd !== -1) {
            return content.substring(cssStart, cssEnd);
        }
    }
    return '';
}

// JavaScript для переключения темы (читаем из gemini.html)
function getThemeJS() {
    const geminiPath = path.join(__dirname, 'product', 'gemini.html');
    if (fs.existsSync(geminiPath)) {
        const content = fs.readFileSync(geminiPath, 'utf-8');
        const jsStart = content.indexOf('<script>\n        // Переключение темы');
        const jsEnd = content.indexOf('</script>', jsStart) + '</script>'.length;
        if (jsStart !== -1 && jsEnd !== -1) {
            return content.substring(jsStart, jsEnd);
        }
    }
    return '';
}

function addDarkThemeToFile(filePath) {
    if (!fs.existsSync(filePath)) {
        console.error(`Файл не найден: ${filePath}`);
        return false;
    }

    let content = fs.readFileSync(filePath, 'utf-8');
    let modified = false;

    // 1. Добавляем скрипт в head
    if (!content.includes('// Предотвращение белой вспышки')) {
        const fontsLinkMatch = content.match(/<link[^>]*href="https:\/\/fonts\.googleapis\.com[^>]*>/);
        if (fontsLinkMatch) {
            const insertPos = fontsLinkMatch.index + fontsLinkMatch[0].length;
            // Проверяем, есть ли уже <style> после этого
            const stylePos = content.indexOf('<style>', insertPos);
            if (stylePos === -1 || stylePos > insertPos + 50) {
                content = content.slice(0, insertPos) + '\n' + HEAD_SCRIPT + '\n    <style>' + content.slice(insertPos);
                // Удаляем дублирующий <style> если он появился
                content = content.replace(/<style>\s*<style>/g, '<style>');
                modified = true;
                console.log(`  ✓ Добавлен скрипт в head`);
            }
        }
    }

    // 2. Добавляем переключатель темы в header
    if (!content.includes('theme-toggle-wrapper')) {
        const headerRightMatch = content.match(/<div class="header-right">/);
        if (headerRightMatch) {
            const headerActionsMatch = content.match(/<div class="header-actions">/);
            if (headerActionsMatch && headerActionsMatch.index > headerRightMatch.index) {
                const insertPos = headerActionsMatch.index;
                content = content.slice(0, insertPos) + THEME_TOGGLE_HTML + '\n                    ' + content.slice(insertPos);
                modified = true;
                console.log(`  ✓ Добавлен переключатель темы`);
            }
        }
    }

    // 3. Добавляем CSS стили
    if (!content.includes('/* Стили для переключателя темы */')) {
        const styleEndMatch = content.match(/        \}\s*<\/style>/);
        if (styleEndMatch) {
            const insertPos = styleEndMatch.index + styleEndMatch[0].indexOf('</style>');
            const darkThemeCSS = getDarkThemeCSS();
            if (darkThemeCSS) {
                content = content.slice(0, insertPos) + '\n        \n' + darkThemeCSS + '\n    </style>' + content.slice(insertPos + '</style>'.length);
                modified = true;
                console.log(`  ✓ Добавлены CSS стили`);
            }
        }
    }

    // 4. Добавляем JavaScript
    if (!content.includes('// Переключение темы')) {
        const salesCounterMatch = content.match(/<script src="\.\.\/sales-counter\.js"><\/script>/);
        if (salesCounterMatch) {
            const insertPos = salesCounterMatch.index + salesCounterMatch[0].length;
            const themeJS = getThemeJS();
            if (themeJS) {
                content = content.slice(0, insertPos) + '\n' + themeJS + '\n' + content.slice(insertPos);
                modified = true;
                console.log(`  ✓ Добавлен JavaScript`);
            }
        }
    }

    if (modified) {
        fs.writeFileSync(filePath, content, 'utf-8');
        return true;
    }

    return false;
}

// Основная функция
function main() {
    const args = process.argv.slice(2);
    
    if (args.length > 0) {
        // Обрабатываем указанный файл
        const filePath = path.resolve(args[0]);
        console.log(`Обработка файла: ${filePath}`);
        if (addDarkThemeToFile(filePath)) {
            console.log('✓ Темная тема успешно добавлена!\n');
        } else {
            console.log('⚠ Файл уже содержит темную тему или произошла ошибка\n');
        }
    } else {
        // Обрабатываем все файлы в папке product
        const productDir = path.join(__dirname, 'product');
        if (!fs.existsSync(productDir)) {
            console.error(`Папка не найдена: ${productDir}`);
            process.exit(1);
        }

        const files = fs.readdirSync(productDir)
            .filter(file => file.endsWith('.html'))
            .filter(file => file !== 'gemini.html' && file !== 'chatgpt.html' && file !== 'vpn.html' && file !== 'cursor.html');

        console.log(`Найдено файлов для обработки: ${files.length}\n`);

        let processed = 0;
        for (const file of files) {
            const filePath = path.join(productDir, file);
            console.log(`Обработка: ${file}`);
            if (addDarkThemeToFile(filePath)) {
                processed++;
                console.log(`✓ ${file} - обновлен\n`);
            } else {
                console.log(`⚠ ${file} - пропущен (уже содержит темную тему)\n`);
            }
        }

        console.log(`\nГотово! Обработано файлов: ${processed} из ${files.length}`);
    }
}

main();

