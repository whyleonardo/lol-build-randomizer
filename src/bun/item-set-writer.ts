import type { RandomBuild } from "../shared/types";
import * as path from "path";
import * as fs from "fs";

// ============================================
// Item Set JSON Writer
// ============================================

/**
 * Default LoL installation paths on Windows
 */
const DEFAULT_LOL_PATHS = [
  "C:/Riot Games/League of Legends",
  "D:/Riot Games/League of Legends",
  "C:/Program Files/Riot Games/League of Legends",
  "C:/Program Files (x86)/Riot Games/League of Legends",
  "D:/Games/Riot Games/League of Legends",
];

/**
 * Try to find the League of Legends installation directory.
 */
async function findLoLPath(): Promise<string | null> {
  for (const lolPath of DEFAULT_LOL_PATHS) {
    try {
      const configPath = path.join(lolPath, "Config");
      if (fs.existsSync(configPath)) {
        return lolPath;
      }
    } catch {
      // Path doesn't exist, try next
    }
  }
  return null;
}

/**
 * Generate the item set JSON structure.
 */
function generateItemSetJSON(build: RandomBuild): object {
  const startingItems = build.items.slice(0, 2).map((item) => ({
    id: item.id,
    count: 1,
  }));

  const coreItems = build.items.slice(2, 5).map((item) => ({
    id: item.id,
    count: 1,
  }));

  const situationalItems = build.items.slice(5).map((item) => ({
    id: item.id,
    count: 1,
  }));

  const title = build.isUltimateBravery
    ? `🤪 Ultimate Bravery - ${build.champion.name}`
    : `🎲 Random Build - ${build.champion.name}`;

  return {
    title,
    type: "custom",
    map: "any",
    mode: "any",
    priority: false,
    sortrank: 0,
    blocks: [
      {
        type: "🎯 Starting Items",
        hideIfSummonerSpell: "",
        showIfSummonerSpell: "",
        items: startingItems,
      },
      {
        type: "⚔️ Core Build",
        hideIfSummonerSpell: "",
        showIfSummonerSpell: "",
        items: coreItems,
      },
      {
        type: "🛡️ Complete Build",
        hideIfSummonerSpell: "",
        showIfSummonerSpell: "",
        items: situationalItems,
      },
      {
        type: "📋 Full Build Order",
        hideIfSummonerSpell: "",
        showIfSummonerSpell: "",
        items: build.items.map((item) => ({
          id: item.id,
          count: 1,
        })),
      },
    ],
  };
}

/**
 * Write the item set JSON file to the LoL config directory.
 */
export async function writeItemSet(
  build: RandomBuild,
  customLolPath: string | null
): Promise<{ success: boolean; message: string }> {
  try {
    const lolPath = customLolPath || (await findLoLPath());

    if (!lolPath) {
      return {
        success: false,
        message:
          "Could not find League of Legends installation. Please provide the path manually.",
      };
    }

    const championKey = build.champion.id;
    const configDir = path.join(
      lolPath,
      "Config",
      "Champions",
      championKey,
      "Recommended"
    );

    // Create directory if it doesn't exist
    fs.mkdirSync(configDir, { recursive: true });

    // Write the item set file
    const filePath = path.join(configDir, "random-build.json");
    const itemSetJSON = generateItemSetJSON(build);

    fs.writeFileSync(filePath, JSON.stringify(itemSetJSON, null, 2), "utf-8");

    console.log(`[ItemSet] Written to: ${filePath}`);

    return {
      success: true,
      message: `Item set saved for ${build.champion.name}! Check your in-game shop.`,
    };
  } catch (e: any) {
    return {
      success: false,
      message: e.message || "Failed to write item set file",
    };
  }
}
