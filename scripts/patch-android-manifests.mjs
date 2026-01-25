import fs from "node:fs";
import path from "node:path";

const projectRoot = process.cwd();

const targets = [
  path.join(
    projectRoot,
    "node_modules",
    "@react-native-async-storage",
    "async-storage",
    "android",
    "src",
    "main",
    "AndroidManifest.xml",
  ),
];

let patchedCount = 0;

for (const filePath of targets) {
  if (!fs.existsSync(filePath)) {
    continue;
  }

  const original = fs.readFileSync(filePath, "utf8");
  const patched = original.replace(/\s*package="[^"]*"/, "");

  if (patched !== original) {
    fs.writeFileSync(filePath, patched, "utf8");
    patchedCount += 1;
  }
}

if (patchedCount > 0) {
  // Keep output terse; it's only for debugging installs.
  console.log(`[patch-android-manifests] Patched ${patchedCount} file(s).`);
}
