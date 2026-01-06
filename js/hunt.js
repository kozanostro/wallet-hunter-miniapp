// hunt.js — WalletHunter (TON) | VISUAL ONLY

const TON_ADDR_LEN = 48;
const SEED_WORDS_COUNT = 24;

// визуальная скорость счётчика (кошельков/сек)
const SPEED_BASE = 60; // x1

// визуальная длительность фазы кошелька (для теста)
const DEFAULT_WALLET_MS = 15 * 1000; // 15 секунд

const PHASE = {
  NONE: "none",
  WALLET_RUNNING: "wallet_running",
  WALLET_DONE: "wallet_done",
  SEED_RUNNING: "seed_running",
  SEED_DONE: "seed_done",
};

const gridEl = document.getElementById("grid");
const timerEl = document.getElementById("timer");
const phaseTextEl = document.getElementById("phaseText");
const statsEl = document.getElementById("stats");

const btnStart = document.getElementById("btnStart");
const btnContinue = document.getElementById("btnContinue");
const btnView = document.getElementById("btnView");

const seedBox = document.getElementById("seedBox");
const seedLine = document.getElementById("seedLine");

// ---- safety: если чего-то нет в HTML, сразу видно ----
function must(el, name) {
  if (!el) throw new Error(`Hunt.html: не найден элемент id="${name}"`);
  return el;
}
must(gridEl, "grid");
must(timerEl, "timer");
must(phaseTextEl, "phaseText");
must(statsEl, "stats");
must(btnStart, "btnStart");
must(btnContinue, "btnContinue");
must(btnView, "btnView");
must(seedBox, "seedBox");
must(seedLine, "seedLine");

// ---- storage helpers ----
function now() { return Date.now(); }
function setPhase(p) { localStorage.setItem("wh_phase", p); }
function getPhase() { return localStorage.getItem("wh_phase") || PHASE.NONE; }

function getWalletMs() {
  const v = Number(localStorage.getItem("wh_wallet_ms") || DEFAULT_WALLET_MS);
  return Number.isFinite(v) ? v : DEFAULT_WALLET_MS;
}

function getSpeedX() {
  const v = Number(localStorage.getItem("wh_speed_x") || "1");
  return Number.isFinite(v) && v > 0 ? v : 1;
}

function fmtTime(ms) {
  if (ms < 0) ms = 0;
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  const r = s % 60;
  return m > 0 ? `${m}м ${r}с` : `${r}с`;
}

// ---- grid ----
function randomChar() {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";
  return chars[Math.floor(Math.random() * chars.length)];
}

function makeGrid() {
  gridEl.innerHTML = "";
  for (let i = 0; i < TON_ADDR_LEN; i++) {
    const d = document.createElement("div");
    d.className = "cell";
    d.textContent = randomChar();
    gridEl.appendChild(d);
  }
}

function setMaskedEdges() {
  const cells = [...gridEl.children];
  for (const c of cells) c.classList.remove("mask");
  for (let i = 0; i < 4; i++) {
    if (cells[i]) cells[i].classList.add("mask");
    if (cells[cells.length - 1 - i]) cells[cells.length - 1 - i].classList.add("mask");
  }
}

// ---- seed words ----
const WORDS_MAIN = [
  "apple","night","river","gold","stone","ocean","green","laser","silent","shadow",
  "planet","matrix","crypto","wolf","orbit","signal","vector","random","vault","hunter",
  "secure","token","native","future","cloud","ember","drift","focus","glory","binary",
  "nebula","hammer","comet","cipher","satoshi","bridge","castle","rocket","frost","pixel",
  "mirror","quantum","zephyr","mosaic","fusion","anchor","silver","dragon","opal","storm",
  "nova","prism","raven","tiger","delta","omega","alpha","gamma"
];

// 30 слов по 3 буквы
const WORDS_3 = [
  "arc","sun","sky","toy","mix","ink","ton","cap","map","run",
  "jet","zip","log","box","key","pin","ice","fog","win","ram",
  "cpu","gpu","lan","wan","hex","bit","bug","dev","bot","api"
];

// 30 слов по 4 буквы
const WORDS_4 = [
  "node","seed","scan","mint","coin","hash","salt","lock","bank","data",
  "peer","link","ring","fork","meme","zero","time","idle","fast","slow",
  "rank","flow","path","open","play","hunt","grid","mask","role","user"
];

const WORDS = [...WORDS_MAIN, ...WORDS_3, ...WORDS_4];

function randomSeed() {
  const arr = [];
  for (let i = 0; i < SEED_WORDS_COUNT; i++) {
    arr.push(WORDS[Math.floor(Math.random() * WORDS.length)]);
  }
  return arr.join(" ");
}

// ---- runtime ----
let animInterval = null;
let tickInterval = null;
let seedInterval = null;

let startAtMs = 0;
let endAtMs = 0;
let checkedWallets = 0;

function stopAllIntervals() {
  if (animInterval) clearInterval(animInterval);
  if (tickInterval) clearInterval(tickInterval);
  if (seedInterval) clearInterval(seedInterval);
  animInterval = tickInterval = seedInterval = null;
}

function animateGrid() {
  if (animInterval) clearInterval(animInterval);
  animInterval = setInterval(() => {
    for (const c of gridEl.children) c.textContent = randomChar();
  }, 60);
}

function startSeedAnimationFast() {
  // x2 быстрее чем было (раньше ~120ms)
  if (seedInterval) clearInterval(seedInterval);
  seedInterval = setInterval(() => {
    seedLine.textContent = randomSeed();
  }, 60);
}

// ---- phases ----
function resetUI() {
  btnStart.style.display = "inline-block";
  btnContinue.style.display = "none";
  btnView.style.display = "none";
  seedBox.style.display = "none";
  timerEl.textContent = "—";
  statsEl.textContent = "Проверено кошельков: 0";
  phaseTextEl.textContent = "Фаза 1: поиск кошелька";
}

function startWalletScan() {
  // полный сброс
  stopAllIntervals();
  makeGrid();

  checkedWallets = 0;
  startAtMs = now();
  endAtMs = startAtMs + getWalletMs();

  localStorage.setItem("wh_startAt", String(startAtMs));
  localStorage.setItem("wh_endAt", String(endAtMs));
  localStorage.setItem("wh_checked", "0");
  setPhase(PHASE.WALLET_RUNNING);

  btnStart.style.display = "none";
  btnContinue.style.display = "none";
  btnView.style.display = "none";
  seedBox.style.display = "none";

  phaseTextEl.textContent = "Фаза 1: поиск кошелька";
  timerEl.textContent = "0с";
  statsEl.textContent = "Проверено кошельков: 0";

  animateGrid();
  startTicker();
}

function finishWalletScan() {
  // фиксируем найденный адрес (визуально)
  const addr = [...gridEl.children].map(x => x.textContent).join("");
  localStorage.setItem("wh_fake_addr", addr);

  setPhase(PHASE.WALLET_DONE);
  setMaskedEdges();

  btnContinue.style.display = "inline-block";
  phaseTextEl.textContent = "Фаза 1 завершена: найден потенциальный кошелёк";
  timerEl.textContent = "готово";
}

function startSeedScan() {
  setPhase(PHASE.SEED_RUNNING);

  btnContinue.style.display = "none";
  btnView.style.display = "none";
  seedBox.style.display = "block";

  phaseTextEl.textContent = "Фаза 2: подбор сид-фразы (визуализация)";
  seedLine.textContent = randomSeed();

  // СЧЁТЧИК НА СИД-ФРАЗАХ НЕ РАСТЁТ — оставляем как есть
  startSeedAnimationFast();

  // здесь нет auto-finish. Завершение можешь привязать к кнопке/таймеру позже.
  // Для теста можно вручную вызвать finishSeedScan() из консоли.
}

function finishSeedScan() {
  setPhase(PHASE.SEED_DONE);

  if (seedInterval) clearInterval(seedInterval);
  seedInterval = null;

  localStorage.setItem("wh_fake_seed", seedLine.textContent);

  btnView.style.display = "inline-block";
  phaseTextEl.textContent = "Фаза 2 завершена: готово к проверке";
  timerEl.textContent = "готово";
}

// ---- ticker (только фаза кошелька считает) ----
function startTicker() {
  if (tickInterval) clearInterval(tickInterval);

  tickInterval = setInterval(() => {
    const phase = getPhase();

    if (phase !== PHASE.WALLET_RUNNING) return;

    const elapsed = now() - startAtMs;
    timerEl.textContent = fmtTime(elapsed);

    const speedX = getSpeedX();
    const perTick = (SPEED_BASE * speedX) / 4; // tick 250ms
    checkedWallets += Math.floor(perTick);

    localStorage.setItem("wh_checked", String(checkedWallets));
    statsEl.textContent = "Проверено кошельков: " + checkedWallets.toLocaleString();

    const left = endAtMs - now();
    if (left <= 0) finishWalletScan();
  }, 250);
}

// ---- restore ----
function restore() {
  makeGrid();

  const phase = getPhase();
  startAtMs = Number(localStorage.getItem("wh_startAt") || "0") || now();
  endAtMs = Number(localStorage.getItem("wh_endAt") || "0") || (startAtMs + getWalletMs());
  checkedWallets = Number(localStorage.getItem("wh_checked") || "0") || 0;

  if (phase === PHASE.NONE) {
    resetUI();
    return;
  }

  if (phase === PHASE.WALLET_RUNNING) {
    btnStart.style.display = "none";
    btnContinue.style.display = "none";
    btnView.style.display = "none";
    seedBox.style.display = "none";

    phaseTextEl.textContent = "Фаза 1: поиск кошелька";
    animateGrid();
    startTicker();
    return;
  }

  if (phase === PHASE.WALLET_DONE) {
    btnStart.style.display = "none";
    btnContinue.style.display = "inline-block";
    btnView.style.display = "none";
    seedBox.style.display = "none";

    phaseTextEl.textContent = "Фаза 1 завершена: найден потенциальный кошелёк";
    timerEl.textContent = "готово";
    statsEl.textContent = "Проверено кошельков: " + checkedWallets.toLocaleString();

    const addr = localStorage.getItem("wh_fake_addr");
    if (addr && addr.length === TON_ADDR_LEN) {
      [...gridEl.children].forEach((c, i) => c.textContent = addr[i]);
    }
    setMaskedEdges();
    return;
  }

  if (phase === PHASE.SEED_RUNNING) {
    btnStart.style.display = "none";
    btnContinue.style.display = "none";
    btnView.style.display = "none";
    seedBox.style.display = "block";

    phaseTextEl.textContent = "Фаза 2: подбор сид-фразы (визуализация)";
    timerEl.textContent = "—";
    statsEl.textContent = "Проверено кошельков: " + checkedWallets.toLocaleString();

    const addr = localStorage.getItem("wh_fake_addr");
    if (addr && addr.length === TON_ADDR_LEN) {
      [...gridEl.children].forEach((c, i) => c.textContent = addr[i]);
    }
    setMaskedEdges();

    seedLine.textContent = localStorage.getItem("wh_fake_seed") || randomSeed();
    startSeedAnimationFast();
    return;
  }

  if (phase === PHASE.SEED_DONE) {
    btnStart.style.display = "none";
    btnContinue.style.display = "none";
    btnView.style.display = "inline-block";
    seedBox.style.display = "block";

    phaseTextEl.textContent = "Фаза 2 завершена: готово к проверке";
    timerEl.textContent = "готово";
    statsEl.textContent = "Проверено кошельков: " + checkedWallets.toLocaleString();

    const addr = localStorage.getItem("wh_fake_addr");
    if (addr && addr.length === TON_ADDR_LEN) {
      [...gridEl.children].forEach((c, i) => c.textContent = addr[i]);
    }
    setMaskedEdges();

    seedLine.textContent = localStorage.getItem("wh_fake_seed") || randomSeed();
    return;
  }
}

// ---- buttons ----
btnStart.addEventListener("click", startWalletScan);
btnContinue.addEventListener("click", startSeedScan);

// временно: чтобы руками завершать сид-фазу (пока без авто)
btnView.addEventListener("click", () => {
  // если сид ещё идёт — завершим перед переходом
  if (getPhase() === PHASE.SEED_RUNNING) finishSeedScan();
  location.href = "result.html";
});

restore();
