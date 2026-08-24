// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require("eslint/config");
const expoConfig = require("eslint-config-expo/flat");

module.exports = defineConfig([
  expoConfig,
  {
    ignores: [
      "dist/*",
      "worker-configuration.d.ts",
      // Quickshell JavaScript modules use QML's top-level var export format.
      "omarchy-plugin/**/*.js",
    ],
  },
  {
    rules: {
      "react/display-name": "off",
    },
  },
  {
    settings: {
      "import/resolver": {
        typescript: {
          alwaysTryTypes: true,
          project: ["./tsconfig.json", "./bunkialo-landing/tsconfig.json"],
        },
      },
    },
  },
]);
