import { cp, mkdir, writeFile } from "node:fs/promises";
const output = new URL("../public/pdf-preview/", import.meta.url);
const root = new URL("../node_modules/pdfjs-dist/", import.meta.url);
await mkdir(output, { recursive: true });
await Promise.all([
  cp(new URL("legacy/build/pdf.mjs", root), new URL("pdf.mjs", output)),
  cp(
    new URL("legacy/build/pdf.worker.mjs", root),
    new URL("pdf.worker.mjs", output),
  ),
  ...["cmaps", "standard_fonts", "wasm"].map((name) =>
    cp(new URL(name + "/", root), new URL(name + "/", output), {
      recursive: true,
    }),
  ),
]);
await writeFile(
  new URL("loader.mjs", output),
  'import * as api from "./pdf.mjs"; window.__bunkialoPdfApi = api;\n',
);
