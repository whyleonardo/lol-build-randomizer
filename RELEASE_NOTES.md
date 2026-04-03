# 🎲 LoL Build Randomizer - Release v0.0.6

This release brings high-quality, production-grade application icons across all platforms! 🎨

## ✨ New Features
- **High-Quality App Icons:** Generated a brand new set of premium app icons from a custom 1024×1024 source image.
  - **macOS:** Full Apple `.iconset` bundle with all 10 required sizes (16×16 through 1024×1024, including @2x Retina variants).
  - **Windows:** Multi-size `.ico` file with 16, 32, 128, and 256px layers embedded.
  - **Linux:** High-resolution 256×256 PNG for window icons and `.desktop` entries.

## 🐛 Bug Fixes
- **Windows Icon Injection:** Restored the `rcedit` workaround in the CI/CD pipeline to apply custom icons to both `launcher.exe` and `bun.exe`, working around Electrobun's hardcoded path bug ([#235](https://github.com/blackboardsh/electrobun/issues/235)).
- **Node.js 24 Deprecation Warning:** Suppressed the GitHub Actions deprecation warning by setting `FORCE_JAVASCRIPT_ACTIONS_TO_NODE24`.
