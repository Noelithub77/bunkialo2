import { MESS_MENU } from "../src/data/mess";

const target = `${import.meta.dir}/../omarchy-plugin/data/mess-menu.json`;

await Bun.write(target, `${JSON.stringify(MESS_MENU, null, 2)}\n`);
console.log(`Exported ${MESS_MENU.length} mess days to ${target}`);
