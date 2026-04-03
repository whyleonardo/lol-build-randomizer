import type {
  Champion,
  Item,
  RuneTree,
  SummonerSpell,
} from "../shared/types";

const DDRAGON_BASE = "https://ddragon.leagueoflegends.com";

let cachedVersion: string | null = null;
let cachedChampions: Map<string, Champion> | null = null;
let cachedItems: Map<string, Item> | null = null;
let cachedRunes: RuneTree[] | null = null;
let cachedSummonerSpells: Map<string, SummonerSpell> | null = null;

export async function getLatestVersion(): Promise<string> {
  if (cachedVersion) return cachedVersion;

  const response = await fetch(`${DDRAGON_BASE}/api/versions.json`);
  const versions: string[] = await response.json();
  cachedVersion = versions[0];
  console.log(`[DataDragon] Latest version: ${cachedVersion}`);
  return cachedVersion;
}

export async function getChampions(): Promise<Map<string, Champion>> {
  if (cachedChampions) return cachedChampions;

  const version = await getLatestVersion();
  const url = `${DDRAGON_BASE}/cdn/${version}/data/en_US/champion.json`;
  console.log(`[DataDragon] Fetching champions...`);
  const response = await fetch(url);
  const data = await response.json();

  cachedChampions = new Map();
  for (const [key, value] of Object.entries(data.data)) {
    const champ = value as any;
    cachedChampions.set(key, {
      id: champ.id,
      key: champ.key,
      name: champ.name,
      title: champ.title,
      tags: champ.tags,
      image: champ.image,
    });
  }

  console.log(`[DataDragon] Loaded ${cachedChampions.size} champions`);
  return cachedChampions;
}

export async function getItems(): Promise<Map<string, Item>> {
  if (cachedItems) return cachedItems;

  const version = await getLatestVersion();
  const url = `${DDRAGON_BASE}/cdn/${version}/data/en_US/item.json`;
  console.log(`[DataDragon] Fetching items...`);
  const response = await fetch(url);
  const data = await response.json();

  cachedItems = new Map();
  for (const [id, value] of Object.entries(data.data)) {
    const item = value as any;
    cachedItems.set(id, {
      id,
      name: item.name,
      description: item.description,
      gold: item.gold,
      tags: item.tags || [],
      image: item.image,
      maps: item.maps,
      into: item.into,
      from: item.from,
      depth: item.depth,
    });
  }

  console.log(`[DataDragon] Loaded ${cachedItems.size} items`);
  return cachedItems;
}

export async function getRunes(): Promise<RuneTree[]> {
  if (cachedRunes) return cachedRunes;

  const version = await getLatestVersion();
  const url = `${DDRAGON_BASE}/cdn/${version}/data/en_US/runesReforged.json`;
  console.log(`[DataDragon] Fetching runes...`);
  const response = await fetch(url);
  cachedRunes = await response.json();

  console.log(`[DataDragon] Loaded ${cachedRunes!.length} rune trees`);
  return cachedRunes!;
}

export async function getSummonerSpells(): Promise<
  Map<string, SummonerSpell>
> {
  if (cachedSummonerSpells) return cachedSummonerSpells;

  const version = await getLatestVersion();
  const url = `${DDRAGON_BASE}/cdn/${version}/data/en_US/summoner.json`;
  console.log(`[DataDragon] Fetching summoner spells...`);
  const response = await fetch(url);
  const data = await response.json();

  cachedSummonerSpells = new Map();
  for (const [key, value] of Object.entries(data.data)) {
    const spell = value as any;
    // Only include spells available on Summoner's Rift (CLASSIC)
    if (spell.modes && spell.modes.includes("CLASSIC")) {
      cachedSummonerSpells.set(key, {
        id: spell.id,
        key: spell.key,
        name: spell.name,
        description: spell.description,
        image: spell.image,
        modes: spell.modes,
      });
    }
  }

  console.log(
    `[DataDragon] Loaded ${cachedSummonerSpells.size} summoner spells`
  );
  return cachedSummonerSpells;
}

export function getChampionSplashUrl(championId: string): string {
  return `${DDRAGON_BASE}/cdn/img/champion/splash/${championId}_0.jpg`;
}

export function getChampionIconUrl(
  version: string,
  imageName: string
): string {
  return `${DDRAGON_BASE}/cdn/${version}/img/champion/${imageName}`;
}

export function getItemIconUrl(version: string, imageName: string): string {
  return `${DDRAGON_BASE}/cdn/${version}/img/item/${imageName}`;
}

export function getRuneIconUrl(iconPath: string): string {
  return `https://ddragon.leagueoflegends.com/cdn/img/${iconPath}`;
}

export function getSpellIconUrl(version: string, imageName: string): string {
  return `${DDRAGON_BASE}/cdn/${version}/img/spell/${imageName}`;
}
