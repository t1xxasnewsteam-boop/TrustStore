# 🚀 Как добавить новый товар

## 📋 Шаги для добавления нового товара:

### 1. Создайте HTML страницу товара
Скопируйте любую существующую страницу (например, `product.html`) как шаблон.

### 2. Подключите необходимые файлы
Убедитесь, что в `<head>` подключены:

```html
<link rel="stylesheet" href="styles.css">
<link rel="stylesheet" href="search.css">
<link rel="stylesheet" href="cart-widget.css">
```

И перед закрывающим `</body>`:

```html
<script src="search.js"></script>
<script src="cart.js"></script>
<script src="cart-widget.js"></script>
<script src="notification.js"></script>
```

### 3. Используйте стандартные классы кнопок

#### ✅ Кнопки "Купить сейчас" и "В корзину"
Используйте эту разметку (стили применятся автоматически из `styles.css`):

```html
<div style="display: flex; gap: 15px; margin-bottom: 30px;">
    <button class="btn-buy-large" onclick="goToCheckout()">Купить сейчас</button>
    <button class="btn-add-cart" onclick="addProductToCart()">🛒 В корзину</button>
</div>
```

**Стили автоматически включают:**
- ✅ `padding: 14px 55px` - тонкие и длинные
- ✅ `border-radius: 50px` - полностью закругленные
- ✅ `font-size: 18px` - крупный текст
- ✅ `flex: 1` - растягиваются на всю ширину поровну
- ✅ Градиент для "Купить сейчас"
- ✅ Белый фон с синей обводкой для "В корзину"
- ✅ Плавные hover эффекты

### 4. Создайте функцию добавления в корзину

```javascript
function addProductToCart() {
    const product = {
        name: 'Название вашего товара',
        price: parseInt(document.getElementById('selected-price').textContent.replace(' ₽', '').replace(/\s/g, '')),
        duration: window.selectedDuration || '1 месяц',
        category: 'Категория',
        image: 'image-file.png'
    };
    
    addToCart(product); // Автоматически покажет красивое уведомление!
}
```

### 5. Функция перехода к оплате

```javascript
function goToCheckout() {
    const productName = 'Название товара';
    const finalPrice = document.getElementById('selected-price').textContent.replace(' ₽', '').replace(/\s/g, '');
    const duration = window.selectedDuration;
    window.location.href = `checkout.html?product=${encodeURIComponent(productName)}&price=${finalPrice}&duration=${encodeURIComponent(duration)}`;
}
```

### 6. Функция выбора тарифа (для товаров с несколькими планами)

```javascript
let currentPrice = 2250; // Начальная цена
let discountApplied = false;

function selectPlan(element, price, duration) {
    // Убрать active со всех опций
    document.querySelectorAll('.pricing-option').forEach(option => {
        option.classList.remove('active');
    });
    
    // Добавить active к выбранной опции
    element.classList.add('active');
    
    // Сохранить текущую цену
    currentPrice = price;
    
    // Обновить цену (учитываем скидку если применена)
    updatePrice();
}

function updatePrice() {
    const priceElement = document.getElementById('selected-price');
    const oldPriceElement = document.getElementById('old-price');
    const discountBadge = document.getElementById('discount-badge');
    let finalPrice = currentPrice;
    
    if (discountApplied) {
        finalPrice = Math.round(currentPrice * 0.9); // 10% скидка
        
        // Показываем старую цену зачеркнутой
        oldPriceElement.textContent = currentPrice.toLocaleString('ru-RU') + ' ₽';
        oldPriceElement.style.display = 'block';
        
        // Показываем бейдж со скидкой
        discountBadge.style.display = 'block';
    } else {
        oldPriceElement.style.display = 'none';
        discountBadge.style.display = 'none';
    }
    
    priceElement.textContent = finalPrice.toLocaleString('ru-RU') + ' ₽';
    // ✨ АНИМАЦИЯ при смене тарифа (как на Claude AI)
    priceElement.style.animation = 'none';
    setTimeout(() => {
        priceElement.style.animation = 'priceUpdate 0.3s ease';
    }, 10);
}
```

### 7. Добавьте CSS анимацию в `<style>` блок страницы

```css
@keyframes priceUpdate {
    0% {
        transform: scale(1);
    }
    50% {
        transform: scale(1.05);
    }
    100% {
        transform: scale(1);
    }
}
```

**Эта анимация сделает плавный "пульс" при смене тарифа!**

## 🎨 Стили кнопок определены глобально

Все стили находятся в `styles.css`:
- `.btn-buy-large` - кнопка "Купить сейчас"
- `.btn-add-cart` - кнопка "В корзину"

**НЕ нужно добавлять inline стили!** Просто используйте эти классы.

## ✨ Что вы получите автоматически:

- 🎨 **Единый дизайн** на всех товарах
- 🔔 **Красивое уведомление** при добавлении в корзину
- 🛒 **Анимация корзины** в header
- 💫 **Анимация ценника** при смене тарифа (как на Claude AI)
- 📱 **Адаптивный дизайн** для мобильных
- ⚡ **Плавные анимации** и эффекты

## 📦 Готово!

Теперь ваш новый товар будет выглядеть и работать точно так же, как все остальные! 🚀
