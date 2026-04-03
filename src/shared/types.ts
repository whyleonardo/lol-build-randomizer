import type { RPCSchema } from "electrobun/bun";

// ============================================
// Game Data Models
// ============================================

export interface Champion {
  id: string;
  key: string;
  name: string;
  title: string;
  tags: string[]; // e.g. ["Fighter", "Tank"]
  image: {
    full: string;
  };
}

export interface Item {
  id: string;
  name: string;
  description: string;
  gold: {
    total: number;
    purchasable: boolean;
  };
  tags: string[];
  image: {
    full: string;
  };
  maps: Record<string, boolean>;
  into?: string[];
  from?: string[];
  depth?: number;
}

export interface RuneSlot {
  runes: RuneData[];
}

export interface RuneData {
  id: number;
  key: string;
  icon: string;
  name: string;
  shortDesc: string;
  longDesc: string;
}

export interface RuneTree {
  id: number;
  key: string;
  icon: string;
  name: string;
  slots: RuneSlot[];
}

export interface SummonerSpell {
  id: string;
  key: string;
  name: string;
  description: string;
  image: {
    full: string;
  };
  modes: string[];
}

// ============================================
// Build Models
// ============================================

export interface SelectedRunes {
  primaryTree: RuneTree;
  subTree: RuneTree;
  keystone: RuneData;
  primarySelections: RuneData[]; // 3 runes from primary tree (rows 1-3)
  subSelections: RuneData[]; // 2 runes from sub tree
  statShards: number[]; // 3 stat shard IDs
}

export interface RandomBuild {
  champion: Champion;
  items: Item[];
  runes: SelectedRunes;
  summonerSpells: SummonerSpell[];
  isUltimateBravery: boolean;
}

export type RoleFilter =
  | "any"
  | "top"
  | "jungle"
  | "mid"
  | "adc"
  | "support";

// ============================================
// LCU Status
// ============================================

export interface LCUStatus {
  connected: boolean;
  gamePhase?: string;
  summonerName?: string;
}

// ============================================
// RPC Schema
// ============================================

export type AppRPCType = {
  bun: RPCSchema<{
    requests: {
      generateBuild: {
        params: {
          role: RoleFilter;
          ultimateBravery: boolean;
          lockedChampionId: string | null;
        };
        response: RandomBuild;
      };
      importRunes: {
        params: {
          runes: SelectedRunes;
          championName: string;
        };
        response: { success: boolean; message: string };
      };
      importItemSet: {
        params: {
          build: RandomBuild;
          lolPath: string | null;
        };
        response: { success: boolean; message: string };
      };
      autoLockChampion: {
        params: {
          championKey: string;
          championName: string;
          runes: SelectedRunes;
        };
        response: { success: boolean; message: string };
      };
      checkLCUConnection: {
        params: {};
        response: LCUStatus;
      };
      getDataVersion: {
        params: {};
        response: { version: string; championCount: number };
      };
      minimizeWindow: {
        params: {};
        response: {};
      };
      closeWindow: {
        params: {};
        response: {};
      };
    };
    messages: {};
  }>;
  webview: RPCSchema<{
    requests: {};
    messages: {
      showNotification: {
        type: "success" | "error" | "info";
        message: string;
      };
      lcuStatusUpdate: LCUStatus;
    };
  }>;
};

// ============================================
// Stat Shards IDs
// ============================================

export const STAT_SHARDS = {
  row1: [5008, 5005, 5007], // Adaptive, Attack Speed, Ability Haste
  row2: [5008, 5010, 5001], // Adaptive, Move Speed, Flat Health
  row3: [5011, 5013, 5001], // Scaling Health, Tenacity/Slow Resist, Flat Health
};
