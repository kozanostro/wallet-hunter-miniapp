// hunt.js — WalletHunter (TON) + маска + seed speed x2 + стоп счётчиков на SEED
console.log("HUNT.JS LOADED");

// ================= URL PARAM =================
const params = new URLSearchParams(window.location.search);
const WALLET_TYPE = params.get("wallet") || "ton";

// ================= WALLET CONFIG =================
const WALLET_CONFIG = {
  ton: { title: "TON Wallet Scan", addrLen: 48 },
  trust: { title: "Trust Wallet Scan (soon)", addrLen: 40 },
  metamask: { title: "MetaMask Scan (soon)", addrLen: 40 },
};
const WALLET = WALLET_CONFIG[WALLET_TYPE] || WALLET_CONFIG.ton;

// ================= BASIC CONFIG =================
const ADDR_LEN = WALLET.addrLen;
const SEED_WORDS_COUNT = 24;

// скорость “проверено кошельков” (только на фазе WALLET)
const SPEED_BASE = 40; // кошельков/сек при x1
let speedX = 1;

// скорость обновления сид-фраз (x2 от нынешнего)
// раньше обновлялось раз в 250мс (в тикере), теперь будет 125мс
const SEED_UPDATE_MS = 125;

// ================= PHASE =================
const PHASE = {
  NONE: "none",
  WALLET: "wallet",
  SEED: "seed",
  DONE: "done",
};

// ================= DOM =================
const gridEl = document.getElementById("grid");
const timerEl = document.getElementById("timer");
const phaseTextEl = document.getElementById("phaseText");
const statsEl = document.getElementById("stats");

const btnStart = document.getElementById("btnStart");
const btnContinue = document.getElementById("btnContinue");
const btnView = document.getElementById("btnView");

const seedBox = document.getElementById("seedBox");
const seedLine = document.getElementById("seedLine");

// ================= STATE =================
let startAt = 0;
let checkedWallets = 0;

let animInterval = null;     // анимация символов
let walletTick = null;       // тикер WALLET (таймер + checked)
let seedInterval = null;     // обновление seed текста

// ================= UTIL =================
function now() { return Date.now(); }

function fmtTime(ms) {
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  const r = s % 60;
  return m > 0 ? `${m}м ${r}с` : `${r}с`;
}

function randomChar() {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";
  return chars[Math.floor(Math.random() * chars.length)];
}

// ================= GRID =================
function makeGrid() {
  gridEl.innerHTML = "";
  for (let i = 0; i < ADDR_LEN; i++) {
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

// Маска: первые 4 и последние 4
function setMaskedEdges() {
  const cells = [...gridEl.children];
  for (const c of cells) c.classList.remove("mask");
  for (let i = 0; i < 4; i++) {
    if (cells[i]) cells[i].classList.add("mask");
    const j = cells.length - 1 - i;
    if (cells[j]) cells[j].classList.add("mask");
  }
}

// Сохраняем текущий “адрес” (визуальный) в localStorage
function saveAddrToStorage() {
  const addr = [...gridEl.children].map(x => x.textContent).join("");
  localStorage.setItem("wh_fake_addr", addr);
}

function restoreAddrFromStorage() {
  const addr = localStorage.getItem("wh_fake_addr") || "";
  if (addr.length === ADDR_LEN) {
    [...gridEl.children].forEach((c, i) => c.textContent = addr[i]);
  }
}

// ================= SEED =================
// 50+ слов (можешь расширять сколько хочешь)
const WORDS = [
  "apple","night","river","gold","stone","ocean","green","laser","silent","shadow",
  "planet","matrix","crypto","wolf","orbit","signal","vector","random","vault","hunter",
  "secure","token","native","future","cloud","ember","drift","focus","glory","binary",
  "silver","winter","summer","autumn","spring","mirror","rocket","comet","nebula","quantum",
  "cipher","kernel","buffer","thread","socket","vectorize","ledger","wallet","bridge","shard",
  "phoenix","dragon","falcon","anchor","beacon","vertex"
];

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

// ================= WALLET TICKER =================
// ВАЖНО: работает ТОЛЬКО на фазе WALLET
function startWalletTicker() {
  stopWalletTicker();
  walletTick = setInterval(() => {
    const elapsed = now() - startAt;
    timerEl.textContent = fmtTime(elapsed);

    const delta = Math.floor((SPEED_BASE * speedX) / 4); // шаг раз в 250мс
    checkedWallets += delta;

    statsEl.textContent = `Проверено кошельков: ${checkedWallets.toLocaleString()}`;
  }, 250);
}

function stopWalletTicker() {
  if (walletTick) clearInterval(walletTick);
  walletTick = null;
}

// ================= FLOW =================
function startWalletScan() {
  startAt = now();
  checkedWallets = 0;

  localStorage.setItem("wh_phase", PHASE.WALLET);
  localStorage.setItem("wh_startAt", String(startAt));
  localStorage.removeItem("wh_fake_addr");

  btnStart.style.display = "none";
  btnContinue.style.display = "none";
  btnView.style.display = "none";
  seedBox.style.display = "none";

  phaseTextEl.textContent = WALLET.title;

  animateGrid();
  startWalletTicker();
}

function finishWalletScan() {
  // фиксируем адрес, останавливаем анимацию, включаем маску
  stopGridAnim();
  stopWalletTicker();

  saveAddrToStorage();
  restoreAddrFromStorage();
  setMaskedEdges();

  // на экране покажем итог, но счётчики больше не растут
  timerEl.textContent = "готово";
  statsEl.textContent = `Проверено кошельков: ${checkedWallets.toLocaleString()}`;

  btnContinue.style.display = "inline-block";
}

function startSeedScan() {
  // Переходим к сид-фразам: таймер и checked НЕ должны расти -> тикер выключен
  localStorage.setItem("wh_phase", PHASE.SEED);

  btnContinue.style.display = "none";
  btnView.style.display = "none";
  seedBox.style.display = "block";

  phaseTextEl.textContent = "Seed phrase analysis";
  timerEl.textContent = "—"; // стоп таймера на сид-фразах
  // checked тоже заморожен (statsEl оставляем как есть)

  // адрес должен оставаться виден (замаскирован)
  restoreAddrFromStorage();
  setMaskedEdges();

  startSeedAnimation();

  // Показываем кнопку "посмотреть" (как у тебя сделано)
  btnView.style.display = "inline-block";
}

function finishAll() {
  stopGridAnim();
  stopWalletTicker();
  stopSeedAnimation();
  localStorage.setItem("wh_phase", PHASE.DONE);

  phaseTextEl.textContent = "Analysis complete";
  timerEl.textContent = "готово";
  btnView.style.display = "inline-block";
}

// ================= RESTORE =================
function restore() {
  makeGrid();
  speedX = Number(localStorage.getItem("wh_speed_x") || "1");

  const phase = localStorage.getItem("wh_phase") || PHASE.NONE;
  startAt = Number(localStorage.getItem("wh_startAt") || now());

  phaseTextEl.textContent = WALLET.title;

  // базовое состояние кнопок
  btnStart.style.display = "none";
  btnContinue.style.display = "none";
  btnView.style.display = "none";
  seedBox.style.display = "none";

  if (phase === PHASE.NONE) {
    btnStart.style.display = "inline-block";
    timerEl.textContent = "0с";
    statsEl.textContent = "";
    return;
  }

  if (phase === PHASE.WALLET) {
    animateGrid();
    startWalletTicker();
    // чтобы была возможность завершить WALLET вручную кнопкой (если у тебя так задумано)
    // можно оставить continue скрытой пока не "нашло", но пока делаем просто кнопку через finish
    // Если хочешь авто-завершение по времени — сделаем следующим шагом.
    return;
  }

  // если был сохранён адрес — восстановим и замаскируем
  restoreAddrFromStorage();
  setMaskedEdges();

  if (phase === PHASE.SEED) {
    stopWalletTicker();
    stopGridAnim();
    seedBox.style.display = "block";
    phaseTextEl.textContent = "Seed phrase analysis";
    timerEl.textContent = "—";
    statsEl.textContent = `Проверено кошельков: ${checkedWallets.toLocaleString()}`;
    startSeedAnimation();
    btnView.style.display = "inline-block";
    return;
  }

  if (phase === PHASE.DONE) {
    finishAll();
  }
}

// ================= BUTTONS =================
btnStart?.addEventListener("click", startWalletScan);

// ВАЖНО: у тебя сейчас нет авто-финиша WALLET, поэтому “Continue” мы включаем вручную.
// Если у тебя уже есть логика авто-поиска — скажи, где (по времени/из API) и я сделаю правильно.
btnContinue?.addEventListener("click", startSeedScan);

btnView?.addEventListener("click", () => {
  location.href = "result.html";
});

// ================= MANUAL FINISH (для теста) =================
// Чтобы не потерять время: сделаем простой тестовый “авто-финиш” WALLET через 10 секунд,
// если хочешь — потом уберём или привяжем к админке/API.
(function autoFinishForTest() {
  const phase = localStorage.getItem("wh_phase") || PHASE.NONE;
  if (phase === PHASE.WALLET) {
    setTimeout(() => {
      const p = localStorage.getItem("wh_phase");
      if (p === PHASE.WALLET) {
        finishWalletScan();
      }
    }, 10_000);
  }
})();

restore();
