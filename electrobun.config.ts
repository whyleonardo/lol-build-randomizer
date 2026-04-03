import type { ElectrobunConfig } from "electrobun";

const config: ElectrobunConfig = {
  app: {
    name: "LoL Build Randomizer",
    identifier: "dev.lol.build.randomizer",
    version: "0.0.1",
  },
  build: {
    bun: {
      entrypoint: "src/bun/index.ts",
    },
    views: {
      "main-ui": {
        entrypoint: "src/main-ui/index.ts",
      },
    },
    copy: {
      "src/main-ui/index.html": "views/main-ui/index.html",
      "src/main-ui/style.css": "views/main-ui/style.css"
    },
    linux: {
      icon: "icon.iconset/icon_256x256.png"
    },
    win: {
      icon: "icon.ico"
    }
  },
};


export default config