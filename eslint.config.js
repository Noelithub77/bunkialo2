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
      // Adopt SDK 58's new compiler diagnostics gradually across existing screens.
      "react-hooks/refs": "warn",
      "react-hooks/set-state-in-effect": "warn",
      "react-hooks/immutability": "warn",
      "react-hooks/static-components": "warn",
      "react-hooks/purity": "warn",
      "react-hooks/preserve-manual-memoization": "warn",
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
