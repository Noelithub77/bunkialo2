import { useSettingsStore } from "@/stores/settings-store";
import type { TimelineEvent } from "@/types";
import { tryAutoLogin } from "./auth/lms-auth";
import { syncDashboardNotifications } from "./dashboard-notifications";
import { fetchDashboardEvents } from "./dashboard";

export type DashboardSyncSource = "foreground" | "background";

export type DashboardSyncResult = {
  newUpcomingEvents: TimelineEvent[];
  overdue: TimelineEvent[];
  syncedAt: number;
  upcoming: TimelineEvent[];
};

export const runDashboardSync = async ({
  source,
}: {
  source: DashboardSyncSource;
}): Promise<DashboardSyncResult> => {
  const sessionReady = await tryAutoLogin();
  if (!sessionReady) {
    throw new Error("Could not restore LMS session");
  }

  const { upcoming, overdue } = await fetchDashboardEvents();
  const settings = useSettingsStore.getState();

  const { newUpcomingEvents } = await syncDashboardNotifications({
    notificationsEnabled: settings.notificationsEnabled,
    reminderMinutes: settings.reminders,
    source,
    upcomingEvents: upcoming,
  });

  return {
    newUpcomingEvents,
    overdue,
    syncedAt: Date.now(),
    upcoming,
  };
};
