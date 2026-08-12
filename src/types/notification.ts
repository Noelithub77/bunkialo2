import type { ImageSourcePropType } from "react-native";

export interface PortalNotification {
  id: string;
  title: string;
  body: string;
  kind: string;
  link: string | null;
  createdAt: string;
  readAt: string | null;
}

export interface PortalNotificationPage {
  unreadCount: number;
  items: PortalNotification[];
}

export type NotificationConcern = "all" | "attendance" | "app";
export type NotificationPriority = "important" | "normal";
export type NotificationPriorityFilter = "all" | NotificationPriority;
export type NotificationReadFilter = "all" | "unread" | "read";

export type NotificationInboxAction =
  | { type: "openUrl"; label: string; url: string }
  | { type: "runPopupAction"; label: string; noticeId: string };

export interface NotificationInboxItem {
  id: string;
  sourceId: string;
  source: Exclude<NotificationConcern, "all">;
  priority: NotificationPriority;
  title: string;
  body: string;
  createdAt: string;
  isRead: boolean;
  imageSource?: ImageSourcePropType;
  action?: NotificationInboxAction;
}
