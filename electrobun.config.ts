export default {
  app: {
    name: "LoL Build Randomizer",
    identifier: "dev.lol.build.randomizer",
    version: "1.0.0",
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
    win: {
      icon: "./icon.ico"
    }
  },
};
