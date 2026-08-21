import {
  DASHBOARD_NOTIFICATION_CHANNELS,
  DASHBOARD_NOTIFICATION_STORAGE_KEY,
  LEGACY_DASHBOARD_NOTIFICATION_STORAGE_KEY,
} from "@/constants/dashboard";
import type { TimelineEvent } from "@/types";
import {
  cancelNotificationRequests,
  ensureNotificationChannels,
  hasNotificationPermissions,
  scheduleDateNotification,
  sendImmediateNotification,
} from "@/utils/notifications";
import { zustandStorage } from "@/stores/storage";
import {
  dedupeTimelineEvents,
  getTimelineEventSignature,
} from "./dashboard-event-utils";

type DashboardSyncSource = "foreground" | "background";

type DashboardNotificationState = {
  seenUpcomingSignatures: string[];
  scheduledReminderIds: Record<string, string>;
};

type SyncDashboardNotificationsParams = {
  notificationsEnabled: boolean;
  reminderMinutes: number[];
  source: DashboardSyncSource;
  upcomingEvents: TimelineEvent[];
};

const EMPTY_NOTIFICATION_STATE: DashboardNotificationState = {
  seenUpcomingSignatures: [],
  scheduledReminderIds: {},
};

let legacyMigrationPromise: Promise<void> | null = null;
let notificationSyncQueue: Promise<void> = Promise.resolve();

const getReminderSignature = (
  event: TimelineEvent,
  minutesBefore: number,
): string => `${getTimelineEventSignature(event)}:${minutesBefore}`;

const migrateLegacyDashboardNotificationState = async (): Promise<void> => {
  const legacyRaw = await zustandStorage.getItem(
    LEGACY_DASHBOARD_NOTIFICATION_STORAGE_KEY,
  );

  if (!legacyRaw) {
    return;
  }

  try {
    const parsed = JSON.parse(legacyRaw) as {
      scheduledReminderIds?: Record<string, string[]>;
    };
    const legacyNotificationIds = Object.values(
      parsed.scheduledReminderIds ?? {},
    ).flat();

    if (legacyNotificationIds.length > 0) {
      await cancelNotificationRequests(legacyNotificationIds);
    }
  } catch {
    // Ignore malformed legacy state and fall through to removing it.
  } finally {
    await zustandStorage.removeItem(LEGACY_DASHBOARD_NOTIFICATION_STORAGE_KEY);
  }
};

const ensureLegacyDashboardNotificationStateMigrated =
  async (): Promise<void> => {
    if (!legacyMigrationPromise) {
      legacyMigrationPromise = migrateLegacyDashboardNotificationState();
    }

    await legacyMigrationPromise;
  };

const loadDashboardNotificationState =
  async (): Promise<DashboardNotificationState> => {
    await ensureLegacyDashboardNotificationStateMigrated();

    const raw = await zustandStorage.getItem(DASHBOARD_NOTIFICATION_STORAGE_KEY);
    if (!raw) {
      return EMPTY_NOTIFICATION_STATE;
    }

    try {
      const parsed = JSON.parse(raw) as Partial<DashboardNotificationState>;
      return {
        seenUpcomingSignatures: Array.isArray(parsed.seenUpcomingSignatures)
          ? parsed.seenUpcomingSignatures
          : [],
        scheduledReminderIds:
          parsed.scheduledReminderIds &&
          typeof parsed.scheduledReminderIds === "object"
            ? parsed.scheduledReminderIds
            : {},
      };
    } catch {
      return EMPTY_NOTIFICATION_STATE;
    }
  };

const saveDashboardNotificationState = async (
  state: DashboardNotificationState,
): Promise<void> => {
  await zustandStorage.setItem(
    DASHBOARD_NOTIFICATION_STORAGE_KEY,
    JSON.stringify(state),
  );
};

const buildNewUpcomingNotification = (
  newUpcomingEvents: TimelineEvent[],
): { title: string; body: string } | null => {
  if (newUpcomingEvents.length === 0) {
    return null;
  }

  const [firstEvent] = newUpcomingEvents;
  if (!firstEvent) {
    return null;
  }

  if (newUpcomingEvents.length === 1) {
    return {
      title: "New upcoming task",
      body: `${firstEvent.activityname} in ${firstEvent.course.shortname}`,
    };
  }

  return {
    title: `${newUpcomingEvents.length} new upcoming tasks`,
    body: `Latest: ${firstEvent.activityname} in ${firstEvent.course.shortname}`,
  };
};

const isFutureReminder = (
  event: TimelineEvent,
  minutesBefore: number,
): boolean => {
  const scheduledAt = event.timesort * 1000 - minutesBefore * 60 * 1000;
  return scheduledAt > Date.now();
};

const cancelReminderMap = async (
  reminderMap: Record<string, string>,
): Promise<void> => {
  const reminderIds = Object.values(reminderMap);
  if (reminderIds.length === 0) {
    return;
  }

  await cancelNotificationRequests(reminderIds);
};

const buildReminderNotifications = async (
  previousReminderIds: Record<string, string>,
  upcomingEvents: TimelineEvent[],
  reminderMinutes: number[],
): Promise<Record<string, string>> => {
  const scheduledReminderIds: Record<string, string> = {};
  const uniqueReminderMinutes = Array.from(
    new Set(reminderMinutes.filter((minutes) => minutes > 0)),
  ).sort((a, b) => b - a);

  for (const event of upcomingEvents) {
    for (const minutesBefore of uniqueReminderMinutes) {
      if (!isFutureReminder(event, minutesBefore)) {
        continue;
      }

      const scheduledAt = event.timesort * 1000 - minutesBefore * 60 * 1000;

      const reminderSignature = getReminderSignature(event, minutesBefore);
      const existingNotificationId = previousReminderIds[reminderSignature];

      if (existingNotificationId) {
        scheduledReminderIds[reminderSignature] = existingNotificationId;
        continue;
      }

      const notificationId = await scheduleDateNotification({
        body: `Due in ${minutesBefore} minutes - ${event.course.shortname}`,
        channelId: DASHBOARD_NOTIFICATION_CHANNELS.reminders,
        data: {
          eventId: event.id,
          reminderMinutes: minutesBefore,
          type: "dashboard-reminder",
          url: event.url,
        },
        date: scheduledAt,
        title: event.activityname,
      });

      scheduledReminderIds[reminderSignature] = notificationId;
    }
  }

  return scheduledReminderIds;
};

export const clearDashboardNotificationState = async (): Promise<void> => {
  await ensureLegacyDashboardNotificationStateMigrated();
  const state = await loadDashboardNotificationState();
  await cancelReminderMap(state.scheduledReminderIds);

  await zustandStorage.removeItem(DASHBOARD_NOTIFICATION_STORAGE_KEY);
};

const runDashboardNotificationsSync = async ({
  notificationsEnabled,
  reminderMinutes,
  source,
  upcomingEvents,
}: SyncDashboardNotificationsParams): Promise<{
  newUpcomingEvents: TimelineEvent[];
}> => {
  const dedupedUpcomingEvents = dedupeTimelineEvents(upcomingEvents);
  const previousState = await loadDashboardNotificationState();
  const previousSignatures = new Set(previousState.seenUpcomingSignatures);
  const currentSignatures = new Set(
    dedupedUpcomingEvents.map(getTimelineEventSignature),
  );
  const hasSeenBaseline = previousState.seenUpcomingSignatures.length > 0;

  const newUpcomingEvents = hasSeenBaseline
    ? dedupedUpcomingEvents.filter(
        (event) => !previousSignatures.has(getTimelineEventSignature(event)),
      )
    : [];

  const shouldSendNotifications =
    notificationsEnabled && (await hasNotificationPermissions());

  if (!shouldSendNotifications) {
    await cancelReminderMap(previousState.scheduledReminderIds);

    await saveDashboardNotificationState({
      seenUpcomingSignatures: Array.from(currentSignatures),
      scheduledReminderIds: {},
    });

    return { newUpcomingEvents: [] };
  }

  await ensureNotificationChannels([
    {
      id: DASHBOARD_NOTIFICATION_CHANNELS.default,
      name: "Default",
    },
    {
      id: DASHBOARD_NOTIFICATION_CHANNELS.reminders,
      name: "Dashboard reminders",
    },
    {
      id: DASHBOARD_NOTIFICATION_CHANNELS.updates,
      name: "Dashboard updates",
    },
  ]);

  const nextReminderKeys = new Set(
    dedupedUpcomingEvents.flatMap((event) =>
      reminderMinutes
        .filter((minutes) => minutes > 0 && isFutureReminder(event, minutes))
        .map((minutesBefore) => getReminderSignature(event, minutesBefore)),
    ),
  );
  const staleReminderIds = Object.entries(previousState.scheduledReminderIds)
    .filter(([reminderSignature]) => !nextReminderKeys.has(reminderSignature))
    .map(([, notificationId]) => notificationId);

  if (staleReminderIds.length > 0) {
    await cancelNotificationRequests(staleReminderIds);
  }

  const scheduledReminderIds = await buildReminderNotifications(
    previousState.scheduledReminderIds,
    dedupedUpcomingEvents,
    reminderMinutes,
  );

  if (source === "background" && newUpcomingEvents.length > 0) {
    const summary = buildNewUpcomingNotification(newUpcomingEvents);

    if (summary) {
      await sendImmediateNotification({
        body: summary.body,
        channelId: DASHBOARD_NOTIFICATION_CHANNELS.updates,
        data: {
          eventIds: newUpcomingEvents.map((event) => event.id),
          type: "dashboard-update",
        },
        title: summary.title,
      });
    }
  }

  await saveDashboardNotificationState({
    seenUpcomingSignatures: Array.from(currentSignatures),
    scheduledReminderIds,
  });

  return { newUpcomingEvents };
};

export const syncDashboardNotifications = async (
  params: SyncDashboardNotificationsParams,
): Promise<{
  newUpcomingEvents: TimelineEvent[];
}> => {
  let releaseQueue!: () => void;
  const waitForTurn = notificationSyncQueue;
  notificationSyncQueue = new Promise<void>((resolve) => {
    releaseQueue = resolve;
  });

  await waitForTurn;

  try {
    return await runDashboardNotificationsSync(params);
  } finally {
    releaseQueue();
  }
};
