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
  const isExpoGoPreview = process.env.EXPO_GO_PREVIEW === "1";

  return {
    ...config,
    name: "Bunkialo2",
    slug: "Bunkialo2",
    owner: "ialexpo",
    orientation: "portrait",
    icon: "./src/assets/images/icon.png",
    scheme: "bunkialo",
    userInterfaceStyle: "automatic",
    ios: {
      bundleIdentifier: "com.codialo.Bunkialo2",
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
      permissions: ["RECEIVE_BOOT_COMPLETED", "ACCESS_NETWORK_STATE"],
      adaptiveIcon: {
        backgroundColor: "#FFAB00",
        foregroundImage: "./src/assets/images/android-icon-foreground.png",
        monochromeImage: "./src/assets/images/android-icon-monochrome.png",
      },
      predictiveBackGestureEnabled: false,
      package: "com.codialo.Bunkialo2",
    },
    web: {
      output: "single",
      bundler: "metro",
      favicon: "./src/assets/images/favicon.png",
    },
    plugins: [
      "expo-router",
      [
        "expo-sharing",
        {
          android: {
            enabled: true,
            singleShareMimeTypes: ["image/*", "application/pdf"],
            multipleShareMimeTypes: ["image/*", "application/pdf"],
          },
          ios: {
            enabled: true,
            activationRule:
              'SUBQUERY(extensionItems, $item, SUBQUERY($item.attachments, $attachment, ANY $attachment.registeredTypeIdentifiers UTI-CONFORMS-TO "public.image" OR ANY $attachment.registeredTypeIdentifiers UTI-CONFORMS-TO "com.adobe.pdf").@count == $item.attachments.@count).@count == extensionItems.@count',
          },
        },
      ],
      "./plugins/with-widget-refresh",
      [
        "expo-widgets",
        {
          enableAndroid: true,
          widgets: [
            {
              name: "BunkialoTimetable",
              displayName: "Timetable",
              description: "Now and next",
              ios: {
                supportedFamilies: ["systemSmall", "systemMedium"],
                contentMarginsDisabled: true,
                initialLayout: "./src/widgets/timetable.ios.tsx",
              },
              android: {
                targetCellWidth: 2,
                targetCellHeight: 2,
                minWidth: 150,
                minHeight: 160,
                resizeMode: "both",
                initialLayout: "./src/widgets/timetable.android.tsx",
              },
            },
            {
              name: "BunkialoMess",
              displayName: "Mess",
              description: "Next meal",
              ios: {
                supportedFamilies: ["systemSmall", "systemMedium"],
                contentMarginsDisabled: true,
                initialLayout: "./src/widgets/mess.ios.tsx",
              },
              android: {
                targetCellWidth: 3,
                targetCellHeight: 2,
                minWidth: 180,
                minHeight: 180,
                resizeMode: "both",
                initialLayout: "./src/widgets/mess.android.tsx",
              },
            },
          ],
        },
      ],
      "expo-build-properties",
      "expo-background-task",
      "expo-font",
      "expo-sqlite",
      "expo-web-browser",
      [
        "expo-notifications",
        {
          defaultChannel: "default",
        },
      ],
      [
        "expo-splash-screen",
        {
          image: "./src/assets/images/splash-icon.png",
          imageWidth: 200,
          resizeMode: "contain",
          backgroundColor: "#000000",
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
    // Expo Go needs the SDK runtime; EAS builds use the app version contract.
    runtimeVersion: isExpoGoPreview
      ? { policy: "sdkVersion" }
      : `${pkgVersion}-sdk58-widgets-v1`,
    updates: {
      url: "https://u.expo.dev/7cbe49d9-9827-4df3-b86e-849443804d63",
    },

    version: pkgVersion,
  };
};
