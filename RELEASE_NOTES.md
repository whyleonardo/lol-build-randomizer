# 🎲 LoL Build Randomizer - Release v1.0.0 (The Automation Update) 🚀

Welcome to the first official **Stable Release**! This version transforms the application from a simple build display into a powerful, automated LoL companion.

## 🌟 New Features: Auto-Lock & Runes
The headline feature is the **"Auto-Lock & Runes"** button. One click now handles the hardest parts of the pre-game setup:
- **Automatic Champion Selection:** Native support for **Quickplay (Queue 480/1900)**, Blind Pick, Custom Games, and Draft/Ranked sessions. 🛡️
- **Integrated Rune Injection:** No more manual clicks. The app constructs and applies valid 2024 season perk pages directly to your client. ⚡
- **High-Definition Visuals:** Forced the client to display high-quality champion splash arts in the lobby slots using base skin IDs. 🎨
- **Integrated Perks (Lobby):** For Dynamic/Blind lobbies, runes are injected directly into the position preference slots to ensure consistency.

## 🛠️ Technical Improvements & Bug Fixes
- **Robust LCU Integration:** Implemented forensic member-search logic that bypasses 404/403 errors when the client fails to identify the local summoner.
- **Dynamic Queue Support:** Successfully integrated the `PUT /lol-lobby/v1/lobby/members/localMember/player-slots` endpoint for seamless lobby updates.
- **Stat Shards 2024:** Fully updated to the latest Season 14 shard system (Move Speed, Tenacity, Flat/Scaling Health) to prevent "Invalid Rune Page" resets.
- **Clean UI:** All system messages and toast notifications have been translated to English.
- **Error Resiliency:** Improved "Silence 404/403" logic during page deletions to ensure the app never crashes during game phase transitions.

---

# 🎲 LoL Build Randomizer - Release v0.0.6 (Icon Polish)

This release brings high-quality, production-grade application icons across all platforms! 🎨

## ✨ New Features
- **High-Quality App Icons:** Generated a brand new set of premium app icons.
- **Windows Icon Injection:** Restored the `rcedit` workaround for Electrobun's hardcoded path bug.
