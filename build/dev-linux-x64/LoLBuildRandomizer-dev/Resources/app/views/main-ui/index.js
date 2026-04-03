// node_modules/electrobun/dist/api/shared/rpc.ts
var MAX_ID = 10000000000;
var DEFAULT_MAX_REQUEST_TIME = 1000;
function missingTransportMethodError(methods, action) {
  const methodsString = methods.map((m) => `"${m}"`).join(", ");
  return new Error(`This RPC instance cannot ${action} because the transport did not provide one or more of these methods: ${methodsString}`);
}
function createRPC(options = {}) {
  let debugHooks = {};
  let transport = {};
  let requestHandler = undefined;
  function setTransport(newTransport) {
    if (transport.unregisterHandler)
      transport.unregisterHandler();
    transport = newTransport;
    transport.registerHandler?.(handler);
  }
  function setRequestHandler(h) {
    if (typeof h === "function") {
      requestHandler = h;
      return;
    }
    requestHandler = (method, params) => {
      const handlerFn = h[method];
      if (handlerFn)
        return handlerFn(params);
      const fallbackHandler = h._;
      if (!fallbackHandler)
        throw new Error(`The requested method has no handler: ${String(method)}`);
      return fallbackHandler(method, params);
    };
  }
  const { maxRequestTime = DEFAULT_MAX_REQUEST_TIME } = options;
  if (options.transport)
    setTransport(options.transport);
  if (options.requestHandler)
    setRequestHandler(options.requestHandler);
  if (options._debugHooks)
    debugHooks = options._debugHooks;
  let lastRequestId = 0;
  function getRequestId() {
    if (lastRequestId <= MAX_ID)
      return ++lastRequestId;
    return lastRequestId = 0;
  }
  const requestListeners = new Map;
  const requestTimeouts = new Map;
  function requestFn(method, ...args) {
    const params = args[0];
    return new Promise((resolve, reject) => {
      if (!transport.send)
        throw missingTransportMethodError(["send"], "make requests");
      const requestId = getRequestId();
      const request2 = {
        type: "request",
        id: requestId,
        method,
        params
      };
      requestListeners.set(requestId, { resolve, reject });
      if (maxRequestTime !== Infinity)
        requestTimeouts.set(requestId, setTimeout(() => {
          requestTimeouts.delete(requestId);
          requestListeners.delete(requestId);
          reject(new Error("RPC request timed out."));
        }, maxRequestTime));
      debugHooks.onSend?.(request2);
      transport.send(request2);
    });
  }
  const request = new Proxy(requestFn, {
    get: (target, prop, receiver) => {
      if (prop in target)
        return Reflect.get(target, prop, receiver);
      return (params) => requestFn(prop, params);
    }
  });
  const requestProxy = request;
  function sendFn(message, ...args) {
    const payload = args[0];
    if (!transport.send)
      throw missingTransportMethodError(["send"], "send messages");
    const rpcMessage = {
      type: "message",
      id: message,
      payload
    };
    debugHooks.onSend?.(rpcMessage);
    transport.send(rpcMessage);
  }
  const send = new Proxy(sendFn, {
    get: (target, prop, receiver) => {
      if (prop in target)
        return Reflect.get(target, prop, receiver);
      return (payload) => sendFn(prop, payload);
    }
  });
  const sendProxy = send;
  const messageListeners = new Map;
  const wildcardMessageListeners = new Set;
  function addMessageListener(message, listener) {
    if (!transport.registerHandler)
      throw missingTransportMethodError(["registerHandler"], "register message listeners");
    if (message === "*") {
      wildcardMessageListeners.add(listener);
      return;
    }
    if (!messageListeners.has(message))
      messageListeners.set(message, new Set);
    messageListeners.get(message).add(listener);
  }
  function removeMessageListener(message, listener) {
    if (message === "*") {
      wildcardMessageListeners.delete(listener);
      return;
    }
    messageListeners.get(message)?.delete(listener);
    if (messageListeners.get(message)?.size === 0)
      messageListeners.delete(message);
  }
  async function handler(message) {
    debugHooks.onReceive?.(message);
    if (!("type" in message))
      throw new Error("Message does not contain a type.");
    if (message.type === "request") {
      if (!transport.send || !requestHandler)
        throw missingTransportMethodError(["send", "requestHandler"], "handle requests");
      const { id, method, params } = message;
      let response;
      try {
        response = {
          type: "response",
          id,
          success: true,
          payload: await requestHandler(method, params)
        };
      } catch (error) {
        if (!(error instanceof Error))
          throw error;
        response = {
          type: "response",
          id,
          success: false,
          error: error.message
        };
      }
      debugHooks.onSend?.(response);
      transport.send(response);
      return;
    }
    if (message.type === "response") {
      const timeout = requestTimeouts.get(message.id);
      if (timeout != null)
        clearTimeout(timeout);
      requestTimeouts.delete(message.id);
      const { resolve, reject } = requestListeners.get(message.id) ?? {};
      requestListeners.delete(message.id);
      if (!message.success)
        reject?.(new Error(message.error));
      else
        resolve?.(message.payload);
      return;
    }
    if (message.type === "message") {
      for (const listener of wildcardMessageListeners)
        listener(message.id, message.payload);
      const listeners = messageListeners.get(message.id);
      if (!listeners)
        return;
      for (const listener of listeners)
        listener(message.payload);
      return;
    }
    throw new Error(`Unexpected RPC message type: ${message.type}`);
  }
  const proxy = { send: sendProxy, request: requestProxy };
  return {
    setTransport,
    setRequestHandler,
    request,
    requestProxy,
    send,
    sendProxy,
    addMessageListener,
    removeMessageListener,
    proxy
  };
}
function defineElectrobunRPC(_side, config) {
  const rpcOptions = {
    maxRequestTime: config.maxRequestTime,
    requestHandler: {
      ...config.handlers.requests,
      ...config.extraRequestHandlers
    },
    transport: {
      registerHandler: () => {}
    }
  };
  const rpc = createRPC(rpcOptions);
  const messageHandlers = config.handlers.messages;
  if (messageHandlers) {
    rpc.addMessageListener("*", (messageName, payload) => {
      const globalHandler = messageHandlers["*"];
      if (globalHandler) {
        globalHandler(messageName, payload);
      }
      const messageHandler = messageHandlers[messageName];
      if (messageHandler) {
        messageHandler(payload);
      }
    });
  }
  return rpc;
}

// node_modules/electrobun/dist/api/browser/index.ts
var WEBVIEW_ID = window.__electrobunWebviewId;
var RPC_SOCKET_PORT = window.__electrobunRpcSocketPort;

class Electroview {
  bunSocket;
  rpc;
  rpcHandler;
  constructor(config) {
    this.rpc = config.rpc;
    this.init();
  }
  init() {
    this.initSocketToBun();
    window.__electrobun.receiveMessageFromBun = this.receiveMessageFromBun.bind(this);
    if (this.rpc) {
      this.rpc.setTransport(this.createTransport());
    }
  }
  initSocketToBun() {
    const socket = new WebSocket(`ws://localhost:${RPC_SOCKET_PORT}/socket?webviewId=${WEBVIEW_ID}`);
    this.bunSocket = socket;
    socket.addEventListener("open", () => {});
    socket.addEventListener("message", async (event) => {
      const message = event.data;
      if (typeof message === "string") {
        try {
          const encryptedPacket = JSON.parse(message);
          const decrypted = await window.__electrobun_decrypt(encryptedPacket.encryptedData, encryptedPacket.iv, encryptedPacket.tag);
          this.rpcHandler?.(JSON.parse(decrypted));
        } catch (err) {
          console.error("Error parsing bun message:", err);
        }
      } else if (message instanceof Blob) {} else {
        console.error("UNKNOWN DATA TYPE RECEIVED:", event.data);
      }
    });
    socket.addEventListener("error", (event) => {
      console.error("Socket error:", event);
    });
    socket.addEventListener("close", (_event) => {});
  }
  createTransport() {
    const that = this;
    return {
      send(message) {
        try {
          const messageString = JSON.stringify(message);
          that.bunBridge(messageString);
        } catch (error) {
          console.error("bun: failed to serialize message to webview", error);
        }
      },
      registerHandler(handler) {
        that.rpcHandler = handler;
      }
    };
  }
  async bunBridge(msg) {
    if (this.bunSocket?.readyState === WebSocket.OPEN) {
      try {
        const { encryptedData, iv, tag } = await window.__electrobun_encrypt(msg);
        const encryptedPacket = {
          encryptedData,
          iv,
          tag
        };
        const encryptedPacketString = JSON.stringify(encryptedPacket);
        this.bunSocket.send(encryptedPacketString);
        return;
      } catch (error) {
        console.error("Error sending message to bun via socket:", error);
      }
    }
    window.__electrobunBunBridge?.postMessage(msg);
  }
  receiveMessageFromBun(msg) {
    if (this.rpcHandler) {
      this.rpcHandler(msg);
    }
  }
  static defineRPC(config) {
    return defineElectrobunRPC("webview", {
      ...config,
      extraRequestHandlers: {
        evaluateJavascriptWithResponse: ({ script }) => {
          return new Promise((resolve) => {
            try {
              const resultFunction = new Function(script);
              const result = resultFunction();
              if (result instanceof Promise) {
                result.then((resolvedResult) => {
                  resolve(resolvedResult);
                }).catch((error) => {
                  console.error("bun: async script execution failed", error);
                  resolve(String(error));
                });
              } else {
                resolve(result);
              }
            } catch (error) {
              console.error("bun: failed to eval script", error);
              resolve(String(error));
            }
          });
        }
      }
    });
  }
}

// src/main-ui/index.ts
var electrobun = new Electroview({
  rpc: {
    handlers: {
      requests: {},
      messages: {
        showNotification: ({ type, message }) => {
          showToast(type, message);
        },
        lcuStatusUpdate: (status) => {
          updateLCUStatus(status.connected);
        }
      }
    }
  }
});
var currentBuild = null;
var currentRole = "any";
var ultimateBravery = false;
var lockedChampionId = null;
var isLoading = false;
var dataVersion = "";
var $ = (sel) => document.querySelector(sel);
var $$ = (sel) => document.querySelectorAll(sel);
document.addEventListener("DOMContentLoaded", () => {
  setupEventListeners();
  loadInitialData();
  checkLCU();
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
function setupEventListeners() {
  $$(".role-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      $$(".role-btn").forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      currentRole = btn.dataset.role || "any";
    });
  });
  const ubToggle = $("#ubToggle");
  if (ubToggle) {
    ubToggle.addEventListener("click", () => {
      ultimateBravery = !ultimateBravery;
      ubToggle.classList.toggle("active", ultimateBravery);
      ubToggle.classList.toggle("ub-active", ultimateBravery);
      const app = $("#app");
      if (app)
        app.classList.toggle("ub-active", ultimateBravery);
    });
  }
  const randomizeBtn = $("#randomizeBtn");
  if (randomizeBtn) {
    randomizeBtn.addEventListener("click", handleRandomize);
  }
  const lockBtn = $("#lockChampionBtn");
  if (lockBtn) {
    lockBtn.addEventListener("click", handleLockChampion);
  }
  const importRunesBtn = $("#importRunesBtn");
  if (importRunesBtn) {
    importRunesBtn.addEventListener("click", handleImportRunes);
  }
  const importItemsBtn = $("#importItemsBtn");
  if (importItemsBtn) {
    importItemsBtn.addEventListener("click", handleImportItems);
  }
}
async function handleRandomize() {
  if (isLoading)
    return;
  const btn = $("#randomizeBtn");
  setLoading(true);
  btn.classList.add("rolling");
  try {
    const build = await electrobun.rpc.request.generateBuild({
      role: currentRole,
      ultimateBravery,
      lockedChampionId
    });
    currentBuild = build;
    renderBuild(build);
    const importRunesBtn = $("#importRunesBtn");
    const importItemsBtn = $("#importItemsBtn");
    if (importRunesBtn)
      importRunesBtn.disabled = false;
    if (importItemsBtn)
      importItemsBtn.disabled = false;
  } catch (e) {
    showToast("error", `Failed to generate build: ${e.message}`);
  } finally {
    setLoading(false);
    setTimeout(() => btn.classList.remove("rolling"), 500);
  }
}
function handleLockChampion() {
  if (!currentBuild)
    return;
  if (lockedChampionId) {
    lockedChampionId = null;
    const lockBtn = $("#lockChampionBtn");
    if (lockBtn) {
      lockBtn.innerHTML = "\uD83D\uDD13 Lock Champion";
      lockBtn.classList.remove("locked");
    }
    showToast("info", "Champion unlocked");
  } else {
    lockedChampionId = currentBuild.champion.id;
    const lockBtn = $("#lockChampionBtn");
    if (lockBtn) {
      lockBtn.innerHTML = `\uD83D\uDD12 ${currentBuild.champion.name} Locked`;
      lockBtn.classList.add("locked");
    }
    showToast("info", `${currentBuild.champion.name} locked!`);
  }
}
async function handleImportRunes() {
  if (!currentBuild)
    return;
  try {
    const result = await electrobun.rpc.request.importRunes({
      runes: currentBuild.runes,
      championName: currentBuild.champion.name
    });
    showToast(result.success ? "success" : "error", result.message);
  } catch (e) {
    showToast("error", `Failed to import runes: ${e.message}`);
  }
}
async function handleImportItems() {
  if (!currentBuild)
    return;
  try {
    const result = await electrobun.rpc.request.importItemSet({
      build: currentBuild,
      lolPath: null
    });
    showToast(result.success ? "success" : "error", result.message);
  } catch (e) {
    showToast("error", `Failed to import items: ${e.message}`);
  }
}
function renderBuild(build) {
  const emptyState = $("#emptyState");
  const championContent = $("#championContent");
  const buildEmptyState = $("#buildEmptyState");
  const buildContent = $("#buildContent");
  if (emptyState)
    emptyState.style.display = "none";
  if (championContent)
    championContent.style.display = "block";
  if (buildEmptyState)
    buildEmptyState.style.display = "none";
  if (buildContent)
    buildContent.style.display = "block";
  renderChampion(build);
  renderSummonerSpells(build);
  renderRunes(build);
  renderItems(build);
  const ubIndicator = $("#ubIndicator");
  if (ubIndicator) {
    ubIndicator.style.display = build.isUltimateBravery ? "block" : "none";
  }
}
function renderChampion(build) {
  const splash = $("#championSplash");
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
  if (name)
    name.textContent = build.champion.name;
  if (title)
    title.textContent = build.champion.title;
  if (tags) {
    tags.innerHTML = build.champion.tags.map((t) => `<span class="champion-tag">${t}</span>`).join("");
  }
  if (lockedChampionId === build.champion.id) {
    const lockBtn = $("#lockChampionBtn");
    if (lockBtn) {
      lockBtn.innerHTML = `\uD83D\uDD12 ${build.champion.name} Locked`;
      lockBtn.classList.add("locked");
    }
  } else if (!lockedChampionId) {
    const lockBtn = $("#lockChampionBtn");
    if (lockBtn) {
      lockBtn.innerHTML = "\uD83D\uDD13 Lock Champion";
      lockBtn.classList.remove("locked");
    }
  }
}
function renderSummonerSpells(build) {
  const container = $("#summonerSpells");
  if (!container)
    return;
  container.innerHTML = build.summonerSpells.map((spell) => {
    const iconUrl = `https://ddragon.leagueoflegends.com/cdn/${dataVersion}/img/spell/${spell.image.full}`;
    return `
        <div data-tooltip="${spell.name}">
          <div class="spell-icon">
            <img src="${iconUrl}" alt="${spell.name}">
          </div>
          <div class="spell-name">${spell.name}</div>
        </div>
      `;
  }).join("");
}
function renderRunes(build) {
  const container = $("#runesSection");
  if (!container)
    return;
  const runes = build.runes;
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
      ${runes.primarySelections.map((r) => `
        <div class="rune-row">
          <div class="rune-icon" data-tooltip="${r.name}">
            <img src="https://ddragon.leagueoflegends.com/cdn/img/${r.icon}" alt="${r.name}">
          </div>
          <span class="rune-name">${r.name}</span>
        </div>
      `).join("")}
    </div>
  `;
  const secondaryHTML = `
    <div class="rune-tree-card secondary">
      <div class="rune-tree-header">
        <img class="rune-tree-icon" src="https://ddragon.leagueoflegends.com/cdn/img/${runes.subTree.icon}" alt="${runes.subTree.name}">
        <span class="rune-tree-name">${runes.subTree.name}</span>
        <span class="rune-tree-label">Secondary</span>
      </div>
      ${runes.subSelections.map((r) => `
        <div class="rune-row">
          <div class="rune-icon" data-tooltip="${r.name}">
            <img src="https://ddragon.leagueoflegends.com/cdn/img/${r.icon}" alt="${r.name}">
          </div>
          <span class="rune-name">${r.name}</span>
        </div>
      `).join("")}
      <div class="stat-shards">
        ${runes.statShards.map((s) => `<div class="stat-shard" data-tooltip="Stat Shard ${s}">✦</div>`).join("")}
      </div>
    </div>
  `;
  container.innerHTML = primaryHTML + secondaryHTML;
}
function renderItems(build) {
  const container = $("#itemsGrid");
  if (!container)
    return;
  container.innerHTML = build.items.map((item) => {
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
  }).join("");
}
function setLoading(loading) {
  isLoading = loading;
  const overlay = $("#loadingOverlay");
  if (overlay) {
    overlay.classList.toggle("hidden", !loading);
  }
}
function updateLCUStatus(connected, _phase) {
  const dot = $("#lcuDot");
  const text = $("#lcuStatusText");
  if (dot) {
    dot.classList.toggle("connected", connected);
  }
  if (text) {
    text.textContent = connected ? "Client Connected" : "Disconnected";
  }
}
function showToast(type, message) {
  const container = $("#toastContainer");
  if (!container)
    return;
  const icons = {
    success: "✅",
    error: "❌",
    info: "ℹ️"
  };
  const toast = document.createElement("div");
  toast.className = `toast ${type}`;
  toast.innerHTML = `
    <span class="toast-icon">${icons[type]}</span>
    <span class="toast-message">${message}</span>
    <button class="toast-close" onclick="this.parentElement.remove()">×</button>
  `;
  container.appendChild(toast);
  setTimeout(() => {
    toast.style.animation = "toast-out 0.3s ease forwards";
    setTimeout(() => toast.remove(), 300);
  }, 4000);
}
