// Run: npm run test
import { test, mock, beforeEach } from "node:test";
import assert from "node:assert/strict";

// Logging out of Bunkialo must not leave portal credentials on the device.
// Otherwise the next person to use the phone can reconnect the portal, and
// "log out" would be a lie for one of the two accounts the app holds.
let portalDisconnected = false;
mock.module("@/services/attendance-portal", {
  namedExports: {
    disconnectPortal: async () => {
      portalDisconnected = true;
    },
    hasPortalCredentials: async () => false,
    fetchPortalAttendance: async () => [],
  },
});

let moodleLoggedOut = false;
// mock.module replaces the whole module, so every export other importers reach
// for has to exist here, not just the ones this test drives.
mock.module("@/services/auth", {
  namedExports: {
    login: async () => true,
    logout: async () => {
      moodleLoggedOut = true;
    },
    getCredentials: async () => null,
    saveCredentials: async () => {},
    clearCredentials: async () => {},
    clearSession: () => {},
    checkSession: async () => false,
    tryAutoLogin: async () => false,
    refreshAuthSession: async () => false,
    getAuthDebugInfo: () => ({}),
  },
});

mock.module("@/background/dashboard-background", {
  namedExports: {
    cancelAllScheduledNotifications: async () => {},
    syncDashboardBackgroundTask: async () => {},
    stopBackgroundRefresh: () => {},
  },
});

mock.module("@/background/wifix-background", {
  namedExports: {
    syncWifixBackgroundTask: async () => {},
    unregisterWifixBackgroundTask: async () => {},
  },
});

const { useAuthStore } = await import("./auth-store.ts");

beforeEach(() => {
  portalDisconnected = false;
  moodleLoggedOut = false;
});

test("logout clears the attendance portal credentials too", async () => {
  await useAuthStore.getState().logout();

  assert.equal(moodleLoggedOut, true);
  assert.equal(portalDisconnected, true);
  assert.equal(useAuthStore.getState().isLoggedIn, false);
});
