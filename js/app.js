// js/app.js — маршрутизация стартовой страницы

const tg = window.Telegram?.WebApp;
tg?.ready?.();
tg?.expand?.();

function getQueryParam(name) {
  const url = new URL(window.location.href);
  return url.searchParams.get(name);
}

function saveUserFromTelegram() {
  const user = tg?.initDataUnsafe?.user;
  if (!user) return null;

  const u = {
    id: user.id,
    username: user.username || "",
    first_name: user.first_name || "",
    last_name: user.last_name || ""
  };

  localStorage.setItem("tg_user", JSON.stringify(u));
  return u;
}

function isRegistered() {
  return localStorage.getItem("registered") === "true";
}

// 1) сохраняем tg_user (если открыто из Telegram)
saveUserFromTelegram();

// 2) роутинг по screen=
const screen = getQueryParam("screen");

// если бот открыл cabinet — сразу туда
if (screen === "cabinet") {
  window.location.replace("pages/dashboard.html");
} else {
  // обычный старт
  if (isRegistered()) {
    window.location.replace("pages/dashboard.html");
  } else {
    window.location.replace("pages/register.html");
  }
}
