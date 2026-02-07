import { getCredentials } from "@/services/auth";
import {
  checkConnectivity,
  loginToCaptivePortal,
  resolvePortalSelection,
} from "@/services/wifix";
import { useWifixStore } from "@/stores/wifix-store";
import { wifixLogger } from "@/utils/wifix-logger";
import * as BackgroundTask from "expo-background-task";
import * as TaskManager from "expo-task-manager";

const WIFIX_TASK_NAME = "wifix-background-login";

const runWifixLogin =
  async (): Promise<BackgroundTask.BackgroundTaskResult> => {
    const { autoReconnectEnabled, portalBaseUrl, portalSource, manualPortalUrl } =
      useWifixStore.getState();

    if (!autoReconnectEnabled) {
      return BackgroundTask.BackgroundTaskResult.Success;
    }

    wifixLogger.info("Background task: Starting auto-reconnect check");

    const credentials = await getCredentials();
    if (!credentials) {
      wifixLogger.error("Background task: No credentials found");
      return BackgroundTask.BackgroundTaskResult.Success;
    }

    wifixLogger.info("Background task: Checking connectivity");
    const connectivity = await checkConnectivity();
    if (connectivity.state === "online") {
      wifixLogger.success("Background task: Already online");
      return BackgroundTask.BackgroundTaskResult.Success;
    }

    if (connectivity.state !== "captive") {
      wifixLogger.error("Background task: No captive portal detected");
      return BackgroundTask.BackgroundTaskResult.Success;
    }

    wifixLogger.info("Background task: Attempting login");
    const selection = resolvePortalSelection({
      detectedPortalUrl: connectivity.portalUrl,
      detectedPortalBaseUrl: connectivity.portalBaseUrl,
      manualPortalUrl,
      portalSource,
    });

    const loginResult = await loginToCaptivePortal({
      username: credentials.username,
      password: credentials.password,
      portalUrl: selection.portalUrl,
      portalBaseUrl: selection.portalBaseUrl ?? portalBaseUrl,
    });

    if (!loginResult.success) {
      wifixLogger.error("Background task: Login failed");
      return BackgroundTask.BackgroundTaskResult.Failed;
    }

    wifixLogger.info("Background task: Verifying connection");
    const verification = await checkConnectivity();
    if (verification.state === "online") {
      wifixLogger.success("Background task: Successfully reconnected");
      return BackgroundTask.BackgroundTaskResult.Success;
    } else {
      wifixLogger.error("Background task: Verification failed");
      return BackgroundTask.BackgroundTaskResult.Failed;
    }
  };

TaskManager.defineTask(WIFIX_TASK_NAME, async () => {
  try {
    return await runWifixLogin();
  } catch {
    return BackgroundTask.BackgroundTaskResult.Failed;
  }
});

export const registerWifixBackgroundTask = async (
  intervalMinutes: number,
): Promise<boolean> => {
  const status = await BackgroundTask.getStatusAsync();
  if (status !== BackgroundTask.BackgroundTaskStatus.Available) {
    return false;
  }

  const isRegistered = await TaskManager.isTaskRegisteredAsync(WIFIX_TASK_NAME);
  if (isRegistered) {
    await BackgroundTask.unregisterTaskAsync(WIFIX_TASK_NAME);
  }

  await BackgroundTask.registerTaskAsync(WIFIX_TASK_NAME, {
    minimumInterval: Math.max(15, intervalMinutes),
  });

  return true;
};

export const unregisterWifixBackgroundTask = async (): Promise<void> => {
  const isRegistered = await TaskManager.isTaskRegisteredAsync(WIFIX_TASK_NAME);
  if (isRegistered) {
    await BackgroundTask.unregisterTaskAsync(WIFIX_TASK_NAME);
  }
};

export const syncWifixBackgroundTask = async (): Promise<void> => {
  const { autoReconnectEnabled, backgroundIntervalMinutes } =
    useWifixStore.getState();

  if (!autoReconnectEnabled) {
    await unregisterWifixBackgroundTask();
    return;
  }

  await registerWifixBackgroundTask(backgroundIntervalMinutes);
};

export const getWifixTaskName = (): string => WIFIX_TASK_NAME;
