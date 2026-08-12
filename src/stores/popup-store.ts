import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { zustandStorage } from "./storage";
import { POPUP_NOTICES } from "@/data/popups";

const VALID_POPUP_IDS = new Set(POPUP_NOTICES.map((popup) => popup.id));

const getValidPopupIds = (): Set<string> =>
  new Set(POPUP_NOTICES.map((popup) => popup.id));

const normalizePopupIds = (value: unknown): string[] => {
  if (!Array.isArray(value)) return [];

  const popupIds = new Set<string>();
  for (const item of value) {
    if (typeof item !== "string" || !VALID_POPUP_IDS.has(item)) continue;
    popupIds.add(item);
  }

  return Array.from(popupIds);
};

const extractSeenPopupIds = (value: unknown): string[] | null => {
  if (Array.isArray(value)) {
    return normalizePopupIds(value);
  }

  if (!value || typeof value !== "object") {
    return null;
  }

  const candidate = value as {
    seenPopupIds?: unknown;
    state?: {
      seenPopupIds?: unknown;
    };
  };

  if ("seenPopupIds" in candidate) {
    return normalizePopupIds(candidate.seenPopupIds);
  }

  if (candidate.state && "seenPopupIds" in candidate.state) {
    return normalizePopupIds(candidate.state.seenPopupIds);
  }

  return null;
};

const extractNotifiedPopupIds = (value: unknown): string[] | null => {
  if (Array.isArray(value)) {
    return [];
  }

  if (!value || typeof value !== "object") {
    return null;
  }

  const candidate = value as {
    notifiedPopupIds?: unknown;
    state?: {
      notifiedPopupIds?: unknown;
    };
  };

  if ("notifiedPopupIds" in candidate) {
    return normalizePopupIds(candidate.notifiedPopupIds);
  }

  if (candidate.state && "notifiedPopupIds" in candidate.state) {
    return normalizePopupIds(candidate.state.notifiedPopupIds);
  }

  return null;
};

const extractDismissedPopupIds = (value: unknown): string[] | null => {
  if (Array.isArray(value)) return [];
  if (!value || typeof value !== "object") return null;

  const candidate = value as {
    dismissedPopupIds?: unknown;
    state?: { dismissedPopupIds?: unknown };
  };
  const dismissed =
    candidate.dismissedPopupIds ?? candidate.state?.dismissedPopupIds;
  return dismissed === undefined ? null : normalizePopupIds(dismissed);
};

interface PopupState {
  seenPopupIds: string[];
  notifiedPopupIds: string[];
  dismissedPopupIds: string[];
  hasHydrated: boolean;
  markAsSeen: (id: string) => void;
  markAsNotified: (id: string) => void;
  markAllAsSeen: () => void;
  dismissPopups: (ids: string[]) => void;
  pruneExpiredPopups: () => void;
  clearSeenPopups: () => void;
  hasUnseenPopups: () => boolean;
  getUnseenPopups: () => typeof POPUP_NOTICES;
  setHasHydrated: (hasHydrated: boolean) => void;
}

export const usePopupStore = create<PopupState>()(
  persist(
    (set, get) => ({
      seenPopupIds: [],
      notifiedPopupIds: [],
      dismissedPopupIds: [],
      hasHydrated: false,

      setHasHydrated: (hasHydrated) => set({ hasHydrated }),

      markAsSeen: (id: string) => {
        if (!VALID_POPUP_IDS.has(id)) return;

        set((state) => {
          if (state.seenPopupIds.includes(id)) {
            return state;
          }
          return {
            seenPopupIds: [...state.seenPopupIds, id],
          };
        });
      },

      markAsNotified: (id: string) => {
        if (!VALID_POPUP_IDS.has(id)) return;

        set((state) => {
          if (state.notifiedPopupIds.includes(id)) {
            return state;
          }
          return {
            notifiedPopupIds: [...state.notifiedPopupIds, id],
          };
        });
      },

      markAllAsSeen: () => {
        set({ seenPopupIds: Array.from(VALID_POPUP_IDS) });
      },

      dismissPopups: (ids) => {
        const validIds = ids.filter((id) => VALID_POPUP_IDS.has(id));
        set((state) => ({
          dismissedPopupIds: [
            ...new Set([...state.dismissedPopupIds, ...validIds]),
          ],
        }));
      },

      pruneExpiredPopups: () => {
        const validIds = getValidPopupIds();
        set((state) => ({
          seenPopupIds: state.seenPopupIds.filter((id) => validIds.has(id)),
          notifiedPopupIds: state.notifiedPopupIds.filter((id) =>
            validIds.has(id),
          ),
          dismissedPopupIds: state.dismissedPopupIds.filter((id) =>
            validIds.has(id),
          ),
        }));
      },

      clearSeenPopups: () => {
        set({ seenPopupIds: [] });
      },

      hasUnseenPopups: () => {
        const { hasHydrated, seenPopupIds, dismissedPopupIds } = get();
        if (!hasHydrated) return false;
        return POPUP_NOTICES.some(
          (popup) =>
            !seenPopupIds.includes(popup.id) &&
            !dismissedPopupIds.includes(popup.id),
        );
      },

      getUnseenPopups: () => {
        const { hasHydrated, seenPopupIds, dismissedPopupIds } = get();
        if (!hasHydrated) return [];
        return POPUP_NOTICES.filter(
          (popup) =>
            !seenPopupIds.includes(popup.id) &&
            !dismissedPopupIds.includes(popup.id),
        );
      },
    }),
    {
      name: "bunkialo-popup-storage-sqlite-v1",
      storage: createJSONStorage(() => ({
        getItem: async (name) => {
          const value = await zustandStorage.getItem(name);
          if (!value) return null;
          try {
            const parsed = JSON.parse(value);

            const seenPopupIds = extractSeenPopupIds(parsed);
            const notifiedPopupIds = extractNotifiedPopupIds(parsed);
            const dismissedPopupIds = extractDismissedPopupIds(parsed);

            if (
              seenPopupIds !== null ||
              notifiedPopupIds !== null ||
              dismissedPopupIds !== null
            ) {
              return JSON.stringify({
                state: {
                  seenPopupIds: seenPopupIds ?? [],
                  notifiedPopupIds: notifiedPopupIds ?? [],
                  dismissedPopupIds: dismissedPopupIds ?? [],
                },
                version: 0,
              });
            }

            return value;
          } catch {
            return value;
          }
        },
        setItem: (name, value) => zustandStorage.setItem(name, value),
        removeItem: (name) => zustandStorage.removeItem(name),
      })),
      partialize: (state) => ({
        seenPopupIds: state.seenPopupIds,
        notifiedPopupIds: state.notifiedPopupIds,
        dismissedPopupIds: state.dismissedPopupIds,
      }),
      onRehydrateStorage: () => (state) => {
        state?.pruneExpiredPopups();
        state?.setHasHydrated(true);
      },
    },
  ),
);
