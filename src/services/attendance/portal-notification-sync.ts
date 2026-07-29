import { usePortalNotificationStore } from "@/stores/portal-notification-store";
import { useSettingsStore } from "@/stores/settings-store";
import {
  hasNotificationPermissions,
  sendImmediateNotification,
} from "@/utils/notifications";
import { getPortalNotifications } from "./attendance-api";

export const syncPortalNotifications = async (): Promise<void> => {
  const page = await getPortalNotifications();
  const store = usePortalNotificationStore.getState();
  const isBaseline = !store.hasBaseline;
  const unseen = page.items.filter(
    (item) =>
      !store.fetchedIds.includes(item.id) &&
      !store.deliveredIds.includes(item.id),
  );

  store.setFetched(page.items);
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
