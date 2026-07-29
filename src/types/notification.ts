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
