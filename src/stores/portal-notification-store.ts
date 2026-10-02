import { markPortalNotificationRead } from "@/services/attendance/attendance-api";
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

const readRequests = new Map<string, Promise<void>>();

interface PortalNotificationState {
  items: PortalNotification[];
  fetchedIds: string[];
  deliveredIds: string[];
  dismissedAtById: Record<string, number>;
  hasBaseline: boolean;
  hasHydrated: boolean;
  lastSyncAt: number | null;
  pendingDeliveryIds: string[];
  pendingReadIds: string[];
  flushPendingReads: () => Promise<void>;
  setPendingDeliveryIds: (ids: string[]) => void;
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
      hasHydrated: false,
      lastSyncAt: null,
      pendingDeliveryIds: [],
      pendingReadIds: [],
      setPendingDeliveryIds: (ids) =>
        set({ pendingDeliveryIds: [...new Set(ids)] }),
      setFetched: (items) =>
        set((state) => {
          const now = Date.now();
          const previous = new Map(state.items.map((item) => [item.id, item]));
          const merged = new Map(state.items.map((item) => [item.id, item]));
          for (const item of items)
            merged.set(item.id, {
              ...item,
              readAt: item.readAt ?? previous.get(item.id)?.readAt ?? null,
            });
          const recentItems = [...merged.values()].filter((item) =>
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
            pendingDeliveryIds: state.pendingDeliveryIds.filter(
              (id) => recentIds.has(id) && dismissedAtById[id] === undefined,
            ),
            fetchedIds: [...recentIds],
            deliveredIds: state.deliveredIds.filter((id) => recentIds.has(id)),
            dismissedAtById,
            hasBaseline: true,
            lastSyncAt: now,
          };
        }),
      addDeliveredIds: (ids) =>
        set((state) => ({
          deliveredIds: [...new Set([...state.deliveredIds, ...ids])],
          pendingDeliveryIds: state.pendingDeliveryIds.filter(
            (id) => !ids.includes(id),
          ),
        })),
      dismiss: (ids) => {
        const dismissedIds = new Set(ids);
        const dismissedAt = Date.now();
        set((state) => ({
          items: state.items.filter((item) => !dismissedIds.has(item.id)),
          pendingDeliveryIds: state.pendingDeliveryIds.filter(
            (id) => !dismissedIds.has(id),
          ),
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
            pendingDeliveryIds: state.pendingDeliveryIds.filter(
              (id) => recentIds.has(id) && dismissedAtById[id] === undefined,
            ),
            pendingReadIds: (state.pendingReadIds ?? []).filter((id) =>
              recentIds.has(id),
            ),
            fetchedIds: state.fetchedIds.filter((id) => recentIds.has(id)),
            deliveredIds: state.deliveredIds.filter((id) => recentIds.has(id)),
            dismissedAtById,
          };
        }),
      flushPendingReads: async () => {
        // Failed acknowledgements stay persisted for the next foreground/background fetch.
        await Promise.all(
          (get().pendingReadIds ?? []).map(async (id) => {
            if (readRequests.has(id)) return readRequests.get(id);
            const request = markPortalNotificationRead(id)
              .then(() => {
                set((state) => ({
                  pendingReadIds: state.pendingReadIds.filter(
                    (pending) => pending !== id,
                  ),
                }));
              })
              .catch(() => undefined)
              .finally(() => readRequests.delete(id));
            readRequests.set(id, request);
            await request;
          }),
        );
      },
      markRead: async (id) => {
        const item = get().items.find((entry) => entry.id === id);
        if (!item || item.readAt) return;
        set((state) => ({
          items: state.items.map((entry) =>
            entry.id === id
              ? { ...entry, readAt: new Date().toISOString() }
              : entry,
          ),
          pendingReadIds: [...new Set([...(state.pendingReadIds ?? []), id])],
          pendingDeliveryIds: state.pendingDeliveryIds.filter(
            (pending) => pending !== id,
          ),
        }));
        await get().flushPendingReads();
      },
      markAllRead: async () => {
        // Capture the current inbox; arrivals during the request remain unread.
        const ids = get()
          .items.filter((item) => !item.readAt)
          .map((item) => item.id);
        const selected = new Set(ids);
        const readAt = new Date().toISOString();
        set((state) => ({
          items: state.items.map((item) =>
            selected.has(item.id) ? { ...item, readAt } : item,
          ),
          pendingReadIds: [
            ...new Set([...(state.pendingReadIds ?? []), ...ids]),
          ],
          pendingDeliveryIds: state.pendingDeliveryIds.filter(
            (id) => !selected.has(id),
          ),
        }));
        await get().flushPendingReads();
      },
      clearPortalNotifications: () =>
        set({
          items: [],
          fetchedIds: [],
          deliveredIds: [],
          dismissedAtById: {},
          hasBaseline: false,
          pendingDeliveryIds: [],
          pendingReadIds: [],
          lastSyncAt: null,
        }),
    }),
    {
      name: "portal-notification-storage-sqlite-v1",
      storage: createJSONStorage(() => zustandStorage),
      onRehydrateStorage: () => (state) => {
        state?.pruneExpired();
        usePortalNotificationStore.setState({ hasHydrated: true });
      },
    },
  ),
);
