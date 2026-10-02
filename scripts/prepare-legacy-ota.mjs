import { execFileSync } from "node:child_process";
import { mkdirSync, copyFileSync, existsSync, readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";

// SDK 54 source with the native dependency contract of production build 59.
// Never copy SDK 58 navigation, sharing, widgets, configuration or dependencies.
const source = "7f814bc5c2145587f6013b035f01d2e1af3e1c6c";
const nativeBase = "704e68c444b5421892d94dfdaa1a18d7fe748f14";
const destination = resolve(process.argv[2] ?? "artifacts/legacy-ota/project");
if (existsSync(resolve(destination, "app.config.ts"))) {
  throw new Error(
    "Destination must be empty; refusing to overwrite a prepared project",
  );
}
mkdirSync(destination, { recursive: true });
const archive = execFileSync("git", ["archive", source], {
  maxBuffer: 100 * 1024 * 1024,
});
execFileSync("tar", ["-x", "-C", destination], { input: archive });
// expo-device was added after build 59. Keep the original login to avoid requiring it.
const login = execFileSync("git", ["show", `${nativeBase}:src/app/login.tsx`]);
execFileSync("git", ["rev-parse", "--verify", nativeBase]);
const { writeFileSync } = await import("node:fs");
writeFileSync(resolve(destination, "src/app/login.tsx"), login);
const files = [
  "src/app/(tabs)/faculty.tsx",
  "src/components/faculty/faculty-card.tsx",
  "src/data/faculty.ts",
  "src/data/hostels.ts",
  "src/stores/hostel-preference-store.ts",
  "src/types/faculty.ts",
  "src/types/academic-calendar.ts",
  "src/utils/academic-event-visibility.ts",
  "src/services/academic-calendar-feed.ts",
  "src/services/dashboard-notifications.ts",
  "src/stores/academic-calendar-feed-store.ts",
  "src/components/dashboard/academic-event-card.tsx",
  "src/components/dashboard/timeline-section.tsx",
  "tests/unit/services/google-calendar-feed.test.ts",
  "tests/unit/utils/academic-event-visibility.test.ts",
  "tests/unit/faculty-hostels.test.ts",
];
for (const file of files) {
  mkdirSync(dirname(resolve(destination, file)), { recursive: true });
  copyFileSync(file, resolve(destination, file));
}
for (const file of ["package.json", "bun.lock"]) {
  copyFileSync(resolve("scripts/legacy-ota", file), resolve(destination, file));
}
const basePackage = JSON.parse(
  execFileSync("git", ["show", `${nativeBase}:package.json`], {
    encoding: "utf8",
  }),
);
const legacyPackage = JSON.parse(
  readFileSync(resolve(destination, "package.json"), "utf8"),
);
for (const section of ["dependencies", "devDependencies"]) {
  const expected = { ...basePackage[section] };
  if (section === "dependencies") expected["ical.js"] = "2.2.1"; // pure JS calendar parser
  if (
    JSON.stringify(Object.entries(expected).sort()) !==
    JSON.stringify(Object.entries(legacyPackage[section]).sort())
  ) {
    throw new Error(
      `Legacy ${section} changed the build 59 dependency contract`,
    );
  }
}
if (
  legacyPackage.version !== "1.4.1" ||
  !legacyPackage.dependencies.expo.startsWith("~54.")
) {
  throw new Error("Expected SDK 54 runtime 1.4.1");
}
const webGradient = resolve(
  destination,
  "src/components/shared/ui/organisms/grainy-gradient/index.web.tsx",
);
writeFileSync(
  webGradient,
  readFileSync(webGradient, "utf8")
    .replace("import { View }", "import { View, type ViewStyle }")
    .replace(
      'backgroundImage: `linear-gradient(135deg, ${stops.join(", ")})`,',
      '...({ backgroundImage: `linear-gradient(135deg, ${stops.join(", ")})` } as ViewStyle & { backgroundImage: string }),',
    ),
);
console.log(`Prepared SDK 54 / runtime 1.4.1 at ${destination}`);
