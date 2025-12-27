// app.js

const tg = window.Telegram.WebApp;
tg.ready();
tg.expand();

// Получаем данные пользователя Telegram
const user = tg.initDataUnsafe?.user;

if (!user) {
    document.getElementById('app').innerHTML =
        '<p>Ошибка инициализации Telegram</p>';
} else {
    // сохраняем пользователя
    localStorage.setItem('tg_user', JSON.stringify({
        id: user.id,
        username: user.username || '',
        first_name: user.first_name || '',
        last_name: user.last_name || ''
    }));

    // редирект на регистрацию
    window.location.href = 'pages/register.html';
}

