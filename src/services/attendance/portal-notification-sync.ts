import { usePortalNotificationStore } from "@/stores/portal-notification-store";
import { useSettingsStore } from "@/stores/settings-store";
import { useAttendanceStore } from "@/stores/attendance-store";
import {
  ensureNotificationChannels,
  hasNotificationPermissions,
  sendImmediateNotification,
} from "@/utils/notifications";
import type { PortalNotificationPage } from "@/types";
import { getPortalNotifications } from "./attendance-api";
import { isNotificationRecent } from "@/utils/notification-inbox";
import { presentPortalNotification } from "@/utils/portal-notification";

let inFlight: Promise<void> | null = null;
let queue: Promise<void> = Promise.resolve();

export const syncPortalNotificationsFromPage = (
  page: PortalNotificationPage,
): Promise<void> => {
  const sync = async () => {
    if (!usePortalNotificationStore.persist.hasHydrated())
      await usePortalNotificationStore.persist.rehydrate();
    if (!useSettingsStore.persist.hasHydrated())
      await useSettingsStore.persist.rehydrate();
    const recentItems = page.items.filter((item) =>
      isNotificationRecent(item.createdAt),
    );
    const before = usePortalNotificationStore.getState();
    const unseen = before.hasBaseline
      ? recentItems.filter(
          (item) =>
            !item.readAt &&
            !before.fetchedIds.includes(item.id) &&
            !before.deliveredIds.includes(item.id) &&
            before.dismissedAtById[item.id] === undefined,
        )
      : [];
    before.setFetched(recentItems);
    await usePortalNotificationStore.getState().flushPendingReads();
    if (!useSettingsStore.getState().notificationsEnabled) {
      before.setPendingDeliveryIds([]);
      return;
    }
    before.setPendingDeliveryIds([
      ...usePortalNotificationStore.getState().pendingDeliveryIds,
      ...unseen.map((item) => item.id),
    ]);
    if (!(await hasNotificationPermissions())) return;
    await ensureNotificationChannels([
      { id: "attendance", name: "Attendance" },
    ]);
    const current = usePortalNotificationStore.getState();
    const pending = current.items
      .filter(
        (item) =>
          current.pendingDeliveryIds.includes(item.id) &&
          !current.deliveredIds.includes(item.id) &&
          !item.readAt,
      )
      .sort(
        (a, b) =>
          Date.parse(a.createdAt) - Date.parse(b.createdAt) ||
          a.id.localeCompare(b.id),
      );
    for (const item of pending) {
      await sendImmediateNotification({
        identifier: `attendance-portal-${item.id}`,
        ...presentPortalNotification(
          item,
          useAttendanceStore.getState().courses,
        ),
        channelId: "attendance",
        data: {
          source: "attendancePortal",
          notificationId: item.id,
          route: "/attendance",
        },
      });
      // Save each successful delivery immediately; failures remain pending.
      usePortalNotificationStore.getState().addDeliveredIds([item.id]);
    }
  };
  const next = queue.then(sync, sync);
  queue = next.catch(() => undefined);
  return next;
};

export const syncPortalNotifications = (): Promise<void> => {
  if (inFlight) return inFlight;
  inFlight = getPortalNotifications()
    .then(syncPortalNotificationsFromPage)
    .finally(() => {
      inFlight = null;
    });
  return inFlight;
};
