import type { StateStorage } from "zustand/middleware";

const getBrowserStorage = (): Storage | null => {
  if (typeof window === "undefined") return null;

  try {
    return window.localStorage;
  } catch {
    return null;
  }
};

export const zustandStorage: StateStorage = {
  getItem: async (name) => getBrowserStorage()?.getItem(name) ?? null,
  setItem: async (name, value) => {
    getBrowserStorage()?.setItem(name, value);
  },
  removeItem: async (name) => {
    getBrowserStorage()?.removeItem(name);
  },
};
