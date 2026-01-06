// hunt.js — WalletHunter (TON) визуализация
// Реальных кошельков/сидов НЕ используется.

const TON_ADDR_LEN = 48;
const SEED_WORDS_COUNT = 24;

// ====== ТЕСТОВЫЕ ТАЙМИНГИ (меняй тут) ======
const DEFAULT_WALLET_SECONDS = 15;  // поиск кошелька (тест: 10-15 сек)
const DEFAULT_SEED_SECONDS = 10;    // подбор seed (тест: 5-10 сек)
const AUTO_RESET_AFTER_DONE_MS = 1500; // через сколько после DONE сбросить в новый цикл (готовность)

// ====== СКОРОСТЬ "ПРОВЕРЕНО КОШЕЛЬКОВ" ======
const SPEED_BASE_WALLETS_PER_SEC = 60; // x1 (визуальная скорость)
const SPEED_MULT_PER_LEVEL = 5;        // каждый уровень множителя

const PHASE = {
  NONE: "none",
  WALLET: "wallet",
  SEED: "seed",
  DONE: "done",
};

// --------- DOM ----------
const gridEl = document.getElementById("grid");
const timerEl = document.getElementById("timer");
const checkedStatsEl = document.getElementById("checkedStats");
const phaseTextEl = document.getElementById("phaseText");
const statsEl = document.getElementById("stats");

const btnStart = document.getElementById("btnStart");
const btnContinue = document.getElementById("btnContinue");
const btnView = document.getElementById("btnView");

const seedBox = document.getElementById("seedBox");
const seedLine = document.getElementById("seedLine");

// Если чего-то нет в HTML — не падаем
function must(el, name) {
  if (!el) console.warn(`[hunt.js] Missing element: ${name}`);
  return el;
}
must(gridEl, "grid");
must(timerEl, "timer");
must(phaseTextEl, "phaseText");
must(btnStart, "btnStart");

// --------- STORAGE KEYS ----------
const LS = {
  phase: "wh_phase",
  startAt: "wh_startAt",
  durationWallet: "wh_wallet_seconds",
  durationSeed: "wh_seed_seconds",
  speedX: "wh_speed_x",
};

// --------- STATE ----------
let animInterval = null;
let tickInterval = null;

let startAt = 0;
let walletSeconds = DEFAULT_WALLET_SECONDS;
let seedSeconds = DEFAULT_SEED_SECONDS;

let speedX = 1; // потом подтянешь из /config или админки
let walletsPerSecond = SPEED_BASE_WALLETS_PER_SEC;

// --------- UTIL ----------
function now() { return Date.now(); }

function fmtElapsed(ms) {
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  const r = s % 60;
  return m > 0 ? `${m}м ${r}с` : `${r}с`;
}

function randomChar() {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";
  return chars[Math.floor(Math.random() * chars.length)];
}

// --------- GRID ----------
function makeGrid() {
  if (!gridEl) return;
  gridEl.innerHTML = "";
  for (let i = 0; i < TON_ADDR_LEN; i++) {
    const d = document.createElement("div");
    d.className = "cell";
    d.textContent = randomChar();
    gridEl.appendChild(d);
  }
}

function animateGrid(on) {
  stopAnim();
  if (!on || !gridEl) return;
  animInterval = setInterval(() => {
    for (const c of gridEl.children) c.textContent = randomChar();
  }, 60);
}

function stopAnim() {
  if (animInterval) clearInterval(animInterval);
  animInterval = null;
}

// --------- SEED ----------
const WORDS = [
  "apple","night","river","gold","stone","ocean","green","laser",
  "silent","shadow","planet","matrix","crypto","wolf","orbit",
  "signal","vector","random","vault","hunter","secure","token",
  "native","future","cloud","ember","drift","focus","glory","binary"
];

function randomSeed() {
  const arr = [];
  for (let i = 0; i < SEED_WORDS_COUNT; i++) {
    arr.push(WORDS[Math.floor(Math.random() * WORDS.length)]);
  }
  return arr.join(" ");
}

// --------- PHASE HELPERS ----------
function setPhase(p) { localStorage.setItem(LS.phase, p); }
function getPhase() { return localStorage.getItem(LS.phase) || PHASE.NONE; }

function setStartAt(ts) { localStorage.setItem(LS.startAt, String(ts)); }
function getStartAt() {
  const v = Number(localStorage.getItem(LS.startAt) || "0");
  return v > 0 ? v : now();
}

function loadConfigFromLocalStorage() {
  // Тайминги (можно потом перезаписывать из админки)
  walletSeconds = Number(localStorage.getItem(LS.durationWallet) || DEFAULT_WALLET_SECONDS);
  seedSeconds = Number(localStorage.getItem(LS.durationSeed) || DEFAULT_SEED_SECONDS);

  // Скорость (уровень/множитель)
  speedX = Number(localStorage.getItem(LS.speedX) || "1");
  if (!Number.isFinite(speedX) || speedX <= 0) speedX = 1;

  walletsPerSecond = SPEED_BASE_WALLETS_PER_SEC * (1 + (speedX - 1) * SPEED_MULT_PER_LEVEL);
}

// --------- UI ----------
function show(el, v) {
  if (!el) return;
  el.style.display = v ? "inline-block" : "none";
}
function showBlock(el, v) {
  if (!el) return;
  el.style.display = v ? "block" : "none";
}

function renderChecked(checked) {
  if (statsEl) statsEl.textContent = `Checked wallets: ${checked.toLocaleString()}`;
  if (checkedStatsEl) checkedStatsEl.textContent = `Проверено кошельков: ${checked.toLocaleString()}`;
}

// --------- CORE LOGIC ----------
function resetToReady() {
  stopAnim();
  if (tickInterval) { clearInterval(tickInterval); tickInterval = null; }

  setPhase(PHASE.NONE);
  setStartAt(0);

  if (phaseTextEl) phaseTextEl.textContent = "TON Wallet Scan";
  if (timerEl) timerEl.textContent = "0с";
  renderChecked(0);

  show(btnStart, true);
  show(btnContinue, false);
  show(btnView, false);
  showBlock(seedBox, false);
}

function startWalletScan() {
  loadConfigFromLocalStorage();

  startAt = now();
  setStartAt(startAt);
  setPhase(PHASE.WALLET);

  if (phaseTextEl) phaseTextEl.textContent = "TON Wallet Scan";
  show(btnStart, false);
  show(btnContinue, false);
  show(btnView, false);
  showBlock(seedBox, false);

  animateGrid(true);
  startTicker();
}

function startSeedScan() {
  setPhase(PHASE.SEED);

  if (phaseTextEl) phaseTextEl.textContent = "Seed phrase analysis";
  show(btnContinue, false);
  show(btnView, false);
  showBlock(seedBox, true);

  if (seedLine) seedLine.textContent = randomSeed();

  // Сбрасываем отсчёт времени для seed отдельно
  startAt = now();
  setStartAt(startAt);
}

function finishAll() {
  setPhase(PHASE.DONE);
  stopAnim();

  if (phaseTextEl) phaseTextEl.textContent = "Analysis complete";
  show(btnView, true);

  // Автосброс: чтобы можно было запускать новый поиск без перезагрузки
  setTimeout(() => {
    // В DONE оставим кнопку Start (новый цикл), а View пусть остаётся по желанию
    setPhase(PHASE.NONE);
    show(btnStart, true);
    show(btnContinue, false);
    // btnView оставим как есть (если хочешь — можно скрыть)
    if (seedBox) seedBox.style.display = "none";
    if (timerEl) timerEl.textContent = "0с";
    renderChecked(0);
    if (phaseTextEl) phaseTextEl.textContent = "TON Wallet Scan";
  }, AUTO_RESET_AFTER_DONE_MS);
}

// --------- TICKER ----------
function startTicker() {
  if (tickInterval) return;

  tickInterval = setInterval(() => {
    const phase = getPhase();

    // Если вдруг фаза NONE — остановим тикер
    if (phase === PHASE.NONE) {
      clearInterval(tickInterval);
      tickInterval = null;
      return;
    }

    const elapsedMs = now() - getStartAt();
    if (timerEl) timerEl.textContent = fmtElapsed(elapsedMs);

    // checked считается стабильно: elapsedSeconds * walletsPerSecond
    const elapsedSeconds = Math.max(0, elapsedMs / 1000);
    const checked = Math.floor(elapsedSeconds * walletsPerSecond);
    renderChecked(checked);

    if (phase === PHASE.WALLET) {
      if (elapsedSeconds >= walletSeconds) {
        // закончили wallet → показываем Continue
        animateGrid(false);
        show(btnContinue, true);
        if (phaseTextEl) phaseTextEl.textContent = "Wallet найден (визуально). Нажми Continue";
        // останавливаем тикер, чтобы “проверено” не тикало бесконечно
        clearInterval(tickInterval);
        tickInterval = null;
      }
      return;
    }

    if (phase === PHASE.SEED) {
      if (seedLine) seedLine.textContent = randomSeed();

      if (elapsedSeconds >= seedSeconds) {
        // закончили seed → DONE
        clearInterval(tickInterval);
        tickInterval = null;
        finishAll();
      }
      return;
    }

    if (phase === PHASE.DONE) {
      clearInterval(tickInterval);
      tickInterval = null;
      return;
    }

  }, 250);
}

// --------- RESTORE ----------
function restore() {
  loadConfigFromLocalStorage();
  makeGrid();

  const phase = getPhase();

  if (phase === PHASE.NONE) {
    resetToReady();
    return;
  }

  // Если была WALLET/SEED — продолжаем с текущими таймингами
  startAt = getStartAt();

  if (phase === PHASE.WALLET) {
    show(btnStart, false);
    show(btnContinue, false);
    show(btnView, false);
    showBlock(seedBox, false);

    if (phaseTextEl) phaseTextEl.textContent = "TON Wallet Scan";
    animateGrid(true);
    startTicker();
    return;
  }

  if (phase === PHASE.SEED) {
    show(btnStart, false);
    show(btnContinue, false);
    show(btnView, false);
    showBlock(seedBox, true);

    if (phaseTextEl) phaseTextEl.textContent = "Seed phrase analysis";
    animateGrid(false);
    startTicker();
    return;
  }

  if (phase === PHASE.DONE) {
    finishAll();
    return;
  }

  resetToReady();
}

// --------- BUTTONS ----------
if (btnStart) btnStart.addEventListener("click", startWalletScan);
if (btnContinue) btnContinue.addEventListener("click", startSeedScan);
if (btnView) btnView.addEventListener("click", () => {
  location.href = "result.html";
});

restore();
