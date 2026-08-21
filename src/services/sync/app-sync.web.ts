import { parseDashboardPayload } from "@/services/dashboard";
import { syncDashboardNotifications } from "@/services/dashboard-notifications";
import {
  syncAttendanceFromPayload,
  type AttendanceSyncPayload,
} from "@/services/attendance/attendance-sync";
import { syncPortalNotificationsFromPage } from "@/services/attendance/portal-notification-sync";
import { portalNotificationsSchema } from "@/services/attendance/attendance-schemas";
import { parseCoursesPayload } from "@/services/lms-courses";
import { useAttendanceStore } from "@/stores/attendance-store";
import { useDashboardStore } from "@/stores/dashboard-store";
import { useSettingsStore } from "@/stores/settings-store";
import type { CourseAttendance, PortalNotificationPage } from "@/types";

interface FullSyncPayload {
  attendance: {
    notifications: unknown;
    sessions: Record<string, unknown>;
    summary: unknown;
    terms: unknown;
  } | null;
  lms: {
    courses: unknown;
    timeline: unknown;
  } | null;
}

const isFullSyncPayload = (value: unknown): value is FullSyncPayload => {
  if (typeof value !== "object" || value === null) return false;
  const payload = value as Record<string, unknown>;
  return "lms" in payload && "attendance" in payload;
};

const requestFullSync = async (): Promise<FullSyncPayload> => {
  const response = await fetch("/api/sync", {
    credentials: "same-origin",
    headers: { Accept: "application/json" },
    method: "POST",
  });
  if (!response.ok) {
    throw new Error(`Full sync failed (${response.status})`);
  }
  const payload: unknown = await response.json();
  if (!isFullSyncPayload(payload)) throw new Error("Invalid full sync response");
  return payload;
};

const fulfilled = (): PromiseSettledResult<unknown> => ({
  status: "fulfilled",
  value: undefined,
});

const rejected = (reason: unknown): PromiseSettledResult<unknown> => ({
  reason,
  status: "rejected",
});

export interface AppSyncResult {
  attendance: PromiseSettledResult<unknown>;
  lms: PromiseSettledResult<unknown>;
  notifications: PromiseSettledResult<unknown>;
}

export const syncAppData = async (options?: {
  silent?: boolean;
  source?: "foreground" | "background";
}): Promise<AppSyncResult> => {
  const source = options?.source ?? "foreground";
  const silent = options?.silent ?? false;
  try {
    const payload = await requestFullSync();
    if (!payload.lms) throw new Error("Could not restore LMS session");

    const { overdue, upcoming } = parseDashboardPayload(payload.lms.timeline);
    const settings = useSettingsStore.getState();
    await syncDashboardNotifications({
      notificationsEnabled: settings.notificationsEnabled,
      reminderMinutes: settings.reminders,
      source,
      upcomingEvents: upcoming,
    });
    useDashboardStore.setState((state) => ({
      error: null,
      events: [...overdue, ...upcoming],
      isLoading: silent ? state.isLoading : false,
      lastSyncTime: Date.now(),
      overdueEvents: overdue,
      upcomingEvents: upcoming,
    }));
    useDashboardStore.getState().addLog(
      `Synced ${upcoming.length} upcoming, ${overdue.length} overdue (${source})`,
      "success",
    );

    if (payload.attendance) {
      const attendancePayload: AttendanceSyncPayload = {
        attendance: payload.attendance.summary,
        lmsCourses: parseCoursesPayload(payload.lms.courses),
        sessions: payload.attendance.sessions,
        terms: payload.attendance.terms,
      };
      const previousCourses = useAttendanceStore.getState().courses;
      const result = syncAttendanceFromPayload(previousCourses, attendancePayload);
      const courses: CourseAttendance[] = result.complete;
      useAttendanceStore.setState({
        courses,
        error: null,
        isLoading: silent ? useAttendanceStore.getState().isLoading : false,
        lastSyncTime: Date.now(),
      });

      if (payload.attendance.notifications !== null) {
        const page: PortalNotificationPage = portalNotificationsSchema.parse(
          payload.attendance.notifications,
        );
        await syncPortalNotificationsFromPage(page);
      }
      return {
        attendance: fulfilled(),
        lms: fulfilled(),
        notifications: fulfilled(),
      };
    }

    return {
      attendance: fulfilled(),
      lms: fulfilled(),
      notifications: fulfilled(),
    };
  } catch (error) {
    const failure = rejected(error);
    useDashboardStore.setState({
      error: error instanceof Error ? error.message : "Full sync failed",
      isLoading: false,
    });
    return { attendance: failure, lms: failure, notifications: failure };
  }
};
