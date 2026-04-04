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
 * Attempt to find the LCU lockfile.
 */
async function findLockfile(): Promise<LCUCredentials | null> {
  const isWin = process.platform === "win32";
  
  // Common paths for League of Legends
  const possiblePaths = isWin ? [
    "C:/Riot Games/League of Legends/lockfile",
    "D:/Riot Games/League of Legends/lockfile",
    "C:/Program Files/Riot Games/League of Legends/lockfile",
    "C:/Program Files (x86)/Riot Games/League of Legends/lockfile",
    "D:/Games/Riot Games/League of Legends/lockfile",
  ] : [
    "/Applications/League of Legends.app/Contents/LoL/lockfile",
    `${process.env.HOME}/Library/Application Support/Riot Games/League of Legends/lockfile`,
  ];

  for (const lockfilePath of possiblePaths) {
    try {
      const file = Bun.file(lockfilePath);
      if (await file.exists()) {
        const content = await file.text();
        const parts = content.split(":");
        if (parts.length >= 5) {
          return {
            port: parseInt(parts[2]!),
            token: parts[3]!,
            protocol: parts[4]!,
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
 */
async function findFromProcess(): Promise<LCUCredentials | null> {
  const isWin = process.platform === "win32";

  try {
    let output = "";
    
    if (isWin) {
      const proc = Bun.spawn(
        [
          "powershell",
          "-NoProfile",
          "-Command",
          "(Get-CimInstance Win32_Process -Filter \"Name='LeagueClientUx.exe'\" | Select-Object -ExpandProperty CommandLine) -join ' '"
        ],
        { stdout: "pipe", stderr: "pipe" }
      );
      output = await new Response(proc.stdout).text();
    } else {
      // macOS/Unix path
      const proc = Bun.spawn(["ps", "aux"], { stdout: "pipe" });
      output = await new Response(proc.stdout).text();
    }

    const portMatch = output.match(/--app-port=(\d+)/);
    const tokenMatch = output.match(/--remoting-auth-token=([\w-]+)/);

    if (portMatch && tokenMatch) {
      return {
        port: parseInt(portMatch[1]!),
        token: tokenMatch[1]!,
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
  // If we have cached credentials, try them first or check if they are still valid?
  // For now, let's just find them fresh to be sure
  let creds = await findLockfile();
  if (!creds) {
    creds = await findFromProcess();
  }

  if (creds) {
    cachedCredentials = creds;
    return creds;
  }

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

  console.log(`[LCU Request] ${method} ${url}`);

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
    console.log(`[LCU Response] ${response.status} ${response.statusText}`);

    if (response.ok) {
      const text = await response.text();
      return text ? JSON.parse(text) : null;
    }

    // Graceful 404/403 for lobby, champ-select and perks
    if ((response.status === 404 || response.status === 403) && 
        (endpoint.includes("/lol-lobby") || endpoint.includes("/lol-champ-select") || endpoint.includes("/lol-perks"))) {
       console.log(`[LCU] Silencing ${response.status} for: ${endpoint}`);
       return null;
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
    // 1. Clean up existing pages to avoid "Limit Reached" (400 Bad Request)
    const pages = await lcuRequest("GET", "/lol-perks/v1/pages");
    if (Array.isArray(pages)) {
        for (const page of pages) {
            if (page.isDeletable && (page.name.includes("🎲") || pages.length >= 2)) {
                await lcuRequest("DELETE", `/lol-perks/v1/pages/${page.id}`);
            }
        }
    }

    // Build the perk IDs array
    const selectedPerkIds = [
      runes.keystone.id,
      ...runes.primarySelections.map((r) => r.id),
      ...runes.subSelections.map((r) => r.id),
      ...runes.statShards,
    ];

    // Create new rune page (Short name to avoid 400)
    const newPage = {
      name: `🎲 ${championName.substring(0, 10)}`,
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
    console.error("[LCU] Rune Import Error:", e);
    return {
      success: false,
      message: e.message || "Failed to import runes",
    };
  }
}

/**
 * Attempts to automatically hover/lock a champion and then imports runes.
 * Integrated with QuickPlay (Dynamic) and Standard Champ Select.
 */
export async function autoLockAndRune(
  championKey: string,
  championName: string,
  runes: SelectedRunes
): Promise<{ success: boolean; message: string }> {
  try {
    const champIdNum = parseInt(championKey);
    console.log(`[LCU] autoLockAndRune: ${championName} (${champIdNum})`);

    // 1. Try Standard Champ Select (Draft, Ranked, Custom)
    console.log("[LCU] Checking for active Champ Select session...");
    const session = await lcuRequest("GET", "/lol-champ-select/v1/session");

    if (session) {
      console.log("[LCU] Champ Select found.");
      const localPlayerId = session.localPlayerCellId;

      // A. Blind Pick / Custom Game
      if (!session.actions || session.actions.length === 0) {
        console.log("[LCU] Blind pick handling...");
        await lcuRequest("PATCH", "/lol-champ-select/v1/session/my-selection", {
          championId: champIdNum
        });
        await importRunes(runes, championName);
        return { success: true, message: `${championName} selected (Blind Mode).` };
      }

      // B. Draft / Ranked
      let pickActionId: number | null = null;
      let isOurTurn = false;

      for (const actionGroup of session.actions) {
        for (const action of actionGroup) {
          if (action.actorCellId === localPlayerId && action.type === "pick") {
            if (!action.completed) {
              pickActionId = action.id;
              isOurTurn = action.isInProgress;
            }
          }
        }
      }

      if (pickActionId !== null) {
        if (isOurTurn) {
          console.log(`[LCU] Locking champion in action ${pickActionId}`);
          await lcuRequest("PATCH", `/lol-champ-select/v1/session/actions/${pickActionId}`, {
            championId: champIdNum,
            completed: true
          });
          await importRunes(runes, championName);
          return { success: true, message: `${championName} locked and runes applied!` };
        } else {
          console.log(`[LCU] Hovering champion in action ${pickActionId}`);
          await lcuRequest("PATCH", `/lol-champ-select/v1/session/actions/${pickActionId}`, {
            championId: champIdNum
          });
          await importRunes(runes, championName);
          return { success: true, message: `Hovered ${championName}. Wait for your turn.` };
        }
      }

      // If we are in session but no specific pick action is pending
      await importRunes(runes, championName);
      return { success: true, message: `Runes imported for ${championName}!` };
    }

    // 2. Fallback to Lobby (for Quickplay / Normal Blind)
    console.log("[LCU] No Champ Select. Checking for Lobby...");
    const lobby = await lcuRequest("GET", "/lol-lobby/v2/lobby");

    if (lobby) {
      const qId = lobby.gameConfig?.queueId;
      console.log(`[LCU] Lobby found (Queue ID: ${qId})`);

      if (String(qId) === "1900" || String(qId) === "480") {
        console.log(`[LCU] Lobby detected (${qId})`);
        
        try {
          const members = lobby.members;
          const localSummoner = await lcuRequest("GET", "/lol-summoner/v1/current-summoner");
          
          if (members && localSummoner) {
             const me = members.find((m: any) => m.summonerId === localSummoner.summonerId);

             if (me) {
                // Construct the perks data for the slot (Queue 480 uses stringified JSON)
                const perkIds = [
                    runes.keystone.id,
                    ...runes.primarySelections.map(r => r.id),
                    ...runes.subSelections.map(r => r.id),
                    ...runes.statShards
                ];
                
                const perksJson = JSON.stringify({
                    perkIds,
                    perkStyle: runes.primaryTree.id,
                    perkSubStyle: runes.subTree.id
                });

                // Priority 1: playerSlots (Lobby V1 endpoint found by user)
                if (me.playerSlots) {
                    console.log("[LCU] playerSlots found! Injecting champion + runes...");
                    
                    const hdSkinId = champIdNum * 1000;
                    const updatedSlots = me.playerSlots.map((slot: any) => ({
                        championId: champIdNum,
                        positionPreference: slot.positionPreference || "NONE",
                        skinId: hdSkinId, // Use HD skin ID for better tile quality
                        spell1: slot.spell1 || 4,
                        spell2: slot.spell2 || 14,
                        perks: perksJson // Directly inject the randomized runes here!
                    }));

                    await lcuRequest("PUT", "/lol-lobby/v1/lobby/members/localMember/player-slots", updatedSlots);
                    console.log(`[LCU] Sent PUT to player-slots with integrated runes and Skin: ${hdSkinId}`);
                } 
                // Priority 2: quickplaySelections (Standard)
                else if (me.quickplaySelections) {
                    const hdSkinId = champIdNum * 1000;
                    const updated = me.quickplaySelections.map((s: any) => ({ 
                        ...s, 
                        championId: champIdNum,
                        skinId: hdSkinId
                    }));
                    await lcuRequest("PUT", "/lol-lobby/v2/lobby/members/localMember/quickplay-selections", updated);
                }
             }
          }
        } catch (e) {
          console.error("[LCU] Failed to update Lobby selections:", e);
        }

        await importRunes(runes, championName);

        return {
          success: true,
          message: `Lobby: ${championName} selected in all slots!`,
        };
      }
    }

    // Final attempt: maybe the LCU just won't give us session/lobby info, try runes anyway
    console.log("[LCU] No explicit session/lobby detected. Trying runes as last resort.");
    const runeRes = await importRunes(runes, championName);
    if (runeRes.success) {
      return { success: true, message: `Runes applied for ${championName} (No active lobby detected).` };
    }

    return { success: false, message: "No active Champion Select or Quickplay Lobby found." };

  } catch (e: any) {
    console.error("[LCU] autoLockAndRune total failure:", e);
    return {
      success: false,
      message: e.message || "Selection error.",
    };
  }
}
