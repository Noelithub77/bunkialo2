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
  "src/hooks/use-lms-attachment-scope.ts",
  "src/app/lms-file.tsx",
  "src/app/lms-forum.tsx",
  "src/app/course/[courseid].tsx",
  "src/components/lms/attachment-card.tsx",
  "src/components/lms/attachment-zoom.tsx",
  "src/components/lms/attachment-zoom.native.tsx",
  "src/components/lms/attachment-zoom.web.tsx",
  "src/services/attachment-preview.ts",
  "src/services/attachment-preview.web.ts",
  "src/services/saved-lms-files.ts",
  "src/services/saved-lms-files.web.ts",
  "src/services/lms-download.ts",
  "src/services/lms-download.web.ts",
  "src/services/open-lms-file.ts",
  "src/services/open-lms-file.web.ts",
  "src/services/lms-forum.ts",
  "src/services/resources-scraper.ts",
  "src/stores/saved-lms-file-store.ts",
  "src/stores/lms-forum-store.ts",
  "src/types/attachment-preview.ts",
  "src/types/saved-lms-file.ts",
  "src/types/lms-download.ts",
  "src/types/lms-forum.ts",
  "src/types/resources.ts",
  "src/utils/attachment-preview.ts",
  "src/utils/lms-forum.ts",
  "tests/unit/utils/attachment-preview.test.ts",
  "tests/unit/utils/lms-forum.test.ts",

  "src/background/dashboard-background.ts",
  "src/background/wifix-background.ts",
  "src/stores/wifix-store.ts",
  "src/background/index.ts",
  "src/background/portal-notification-background.ts",
  "src/background/portal-notification-background.web.ts",
  "src/components/dashboard/notices-modal.tsx",
  "src/components/dashboard/notification-inbox-controls.tsx",
  "src/components/dashboard/notification-list-item.tsx",
  "src/components/dashboard/notification-read-content.tsx",
  "src/components/dashboard/notification-read-content.web.tsx",
  "src/components/settings/dashboard-settings-section.tsx",
  "src/components/sync/app-sync-controller.tsx",
  "src/components/sync/calendar-notification-controller.tsx",
  "src/constants/dashboard.ts",
  "src/constants/portal-notifications.ts",
  "src/services/attendance/portal-notification-sync.ts",
  "src/services/calendar-notification-sync.ts",
  "src/stores/portal-notification-store.ts",
  "src/types/notification.ts",
  "src/utils/notification-inbox.ts",
  "src/utils/portal-notification.ts",
  "src/utils/calendar-reminders.ts",
  "src/utils/battery-settings.ts",
  "src/utils/notifications.ts",
  "src/utils/notifications.web.ts",
  "tests/unit/notifications/portal-sync.test.ts",
  "tests/unit/notifications/presentation-reminders.test.ts",

  "src/app/(tabs)/faculty.tsx",
  "src/app/course/[courseid]/assignment/[assignmentid].tsx",
  "src/services/assignment.ts",
  "src/stores/assignment-store.ts",
  "src/types/assignment.ts",
  "src/utils/upload-progress.ts",
  "src/utils/assignment-share.ts",
  "src/utils/assignment-presentation.ts",
  "src/utils/timetable-inference.ts",
  "src/components/timetable/day-schedule.tsx",
  "src/components/timetable/upnext-carousel.tsx",
  "src/components/ui/search-input.tsx",
  "tests/unit/utils/timetable-inference.test.ts",
  "src/utils/scheduling.ts",
  "tests/unit/services/assignment.test.ts",
  "tests/unit/utils/assignment-presentation.test.ts",
  "src/components/faculty/faculty-image-viewer.tsx",
  "src/components/faculty/faculty-image-viewer.native.tsx",
  "src/components/faculty/faculty-image-viewer.web.tsx",
  "src/components/faculty/faculty-image-viewer.types.ts",
  "src/app/faculty/[id].tsx",
  "src/hooks/use-faculty-photo.ts",
  "src/services/faculty-photo-cache.ts",
  "src/services/faculty-photo-cache.web.ts",
  "src/stores/faculty-photo-cache-store.ts",
  "src/utils/faculty-photo-cache.ts",
  "tests/unit/utils/faculty-photo-cache.test.ts",
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

const rootLayout = resolve(destination, "src/app/_layout.tsx");
const rootSource = readFileSync(rootLayout, "utf8");
if (!rootSource.includes("export default function RootLayout() {"))
  throw new Error("Legacy root layout hook anchor missing");
writeFileSync(
  rootLayout,
  `import { CalendarNotificationController } from "@/components/sync/calendar-notification-controller";\nimport { useFacultyPhotoCaching } from "@/hooks/use-faculty-photo";\n` +
    rootSource
      .replace(
        "<AppSyncController />",
        "<AppSyncController /><CalendarNotificationController />",
      )
      .replace(
        "export default function RootLayout() {",
        "export default function RootLayout() {\n  useFacultyPhotoCaching();",
      ),
);

const typeIndex = resolve(destination, "src/types/index.ts");
writeFileSync(
  typeIndex,
  readFileSync(typeIndex, "utf8") +
    '\nexport * from "./attachment-preview";\nexport * from "./saved-lms-file";\nexport * from "./lms-forum";\n',
);
