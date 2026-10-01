import { isRunningInExpoGo } from "expo";
import { requireOptionalNativeModule } from "expo-modules-core";
import { Platform } from "react-native";
import WidgetRefresh from "../../modules/widget-refresh";
import { useAuthStore } from "@/stores/auth-store";
import { useBunkStore } from "@/stores/bunk-store";
import { useTimetableStore } from "@/stores/timetable-store";
import {
  buildMessWidgetProps,
  buildTimetableWidgetProps,
  getWidgetBoundaries,
  getWidgetTimelineDates,
} from "./data";

export async function syncHomeWidgets(): Promise<void> {
  if (isRunningInExpoGo() || !requireOptionalNativeModule("ExpoWidgets")) return;
  const bunk = useBunkStore.getState();
  const timetable = useTimetableStore.getState();
  const auth = useAuthStore.getState();
  if (
    !bunk.hasHydrated ||
    !useTimetableStore.persist.hasHydrated() ||
    auth.isCheckingAuth
  )
    return;
  const classes = buildTimetableWidgetProps(
    auth.isLoggedIn ? timetable.slots : [],
    bunk.courses,
    bunk.hiddenCourses,
  );
  const meals = buildMessWidgetProps();
  const [timetableWidget, messWidget] =
    Platform.OS === "ios"
      ? await Promise.all([import("./timetable.ios"), import("./mess.ios")])
      : await Promise.all([
          import("./timetable.android"),
          import("./mess.android"),
        ]);
  if (Platform.OS === "ios") {
    timetableWidget.default.updateTimeline(
      getWidgetTimelineDates(classes.cards).map((date) => ({
        date,
        props: classes,
      })),
    );
    messWidget.default.updateTimeline(
      getWidgetTimelineDates(meals.cards).map((date) => ({
        date,
        props: meals,
      })),
    );
  } else {
    timetableWidget.default.updateSnapshot(classes);
    messWidget.default.updateSnapshot(meals);
    await WidgetRefresh?.setSchedule(
      getWidgetBoundaries([...classes.cards, ...meals.cards]),
    );
  }
}
