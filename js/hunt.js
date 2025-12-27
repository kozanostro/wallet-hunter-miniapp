// hunt.js — "бегущие цифры" + 2 фазы + продолжение после закрытия
// ВАЖНО: это пока чисто визуальная игра. Реальные кошельки/сид-фразы НЕ используются.

const TON_ADDR_LEN = 48; // стандартно 48 символов (для визуализации)
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

const btnStart = document.getElementById("btnStart");
const btnContinue = document.getElementById("btnContinue");
const btnView = document.getElementById("btnView");

const seedBox = document.getElementById("seedBox");
const seedLine = document.getElementById("seedLine");

// Настройки таймингов (потом админка будет менять их в localStorage)
const DEFAULT_WALLET_MS = 30 * 1000; // 30 сек для теста (потом будет часы)
const DEFAULT_SEED_MS = 20 * 1000;   // 20 сек для теста (потом будет минуты)

function getWalletDurationMs() {
  return Number(localStorage.getItem("hunt_wallet_duration_ms") || DEFAULT_WALLET_MS);
}
function getSeedDurationMs() {
  return Number(localStorage.getItem("hunt_seed_duration_ms") || DEFAULT_SEED_MS);
}

function setPhase(p) {
  localStorage.setItem("hunt_phase", p);
}

function getPhase() {
  return localStorage.getItem("hunt_phase") || PHASE.NONE;
}

function nowMs() {
  return Date.now();
}

function fmtMs(ms) {
  if (ms < 0) ms = 0;
  const s = Math.ceil(ms / 1000);
  const m = Math.floor(s / 60);
  const r = s % 60;
  if (m <= 0) return `${r}с`;
  return `${m}м ${r}с`;
}

// ---- GRID ----
function makeCells() {
  gridEl.innerHTML = "";
  for (let i = 0; i < TON_ADDR_LEN; i++) {
    const d = document.createElement("div");
    d.className = "cell";
    d.textContent = randomChar();
    gridEl.appendChild(d);
  }
}

function randomChar() {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";
  return chars[Math.floor(Math.random() * chars.length)];
}

function setMaskedEdges() {
  const cells = [...gridEl.children];
  for (let i = 0; i < cells.length; i++) {
    cells[i].classList.remove("mask");
  }
  // первые 4 и последние 4 скрываем
  for (let i = 0; i < 4; i++) {
    cells[i].classList.add("mask");
    cells[cells.length - 1 - i].classList.add("mask");
  }
}

// ---- RUNNERS ----
let walletInterval = null;
let seedInterval = null;
let tickInterval = null;

function startWalletRun() {
  // фиксируем время окончания — чтобы продолжалось даже после закрытия
  const endAt = nowMs() + getWalletDurationMs();
  localStorage.setItem("hunt_wallet_endAt", String(endAt));
  setPhase(PHASE.WALLET_RUNNING);

  btnStart.style.display = "none";
  btnContinue.style.display = "none";
  btnView.style.display = "none";
  seedBox.style.display = "none";

  phaseTextEl.textContent = "Фаза 1: поиск кошелька";
  runWalletAnimation();
  ensureTicker();
}

function finishWalletRun() {
  stopWalletAnimation();

  // финальный "адрес" сохраняем (визуальный)
  const addr = [...gridEl.children].map(x => x.textContent).join("");
  localStorage.setItem("hunt_fake_addr", addr);

  setPhase(PHASE.WALLET_DONE);
  setMaskedEdges();

  btnContinue.style.display = "inline-block";
  phaseTextEl.textContent = "Фаза 1 завершена: найден потенциальный кошелёк";
  timerEl.textContent = "готово";
}

function startSeedRun() {
  const endAt = nowMs() + getSeedDurationMs();
  localStorage.setItem("hunt_seed_endAt", String(endAt));
  setPhase(PHASE.SEED_RUNNING);

  btnContinue.style.display = "none";
  btnView.style.display = "none";

  seedBox.style.display = "block";
  phaseTextEl.textContent = "Фаза 2: подбор сид-фраз (визуализация)";
  runSeedAnimation();
  ensureTicker();
}

function finishSeedRun() {
  stopSeedAnimation();
  setPhase(PHASE.SEED_DONE);

  btnView.style.display = "inline-block";
  phaseTextEl.textContent = "Фаза 2 завершена: готово к проверке";
  timerEl.textContent = "готово";

  // сохраним "сид" (визуальный)
  localStorage.setItem("hunt_fake_seed", seedLine.textContent);
}

function runWalletAnimation() {
  stopWalletAnimation();
  walletInterval = setInterval(() => {
    for (const cell of gridEl.children) {
      cell.textContent = randomChar();
    }
  }, 60);
}

function stopWalletAnimation() {
  if (walletInterval) clearInterval(walletInterval);
  walletInterval = null;
}

const WORDS = [
  "apple","night","river","gold","stone","ocean","green","laser","silent","shadow",
  "planet","matrix","crypto","wolf","orbit","signal","vector","random","vault","hunter",
  "secure","token","native","future","cloud","ember","drift","glory","focus","orbit",
];

function randomWords(n=12) {
  const arr = [];
  for (let i=0;i<n;i++) arr.push(WORDS[Math.floor(Math.random()*WORDS.length)]);
  return arr.join(" ");
}

function runSeedAnimation() {
  stopSeedAnimation();
  seedInterval = setInterval(() => {
    seedLine.textContent = randomWords(12);
  }, 120);
}

function stopSeedAnimation() {
  if (seedInterval) clearInterval(seedInterval);
  seedInterval = null;
}

// ---- TICKER: следит за endAt и управляет состояниями ----
function ensureTicker() {
  if (tickInterval) return;
  tickInterval = setInterval(() => {
    const phase = getPhase();

    if (phase === PHASE.WALLET_RUNNING) {
      const endAt = Number(localStorage.getItem("hunt_wallet_endAt") || 0);
      const left = endAt - nowMs();
      timerEl.textContent = fmtMs(left);
      if (left <= 0) finishWalletRun();
    }

    if (phase === PHASE.SEED_RUNNING) {
      const endAt = Number(localStorage.getItem("hunt_seed_endAt") || 0);
      const left = endAt - nowMs();
      timerEl.textContent = fmtMs(left);
      if (left <= 0) finishSeedRun();
    }
  }, 250);
}

// ---- RESTORE ON LOAD ----
function restoreState() {
  makeCells();

  const phase = getPhase();

  if (phase === PHASE.NONE) {
    btnStart.style.display = "inline-block";
    btnContinue.style.display = "none";
    btnView.style.display = "none";
    seedBox.style.display = "none";
    timerEl.textContent = "—";
    phaseTextEl.textContent = "Фаза 1: поиск кошелька";
    return;
  }

  if (phase === PHASE.WALLET_RUNNING) {
    btnStart.style.display = "none";
    btnContinue.style.display = "none";
    btnView.style.display = "none";
    seedBox.style.display = "none";
    phaseTextEl.textContent = "Фаза 1: поиск кошелька";
    runWalletAnimation();
    ensureTicker();
    return;
  }

  if (phase === PHASE.WALLET_DONE) {
    btnStart.style.display = "none";
    btnContinue.style.display = "inline-block";
    btnView.style.display = "none";
    seedBox.style.display = "none";
    phaseTextEl.textContent = "Фаза 1 завершена: найден потенциальный кошелёк";
    // восстановим адрес, если есть
    const addr = localStorage.getItem("hunt_fake_addr");
    if (addr && addr.length === TON_ADDR_LEN) {
      [...gridEl.children].forEach((c, i) => c.textContent = addr[i]);
    }
    setMaskedEdges();
    timerEl.textContent = "готово";
    return;
  }

  if (phase === PHASE.SEED_RUNNING) {
    btnStart.style.display = "none";
    btnContinue.style.display = "none";
    btnView.style.display = "none";
    seedBox.style.display = "block";
    phaseTextEl.textContent = "Фаза 2: подбор сид-фраз (визуализация)";
    // адрес восстановим
    const addr = localStorage.getItem("hunt_fake_addr");
    if (addr && addr.length === TON_ADDR_LEN) {
      [...gridEl.children].forEach((c, i) => c.textContent = addr[i]);
    }
    setMaskedEdges();
    runSeedAnimation();
    ensureTicker();
    return;
  }

  if (phase === PHASE.SEED_DONE) {
    btnStart.style.display = "none";
    btnContinue.style.display = "none";
    btnView.style.display = "inline-block";
    seedBox.style.display = "block";
    phaseTextEl.textContent = "Фаза 2 завершена: готово к проверке";

    const addr = localStorage.getItem("hunt_fake_addr");
    if (addr && addr.length === TON_ADDR_LEN) {
      [...gridEl.children].forEach((c, i) => c.textContent = addr[i]);
    }
    setMaskedEdges();

    const seed = localStorage.getItem("hunt_fake_seed");
    seedLine.textContent = seed || randomWords(12);

    timerEl.textContent = "готово";
    return;
  }
}

// ---- BUTTONS ----
btnStart.addEventListener("click", startWalletRun);
btnContinue.addEventListener("click", startSeedRun);
btnView.addEventListener("click", () => {
  // переход на результат
  window.location.href = "result.html";
});

restoreState();

