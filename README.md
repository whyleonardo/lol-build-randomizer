<h1 align="center">🎲 LoL Build Randomizer</h1>

<p align="center">
  A highly optimized, blazingly fast desktop application to randomly generate builds, runes, and summoner spells for League of Legends, syncing automatically with your official Game Client.
</p>

<p align="center">
  <img src="https://img.shields.io/github/v/release/whyleonardo/lol-build-randomizer?style=for-the-badge&color=gold" alt="Current Release">
</p>

## ✨ Features

- **Real-Time Client Sync (LCU):** Directly integrates with the running League of Legends client. No need to look for root folders, it automatically finds your connection.
- **Role Filters:** Easily select your role (Top, Jungle, Mid, ADC, Support) to limit the champion scope and avoid invalid jungle items on non-junglers.
- **1-Click Imports:** Generates the items and runes inside the app and allows you to inject the generated Rune Pages and Item Sets directly into your client with a single click.
- **Ultimate Bravery Mode:** Want to test your sanity? Toggle this mode to get completely random and uncurated items. 
- **Modern UI:** A stunning, completely frameless window experience, wrapped natively for your operating system.

## 🛠️ Tech Stack

This project was built with blazing fast modern tooling:
- **[Bun](https://bun.sh/)** — JavaScript runtime & package manager.
- **[Electrobun](https://electrobun.dev/)** — An ultra-lightweight desktop framework bridging Bun, Zig, and OS Webviews natively (an alternative to Electron/Tauri).
- **TypeScript** — For end-to-end type safety between the frontend views and the desktop backend.

## 🚀 How to Run Locally

### Prerequisites
Make sure you have **Bun** installed on your machine.
```bash
# Install bun via curl (macOS/Linux) or powershell (Windows)
curl -fsSL https://bun.sh/install | bash
```

### Installation & Development
1. Clone this repository:
```bash
git clone https://github.com/your-username/lol-build-randomizer.git
cd lol-build-randomizer
```

2. Start the development server (automatically builds resources and opens the dev window):
```bash
bun run start
```
*Note: Make sure your League of Legends client is running in the background so the app can successfully hook into the LCU API!*

## 📦 Building for Production

This project uses **GitHub Actions** for cross-compilation matrix builds.
If you simply push to `main` or create a new Release tag (like `v0.0.1`), the `.github/workflows/build.yml` file will automatically compile the official binaries for:
- Windows (x64)
- macOS (arm64)
- Linux (x64)

### Manual Build
If you want to manually build an executable for your current OS:
```bash
bunx electrobun build
```
Binaries will be placed within the `build/` folder.

## ⚠️ Disclaimer
**LoL Build Randomizer** isn't endorsed by Riot Games and doesn't reflect the views or opinions of Riot Games or anyone officially involved in producing or managing League of Legends. League of Legends and Riot Games are trademarks or registered trademarks of Riot Games, Inc. League of Legends © Riot Games, Inc.
