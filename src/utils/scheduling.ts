type IdleScheduler = {
  requestIdleCallback?: (
    callback: () => void,
    options?: { timeout: number },
  ) => number;
  cancelIdleCallback?: (id: number) => void;
};

interface ScheduleIdleTaskOptions {
  timeoutMs?: number;
  fallbackDelayMs?: number;
}

export const scheduleDeferredTask = (callback: () => void) => ({
  cancel: scheduleIdleTask(callback),
});

export const scheduleIdleTask = (
  callback: () => void,
  options?: ScheduleIdleTaskOptions,
): (() => void) => {
  const { timeoutMs = 500, fallbackDelayMs = 16 } = options ?? {};
  const scheduler = globalThis as typeof globalThis & IdleScheduler;

  if (typeof scheduler.requestIdleCallback === "function") {
    const idleId = scheduler.requestIdleCallback(callback, {
      timeout: timeoutMs,
    });
    return () => scheduler.cancelIdleCallback?.(idleId);
  }

  const timeoutId = setTimeout(callback, fallbackDelayMs);
  return () => clearTimeout(timeoutId);
};
