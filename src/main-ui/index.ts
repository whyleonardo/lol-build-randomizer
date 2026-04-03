import { Electroview } from "electrobun/view";

// ============================================
// Initialize Electrobun
// ============================================

const electrobun = new Electroview({
  rpc: {
    handlers: {
      requests: {},
      messages: {
        showNotification: ({ type, message }) => {
          showToast(type, message);
        },
        lcuStatusUpdate: (status) => {
          updateLCUStatus(status.connected);
        },
      },
    },
  },
});

// ============================================
// State
// ============================================

let currentBuild: any = null;
let currentRole = "any";
let ultimateBravery = false;
let lockedChampionId: string | null = null;
let isLoading = false;
let dataVersion = "";

// ============================================
// DOM References
// ============================================

const $ = (sel: string) => document.querySelector(sel);
const $$ = (sel: string) => document.querySelectorAll(sel);

// ============================================
// Initialization
// ============================================

document.addEventListener("DOMContentLoaded", () => {
  setupEventListeners();
  loadInitialData();
  checkLCU();
  // Check LCU status periodically
  setInterval(checkLCU, 15000);
});

async function loadInitialData() {
  try {
    const result = await electrobun.rpc.request.getDataVersion({});
    dataVersion = result.version;
    const patchBadge = $("#patchBadge");
    if (patchBadge) {
      patchBadge.textContent = `Patch ${dataVersion} • ${result.championCount} Champions`;
    }
  } catch (e) {
    console.error("Failed to load data:", e);
  }
}

async function checkLCU() {
  try {
    const status = await electrobun.rpc.request.checkLCUConnection({});
    updateLCUStatus(status.connected, status.gamePhase);
  } catch {
    updateLCUStatus(false);
  }
}

// ============================================
// Event Listeners
// ============================================

function setupEventListeners() {
  // Role buttons
  $$(".role-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      $$(".role-btn").forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      currentRole = (btn as HTMLElement).dataset.role || "any";
    });
  });

  // Ultimate Bravery toggle
  const ubToggle = $("#ubToggle");
  if (ubToggle) {
    ubToggle.addEventListener("click", () => {
      ultimateBravery = !ultimateBravery;
      ubToggle.classList.toggle("active", ultimateBravery);
      ubToggle.classList.toggle("ub-active", ultimateBravery);

      const app = $("#app");
      if (app) app.classList.toggle("ub-active", ultimateBravery);
    });
  }

  // Randomize button
  const randomizeBtn = $("#randomizeBtn");
  if (randomizeBtn) {
    randomizeBtn.addEventListener("click", handleRandomize);
  }

  // Lock champion button
  const lockBtn = $("#lockChampionBtn");
  if (lockBtn) {
    lockBtn.addEventListener("click", handleLockChampion);
  }

  // Import buttons
  const importRunesBtn = $("#importRunesBtn");
  if (importRunesBtn) {
    importRunesBtn.addEventListener("click", handleImportRunes);
  }

  const importItemsBtn = $("#importItemsBtn");
  if (importItemsBtn) {
    importItemsBtn.addEventListener("click", handleImportItems);
  }
}

// ============================================
// Handlers
// ============================================

async function handleRandomize() {
  if (isLoading) return;

  const btn = $("#randomizeBtn") as HTMLButtonElement;
  setLoading(true);
  btn.classList.add("rolling");

  try {
    const build = await electrobun.rpc.request.generateBuild({
      role: currentRole as any,
      ultimateBravery,
      lockedChampionId,
    });

    currentBuild = build;
    renderBuild(build);

    // Enable import buttons
    const importRunesBtn = $("#importRunesBtn") as HTMLButtonElement;
    const importItemsBtn = $("#importItemsBtn") as HTMLButtonElement;
    if (importRunesBtn) importRunesBtn.disabled = false;
    if (importItemsBtn) importItemsBtn.disabled = false;
  } catch (e: any) {
    showToast("error", `Failed to generate build: ${e.message}`);
  } finally {
    setLoading(false);
    setTimeout(() => btn.classList.remove("rolling"), 500);
  }
}

function handleLockChampion() {
  if (!currentBuild) return;

  if (lockedChampionId) {
    // Unlock
    lockedChampionId = null;
    const lockBtn = $("#lockChampionBtn");
    if (lockBtn) {
      lockBtn.innerHTML = "🔓 Lock Champion";
      lockBtn.classList.remove("locked");
    }
    showToast("info", "Champion unlocked");
  } else {
    // Lock current champion
    lockedChampionId = currentBuild.champion.id;
    const lockBtn = $("#lockChampionBtn");
    if (lockBtn) {
      lockBtn.innerHTML = `🔒 ${currentBuild.champion.name} Locked`;
      lockBtn.classList.add("locked");
    }
    showToast("info", `${currentBuild.champion.name} locked!`);
  }
}

async function handleImportRunes() {
  if (!currentBuild) return;

  try {
    const result = await electrobun.rpc.request.importRunes({
      runes: currentBuild.runes,
      championName: currentBuild.champion.name,
    });

    showToast(
      result.success ? "success" : "error",
      result.message
    );
  } catch (e: any) {
    showToast("error", `Failed to import runes: ${e.message}`);
  }
}

async function handleImportItems() {
  if (!currentBuild) return;

  try {
    const result = await electrobun.rpc.request.importItemSet({
      build: currentBuild,
      lolPath: null,
    });

    showToast(
      result.success ? "success" : "error",
      result.message
    );
  } catch (e: any) {
    showToast("error", `Failed to import items: ${e.message}`);
  }
}

// ============================================
// Rendering
// ============================================

function renderBuild(build: any) {
  // Show build content, hide empty states
  const emptyState = $("#emptyState") as HTMLElement;
  const championContent = $("#championContent") as HTMLElement;
  const buildEmptyState = $("#buildEmptyState") as HTMLElement;
  const buildContent = $("#buildContent") as HTMLElement;

  if (emptyState) emptyState.style.display = "none";
  if (championContent) championContent.style.display = "block";
  if (buildEmptyState) buildEmptyState.style.display = "none";
  if (buildContent) buildContent.style.display = "block";

  renderChampion(build);
  renderSummonerSpells(build);
  renderRunes(build);
  renderItems(build);

  // Update UB indicator
  const ubIndicator = $("#ubIndicator") as HTMLElement;
  if (ubIndicator) {
    ubIndicator.style.display = build.isUltimateBravery ? "block" : "none";
  }
}

function renderChampion(build: any) {
  const splash = $("#championSplash") as HTMLImageElement;
  const name = $("#championName");
  const title = $("#championTitle");
  const tags = $("#championTags");

  if (splash) {
    splash.classList.add("transitioning");
    splash.src = `https://ddragon.leagueoflegends.com/cdn/img/champion/splash/${build.champion.id}_0.jpg`;
    splash.onload = () => {
      setTimeout(() => splash.classList.remove("transitioning"), 500);
    };
  }

  if (name) name.textContent = build.champion.name;
  if (title) title.textContent = build.champion.title;

  if (tags) {
    tags.innerHTML = build.champion.tags
      .map((t: string) => `<span class="champion-tag">${t}</span>`)
      .join("");
  }

  // Update lock button state
  if (lockedChampionId === build.champion.id) {
    const lockBtn = $("#lockChampionBtn");
    if (lockBtn) {
      lockBtn.innerHTML = `🔒 ${build.champion.name} Locked`;
      lockBtn.classList.add("locked");
    }
  } else if (!lockedChampionId) {
    const lockBtn = $("#lockChampionBtn");
    if (lockBtn) {
      lockBtn.innerHTML = "🔓 Lock Champion";
      lockBtn.classList.remove("locked");
    }
  }
}

function renderSummonerSpells(build: any) {
  const container = $("#summonerSpells");
  if (!container) return;

  container.innerHTML = build.summonerSpells
    .map((spell: any) => {
      const iconUrl = `https://ddragon.leagueoflegends.com/cdn/${dataVersion}/img/spell/${spell.image.full}`;
      return `
        <div data-tooltip="${spell.name}">
          <div class="spell-icon">
            <img src="${iconUrl}" alt="${spell.name}">
          </div>
          <div class="spell-name">${spell.name}</div>
        </div>
      `;
    })
    .join("");
}

function renderRunes(build: any) {
  const container = $("#runesSection");
  if (!container) return;

  const runes = build.runes;

  // Primary tree card
  const primaryHTML = `
    <div class="rune-tree-card primary">
      <div class="rune-tree-header">
        <img class="rune-tree-icon" src="https://ddragon.leagueoflegends.com/cdn/img/${runes.primaryTree.icon}" alt="${runes.primaryTree.name}">
        <span class="rune-tree-name">${runes.primaryTree.name}</span>
        <span class="rune-tree-label">Primary</span>
      </div>
      <div class="rune-row">
        <div class="rune-icon keystone" data-tooltip="${runes.keystone.name}">
          <img src="https://ddragon.leagueoflegends.com/cdn/img/${runes.keystone.icon}" alt="${runes.keystone.name}">
        </div>
        <span class="rune-name keystone-name">${runes.keystone.name}</span>
      </div>
      ${runes.primarySelections
        .map(
          (r: any) => `
        <div class="rune-row">
          <div class="rune-icon" data-tooltip="${r.name}">
            <img src="https://ddragon.leagueoflegends.com/cdn/img/${r.icon}" alt="${r.name}">
          </div>
          <span class="rune-name">${r.name}</span>
        </div>
      `
        )
        .join("")}
    </div>
  `;

  // Secondary tree card
  const secondaryHTML = `
    <div class="rune-tree-card secondary">
      <div class="rune-tree-header">
        <img class="rune-tree-icon" src="https://ddragon.leagueoflegends.com/cdn/img/${runes.subTree.icon}" alt="${runes.subTree.name}">
        <span class="rune-tree-name">${runes.subTree.name}</span>
        <span class="rune-tree-label">Secondary</span>
      </div>
      ${runes.subSelections
        .map(
          (r: any) => `
        <div class="rune-row">
          <div class="rune-icon" data-tooltip="${r.name}">
            <img src="https://ddragon.leagueoflegends.com/cdn/img/${r.icon}" alt="${r.name}">
          </div>
          <span class="rune-name">${r.name}</span>
        </div>
      `
        )
        .join("")}
      <div class="stat-shards">
        ${runes.statShards.map((s: number) => `<div class="stat-shard" data-tooltip="Stat Shard ${s}">✦</div>`).join("")}
      </div>
    </div>
  `;

  container.innerHTML = primaryHTML + secondaryHTML;
}

function renderItems(build: any) {
  const container = $("#itemsGrid");
  if (!container) return;

  container.innerHTML = build.items
    .map((item: any) => {
      const iconUrl = `https://ddragon.leagueoflegends.com/cdn/${dataVersion}/img/item/${item.image.full}`;
      return `
        <div class="item-slot" data-tooltip="${item.name}">
          <div class="item-icon">
            <img src="${iconUrl}" alt="${item.name}">
          </div>
          <div class="item-name">${item.name}</div>
          <div class="item-cost">${item.gold.total}g</div>
        </div>
      `;
    })
    .join("");
}

// ============================================
// UI Helpers
// ============================================

function setLoading(loading: boolean) {
  isLoading = loading;
  const overlay = $("#loadingOverlay");
  if (overlay) {
    overlay.classList.toggle("hidden", !loading);
  }
}

function updateLCUStatus(connected: boolean, _phase?: string) {
  const dot = $("#lcuDot");
  const text = $("#lcuStatusText");

  if (dot) {
    dot.classList.toggle("connected", connected);
  }

  if (text) {
    text.textContent = connected ? "Client Connected" : "Disconnected";
  }
}

function showToast(type: "success" | "error" | "info", message: string) {
  const container = $("#toastContainer");
  if (!container) return;

  const icons: Record<string, string> = {
    success: "✅",
    error: "❌",
    info: "ℹ️",
  };

  const toast = document.createElement("div");
  toast.className = `toast ${type}`;
  toast.innerHTML = `
    <span class="toast-icon">${icons[type]}</span>
    <span class="toast-message">${message}</span>
    <button class="toast-close" onclick="this.parentElement.remove()">×</button>
  `;

  container.appendChild(toast);

  // Auto remove after 4 seconds
  setTimeout(() => {
    toast.style.animation = "toast-out 0.3s ease forwards";
    setTimeout(() => toast.remove(), 300);
  }, 4000);
}
