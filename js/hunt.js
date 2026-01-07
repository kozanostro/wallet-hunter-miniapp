// hunt.js — WalletHunter (TON) — визуализация 2 фаз + стабильные состояния
// Фаза 1: поиск кошелька (grid бегает + счётчик растёт)
// Фаза 2: сид-фразы (grid заморожен + счётчик НЕ растёт)

const TON_ADDR_LEN = 48;
const SEED_WORDS_COUNT = 24;

// --- тестовые тайминги (можно менять в localStorage) ---
const DEFAULT_WALLET_MS = 15 * 1000; // 15 секунд (тест)
const DEFAULT_SEED_MS   = 12 * 1000; // 12 секунд (тест)

// --- скорость визуального счётчика (кошельков/сек) ---
const SPEED_BASE = 30; // x1
// множитель можно хранить как wh_speed_x в localStorage
// например wh_speed_x=5 даст x5

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
const checkedStatsEl = document.getElementById("checkedStats");

const btnStart = document.getElementById("btnStart");
const btnContinue = document.getElementById("btnContinue");
const btnView = document.getElementById("btnView");

const seedBox = document.getElementById("seedBox");
const seedLine = document.getElementById("seedLine");

// ---------------- storage helpers ----------------
function nowMs() { return Date.now(); }

function getWalletDurationMs() {
  return Number(localStorage.getItem("hunt_wallet_duration_ms") || DEFAULT_WALLET_MS);
}
function getSeedDurationMs() {
  return Number(localStorage.getItem("hunt_seed_duration_ms") || DEFAULT_SEED_MS);
}
function getSpeedX() {
  const x = Number(localStorage.getItem("wh_speed_x") || "1");
  return isFinite(x) && x > 0 ? x : 1;
}

function setPhase(p) { localStorage.setItem("hunt_phase", p); }
function getPhase() { return localStorage.getItem("hunt_phase") || PHASE.NONE; }

// ---------------- time formatting ----------------
function fmtMs(ms) {
  if (ms < 0) ms = 0;
  const s = Math.ceil(ms / 1000);
  const m = Math.floor(s / 60);
  const r = s % 60;
  if (m <= 0) return `${r}с`;
  return `${m}м ${r}с`;
}

// ---------------- GRID ----------------
function randomChar() {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";
  return chars[Math.floor(Math.random() * chars.length)];
}

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

function setMaskedEdges() {
  if (!gridEl) return;
  const cells = [...gridEl.children];
  for (let i = 0; i < cells.length; i++) cells[i].classList.remove("mask");

  // первые 4 и последние 4 скрываем
  for (let i = 0; i < 4; i++) {
    if (cells[i]) cells[i].classList.add("mask");
    if (cells[cells.length - 1 - i]) cells[cells.length - 1 - i].classList.add("mask");
  }
}

function setGridFromString(addr) {
  if (!gridEl) return;
  if (!addr || addr.length !== TON_ADDR_LEN) return;
  [...gridEl.children].forEach((c, i) => { c.textContent = addr[i]; });
}

// ---------------- SEED WORDS ----------------
// База 50+ слов
const WORDS_BASE = [
  "apple","night","river","gold","stone","ocean","green","laser","silent","shadow",
  "planet","matrix","crypto","wolf","orbit","signal","vector","random","vault","hunter",
  "secure","token","native","future","cloud","ember","drift","glory","focus","binary",
  "mercury","saturn","lunar","solar","comet","nebula","quartz","copper","silver","carbon",
  "fusion","photon","nexus","cipher","wallet","miners","ledger","shield","atomic","quantum",
  "engine","rocket","hazard","dragon","oracle","zenith","flux","prism","vertex","kernel"
];

// + 30 слов из 3 букв
const WORDS_3 = [
  "ton","dex","bot","air","ice","sky","sun","jet","zip","key",
  "app","api","rpc","cpu","gpu","ram","log","uid","win","run",
  "fee","buy","sell","pay","mix","max","min","top","low","mid"
];

// + 30 слов из 4 букв
const WORDS_4 = [
  "seed","scan","hunt","mask","grid","node","swap","mint","send","recv",
  "link","hash","salt","keys","coin","play","work","open","load","save",
  "time","lock","fast","slow","safe","zero","full","test","prod","next"
];

const WORDS = [...WORDS_BASE, ...WORDS_3, ...WORDS_4];

function randomSeed(n = SEED_WORDS_COUNT) {
  const arr = [];
  for (let i = 0; i < n; i++) {
    arr.push(WORDS[Math.floor(Math.random() * WORDS.length)]);
  }
  return arr.join(" ");
}

// ---------------- intervals / runtime state ----------------
let walletInterval = null; // grid animation
let seedInterval = null;   // seed animation
let tickInterval = null;   // global ticker

let checkedWallets = 0;

// ---------------- stop helpers ----------------
function stopWalletAnimation() {
  if (walletInterval) clearInterval(walletInterval);
  walletInterval = null;
}
function stopSeedAnimation() {
  if (seedInterval) clearInterval(seedInterval);
  seedInterval = null;
}
function stopTicker() {
  if (tickInterval) clearInterval(tickInterval);
  tickInterval = null;
}
function stopAll() {
  stopWalletAnimation();
  stopSeedAnimation();
  stopTicker();
}

// ---------------- animations ----------------
function runWalletAnimation() {
  stopWalletAnimation();
  walletInterval = setInterval(() => {
    if (!gridEl) return;
    for (const cell of gridEl.children) cell.textContent = randomChar();
  }, 60);
}

// сид-фразы быстрее x2: было условно 120ms, делаем 60ms
function runSeedAnimationFast() {
  stopSeedAnimation();
  seedInterval = setInterval(() => {
    if (seedLine) seedLine.textContent = randomSeed(SEED_WORDS_COUNT);
  }, 60);
}

// ---------------- phase actions ----------------
function resetToStartState() {
  stopAll();
  setPhase(PHASE.NONE);

  localStorage.removeItem("hunt_wallet_endAt");
  localStorage.removeItem("hunt_seed_endAt");
  localStorage.removeItem("hunt_fake_addr");
  localStorage.removeItem("hunt_fake_seed");

  checkedWallets = 0;

  if (btnStart) {
    btnStart.style.display = "inline-block";
    btnStart.textContent = "СТАРТ";
  }
  if (btnContinue) btnContinue.style.display = "none";
  if (btnView) btnView.style.display = "none";
  if (seedBox) seedBox.style.display = "none";

  if (phaseTextEl) phaseTextEl.textContent = "Фаза 1: поиск кошелька";
  if (timerEl) timerEl.textContent = "—";
  if (statsEl) statsEl.textContent = "";
  if (checkedStatsEl) checkedStatsEl.textContent = "Проверено кошельков: 0";
}

function startWalletRun() {
  // старт новой сессии
  checkedWallets = 0;
  if (checkedStatsEl) checkedStatsEl.textContent = "Проверено кошельков: 0";
  if (statsEl) statsEl.textContent = "";

  const endAt = nowMs() + getWalletDurationMs();
  localStorage.setItem("hunt_wallet_endAt", String(endAt));
  setPhase(PHASE.WALLET_RUNNING);

  if (btnStart) btnStart.style.display = "none";
  if (btnContinue) btnContinue.style.display = "none";
  if (btnView) btnView.style.display = "none";
  if (seedBox) seedBox.style.display = "none";

  if (phaseTextEl) phaseTextEl.textContent = "Фаза 1: поиск кошелька";
  runWalletAnimation();
  ensureTicker();
}

function finishWalletRun() {
  stopWalletAnimation();

  // сохраняем финальный "адрес" (визуальный)
  let addr = "";
  if (gridEl) addr = [...gridEl.children].map(x => x.textContent).join("");
  localStorage.setItem("hunt_fake_addr", addr);

  setPhase(PHASE.WALLET_DONE);
  setMaskedEdges();

  if (btnContinue) btnContinue.style.display = "inline-block";
  if (phaseTextEl) phaseTextEl.textContent = "Фаза 1 завершена: найден потенциальный кошелёк";
  if (timerEl) timerEl.textContent = "готово";
}

function startSeedRun() {
  // seed начинается — кошелёк должен быть заморожен (НЕ бегать)
  stopWalletAnimation();

  const endAt = nowMs() + getSeedDurationMs();
  localStorage.setItem("hunt_seed_endAt", String(endAt));
  setPhase(PHASE.SEED_RUNNING);

  if (btnContinue) btnContinue.style.display = "none";
  if (btnView) btnView.style.display = "none";

  if (seedBox) seedBox.style.display = "block";
  if (phaseTextEl) phaseTextEl.textContent = "Фаза 2: подбор сид-фраз (визуализация)";

  // восстановим адрес и маску
  const addr = localStorage.getItem("hunt_fake_addr");
  setGridFromString(addr);
  setMaskedEdges();

  // старт сид-анимации
  if (seedLine) seedLine.textContent = randomSeed(SEED_WORDS_COUNT);
  runSeedAnimationFast();

  ensureTicker();
}

function finishSeedRun() {
  stopSeedAnimation();
  setPhase(PHASE.SEED_DONE);

  if (btnView) btnView.style.display = "inline-block";
  if (phaseTextEl) phaseTextEl.textContent = "Фаза 2 завершена: готово к проверке";
  if (timerEl) timerEl.textContent = "готово";

  // сохраняем сид
  if (seedLine) localStorage.setItem("hunt_fake_seed", seedLine.textContent);

  // покажем кнопку "Новый поиск"
  if (btnStart) {
    btnStart.style.display = "inline-block";
    btnStart.textContent = "Новый поиск";
  }
}

// ---------------- ticker ----------------
function ensureTicker() {
  if (tickInterval) return;

  tickInterval = setInterval(() => {
    const phase = getPhase();

    // Фаза 1: таймер ДО конца + счётчик растёт
    if (phase === PHASE.WALLET_RUNNING) {
      const endAt = Number(localStorage.getItem("hunt_wallet_endAt") || 0);
      const left = endAt - nowMs();
      if (timerEl) timerEl.textContent = fmtMs(left);

      // счётчик растёт только тут
      const speedX = getSpeedX();
      const perTick = Math.floor((SPEED_BASE * speedX) / 4); // потому что тик 250ms
      checkedWallets += Math.max(0, perTick);

      if (checkedStatsEl) checkedStatsEl.textContent = "Проверено кошельков: " + checkedWallets.toLocaleString();
      if (statsEl) statsEl.textContent = "";

      if (left <= 0) finishWalletRun();
      return;
    }

    // Фаза 2: таймер ДО конца + сид крутится, НО счётчик НЕ растёт
    if (phase === PHASE.SEED_RUNNING) {
      const endAt = Number(localStorage.getItem("hunt_seed_endAt") || 0);
      const left = endAt - nowMs();
      if (timerEl) timerEl.textContent = fmtMs(left);

      // счётчик НЕ меняем
      if (left <= 0) finishSeedRun();
      return;
    }

    // Готовые фазы — тикер можно оставить, но он ничего не делает
    if (phase === PHASE.WALLET_DONE || phase === PHASE.SEED_DONE || phase === PHASE.NONE) {
      return;
    }
  }, 250);
}

// ---------------- restore ----------------
function restoreState() {
  makeGrid();

  const phase = getPhase();

  // defaults
  if (checkedStatsEl) checkedStatsEl.textContent = "Проверено кошельков: " + checkedWallets.toLocaleString();

  if (phase === PHASE.NONE) {
    resetToStartState();
    return;
  }

  // если шёл поиск кошелька
  if (phase === PHASE.WALLET_RUNNING) {
    if (btnStart) btnStart.style.display = "none";
    if (btnContinue) btnContinue.style.display = "none";
    if (btnView) btnView.style.display = "none";
    if (seedBox) seedBox.style.display = "none";
    if (phaseTextEl) phaseTextEl.textContent = "Фаза 1: поиск кошелька";

    runWalletAnimation();
    ensureTicker();
    return;
  }

  // если кошелёк найден
  if (phase === PHASE.WALLET_DONE) {
    if (btnStart) btnStart.style.display = "none";
    if (btnContinue) btnContinue.style.display = "inline-block";
    if (btnView) btnView.style.display = "none";
    if (seedBox) seedBox.style.display = "none";

    if (phaseTextEl) phaseTextEl.textContent = "Фаза 1 завершена: найден потенциальный кошелёк";
    const addr = localStorage.getItem("hunt_fake_addr");
    setGridFromString(addr);
    setMaskedEdges();
    if (timerEl) timerEl.textContent = "готово";
    return;
  }

  // если шёл сид-подбор
  if (phase === PHASE.SEED_RUNNING) {
    if (btnStart) btnStart.style.display = "none";
    if (btnContinue) btnContinue.style.display = "none";
    if (btnView) btnView.style.display = "none";
    if (seedBox) seedBox.style.display = "block";

    if (phaseTextEl) phaseTextEl.textContent = "Фаза 2: подбор сид-фраз (визуализация)";

    const addr = localStorage.getItem("hunt_fake_addr");
    setGridFromString(addr);
    setMaskedEdges();

    runSeedAnimationFast();
    ensureTicker();
    return;
  }

  // если сид-подбор завершён
  if (phase === PHASE.SEED_DONE) {
    if (btnContinue) btnContinue.style.display = "none";
    if (btnView) btnView.style.display = "inline-block";
    if (seedBox) seedBox.style.display = "block";

    if (phaseTextEl) phaseTextEl.textContent = "Фаза 2 завершена: готово к проверке";

    const addr = localStorage.getItem("hunt_fake_addr");
    setGridFromString(addr);
    setMaskedEdges();

    const seed = localStorage.getItem("hunt_fake_seed");
    if (seedLine) seedLine.textContent = seed || randomSeed(SEED_WORDS_COUNT);

    if (timerEl) timerEl.textContent = "готово";

    // кнопка "Новый поиск"
    if (btnStart) {
      btnStart.style.display = "inline-block";
      btnStart.textContent = "Новый поиск";
    }
    return;
  }

  // если что-то странное — сброс
  resetToStartState();
}

// ---------------- buttons ----------------
if (btnStart) {
  btnStart.addEventListener("click", () => {
    // если уже закончили — начинаем заново
    const ph = getPhase();
    if (ph === PHASE.SEED_DONE) {
      resetToStartState();
    }
    startWalletRun();
  });
}
if (btnContinue) btnContinue.addEventListener("click", startSeedRun);
if (btnView) {
  btnView.addEventListener("click", () => {
    stopSeedAnimation();
    window.location.href = "result.html";
  });
}

// старт
restoreState();
