import type { NotificationChannelConfig } from "./notifications.types";
import { z } from "zod";

const publicKeySchema = z.object({ publicKey: z.string().min(1) });
const statusSchema = z.object({ subscribed: z.boolean() });

const base64UrlToBytes = (value: string): ArrayBuffer => {
  const base64 = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, "=");
  const decoded = atob(padded);
  const buffer = new ArrayBuffer(decoded.length);
  const bytes = new Uint8Array(buffer);
  for (let index = 0; index < decoded.length; index += 1) {
    bytes[index] = decoded.charCodeAt(index);
  }
  return buffer;
};

const getRegistration = async (): Promise<ServiceWorkerRegistration> => {
  if (!("serviceWorker" in navigator)) throw new Error("Service workers are unavailable.");
  return navigator.serviceWorker.ready;
};

const saveSubscription = async (
  subscription: PushSubscription,
): Promise<void> => {
  const response = await fetch("/api/push/subscription", {
    body: JSON.stringify(subscription.toJSON()),
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    method: "POST",
  });
  if (!response.ok) throw new Error("Could not save the push subscription.");
};

const ensurePushSubscription = async (): Promise<boolean> => {
  if (!("PushManager" in globalThis) || Notification.permission !== "granted") return false;
  const registration = await getRegistration();
  const existing = await registration.pushManager.getSubscription();
  if (existing) {
    await saveSubscription(existing);
    return true;
  }
  const keyResponse = await fetch("/api/push/key", { credentials: "same-origin" });
  if (!keyResponse.ok) return false;
  const { publicKey } = publicKeySchema.parse(await keyResponse.json());
  const subscription = await registration.pushManager.subscribe({
    applicationServerKey: base64UrlToBytes(publicKey),
    userVisibleOnly: true,
  });
  await saveSubscription(subscription);
  return true;
};

export const ensureNotificationChannels = async (
  _channels: NotificationChannelConfig[],
): Promise<void> => undefined;

export const hasNotificationPermissions = async (): Promise<boolean> => {
  if (!("Notification" in globalThis) || Notification.permission !== "granted") return false;
  try {
    const response = await fetch("/api/push/status", { credentials: "same-origin" });
    return response.ok && statusSchema.parse(await response.json()).subscribed;
  } catch {
    return false;
  }
};

export const requestNotificationPermissions = async (): Promise<boolean> => {
  if (!("Notification" in globalThis) || !("serviceWorker" in navigator)) return false;
  const permission = Notification.permission === "default"
    ? await Notification.requestPermission()
    : Notification.permission;
  return permission === "granted" && (await ensurePushSubscription());
};

export const initializeNotifications = async (): Promise<void> => {
  if ("Notification" in globalThis && Notification.permission === "granted") {
    await ensurePushSubscription();
  }
};

export const scheduleDateNotification = async (params: {
  body: string;
  channelId?: string;
  data?: Record<string, unknown>;
  date: Date | number;
  title: string;
}): Promise<string> => {
  const id = crypto.randomUUID();
  const date = typeof params.date === "number" ? params.date : params.date.getTime();
  const response = await fetch("/api/push/reminders", {
    body: JSON.stringify({ body: params.body, date, id, title: params.title, url: "/" }),
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    method: "POST",
  });
  if (!response.ok) throw new Error("Could not schedule the web reminder.");
  return id;
};

export const sendImmediateNotification = async (params: {
  body: string;
  channelId?: string;
  data?: Record<string, unknown>;
  title: string;
}): Promise<string> => scheduleDateNotification({ ...params, date: Date.now() + 1000 });

export const cancelNotificationRequests = async (
  notificationIds: string[],
): Promise<void> => {
  await Promise.all(
    notificationIds.map((id) =>
      fetch(`/api/push/reminders/${encodeURIComponent(id)}`, {
        credentials: "same-origin",
        method: "DELETE",
      }),
    ),
  );
};

export const cancelAllNotifications = async (): Promise<void> => {
  await fetch("/api/push/reminders", { credentials: "same-origin", method: "DELETE" });
};

export const requestNotificationPermissionsWithExplanation = requestNotificationPermissions;
