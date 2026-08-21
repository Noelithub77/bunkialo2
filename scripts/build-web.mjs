import { copyFile, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { injectManifest } from "workbox-build";

const run = (command, args) => {
  const executable = process.platform === "win32" ? `${command}.exe` : command;
  const result = spawnSync(executable, args, { stdio: "inherit" });
  if (result.status !== 0) {
    throw new Error(`${command} ${args.join(" ")} failed`);
  }
};

run("bunx", ["expo", "export", "--platform", "web", "--output-dir", "dist"]);

await mkdir("dist/icons", { recursive: true });
await Promise.all([
  copyFile("src/assets/images/favicon.png", "dist/icons/icon-192.png"),
  copyFile("src/assets/images/icon.png", "dist/icons/icon-512.png"),
]);

const indexPath = "dist/index.html";
const indexHtml = await readFile(indexPath, "utf8");
const pwaHead = [
  '<meta name="theme-color" content="#ffab00" />',
  '<meta name="apple-mobile-web-app-capable" content="yes" />',
  '<meta name="apple-mobile-web-app-status-bar-style" content="black" />',
  '<link rel="manifest" href="/manifest.webmanifest" />',
  '<link rel="apple-touch-icon" href="/icons/icon-192.png" />',
].join("");
await writeFile(indexPath, indexHtml.replace("</head>", `${pwaHead}</head>`));

const temporaryWorker = "dist/service-worker-source.js";
run("bun", [
  "build",
  "service-worker.ts",
  "--outfile",
  temporaryWorker,
  "--target",
  "browser",
]);

await injectManifest({
  globDirectory: "dist",
  globPatterns: ["**/*.{css,html,ico,js,json,png,svg,wasm,webmanifest}"],
  globIgnores: ["service-worker-source.js", "service-worker.js"],
  maximumFileSizeToCacheInBytes: 8 * 1024 * 1024,
  injectionPoint: "serviceWorker.__WB_MANIFEST",
  swSrc: temporaryWorker,
  swDest: "dist/service-worker.js",
});

await rm(temporaryWorker, { force: true });
