import { readFileSync, writeFileSync } from "node:fs";

const packageJson = JSON.parse(readFileSync("package.json", "utf8"));
const appJson = JSON.parse(readFileSync("app.json", "utf8"));

if (!appJson.expo) {
  throw new Error("app.json is missing expo config");
}

appJson.expo.version = packageJson.version;
writeFileSync("app.json", `${JSON.stringify(appJson, null, 2)}\n`);

console.log(`Synced app.json expo.version to ${packageJson.version}`);
