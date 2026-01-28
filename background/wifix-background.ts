import { getCredentials } from "@/services/auth";
import { checkConnectivity, loginToCaptivePortal } from "@/services/wifix";
import { useWifixStore } from "@/stores/wifix-store";
import * as BackgroundTask from "expo-background-task";
import * as TaskManager from "expo-task-manager";

const WIFIX_TASK_NAME = "wifix-background-login";

const runWifixLogin =
  async (): Promise<BackgroundTask.BackgroundTaskResult> => {
    const { autoReconnectEnabled, portalBaseUrl } = useWifixStore.getState();
    if (!autoReconnectEnabled) {
      return BackgroundTask.BackgroundTaskResult.Success;
    }

    const credentials = await getCredentials();
    if (!credentials) {
      return BackgroundTask.BackgroundTaskResult.Success;
    }

    const connectivity = await checkConnectivity();
    if (connectivity.state === "online") {
      return BackgroundTask.BackgroundTaskResult.Success;
    }

    if (connectivity.state !== "captive") {
      return BackgroundTask.BackgroundTaskResult.Success;
    }

    const loginResult = await loginToCaptivePortal({
      username: credentials.username,
      password: credentials.password,
      portalUrl: connectivity.portalUrl,
      portalBaseUrl: connectivity.portalBaseUrl ?? portalBaseUrl,
    });

    if (!loginResult.success) {
      return BackgroundTask.BackgroundTaskResult.Failed;
    }

    const verification = await checkConnectivity();
    return verification.state === "online"
      ? BackgroundTask.BackgroundTaskResult.Success
      : BackgroundTask.BackgroundTaskResult.Failed;
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
  if (
    status === BackgroundTask.BackgroundTaskStatus.Denied ||
    status === BackgroundTask.BackgroundTaskStatus.Restricted
  ) {
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
