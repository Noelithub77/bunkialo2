import { usePortalNotificationStore } from "@/stores/portal-notification-store";
import { useSettingsStore } from "@/stores/settings-store";
import {
  hasNotificationPermissions,
  sendImmediateNotification,
} from "@/utils/notifications";
import type { PortalNotificationPage } from "@/types";
import { getPortalNotifications } from "./attendance-api";
import { isNotificationRecent } from "@/utils/notification-inbox";

export const syncPortalNotificationsFromPage = async (
  page: PortalNotificationPage,
): Promise<void> => {
  const recentItems = page.items.filter((item) =>
    isNotificationRecent(item.createdAt),
  );
  const store = usePortalNotificationStore.getState();
  const isBaseline = !store.hasBaseline;
  const unseen = recentItems.filter(
    (item) =>
      !store.fetchedIds.includes(item.id) &&
      !store.deliveredIds.includes(item.id) &&
      store.dismissedAtById[item.id] === undefined,
  );

  store.setFetched(recentItems);
  if (isBaseline || unseen.length === 0) return;
  if (!useSettingsStore.getState().notificationsEnabled) return;
  if (!(await hasNotificationPermissions())) return;

  const delivered: string[] = [];
  for (const item of unseen) {
    await sendImmediateNotification({
      title: item.title,
      body: item.body,
      channelId: "attendance",
      data: { source: "attendancePortal", notificationId: item.id },
    });
    delivered.push(item.id);
  }
  usePortalNotificationStore.getState().addDeliveredIds(delivered);
};

export const syncPortalNotifications = async (): Promise<void> => {
  await syncPortalNotificationsFromPage(await getPortalNotifications());
};
