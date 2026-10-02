import { useEffect } from "react";
import { AppState } from "react-native";
import { syncDashboardNotifications } from "@/services/dashboard-notifications";
import { useAcademicCalendarStore } from "@/stores/academic-calendar-store";
import { useAcademicCalendarFeedStore } from "@/stores/academic-calendar-feed-store";
import { useAuthStore } from "@/stores/auth-store";
import { useDashboardStore } from "@/stores/dashboard-store";
import { useSettingsStore } from "@/stores/settings-store";

export function CalendarNotificationController() {
  const loggedIn = useAuthStore((state) => state.isLoggedIn);
  const overrides = useAcademicCalendarStore((state) => state.overrides);
  const custom = useAcademicCalendarStore((state) => state.customEvents);
  const feed = useAcademicCalendarFeedStore((state) => state.googleEvents);
  const upcoming = useDashboardStore((state) => state.upcomingEvents);
  const enabled = useSettingsStore((state) => state.notificationsEnabled);
  const minutes = useSettingsStore((state) => state.reminders);
  useEffect(() => {
    if (!loggedIn) return;
    const sync = async () => {
      if (!useAcademicCalendarStore.persist.hasHydrated() || !useAcademicCalendarFeedStore.persist.hasHydrated() || !useDashboardStore.persist.hasHydrated() || !useSettingsStore.persist.hasHydrated()) return;
      await syncDashboardNotifications({ notificationsEnabled: enabled, reminderMinutes: minutes, source: "foreground", upcomingEvents: upcoming });
    };
    const run = () => void sync().catch((error: unknown) => console.warn("Calendar reminders could not sync", error instanceof Error ? error.message : "Unknown error"));
    const timer = setTimeout(run, 300);
    const hydrated = [
      useAcademicCalendarStore.persist.onFinishHydration(run),
      useAcademicCalendarFeedStore.persist.onFinishHydration(run),
      useDashboardStore.persist.onFinishHydration(run),
      useSettingsStore.persist.onFinishHydration(run),
    ];
    const subscription = AppState.addEventListener("change", (state) => { if (state === "active") run(); });
    return () => { clearTimeout(timer); subscription.remove(); hydrated.forEach((unsubscribe) => unsubscribe()); };
  }, [loggedIn, overrides, custom, feed, upcoming, enabled, minutes]);
  return null;
}
