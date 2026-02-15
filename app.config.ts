 
import type { ExpoConfig } from "expo/config";

type PackageJson = { version?: string };

const pkg = require("./package.json") as PackageJson;

function requirePackageVersion(): string {
  const v = pkg.version;
  if (typeof v !== "string" || v.trim().length === 0) {
    throw new Error("package.json version is missing or invalid");
  }
  return v;
}

export default ({ config }: { config: ExpoConfig }): ExpoConfig => {
  const pkgVersion = requirePackageVersion();

  return {
    ...config,
    name: "Bunkialo2",
    slug: "Bunkialo2",
    owner: "ialexpo",
    orientation: "portrait",
    icon: "./src/assets/images/icon.png",
    scheme: "bunkialo",
    userInterfaceStyle: "automatic",
    newArchEnabled: true,
    ios: {
      supportsTablet: true,
      icon: {
        light: "./src/assets/images/ios-icon-light.png",
        dark: "./src/assets/images/ios-icon-dark.png",
        tinted: "./src/assets/images/ios-icon-tinted.png",
      },
      infoPlist: {
        UIBackgroundModes: ["fetch"],
      },
    },
    // Developer-facing build numbers are managed by EAS remote versioning.
    android: {
      softwareKeyboardLayoutMode: "resize",
      permissions: ["RECEIVE_BOOT_COMPLETED"],
      adaptiveIcon: {
        backgroundColor: "#E6F4FE",
        foregroundImage: "./src/assets/images/android-icon-foreground.png",
        backgroundImage: "./src/assets/images/android-icon-background.png",
        monochromeImage: "./src/assets/images/android-icon-monochrome.png",
      },
      edgeToEdgeEnabled: true,
      predictiveBackGestureEnabled: false,
      package: "com.codialo.Bunkialo2",
    },
    web: {
      output: "static",
      bundler: "metro",
      favicon: "./src/assets/images/favicon.png",
    },
    plugins: [
      "expo-router",
      "expo-build-properties",
      [
        "expo-splash-screen",
        {
          image: "./src/assets/images/splash-icon.png",
          imageWidth: 200,
          resizeMode: "contain",
          backgroundColor: "#ffffff",
          dark: { backgroundColor: "#000000" },
        },
      ],
    ],
    experiments: {
      typedRoutes: true,
      reactCompiler: true,
    },
    extra: {
      router: {},
      eas: {
        projectId: "7cbe49d9-9827-4df3-b86e-849443804d63",
      },
    },
    runtimeVersion: "0.1.0",
    updates: {
      url: "https://u.expo.dev/7cbe49d9-9827-4df3-b86e-849443804d63",
    },

    version: pkgVersion,
  };
};
