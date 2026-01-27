import { getCredentials } from "@/services/auth";
import { checkConnectivity, loginToCaptivePortal } from "@/services/wifix";
import { useWifixStore } from "@/stores/wifix-store";
import * as BackgroundFetch from "expo-background-fetch";
import * as TaskManager from "expo-task-manager";

const WIFIX_TASK_NAME = "wifix-background-login";

const runWifixLogin =
  async (): Promise<BackgroundFetch.BackgroundFetchResult> => {
    const { autoReconnectEnabled, portalBaseUrl } = useWifixStore.getState();
    if (!autoReconnectEnabled) {
      return BackgroundFetch.BackgroundFetchResult.NoData;
    }

    const credentials = await getCredentials();
    if (!credentials) {
      return BackgroundFetch.BackgroundFetchResult.NoData;
    }

    const connectivity = await checkConnectivity();
    if (connectivity.state === "online") {
      return BackgroundFetch.BackgroundFetchResult.NoData;
    }

    if (connectivity.state !== "captive") {
      return BackgroundFetch.BackgroundFetchResult.NoData;
    }

    const loginResult = await loginToCaptivePortal({
      username: credentials.username,
      password: credentials.password,
      portalUrl: connectivity.portalUrl,
      portalBaseUrl: connectivity.portalBaseUrl ?? portalBaseUrl,
    });

    if (!loginResult.success) {
      return BackgroundFetch.BackgroundFetchResult.Failed;
    }

    const verification = await checkConnectivity();
    return verification.state === "online"
      ? BackgroundFetch.BackgroundFetchResult.NewData
      : BackgroundFetch.BackgroundFetchResult.NoData;
  };

TaskManager.defineTask(WIFIX_TASK_NAME, async () => {
  try {
    return await runWifixLogin();
  } catch {
    return BackgroundFetch.BackgroundFetchResult.Failed;
  }
});

export const registerWifixBackgroundTask = async (
  intervalMinutes: number,
): Promise<boolean> => {
  const status = await BackgroundFetch.getStatusAsync();
  if (
    status === BackgroundFetch.BackgroundFetchStatus.Denied ||
    status === BackgroundFetch.BackgroundFetchStatus.Restricted
  ) {
    return false;
  }

  const existingTasks = await TaskManager.getRegisteredTasksAsync();
  const alreadyRegistered = existingTasks.some(
    (task) => task.taskName === WIFIX_TASK_NAME,
  );

  if (alreadyRegistered) {
    await BackgroundFetch.unregisterTaskAsync(WIFIX_TASK_NAME);
  }

  await BackgroundFetch.registerTaskAsync(WIFIX_TASK_NAME, {
    minimumInterval: Math.max(15, intervalMinutes) * 60,
    stopOnTerminate: false,
    startOnBoot: true,
  });

  return true;
};

export const unregisterWifixBackgroundTask = async (): Promise<void> => {
  const existingTasks = await TaskManager.getRegisteredTasksAsync();
  const alreadyRegistered = existingTasks.some(
    (task) => task.taskName === WIFIX_TASK_NAME,
  );

  if (alreadyRegistered) {
    await BackgroundFetch.unregisterTaskAsync(WIFIX_TASK_NAME);
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
