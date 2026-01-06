// hunt.js — WalletHunter (TON) визуализация

const params = new URLSearchParams(window.location.search);
const WALLET_TYPE = params.get("wallet") || "ton";

const WALLET_CONFIG = {
  ton: { title: "TON Wallet Scan", addrLen: 48 },
  trust: { title: "Trust Wallet Scan (soon)", addrLen: 40 },
  metamask: { title: "MetaMask Scan (soon)", addrLen: 40 },
};
const WALLET = WALLET_CONFIG[WALLET_TYPE] || WALLET_CONFIG.ton;

// ====== TEST TIMINGS (меняй здесь) ======
const DEFAULT_WALLET_MS = 15 * 1000; // 15 секунд
const DEFAULT_SEED_MS   = 10 * 1000; // 10 секунд

// скорости (визуально)
const SPEED_BASE = 40; // кошельков/сек при x1
let speedX = 1;

// seed-анимация
const SEED_WORDS_COUNT = 24;
const SEED_UPDATE_MS = 125; // x2

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

let checkedWallets = 0;
let startAt = 0;
let endAt = 0;

let animInterval = null;
let tickInterval = null;
let seedInterval = null;

// ---------- helpers ----------
const now = () => Date.now();

function fmtTime(ms) {
  if (ms < 0) ms = 0;
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  const r = s % 60;
  return m > 0 ? `${m}м ${r}с` : `${r}с`;
}

function randomChar() {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";
  return chars[Math.floor(Math.random() * chars.length)];
}

function setPhase(p) {
  localStorage.setItem("wh_phase", p);
}

function getPhase() {
  return localStorage.getItem("wh_phase") || PHASE.NONE;
}

function getWalletDurationMs() {
  return Number(localStorage.getItem("wh_wallet_ms") || DEFAULT_WALLET_MS);
}
function getSeedDurationMs() {
  return Number(localStorage.getItem("wh_seed_ms") || DEFAULT_SEED_MS);
}

// ---------- grid ----------
function makeGrid() {
  gridEl.innerHTML = "";
  for (let i = 0; i < WALLET.addrLen; i++) {
    const d = document.createElement("div");
    d.className = "cell";
    d.textContent = randomChar();
    gridEl.appendChild(d);
  }
}

function animateGrid() {
  stopGridAnim();
  animInterval = setInterval(() => {
    for (const c of gridEl.children) c.textContent = randomChar();
  }, 60);
}

function stopGridAnim() {
  if (animInterval) clearInterval(animInterval);
  animInterval = null;
}

function setMaskedEdges() {
  const cells = [...gridEl.children];
  cells.forEach(c => c.classList.remove("mask"));
  for (let i = 0; i < 4; i++) {
    cells[i]?.classList.add("mask");
    cells[cells.length - 1 - i]?.classList.add("mask");
  }
}

function saveAddr() {
  const addr = [...gridEl.children].map(c => c.textContent).join("");
  localStorage.setItem("wh_fake_addr", addr);
}

function restoreAddr() {
  const addr = localStorage.getItem("wh_fake_addr") || "";
  if (addr.length === WALLET.addrLen) {
    [...gridEl.children].forEach((c, i) => c.textContent = addr[i]);
  }
}

// ---------- seed words ----------
const WORDS_3 = [
  "sun","ice","box","jet","key","map","run","dot","bit","hex",
  "air","sky","cpu","ram","net","usb","app","gas","log","mix",
  "sec","pin","bug","alt","tab","row","col","tag","zip","dns"
];

const WORDS_4 = [
  "node","hash","mint","fork","seed","coin","scan","link","salt","zero",
  "unit","byte","chip","data","time","code","pool","ring","path","lock",
  "sign","swap","burn","cold","ping","mask","flow","rate","trust","meta"
];

const WORDS_LONG = [
  "planet","matrix","crypto","hunter","secure","future","binary","quantum",
  "wallet","bridge","ledger","vector","random","signal","native","shadow",
  "orbit","vault","token","ember","drift","focus","glory","beacon","vertex"
];

const WORDS = [...WORDS_3, ...WORDS_4, ...WORDS_LONG];

function randomSeed() {
  const arr = [];
  for (let i = 0; i < SEED_WORDS_COUNT; i++) {
    arr.push(WORDS[Math.floor(Math.random() * WORDS.length)]);
  }
  return arr.join(" ");
}

function startSeedAnimation() {
  stopSeedAnimation();
  seedInterval = setInterval(() => {
    seedLine.textContent = randomSeed();
  }, SEED_UPDATE_MS);
}

function stopSeedAnimation() {
  if (seedInterval) clearInterval(seedInterval);
  seedInterval = null;
}

// ---------- ticker ----------
function startTicker() {
  if (tickInterval) return;

  tickInterval = setInterval(() => {
    const phase = getPhase();

    // 1) Wallet running: таймер + счётчик растут
    if (phase === PHASE.WALLET_RUNNING) {
      const elapsed = now() - startAt;
      timerEl.textContent = fmtTime(elapsed);

      const delta = Math.floor((SPEED_BASE * speedX) / 4);
      checkedWallets += delta;
      statsEl.textContent = `Проверено кошельков: ${checkedWallets.toLocaleString()}`;

      // финиш по времени
      if (now() >= endAt) {
        finishWalletRun();
      }
      return;
    }

    // 2) Seed running: таймер можно показать (если хочешь), но кошельки НЕ считаем
    if (phase === PHASE.SEED_RUNNING) {
      const left = endAt - now();
      timerEl.textContent = fmtTime(left);

      if (left <= 0) {
        finishSeedRun();
      }
      return;
    }
  }, 250);
}

function stopTicker() {
  if (tickInterval) clearInterval(tickInterval);
  tickInterval = null;
}

// ---------- flow ----------
function startWalletRun() {
  startAt = now();
  endAt = startAt + getWalletDurationMs();
  checkedWallets = 0;

  localStorage.setItem("wh_startAt", String(startAt));
  localStorage.setItem("wh_endAt", String(endAt));
  localStorage.removeItem("wh_fake_addr");
  localStorage.removeItem("wh_fake_seed");

  setPhase(PHASE.WALLET_RUNNING);

  btnStart.style.display = "none";
  btnContinue.style.display = "none";
  btnView.style.display = "none";
  seedBox.style.display = "none";

  phaseTextEl.textContent = WALLET.title;
  timerEl.textContent = "0с";
  statsEl.textContent = "Проверено кошельков: 0";

  animateGrid();
  startTicker();
}

function finishWalletRun() {
  stopGridAnim();

  saveAddr();
  restoreAddr();
  setMaskedEdges();

  setPhase(PHASE.WALLET_DONE);

  timerEl.textContent = "готово";
  // statsEl оставляем как есть

  btnContinue.style.display = "inline-block";
  btnView.style.display = "none";
  seedBox.style.display = "none";

  phaseTextEl.textContent = "Найден потенциальный кошелёк";
}

function startSeedRun() {
  // seed идёт фиксированное время
  startAt = now();
  endAt = startAt + getSeedDurationMs();
  localStorage.setItem("wh_startAt", String(startAt));
  localStorage.setItem("wh_endAt", String(endAt));

  setPhase(PHASE.SEED_RUNNING);

  btnContinue.style.display = "none";
  btnView.style.display = "none";
  seedBox.style.display = "block";

  phaseTextEl.textContent = "Подбор сид-фраз";
  timerEl.textContent = fmtTime(getSeedDurationMs());

  // ВАЖНО: на сид-фразах НЕ увеличиваем checkedWallets (и не меняем stats)
  restoreAddr();
  setMaskedEdges();

  seedLine.textContent = randomSeed();
  startSeedAnimation();
  startTicker();
}

function finishSeedRun() {
  stopSeedAnimation();
  setPhase(PHASE.SEED_DONE);

  const finalSeed = seedLine.textContent || randomSeed();
  localStorage.setItem("wh_fake_seed", finalSeed);

  timerEl.textContent = "готово";
  phaseTextEl.textContent = "Готово к проверке";
  btnView.style.display = "inline-block";
}

function restore() {
  makeGrid();

  speedX = Number(localStorage.getItem("wh_speed_x") || "1");

  const phase = getPhase();
  startAt = Number(localStorage.getItem("wh_startAt") || now());
  endAt = Number(localStorage.getItem("wh_endAt") || (startAt + getWalletDurationMs()));

  btnStart.style.display = "none";
  btnContinue.style.display = "none";
  btnView.style.display = "none";
  seedBox.style.display = "none";

  if (phase === PHASE.NONE) {
    phaseTextEl.textContent = WALLET.title;
    timerEl.textContent = "0с";
    statsEl.textContent = "";
    btnStart.style.display = "inline-block";
    return;
  }

  if (phase === PHASE.WALLET_RUNNING) {
    phaseTextEl.textContent = WALLET.title;
    animateGrid();
    startTicker();
    btnStart.style.display = "none";
    return;
  }

  if (phase === PHASE.WALLET_DONE) {
    restoreAddr();
    setMaskedEdges();
    phaseTextEl.textContent = "Найден потенциальный кошелёк";
    timerEl.textContent = "готово";
    btnContinue.style.display = "inline-block";
    return;
  }

  if (phase === PHASE.SEED_RUNNING) {
    restoreAddr();
    setMaskedEdges();
    phaseTextEl.textContent = "Подбор сид-фраз";
    seedBox.style.display = "block";
    seedLine.textContent = randomSeed();
    startSeedAnimation();
    startTicker();
    return;
  }

  if (phase === PHASE.SEED_DONE) {
    restoreAddr();
    setMaskedEdges();
    phaseTextEl.textContent = "Готово к проверке";
    seedBox.style.display = "block";
    seedLine.textContent = localStorage.getItem("wh_fake_seed") || randomSeed();
    timerEl.textContent = "готово";
    btnView.style.display = "inline-block";
    return;
  }
}

// ---------- buttons ----------
btnStart?.addEventListener("click", startWalletRun);
btnContinue?.addEventListener("click", startSeedRun);
btnView?.addEventListener("click", () => {
  location.href = "result.html";
});

restore();
