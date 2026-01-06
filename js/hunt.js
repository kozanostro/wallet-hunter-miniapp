// hunt.js — WalletHunter (TON) визуализация
// Реальных кошельков/сидов НЕ используется.

const TON_ADDR_LEN = 48;
const SEED_WORDS_COUNT = 24;

// ====== ТЕСТОВЫЕ ТАЙМИНГИ (меняй тут) ======
const DEFAULT_WALLET_SECONDS = 15;
const DEFAULT_SEED_SECONDS = 10;
const AUTO_RESET_AFTER_DONE_MS = 1500;

// ====== СКОРОСТЬ "ПРОВЕРЕНО КОШЕЛЬКОВ" ======
const SPEED_BASE_WALLETS_PER_SEC = 60;
const SPEED_MULT_PER_LEVEL = 5;

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

  // ✅ результат награды
  result: "wh_result",
};

let animInterval = null;
let tickInterval = null;

let startAt = 0;
let walletSeconds = DEFAULT_WALLET_SECONDS;
let seedSeconds = DEFAULT_SEED_SECONDS;

let speedX = 1;
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
  walletSeconds = Number(localStorage.getItem(LS.durationWallet) || DEFAULT_WALLET_SECONDS);
  seedSeconds = Number(localStorage.getItem(LS.durationSeed) || DEFAULT_SEED_SECONDS);

  speedX = Number(localStorage.getItem(LS.speedX) || "1");
  if (!Number.isFinite(speedX) || speedX <= 0) speedX = 1;

  walletsPerSecond = SPEED_BASE_WALLETS_PER_SEC * (1 + (speedX - 1) * SPEED_MULT_PER_LEVEL);
}

// --------- UI ----------
function show(el, v) { if (el) el.style.display = v ? "inline-block" : "none"; }
function showBlock(el, v) { if (el) el.style.display = v ? "block" : "none"; }

function renderChecked(checked) {
  if (statsEl) statsEl.textContent = `Checked wallets: ${checked.toLocaleString()}`;
  if (checkedStatsEl) checkedStatsEl.textContent = `Проверено кошельков: ${checked.toLocaleString()}`;
}

// --------- RESULT (reward) ----------
function randomRewardTon() {
  // Визуальный “рандом”. Сделай как хочешь.
  // Пример: чаще маленькое, редко большое
  const r = Math.random();
  let val = 0;
  if (r < 0.80) val = +(Math.random() * 0.5).toFixed(3);      // 0..0.5 TON
  else if (r < 0.97) val = +(0.5 + Math.random() * 2).toFixed(3); // 0.5..2.5 TON
  else val = +(2.5 + Math.random() * 5).toFixed(3);          // 2.5..7.5 TON
  return val;
}

function saveResultOnce() {
  // если результат уже есть — не перезаписываем
  const existing = localStorage.getItem(LS.result);
  if (existing) return;

  const rewardTon = randomRewardTon();
  const payload = {
    reward_ton: rewardTon,
    ts: now(),
  };
  localStorage.setItem(LS.result, JSON.stringify(payload));
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

  // ✅ новый запуск — чистим прошлый результат
  localStorage.removeItem(LS.result);

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

  startAt = now();
  setStartAt(startAt);
}

function finishAll() {
  setPhase(PHASE.DONE);
  stopAnim();

  // ✅ ВАЖНО: сохраняем награду ОДИН РАЗ
  saveResultOnce();

  if (phaseTextEl) phaseTextEl.textContent = "Analysis complete";
  show(btnView, true);

  setTimeout(() => {
    setPhase(PHASE.NONE);
    show(btnStart, true);
    show(btnContinue, false);
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

    if (phase === PHASE.NONE) {
      clearInterval(tickInterval);
      tickInterval = null;
      return;
    }

    const elapsedMs = now() - getStartAt();
    if (timerEl) timerEl.textContent = fmtElapsed(elapsedMs);

    const elapsedSeconds = Math.max(0, elapsedMs / 1000);
    const checked = Math.floor(elapsedSeconds * walletsPerSecond);
    renderChecked(checked);

    if (phase === PHASE.WALLET) {
      if (elapsedSeconds >= walletSeconds) {
        animateGrid(false);
        show(btnContinue, true);
        if (phaseTextEl) phaseTextEl.textContent = "Wallet найден (визуально). Нажми Continue";
        clearInterval(tickInterval);
        tickInterval = null;
      }
      return;
    }

    if (phase === PHASE.SEED) {
      if (seedLine) seedLine.textContent = randomSeed();

      if (elapsedSeconds >= seedSeconds) {
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
