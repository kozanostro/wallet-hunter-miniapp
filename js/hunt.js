// hunt.js — WalletHunter (TON)
// Визуализация процесса. Реальных кошельков не используется.
console.log("HUNT.JS VERSION 999 LOADED");
alert("HUNT.JS VERSION 999 LOADED");

const TON_ADDR_LEN = 48;
const SEED_WORDS_COUNT = 24;

// скорости (кошельков в секунду) — визуал
const SPEED_BASE = 40;      // x1
const SPEED_MULT = 5;       // каждый уровень даёт +x

const PHASE = {
  NONE: "none",
  WALLET: "wallet",
  SEED: "seed",
  DONE: "done",
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

let startAt = 0;
let checkedWallets = 0;
let speedX = 1;

let animInterval = null;
let tickInterval = null;

// ---------------- UTIL ----------------
function now() {
  return Date.now();
}

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

// ---------------- GRID ----------------
function makeGrid() {
  gridEl.innerHTML = "";
  for (let i = 0; i < TON_ADDR_LEN; i++) {
    const d = document.createElement("div");
    d.className = "cell";
    d.textContent = randomChar();
    gridEl.appendChild(d);
  }
}

function animateGrid() {
  stopAnim();
  animInterval = setInterval(() => {
    for (const c of gridEl.children) {
      c.textContent = randomChar();
    }
  }, 60);
}

function stopAnim() {
  if (animInterval) clearInterval(animInterval);
  animInterval = null;
}

// ---------------- SEED ----------------
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

// ---------------- CORE ----------------
function startWalletScan() {
  startAt = now();
  checkedWallets = 0;

  localStorage.setItem("wh_phase", PHASE.WALLET);
  localStorage.setItem("wh_startAt", startAt);

  btnStart.style.display = "none";
  btnContinue.style.display = "none";
  btnView.style.display = "none";
  seedBox.style.display = "none";

  phaseTextEl.textContent = "TON Wallet Scan";
  animateGrid();
  startTicker();
}

function startSeedScan() {
  localStorage.setItem("wh_phase", PHASE.SEED);

  btnContinue.style.display = "none";
  seedBox.style.display = "block";

  phaseTextEl.textContent = "Seed phrase analysis";
  seedLine.textContent = randomSeed();
}

function finishAll() {
  stopAnim();
  localStorage.setItem("wh_phase", PHASE.DONE);

  btnView.style.display = "inline-block";
  phaseTextEl.textContent = "Analysis complete";
}

// ---------------- TICKER ----------------
function startTicker() {
  if (tickInterval) return;

  tickInterval = setInterval(() => {
    const elapsed = now() - startAt;
    timerEl.textContent = fmtTime(elapsed);

    const delta = (SPEED_BASE * speedX) / 4;
    checkedWallets += Math.floor(delta);

    statsEl.textContent =
      `Checked wallets: ${checkedWallets.toLocaleString()}`;

    const phase = localStorage.getItem("wh_phase");

    if (phase === PHASE.SEED) {
      seedLine.textContent = randomSeed();
    }
  }, 250);
}

// ---------------- RESTORE ----------------
function restore() {
  makeGrid();

  speedX = Number(localStorage.getItem("wh_speed_x") || "1");

  const phase = localStorage.getItem("wh_phase") || PHASE.NONE;
  startAt = Number(localStorage.getItem("wh_startAt") || now());

  if (phase === PHASE.NONE) {
    btnStart.style.display = "inline-block";
    timerEl.textContent = "0с";
    statsEl.textContent = "";
    phaseTextEl.textContent = "TON Wallet Scan";
    return;
  }

  animateGrid();
  startTicker();

  if (phase === PHASE.SEED) {
    seedBox.style.display = "block";
    seedLine.textContent = randomSeed();
  }

  if (phase === PHASE.DONE) {
    finishAll();
  }
}

// ---------------- BUTTONS ----------------
btnStart.addEventListener("click", startWalletScan);
btnContinue.addEventListener("click", startSeedScan);
btnView.addEventListener("click", () => {
  location.href = "result.html";
});

restore();
