// Inert stand-in for native/Expo modules under `node --test`. See test-setup.mjs.
//
// ponytail: only the exports tests actually reach for. Add a name when an import
// fails, not before. Tests needing real behaviour should mock.module() locally.
const noop = async () => null;

// expo-secure-store
export const getItemAsync = noop;
export const setItemAsync = noop;
export const deleteItemAsync = noop;
export const WHEN_UNLOCKED_THIS_DEVICE_ONLY = "WHEN_UNLOCKED_THIS_DEVICE_ONLY";

// react-native
export const Platform = { OS: "android", select: (o) => o.android ?? o.default };
export const AppState = { addEventListener: () => ({ remove: () => {} }) };

// expo-notifications
export const setNotificationHandler = () => {};
export const scheduleNotificationAsync = noop;
export const cancelAllScheduledNotificationsAsync = noop;
export const getAllScheduledNotificationsAsync = async () => [];
export const cancelScheduledNotificationAsync = noop;
export const getPermissionsAsync = async () => ({ status: "granted" });
export const requestPermissionsAsync = async () => ({ status: "granted" });
export const setNotificationChannelAsync = noop;
export const AndroidImportance = { DEFAULT: 3, HIGH: 4 };
export const SchedulableTriggerInputTypes = { DATE: "date" };

// @react-native-async-storage/async-storage (default import)
export default {
  getItem: noop,
  setItem: noop,
  removeItem: noop,
  clear: noop,
};
