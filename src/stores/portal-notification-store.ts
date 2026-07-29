import {
  markAllPortalNotificationsRead,
  markPortalNotificationRead,
} from "@/services/attendance/attendance-api";
import type { PortalNotification } from "@/types";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { zustandStorage } from "./storage";

interface PortalNotificationState {
  items: PortalNotification[];
  fetchedIds: string[];
  deliveredIds: string[];
  hasBaseline: boolean;
  setFetched: (items: PortalNotification[]) => void;
  addDeliveredIds: (ids: string[]) => void;
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
      hasBaseline: false,
      setFetched: (items) =>
        set({
          items,
          fetchedIds: items.map((item) => item.id),
          hasBaseline: true,
        }),
      addDeliveredIds: (ids) =>
        set((state) => ({
          deliveredIds: [...new Set([...state.deliveredIds, ...ids])],
        })),
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
          hasBaseline: false,
        }),
    }),
    {
      name: "portal-notification-storage-sqlite-v1",
      storage: createJSONStorage(() => zustandStorage),
    },
  ),
);
