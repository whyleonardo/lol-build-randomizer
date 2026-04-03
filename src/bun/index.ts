import { BrowserWindow, BrowserView, ApplicationMenu } from "electrobun/bun";
import type { AppRPCType } from "../shared/types";
import { generateRandomBuild } from "./build-generator";
import { getLatestVersion, getChampions } from "./data-dragon";
import { checkConnection, importRunes } from "./lcu-client";
import { writeItemSet } from "./item-set-writer";

// ============================================
// Application Menu
// ============================================

ApplicationMenu.setApplicationMenu([
  {
    submenu: [{ label: "Quit", role: "quit" }],
  },
  {
    label: "Edit",
    submenu: [
      { role: "undo" },
      { role: "redo" },
      { type: "separator" },
      { role: "cut" },
      { role: "copy" },
      { role: "paste" },
      { role: "selectAll" },
    ],
  },
  {
    label: "View",
    submenu: [
      { label: "Reload", role: "reload" },
      { label: "Toggle DevTools", role: "toggleDevTools" },
    ],
  },
]);

// ============================================
// RPC Handlers
// ============================================

const mainRPC = BrowserView.defineRPC<AppRPCType>({
  maxRequestTime: 30000, // 30s for API calls
  handlers: {
    requests: {
      generateBuild: async ({ role, ultimateBravery, lockedChampionId }) => {
        console.log(
          `[RPC] generateBuild - role: ${role}, UB: ${ultimateBravery}, locked: ${lockedChampionId}`
        );
        const build = await generateRandomBuild(
          role,
          ultimateBravery,
          lockedChampionId
        );
        return build;
      },

      importRunes: async ({ runes, championName }) => {
        console.log(`[RPC] importRunes for ${championName}`);
        return await importRunes(runes, championName);
      },

      autoLockChampion: async ({ championKey, championName, runes }) => {
        console.log(`[RPC] autoLockChampion for ${championName}`);
        // Requires importing autoLockAndRune from lcu-client
        const { autoLockAndRune } = await import("./lcu-client");
        return await autoLockAndRune(championKey, championName, runes);
      },

      importItemSet: async ({ build, lolPath }) => {
        console.log(`[RPC] importItemSet for ${build.champion.name}`);
        return await writeItemSet(build, lolPath);
      },

      checkLCUConnection: async () => {
        console.log(`[RPC] checkLCUConnection`);
        return await checkConnection();
      },

      getDataVersion: async () => {
        const version = await getLatestVersion();
        const champions = await getChampions();
        return { version, championCount: champions.size };
      },
      minimizeWindow: () => {
        win.minimize();
        return {};
      },
      closeWindow: () => {
        win.close();
        return {};
      },
    },
    messages: {},
  },
});

// ============================================
// Create Main Window
// ============================================

const win = new BrowserWindow({
  title: "LoL Build Randomizer",
  url: "views://main-ui/index.html",
  frame: {
    width: 1200,
    height: 850,
    x: 200,
    y: 100,
  },
  titleBarStyle: "hidden",
  transparent: true,
  rpc: mainRPC,
});

console.log("[App] LoL Build Randomizer started! 🎮");

// Pre-fetch data in background
getLatestVersion().then((v) => console.log(`[App] Patch ${v} loaded`));
