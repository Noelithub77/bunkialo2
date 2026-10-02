import { isVisibleAcademicEvent } from "@/utils/academic-event-visibility";
import { ACADEMIC_EVENTS } from "@/data/acad-cal";
import { useAcademicCalendarStore } from "@/stores/academic-calendar-store";
import { useAcademicCalendarFeedStore } from "@/stores/academic-calendar-feed-store";
import {
  mergeCalendarReminders,
  getCalendarReminderTime,
  getCalendarReminderMinutes,
} from "@/utils/calendar-reminders";
import { notificationIdentifier } from "@/utils/portal-notification";
import {
  DASHBOARD_NOTIFICATION_CHANNELS,
  DASHBOARD_NOTIFICATION_STORAGE_KEY,
  LEGACY_DASHBOARD_NOTIFICATION_STORAGE_KEY,
} from "@/constants/dashboard";
import type { AcademicEvent, TimelineEvent } from "@/types";
import {
  cancelNotificationRequests,
  ensureNotificationChannels,
  hasNotificationPermissions,
  getScheduledNotificationIds,
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
  academicEvents?: AcademicEvent[];
  notificationsEnabled: boolean;
  reminderMinutes: number[];
  source: DashboardSyncSource;
  upcomingEvents: TimelineEvent[];
};

type ReminderEvent = {
  body: (minutesBefore: number) => string;
  data: Record<string, unknown>;
  id: string;
  startAt: number;
  title: string;
  reminderMinutes?: number[];
  type: "academic-calendar-reminder" | "dashboard-reminder";
};

const EMPTY_NOTIFICATION_STATE: DashboardNotificationState = {
  seenUpcomingSignatures: [],
  scheduledReminderIds: {},
};

let legacyMigrationPromise: Promise<void> | null = null;
let notificationSyncQueue: Promise<void> = Promise.resolve();

const getReminderSignature = (
  event: ReminderEvent,
  minutesBefore: number,
): string =>
  `${event.type}:${event.id}:${event.startAt}:${minutesBefore}:${notificationIdentifier(JSON.stringify([event.title, event.body(minutesBefore), event.data]))}`;

const toReminderEvents = (
  upcomingEvents: TimelineEvent[],
  academicEvents: AcademicEvent[],
): ReminderEvent[] => [
  ...dedupeTimelineEvents(upcomingEvents).map((event) => ({
    body: (minutesBefore: number) =>
      `Due in ${minutesBefore} minutes - ${event.course.shortname}`,
    data: {
      eventId: event.id,
      type: "dashboard-reminder",
      url: event.url,
    },
    id: `${event.id}`,
    startAt: event.timesort * 1000,
    title: event.activityname,
    type: "dashboard-reminder" as const,
  })),
  ...academicEvents.flatMap((event) => {
    if (!isVisibleAcademicEvent(event)) return [];
    const startAt = getCalendarReminderTime(event);
    if (startAt === null) return [];

    return [
      {
        body: (minutesBefore: number) =>
          `${event.deadlineAt ? "Due" : "Starts"} in ${minutesBefore} min${event.location ? ` · ${event.location}` : ""}`,
        data: {
          calendarUrl: event.calendarUrl,
          route: "/acad-cal",
          eventId: event.id,
          type: "academic-calendar-reminder",
        },
        id: event.id,
        startAt,
        title: event.title,
        reminderMinutes: getCalendarReminderMinutes(event),
        type: "academic-calendar-reminder" as const,
      },
    ];
  }),
];

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

    const raw = await zustandStorage.getItem(
      DASHBOARD_NOTIFICATION_STORAGE_KEY,
    );
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

const planReminders = (events: ReminderEvent[], defaultMinutes: number[]) =>
  events.flatMap((event) => [...new Set(event.reminderMinutes ?? defaultMinutes)]
    .filter((minutes) => Number.isFinite(minutes) && minutes > 0)
    .map((minutesBefore) => ({ event, minutesBefore, scheduledAt: event.startAt - minutesBefore * 60000, signature: getReminderSignature(event, minutesBefore) })))
    .filter((reminder) => reminder.scheduledAt > Date.now())
    .sort((a, b) => a.scheduledAt - b.scheduledAt || a.signature.localeCompare(b.signature))
    .slice(0, 60);

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
  reminderEvents: ReminderEvent[],
  reminderMinutes: number[],
): Promise<Record<string, string>> => {
  const scheduledReminderIds: Record<string, string> = {};
  for (const {event, minutesBefore, scheduledAt, signature: reminderSignature} of planReminders(reminderEvents, reminderMinutes)) {
    const existingNotificationId = previousReminderIds[reminderSignature];
    if (existingNotificationId) {
      scheduledReminderIds[reminderSignature] = existingNotificationId;
      continue;
    }
    const notificationId = await scheduleDateNotification({
      identifier: notificationIdentifier(reminderSignature),
      body: event.body(minutesBefore),
      channelId: DASHBOARD_NOTIFICATION_CHANNELS.reminders,
      data: { ...event.data, reminderMinutes: minutesBefore },
      date: scheduledAt,
      title: event.title,
    });
    scheduledReminderIds[reminderSignature] = notificationId;
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
  academicEvents = [],
  notificationsEnabled,
  reminderMinutes,
  source,
  upcomingEvents,
}: SyncDashboardNotificationsParams): Promise<{
  newUpcomingEvents: TimelineEvent[];
}> => {
  const dedupedUpcomingEvents = dedupeTimelineEvents(upcomingEvents);
  const calendar = useAcademicCalendarStore.getState();
  const allAcademicEvents = mergeCalendarReminders(
    [
      ...ACADEMIC_EVENTS,
      ...calendar.customEvents,
      ...useAcademicCalendarFeedStore.getState().googleEvents,
      ...academicEvents,
    ],
    calendar.overrides,
  );
  const reminderEvents = toReminderEvents(
    dedupedUpcomingEvents,
    allAcademicEvents,
  );
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

  const nextReminderKeys = new Set(planReminders(reminderEvents, reminderMinutes).map((reminder) => reminder.signature));
  const staleReminderIds = Object.entries(previousState.scheduledReminderIds)
    .filter(([reminderSignature]) => !nextReminderKeys.has(reminderSignature))
    .map(([, notificationId]) => notificationId);

  if (staleReminderIds.length > 0) {
    await cancelNotificationRequests(staleReminderIds);
  }

  const scheduledIds = await getScheduledNotificationIds();
  const pendingIds = new Set(scheduledIds ?? Object.values(previousState.scheduledReminderIds));
  const validExisting = Object.fromEntries(
    Object.entries(previousState.scheduledReminderIds).filter(([, id]) =>
      pendingIds.has(id),
    ),
  );
  const scheduledReminderIds = await buildReminderNotifications(
    validExisting,
    reminderEvents,
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
