import type { LCUStatus, SelectedRunes } from "../shared/types";

// ============================================
// LCU Client - Communicates with the League Client
// ============================================

interface LCUCredentials {
  port: number;
  token: string;
  protocol: string;
}

let cachedCredentials: LCUCredentials | null = null;

/**
 * Attempt to find the LCU lockfile on Windows.
 * The lockfile contains: processName:pid:port:token:protocol
 */
async function findLockfile(): Promise<LCUCredentials | null> {
  // Common Windows paths for League of Legends
  const possiblePaths = [
    "C:/Riot Games/League of Legends/lockfile",
    "D:/Riot Games/League of Legends/lockfile",
    "C:/Program Files/Riot Games/League of Legends/lockfile",
    "C:/Program Files (x86)/Riot Games/League of Legends/lockfile",
    "D:/Games/Riot Games/League of Legends/lockfile",
  ];

  for (const lockfilePath of possiblePaths) {
    try {
      const file = Bun.file(lockfilePath);
      if (await file.exists()) {
        const content = await file.text();
        const parts = content.split(":");
        if (parts.length >= 5) {
          return {
            port: parseInt(parts[2]),
            token: parts[3],
            protocol: parts[4],
          };
        }
      }
    } catch {
      // File doesn't exist or can't be read, try next path
    }
  }

  return null;
}

/**
 * Try to find LCU credentials from the running process command line args.
 * Works on Windows using WMIC.
 */
async function findFromProcess(): Promise<LCUCredentials | null> {
  try {
    const proc = Bun.spawn(
      [
        "wmic",
        "process",
        "where",
        "name='LeagueClientUx.exe'",
        "get",
        "commandline",
      ],
      {
        stdout: "pipe",
        stderr: "pipe",
      }
    );

    const output = await new Response(proc.stdout).text();

    const portMatch = output.match(/--app-port=(\d+)/);
    const tokenMatch = output.match(/--remoting-auth-token=([\w-]+)/);

    if (portMatch && tokenMatch) {
      return {
        port: parseInt(portMatch[1]),
        token: tokenMatch[1],
        protocol: "https",
      };
    }
  } catch (e) {
    console.log("[LCU] Could not find process:", e);
  }

  return null;
}

/**
 * Get LCU credentials, trying lockfile first, then process args.
 */
async function getCredentials(): Promise<LCUCredentials | null> {
  // Try lockfile first (faster)
  let creds = await findLockfile();
  if (creds) {
    cachedCredentials = creds;
    return creds;
  }

  // Try process args
  creds = await findFromProcess();
  if (creds) {
    cachedCredentials = creds;
    return creds;
  }

  cachedCredentials = null;
  return null;
}

/**
 * Make an authenticated request to the LCU API.
 */
async function lcuRequest(
  method: string,
  endpoint: string,
  body?: any
): Promise<any> {
  const creds = cachedCredentials || (await getCredentials());
  if (!creds) {
    throw new Error("League Client not found. Make sure it is running.");
  }

  const url = `https://127.0.0.1:${creds.port}${endpoint}`;
  const auth = Buffer.from(`riot:${creds.token}`).toString("base64");

  const options: RequestInit = {
    method,
    headers: {
      Authorization: `Basic ${auth}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    // Ignore self-signed cert
    // @ts-ignore - Bun supports this
    tls: {
      rejectUnauthorized: false,
    },
  };

  if (body) {
    options.body = JSON.stringify(body);
  }

  try {
    const response = await fetch(url, options);
    if (response.ok) {
      const text = await response.text();
      return text ? JSON.parse(text) : null;
    }
    throw new Error(`LCU API error: ${response.status} ${response.statusText}`);
  } catch (e: any) {
    if (e.code === "ECONNREFUSED") {
      cachedCredentials = null;
      throw new Error("League Client is not running.");
    }
    throw e;
  }
}

// ============================================
// Public API
// ============================================

/**
 * Check if the League Client is running and get connection status.
 */
export async function checkConnection(): Promise<LCUStatus> {
  try {
    const creds = await getCredentials();
    if (!creds) {
      return { connected: false };
    }

    // Try to get the current game phase
    const phase = await lcuRequest("GET", "/lol-gameflow/v1/gameflow-phase");

    return {
      connected: true,
      gamePhase: phase,
    };
  } catch {
    return { connected: false };
  }
}

/**
 * Import runes to the League Client.
 * Deletes the current page and creates a new one with the given runes.
 */
export async function importRunes(
  runes: SelectedRunes,
  championName: string
): Promise<{ success: boolean; message: string }> {
  try {
    // Get current rune page
    const currentPage = await lcuRequest(
      "GET",
      "/lol-perks/v1/currentpage"
    );

    // Delete current page if it exists and is editable
    if (currentPage && currentPage.id && currentPage.isDeletable) {
      await lcuRequest(
        "DELETE",
        `/lol-perks/v1/pages/${currentPage.id}`
      );
    }

    // Build the perk IDs array
    const selectedPerkIds = [
      runes.keystone.id,
      ...runes.primarySelections.map((r) => r.id),
      ...runes.subSelections.map((r) => r.id),
      ...runes.statShards,
    ];

    // Create new rune page
    const newPage = {
      name: `🎲 ${championName} Random Build`,
      primaryStyleId: runes.primaryTree.id,
      subStyleId: runes.subTree.id,
      selectedPerkIds,
      current: true,
    };

    await lcuRequest("POST", "/lol-perks/v1/pages", newPage);

    return {
      success: true,
      message: `Runes imported for ${championName}!`,
    };
  } catch (e: any) {
    return {
      success: false,
      message: e.message || "Failed to import runes",
    };
  }
}
