import { mkdir } from "node:fs/promises";
import { dirname } from "node:path";
import { MESS_MENU } from "../src/data/mess";

const outputPath = process.argv[2];

if (!outputPath) {
  throw new Error("Pass the generated Wear OS mess-menu JSON output path.");
}

await mkdir(dirname(outputPath), { recursive: true });
await Bun.write(outputPath, `${JSON.stringify(MESS_MENU, null, 2)}\n`);
