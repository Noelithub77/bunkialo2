import * as Notifications from "expo-notifications";
import { Platform } from "react-native";
import { zustandStorage } from "@/stores/storage";
import type { NotificationChannelConfig } from "./notifications.types";

const NOTIFICATION_PERMISSIONS_ASKED = "notification_permissions_asked";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export const ensureNotificationChannels = async (
  channels: NotificationChannelConfig[],
): Promise<void> => {
  if (Platform.OS !== "android") {
    return;
  }

  await Promise.all(
    channels.map((channel) =>
      Notifications.setNotificationChannelAsync(channel.id, {
        name: channel.name,
        importance: Notifications.AndroidImportance.HIGH,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: channel.lightColor ?? "#FF231F7C",
      }),
    ),
  );
};

export const hasNotificationPermissions = async (): Promise<boolean> => {
  const { status } = await Notifications.getPermissionsAsync();
  return status === "granted";
};

export const requestNotificationPermissions = async (): Promise<boolean> => {
  await ensureNotificationChannels([{ id: "default", name: "Default" }]);

  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  if (existingStatus !== "granted") {
    const { status } = await Notifications.requestPermissionsAsync({
      ios: {
        allowAlert: true,
        allowBadge: true,
        allowSound: true,
      },
    });
    finalStatus = status;
  }

  return finalStatus === "granted";
};

export const initializeNotifications = async (): Promise<void> => {
  await ensureNotificationChannels([
    { id: "default", name: "Default" },
    { id: "attendance", name: "Attendance updates" },
  ]);

  const hasAsked = await zustandStorage.getItem(NOTIFICATION_PERMISSIONS_ASKED);
  if (hasAsked) {
    return;
  }

  await requestNotificationPermissions();
  await zustandStorage.setItem(NOTIFICATION_PERMISSIONS_ASKED, "true");
};

export const scheduleDateNotification = async (params: {
  body: string;
  channelId?: string;
  data?: Record<string, unknown>;
  date: Date | number;
  title: string;
}): Promise<string> => {
  return Notifications.scheduleNotificationAsync({
    content: {
      title: params.title,
      body: params.body,
      data: params.data,
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DATE,
      date: params.date,
      channelId: params.channelId,
    },
  });
};

export const sendImmediateNotification = async (params: {
  body: string;
  channelId?: string;
  data?: Record<string, unknown>;
  title: string;
}): Promise<string> => {
  return Notifications.scheduleNotificationAsync({
    content: {
      title: params.title,
      body: params.body,
      data: params.data,
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
      seconds: 1,
      channelId: params.channelId,
    },
  });
};

export const cancelNotificationRequests = async (
  notificationIds: string[],
): Promise<void> => {
  await Promise.all(
    notificationIds.map((id) =>
      Notifications.cancelScheduledNotificationAsync(id),
    ),
  );
};

export const cancelAllNotifications = async (): Promise<void> => {
  await Notifications.cancelAllScheduledNotificationsAsync();
};

export const requestNotificationPermissionsWithExplanation =
  async (): Promise<boolean> => {
    return requestNotificationPermissions();
  };
