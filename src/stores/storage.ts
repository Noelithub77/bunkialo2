import SQLiteStorage from "expo-sqlite/kv-store";
import { StateStorage } from "zustand/middleware";

// Zustand adapter backed by Expo SQLite.
export const zustandStorage: StateStorage = {
  getItem: async (name) => {
    const value = await SQLiteStorage.getItem(name);
    return value ?? null;
  },
  setItem: async (name, value) => {
    await SQLiteStorage.setItem(name, value);
  },
  removeItem: async (name) => {
    await SQLiteStorage.removeItem(name);
  },
};
