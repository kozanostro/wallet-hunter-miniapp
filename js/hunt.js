// hunt.js — WalletHunter (TON) визуализация
// Реальных кошельков/сидов НЕ используется.

const TON_ADDR_LEN = 48;
const SEED_WORDS_COUNT = 24;

// ====== ТЕСТОВЫЕ ТАЙМИНГИ (меняй тут) ======
const DEFAULT_WALLET_SECONDS = 15; // 10–15 сек тест
const DEFAULT_SEED_SECONDS = 10;   // 10 сек тест

// ====== СКОРОСТЬ "ПРОВЕРЕНО КОШЕЛЬКОВ" ======
const SPEED_BASE_WALLETS_PER_SEC = 500; // чтобы цифры выглядели “сочно”
const SPEED_X = 1; // потом привяжем к покупке x5/x10

const PHASE = {
  NONE: "none",
  WALLET: "wallet",
  SEED: "seed",
};

const LS = {
  phase: "wh_phase",
  startAt: "wh_startAt",
  walletSeconds: "wh_wallet_seconds",
  seedSeconds: "wh_seed_seconds",
  result: "wh_result",
};

// ---- DOM ----
const gridEl = document.getElementById("grid");
const timerEl = document.getElementById("timer");
const checkedStatsEl = document.getElementById("checkedStats");
const phaseTextEl = document.getElementById("phaseText");
const statsEl = document.getElementById("stats");

const btnStart = document.getElementById("btnStart"); // оставим, но цикл будет авто
const seedBox = document.getElementById("seedBox");
const seedLine = document.getElementById("seedLine");

// ---- state ----
let animInterval = null;
let tickInterval = null;

let walletSeconds = DEFAULT_WALLET_SECONDS;
let seedSeconds = DEFAULT_SEED_SECONDS;

let startAt = 0;
let walletsPerSecond = SPEED_BASE_WALLETS_PER_SEC * SPEED_X;

// ---- util ----
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

// ---- grid ----
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

function startGridAnim() {
  stopGridAnim();
  if (!gridEl) return;
  animInterval = setInterval(() => {
    for (const c of gridEl.children) c.textContent = randomChar();
  }, 60);
}

function stopGridAnim() {
  if (animInterval) clearInterval(animInterval);
  animInterval = null;
}

// ---- seed ----
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

// ---- storage helpers ----
function setPhase(p) { localStorage.setItem(LS.phase, p); }
function getPhase() { return localStorage.getItem(LS.phase) || PHASE.NONE; }

function setStartAt(ts) { localStorage.setItem(LS.startAt, String(ts)); }
function getStartAt() {
  const v = Number(localStorage.getItem(LS.startAt) || "0");
  return v > 0 ? v : now();
}

function loadDurations() {
  walletSeconds = Number(localStorage.getItem(LS.walletSeconds) || DEFAULT_WALLET_SECONDS);
  seedSeconds = Number(localStorage.getItem(LS.seedSeconds) || DEFAULT_SEED_SECONDS);
  if (!Number.isFinite(walletSeconds) || walletSeconds <= 0) walletSeconds = DEFAULT_WALLET_SECONDS;
  if (!Number.isFinite(seedSeconds) || seedSeconds <= 0) seedSeconds = DEFAULT_SEED_SECONDS;
}

// ---- reward фиксируем один раз ----
function randomRewardTon() {
  const r = Math.random();
  let val = 0;
  if (r < 0.80) val = +(Math.random() * 0.5).toFixed(3);
  else if (r < 0.97) val = +(0.5 + Math.random() * 2).toFixed(3);
  else val = +(2.5 + Math.random() * 5).toFixed(3);
  return val;
}

function saveResultOnce() {
  if (localStorage.getItem(LS.result)) return;
  const payload = { reward_ton: randomRewardTon(), ts: now() };
  localStorage.setItem(LS.result, JSON.stringify(payload));
}

// ---- ui ----
function renderChecked(elapsedSec) {
  const checked = Math.floor(elapsedSec * walletsPerSecond);
  if (statsEl) statsEl.textContent = `Checked wallets: ${checked.toLocaleString()}`;
  if (checkedStatsEl) checkedStatsEl.textContent = `Проверено кошельков: ${checked.toLocaleString()}`;
}

function showStart(v) { if (btnStart) btnStart.style.display = v ? "inline-block" : "none"; }
function showSeed(v) { if (seedBox) seedBox.style.display = v ? "block" : "none"; }

// ---- phases ----
function startWalletPhase() {
  loadDurations();

  // новый цикл — чистим прошлую награду
  localStorage.removeItem(LS.result);

  setPhase(PHASE.WALLET);
  startAt = now();
  setStartAt(startAt);

  if (phaseTextEl) phaseTextEl.textContent = "TON Wallet Scan";
  showStart(false);
  showSeed(false);

  startGridAnim();
  startTicker();
}

function startSeedPhase() {
  setPhase(PHASE.SEED);
  startAt = now();
  setStartAt(startAt);

  stopGridAnim();
  if (phaseTextEl) phaseTextEl.textContent = "Seed phrase analysis";
  showSeed(true);
  if (seedLine) seedLine.textContent = randomSeed();

  startTicker();
}

function finishAndGoResult() {
  stopGridAnim();
  stopTicker();

  saveResultOnce();

  // авто-переход на результат
  location.href = "result.html";
}

// ---- ticker ----
function stopTicker() {
  if (tickInterval) clearInterval(tickInterval);
  tickInterval = null;
}

function startTicker() {
  if (tickInterval) return;

  tickInterval = setInterval(() => {
    const phase = getPhase();
    const elapsedMs = now() - getStartAt();
    const elapsedSec = Math.max(0, elapsedMs / 1000);

    if (timerEl) timerEl.textContent = fmtElapsed(elapsedMs);
    renderChecked(elapsedSec);

    if (phase === PHASE.WALLET) {
      if (elapsedSec >= walletSeconds) {
        // авто-переход на SEED
        startSeedPhase();
      }
      return;
    }

    if (phase === PHASE.SEED) {
      if (seedLine) seedLine.textContent = randomSeed();
      if (elapsedSec >= seedSeconds) {
        finishAndGoResult();
      }
      return;
    }
  }, 250);
}

// ---- restore ----
function restore() {
  makeGrid();
  loadDurations();

  const phase = getPhase();
  startAt = getStartAt();

  if (phase === PHASE.NONE) {
    if (phaseTextEl) phaseTextEl.textContent = "TON Wallet Scan";
    showStart(true);
    showSeed(false);
    if (timerEl) timerEl.textContent = "0с";
    if (statsEl) statsEl.textContent = "";
    if (checkedStatsEl) checkedStatsEl.textContent = "";
    stopGridAnim();
    stopTicker();
    return;
  }

  // если был запущен — продолжаем
  showStart(false);

  if (phase === PHASE.WALLET) {
    if (phaseTextEl) phaseTextEl.textContent = "TON Wallet Scan";
    showSeed(false);
    startGridAnim();
    startTicker();
    return;
  }

  if (phase === PHASE.SEED) {
    stopGridAnim();
    if (phaseTextEl) phaseTextEl.textContent = "Seed phrase analysis";
    showSeed(true);
    if (seedLine && !seedLine.textContent) seedLine.textContent = randomSeed();
    startTicker();
    return;
  }

  // если что-то странное
  localStorage.setItem(LS.phase, PHASE.NONE);
  restore();
}

// ---- buttons ----
if (btnStart) btnStart.addEventListener("click", startWalletPhase);

// автозапуск не делаем — пусть человек жмёт Start
restore();
