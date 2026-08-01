// Inert stand-in for native/Expo modules under `node --test`. See test-setup.mjs.
//
// ponytail: only the exports tests actually reach for. Add a name when an import
// fails, not before. Tests needing real behaviour should mock.module() locally.
const noop = async () => null;

// expo-secure-store
export const getItemAsync = noop;
export const setItemAsync = noop;
export const deleteItemAsync = noop;

// @react-native-async-storage/async-storage (default import)
export default {
  getItem: noop,
  setItem: noop,
  removeItem: noop,
  clear: noop,
};
