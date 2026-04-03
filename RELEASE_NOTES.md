# 🎲 LoL Build Randomizer - Release v0.0.5

Welcome to the newly polished v0.0.5 update! 🚀
This is a quick hotfix and optimization patch following our recent multi-platform refactoring.

## ✨ New Features
- **Node.js 24 Support via GH Actions:** Future-proofed the CI/CD pipeline! Outdated internal engine warnings (`Node.js 20 actions are deprecated`) have been completely suppressed and resolved by migrating the infrastructure to Node 24 natively.

## 🐛 Bug Fixes
- Fixed an issue where the Windows `.ico` injection path was targeting an incorrect directory. The native framework bundler now correctly targets `assets/icon.ico` upon compilation.
