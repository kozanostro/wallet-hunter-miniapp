// hunt.js — WalletHunter (TON) — ВИЗУАЛИЗАЦИЯ
// Реальных кошельков/сидов не используется.

const TON_ADDR_LEN = 48;
const SEED_WORDS_COUNT = 24;

// ====== ТЕСТОВЫЕ ВРЕМЕНА ======
const WALLET_MS = 15 * 1000; // 15 секунд
const SEED_MS   = 10 * 1000; // 10 секунд
// ==============================

// скорость “проверки кошельков” (визуально)
const WALLETS_PER_SEC = 400;

const PHASE = {
  NONE: "none",
  WALLET_RUNNING: "wallet_running",
  WALLET_DONE: "wallet_done",
  SEED_RUNNING: "seed_running",
  SEED_DONE: "seed_done",
};

// ---- DOM ----
const gridEl = document.getElementById("grid");
const timerEl = document.getElementById("timer");
const phaseTextEl = document.getElementById("phaseText");
const checkedStatsEl = document.getElementById("checkedStats");

const btnStart = document.getElementById("btnStart");
const btnContinue = document.getElementById("btnContinue");
const btnView = document.getElementById("btnView");

const seedBox = document.getElementById("seedBox");
const seedLine = document.getElementById("seedLine");

// ---- state ----
let animInterval = null;
let tickInterval = null;
let checkedWallets = 0;

// ---------------- UTIL ----------------
function nowMs() { return Date.now(); }

function fmtElapsed(ms) {
  if (ms < 0) ms = 0;
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  const r = s % 60;
  return m > 0 ? `${m}м ${r}с` : `${r}с`;
}

function setPhase(p) { localStorage.setItem("wh_phase", p); }
function getPhase() { return localStorage.getItem("wh_phase") || PHASE.NONE; }

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

function saveFinalAddress() {
  if (!gridEl) return;
  const addr = [...gridEl.children].map(x => x.textContent).join("");
  localStorage.setItem("wh_fake_addr", addr);
}

function restoreFinalAddress() {
  if (!gridEl) return;
  const addr = localStorage.getItem("wh_fake_addr") || "";
  if (addr.length !== TON_ADDR_LEN) return;
  [...gridEl.children].forEach((c, i) => (c.textContent = addr[i]));
}

// ---------------- SEED ----------------
const WORDS = [
  "apple","night","river","gold","stone","ocean","green","laser",
  "silent","shadow","planet","matrix","crypto","wolf","orbit",
  "signal","vector","random","vault","hunter","secure","token",
  "native","future","cloud","ember","drift","focus","glory","binary",
  "cipher","prism","nova","lunar","quartz","rocket","spiral","delta"
];

function randomSeed() {
  const arr = [];
  for (let i = 0; i < SEED_WORDS_COUNT; i++) {
    arr.push(WORDS[Math.floor(Math.random() * WORDS.length)]);
  }
  return arr.join(" ");
}

// ---------------- UI HELPERS ----------------
function show(el, on) {
  if (!el) return;
  el.style.display = on ? "inline-block" : "none";
}

function setText(el, txt) {
  if (!el) return;
  el.textContent = txt;
}

function resetChecked() {
  checkedWallets = 0;
  if (checkedStatsEl) checkedStatsEl.textContent = "Проверено кошельков: 0";
}

// ---------------- PHASES ----------------
function startWalletPhase() {
  const startAt = nowMs();
  const endAt = startAt + WALLET_MS;

  localStorage.setItem("wh_wallet_startAt", String(startAt));
  localStorage.setItem("wh_wallet_endAt", String(endAt));
  setPhase(PHASE.WALLET_RUNNING);

  resetChecked();

  show(btnStart, false);
  show(btnContinue, false);
  show(btnView, false);

  if (seedBox) seedBox.style.display = "none";

  setText(phaseTextEl, "TON Wallet Scan");
  startGridAnim();
  ensureTicker();
}

function finishWalletPhase() {
  stopGridAnim();
  saveFinalAddress();
  setPhase(PHASE.WALLET_DONE);

  setText(phaseTextEl, "Кошелёк найден (визуально). Продолжить?");
  setText(timerEl, "готово");

  show(btnContinue, true);
}

function startSeedPhase() {
  const startAt = nowMs();
  const endAt = startAt + SEED_MS;

  localStorage.setItem("wh_seed_startAt", String(startAt));
  localStorage.setItem("wh_seed_endAt", String(endAt));
  setPhase(PHASE.SEED_RUNNING);

  show(btnContinue, false);
  show(btnView, false);

  if (seedBox) seedBox.style.display = "block";
  setText(phaseTextEl, "Seed phrase analysis");
  if (seedLine) seedLine.textContent = randomSeed();

  ensureTicker();
}

function finishSeedPhase() {
  setPhase(PHASE.SEED_DONE);
  if (seedLine) localStorage.setItem("wh_fake_seed", seedLine.textContent || "");

  setText(phaseTextEl, "Analysis complete");
  setText(timerEl, "готово");

  show(btnView, true);
}

// ---------------- TICKER ----------------
function ensureTicker() {
  if (tickInterval) return;

  tickInterval = setInterval(() => {
    const phase = getPhase();

    // счётчик кошельков (идёт в фазах wallet + seed)
    if (phase === PHASE.WALLET_RUNNING || phase === PHASE.SEED_RUNNING) {
      checkedWallets += Math.floor(WALLETS_PER_SEC / 4); // каждые 250мс
      if (checkedStatsEl) {
        checkedStatsEl.textContent = "Проверено кошельков: " + checkedWallets.toLocaleString();
      }
    }

    if (phase === PHASE.WALLET_RUNNING) {
      const startAt = Number(localStorage.getItem("wh_wallet_startAt") || 0);
      const endAt = Number(localStorage.getItem("wh_wallet_endAt") || 0);

      setText(timerEl, fmtElapsed(nowMs() - startAt));
      if (endAt > 0 && nowMs() >= endAt) finishWalletPhase();
      return;
    }

    if (phase === PHASE.SEED_RUNNING) {
      const startAt = Number(localStorage.getItem("wh_seed_startAt") || 0);
      const endAt = Number(localStorage.getItem("wh_seed_endAt") || 0);

      setText(timerEl, fmtElapsed(nowMs() - startAt));
      if (seedLine) seedLine.textContent = randomSeed();

      if (endAt > 0 && nowMs() >= endAt) finishSeedPhase();
      return;
    }
  }, 250);
}

// ---------------- RESTORE ----------------
function restore() {
  makeGrid();

  const phase = getPhase();
  resetChecked();

  // дефолт UI
  show(btnStart, false);
  show(btnContinue, false);
  show(btnView, false);
  if (seedBox) seedBox.style.display = "none";

  if (phase === PHASE.NONE) {
    show(btnStart, true);
    setText(timerEl, "0с");
    setText(phaseTextEl, "TON Wallet Scan");
    return;
  }

  if (phase === PHASE.WALLET_RUNNING) {
    show(btnStart, false);
    setText(phaseTextEl, "TON Wallet Scan");
    startGridAnim();
    ensureTicker();
    return;
  }

  if (phase === PHASE.WALLET_DONE) {
    restoreFinalAddress();
    show(btnContinue, true);
    setText(timerEl, "готово");
    setText(phaseTextEl, "Кошелёк найден (визуально). Продолжить?");
    return;
  }

  if (phase === PHASE.SEED_RUNNING) {
    restoreFinalAddress();
    if (seedBox) seedBox.style.display = "block";
    setText(phaseTextEl, "Seed phrase analysis");
    ensureTicker();
    return;
  }

  if (phase === PHASE.SEED_DONE) {
    restoreFinalAddress();
    if (seedBox) seedBox.style.display = "block";
    if (seedLine) seedLine.textContent = localStorage.getItem("wh_fake_seed") || randomSeed();
    show(btnView, true);
    setText(timerEl, "готово");
    setText(phaseTextEl, "Analysis complete");
    return;
  }
}

// ---------------- BUTTONS ----------------
btnStart && btnStart.addEventListener("click", startWalletPhase);
btnContinue && btnContinue.addEventListener("click", startSeedPhase);
btnView && btnView.addEventListener("click", () => {
  location.href = "result.html";
});

restore();
