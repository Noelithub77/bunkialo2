import {
  markAllPortalNotificationsRead,
  markPortalNotificationRead,
} from "@/services/attendance/attendance-api";
import type { PortalNotification } from "@/types";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { zustandStorage } from "./storage";
import {
  isNotificationRecent,
  NOTIFICATION_RETENTION_MS,
} from "@/utils/notification-inbox";

const pruneDismissedIds = (
  dismissedAtById: Record<string, number>,
  now: number,
): Record<string, number> =>
  Object.fromEntries(
    Object.entries(dismissedAtById).filter(
      ([, dismissedAt]) => dismissedAt >= now - NOTIFICATION_RETENTION_MS,
    ),
  );

interface PortalNotificationState {
  items: PortalNotification[];
  fetchedIds: string[];
  deliveredIds: string[];
  dismissedAtById: Record<string, number>;
  hasBaseline: boolean;
  setFetched: (items: PortalNotification[]) => void;
  addDeliveredIds: (ids: string[]) => void;
  dismiss: (ids: string[]) => void;
  pruneExpired: () => void;
  markRead: (id: string) => Promise<void>;
  markAllRead: () => Promise<void>;
  clearPortalNotifications: () => void;
}

export const usePortalNotificationStore = create<PortalNotificationState>()(
  persist(
    (set, get) => ({
      items: [],
      fetchedIds: [],
      deliveredIds: [],
      dismissedAtById: {},
      hasBaseline: false,
      setFetched: (items) =>
        set((state) => {
          const now = Date.now();
          const recentItems = items.filter((item) =>
            isNotificationRecent(item.createdAt, now),
          );
          const recentIds = new Set(recentItems.map((item) => item.id));
          const dismissedAtById = pruneDismissedIds(
            state.dismissedAtById ?? {},
            now,
          );
          return {
            items: recentItems.filter(
              (item) => dismissedAtById[item.id] === undefined,
            ),
            fetchedIds: [...recentIds],
            deliveredIds: state.deliveredIds.filter((id) => recentIds.has(id)),
            dismissedAtById,
            hasBaseline: true,
          };
        }),
      addDeliveredIds: (ids) =>
        set((state) => ({
          deliveredIds: [...new Set([...state.deliveredIds, ...ids])],
        })),
      dismiss: (ids) => {
        const dismissedIds = new Set(ids);
        const dismissedAt = Date.now();
        set((state) => ({
          items: state.items.filter((item) => !dismissedIds.has(item.id)),
          dismissedAtById: {
            ...(state.dismissedAtById ?? {}),
            ...Object.fromEntries(ids.map((id) => [id, dismissedAt])),
          },
        }));
      },
      pruneExpired: () =>
        set((state) => {
          const now = Date.now();
          const items = state.items.filter((item) =>
            isNotificationRecent(item.createdAt, now),
          );
          const dismissedAtById = pruneDismissedIds(
            state.dismissedAtById ?? {},
            now,
          );
          const recentIds = new Set([
            ...items.map((item) => item.id),
            ...Object.keys(dismissedAtById),
          ]);
          return {
            items,
            fetchedIds: state.fetchedIds.filter((id) => recentIds.has(id)),
            deliveredIds: state.deliveredIds.filter((id) => recentIds.has(id)),
            dismissedAtById,
          };
        }),
      markRead: async (id) => {
        await markPortalNotificationRead(id);
        set((state) => ({
          items: state.items.map((item) =>
            item.id === id
              ? { ...item, readAt: item.readAt ?? new Date().toISOString() }
              : item,
          ),
        }));
      },
      markAllRead: async () => {
        await markAllPortalNotificationsRead();
        const readAt = new Date().toISOString();
        set({
          items: get().items.map((item) => ({
            ...item,
            readAt: item.readAt ?? readAt,
          })),
        });
      },
      clearPortalNotifications: () =>
        set({
          items: [],
          fetchedIds: [],
          deliveredIds: [],
          dismissedAtById: {},
          hasBaseline: false,
        }),
    }),
    {
      name: "portal-notification-storage-sqlite-v1",
      storage: createJSONStorage(() => zustandStorage),
      onRehydrateStorage: () => (state) => state?.pruneExpired(),
    },
  ),
);
