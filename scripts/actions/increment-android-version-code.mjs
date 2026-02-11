import { readFileSync, writeFileSync } from "node:fs";

const packageJsonPath = "package.json";
const appJsonPath = "app.json";

const packageJson = JSON.parse(readFileSync(packageJsonPath, "utf8"));
const appJson = JSON.parse(readFileSync(appJsonPath, "utf8"));

const currentVersion = packageJson.version;
if (!/^\d+\.\d+\.\d+$/.test(currentVersion)) {
  throw new Error(`Unsupported package version format: ${currentVersion}`);
}

const [major, minor, patch] = currentVersion.split(".").map(Number);
const syncedVersionCode = major * 10000 + minor * 100 + patch;

if (typeof appJson?.expo?.android?.versionCode !== "number") {
  throw new Error("app.json expo.android.versionCode must be a number");
}

const currentVersionCode = appJson.expo.android.versionCode;
appJson.expo.android.versionCode = syncedVersionCode;
writeFileSync(appJsonPath, `${JSON.stringify(appJson, null, 2)}\n`);

console.log(`package version: ${currentVersion}`);
console.log(`versionCode: ${currentVersionCode} -> ${syncedVersionCode}`);
