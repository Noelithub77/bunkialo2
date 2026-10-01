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
        await fs.writeFile(
          file,
          xml.replace(
            'android:updatePeriodMillis="0"',
            'android:updatePeriodMillis="1800000"',
          ),
        );
      }
      return config;
    },
  ]);
