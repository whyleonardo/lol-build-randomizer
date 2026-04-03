# 🎲 LoL Build Randomizer - Release v0.0.4

Welcome to the new v0.0.4 update! 🚀
We are refining the project to ensure a true cross-platform experience with structural improvements to the native executables.

## ✨ New Features
- **Official Native Support:** Restored support for native icon metadata in the Electrobun engine. Now all compilers and systems (Win, Mac, Linux) will use the framework's official injection to handle window properties.
- **MacOS Iconset:** The project now supports `.iconset` and builds system tray/app icons seamlessly right out of the box!

## 🐛 Bug Fixes
- Fixed a bug where `RELEASE_NOTES.md` was ignored on the repository's release tab (the GitHub Actions Runner was skipping checkout for documentation files).
- Removed secondary `rcedit` hard-coded scripts from the deployment pipeline to prioritize the native CLI.
