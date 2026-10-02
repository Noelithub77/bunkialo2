import { syncDashboardNotifications } from "@/services/dashboard-notifications";
import { useAcademicCalendarStore } from "@/stores/academic-calendar-store";
import { useAcademicCalendarFeedStore } from "@/stores/academic-calendar-feed-store";
import { useDashboardStore } from "@/stores/dashboard-store";
import { useSettingsStore } from "@/stores/settings-store";

export const refreshCalendarNotifications = async (refreshFeed = false): Promise<void> => {
  await Promise.all([
    useAcademicCalendarStore.persist.rehydrate(),
    useAcademicCalendarFeedStore.persist.rehydrate(),
    useDashboardStore.persist.rehydrate(),
    useSettingsStore.persist.rehydrate(),
  ]);
  if (refreshFeed) await useAcademicCalendarFeedStore.getState().fetchGoogleEvents(true);
  const settings = useSettingsStore.getState();
  await syncDashboardNotifications({
    notificationsEnabled: settings.notificationsEnabled,
    reminderMinutes: settings.reminders,
    source: "foreground",
    upcomingEvents: useDashboardStore.getState().upcomingEvents,
  });
};

