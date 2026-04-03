import type {
  Champion,
  Item,
  RandomBuild,
  RoleFilter,
  RuneData,
  RuneTree,
  SelectedRunes,
  SummonerSpell,
} from "../shared/types";
import { STAT_SHARDS } from "../shared/types";
import {
  getChampions,
  getItems,
  getRunes,
  getSummonerSpells,
} from "./data-dragon";

// ============================================
// Role → Champion Tag Mapping
// ============================================

const ROLE_TAG_MAP: Record<RoleFilter, string[]> = {
  any: [],
  top: ["Fighter", "Tank"],
  jungle: ["Fighter", "Assassin", "Tank"],
  mid: ["Mage", "Assassin"],
  adc: ["Marksman"],
  support: ["Support", "Tank", "Mage"],
};

// ============================================
// Item filtering helpers
// ============================================

// Items that should never be randomly selected
const EXCLUDED_ITEM_PATTERNS = [
  "Enchantment",
  "Ornn",
  "Quick Charge",
  "Scarecrow Effigy",
  "Minion Dematerializer",
  "Commencing Stopwatch",
  "Broken Stopwatch",
  "Perfectly Timed",
];

function isValidItem(item: Item, _ultimateBravery: boolean): boolean {
  // Must be purchasable
  if (!item.gold.purchasable) return false;

  // Must be available on Summoner's Rift (map 11)
  if (item.maps && !item.maps["11"]) return false;

  // Must be a completed item (has no "into" upgrades, or is a boot)
  const isCompletedItem =
    !item.into || item.into.length === 0 || item.tags.includes("Boots");

  if (!isCompletedItem) return false;

  // Cost filter - items should cost something meaningful
  if (item.gold.total < 300) return false;

  // Exclude certain items by name pattern
  for (const pattern of EXCLUDED_ITEM_PATTERNS) {
    if (item.name.includes(pattern)) return false;
  }

  return true;
}

function getBootItems(allItems: Map<string, Item>): Item[] {
  const boots: Item[] = [];
  for (const [, item] of allItems) {
    if (
      item.tags.includes("Boots") &&
      item.gold.purchasable &&
      item.gold.total > 300 &&
      item.maps?.["11"] &&
      (!item.into || item.into.length === 0)
    ) {
      boots.push(item);
    }
  }
  return boots;
}

// ============================================
// Randomization Helpers
// ============================================

function randomElement<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randomElements<T>(arr: T[], count: number): T[] {
  const shuffled = [...arr].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count);
}

// ============================================
// Build Generator
// ============================================

export async function generateRandomBuild(
  role: RoleFilter,
  ultimateBravery: boolean,
  lockedChampionId: string | null
): Promise<RandomBuild> {
  const [championsMap, itemsMap, runeTrees, spellsMap] = await Promise.all([
    getChampions(),
    getItems(),
    getRunes(),
    getSummonerSpells(),
  ]);

  // 1. Pick champion
  const champion = pickChampion(championsMap, role, lockedChampionId);

  // 2. Pick items
  const items = pickItems(itemsMap, champion, ultimateBravery);

  // 3. Pick runes
  const runes = pickRunes(runeTrees, champion, ultimateBravery);

  // 4. Pick summoner spells
  const summonerSpells = pickSummonerSpells(spellsMap, role, ultimateBravery);

  return {
    champion,
    items,
    runes,
    summonerSpells,
    isUltimateBravery: ultimateBravery,
  };
}

function pickChampion(
  championsMap: Map<string, Champion>,
  role: RoleFilter,
  lockedChampionId: string | null
): Champion {
  if (lockedChampionId) {
    const locked = championsMap.get(lockedChampionId);
    if (locked) return locked;
  }

  const allChampions = Array.from(championsMap.values());

  if (role === "any") {
    return randomElement(allChampions);
  }

  const roleTags = ROLE_TAG_MAP[role];
  const filtered = allChampions.filter((c) =>
    c.tags.some((t) => roleTags.includes(t))
  );

  return randomElement(filtered.length > 0 ? filtered : allChampions);
}

function pickItems(
  itemsMap: Map<string, Item>,
  _champion: Champion,
  ultimateBravery: boolean
): Item[] {
  const validItems: Item[] = [];
  for (const [, item] of itemsMap) {
    if (isValidItem(item, ultimateBravery)) {
      validItems.push(item);
    }
  }

  const boots = getBootItems(itemsMap);
  const nonBootItems = validItems.filter((i) => !i.tags.includes("Boots"));

  // Pick 1 boot + 5 other items
  const selectedBoot = boots.length > 0 ? randomElement(boots) : null;
  const otherItems = randomElements(nonBootItems, selectedBoot ? 5 : 6);

  const result = selectedBoot ? [selectedBoot, ...otherItems] : otherItems;

  return result.slice(0, 6);
}

function pickRunes(
  runeTrees: RuneTree[],
  _champion: Champion,
  _ultimateBravery: boolean
): SelectedRunes {
  // Pick primary tree
  const primaryTree = randomElement(runeTrees);

  // Pick sub tree (different from primary)
  const otherTrees = runeTrees.filter((t) => t.id !== primaryTree.id);
  const subTree = randomElement(otherTrees);

  // Primary: keystone (slot 0) + one from each of slots 1, 2, 3
  const keystone = randomElement(primaryTree.slots[0].runes);
  const primarySelections: RuneData[] = [];
  for (let i = 1; i < primaryTree.slots.length && i <= 3; i++) {
    primarySelections.push(randomElement(primaryTree.slots[i].runes));
  }

  // Secondary: pick 2 from 2 different rows of the sub tree (slots 1, 2, 3)
  const subSlotIndices = [1, 2, 3].filter((i) => i < subTree.slots.length);
  const selectedSubSlots = randomElements(subSlotIndices, 2);
  const subSelections: RuneData[] = selectedSubSlots.map((slotIdx) =>
    randomElement(subTree.slots[slotIdx].runes)
  );

  // Stat shards
  const statShards = [
    randomElement(STAT_SHARDS.row1),
    randomElement(STAT_SHARDS.row2),
    randomElement(STAT_SHARDS.row3),
  ];

  return {
    primaryTree,
    subTree,
    keystone,
    primarySelections,
    subSelections,
    statShards,
  };
}

function pickSummonerSpells(
  spellsMap: Map<string, SummonerSpell>,
  role: RoleFilter,
  ultimateBravery: boolean
): SummonerSpell[] {
  const allSpells = Array.from(spellsMap.values());

  if (ultimateBravery) {
    // In Ultimate Bravery, any 2 random spells (can't duplicate)
    return randomElements(allSpells, 2);
  }

  // In normal mode, keep Flash as one option and randomize the other
  if (role === "jungle") {
    // Junglers always get Smite
    const smite = allSpells.find((s) => s.id === "SummonerSmite");
    const others = allSpells.filter((s) => s.id !== "SummonerSmite");
    const second = randomElement(others);
    return smite ? [smite, second] : randomElements(allSpells, 2);
  }

  // Other roles: Flash + random
  const flash = allSpells.find((s) => s.id === "SummonerFlash");
  const others = allSpells.filter((s) => s.id !== "SummonerFlash");
  const second = randomElement(others);
  return flash ? [flash, second] : randomElements(allSpells, 2);
}
