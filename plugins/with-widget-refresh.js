const { withDangerousMod } = require("expo/config-plugins");
const fs = require("node:fs/promises");
const path = require("node:path");

module.exports = (config) =>
  withDangerousMod(config, [
    "android",
    async (config) => {
      const root = path.join(
        config.modRequest.platformProjectRoot,
        "app/src/main/res/xml",
      );
      for (const name of [
        "bunkialo_timetable_info.xml",
        "bunkialo_mess_info.xml",
      ]) {
        const file = path.join(root, name);
        const xml = await fs.readFile(file, "utf8");
        const period = /android:updatePeriodMillis\s*=\s*["']\d+["']/;
        if (!period.test(xml)) {
          throw new Error(`Widget refresh interval missing in ${name}`);
        }
        await fs.writeFile(
          file,
          xml.replace(period, 'android:updatePeriodMillis="1800000"'),
        );
      }
      return config;
    },
  ]);
