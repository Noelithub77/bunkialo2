import { useDashboardStore } from '@/stores/dashboard-store'
import { useSettingsStore } from '@/stores/settings-store'
import type { TimelineEvent } from '@/types'
import * as Notifications from 'expo-notifications'

let refreshIntervalId: ReturnType<typeof setInterval> | null = null
const scheduledNotifications = new Map<string, string[]>()

Notifications.setNotificationHandler({
    handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: true,
        shouldShowBanner: true,
        shouldShowList: true,
        priority: Notifications.AndroidNotificationPriority.HIGH,
    }),
})

export const requestNotificationPermissions = async (): Promise<boolean> => {
    const { status: existingStatus } = await Notifications.getPermissionsAsync()
    let finalStatus = existingStatus

    if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync()
        finalStatus = status
    }

    return finalStatus === 'granted'
}

export const scheduleEventNotification = async (
    event: TimelineEvent,
    minutesBefore: number
): Promise<string | null> => {
    const notificationTime = event.timesort * 1000 - minutesBefore * 60 * 1000
    const now = Date.now()

    if (notificationTime <= now) return null

    const notificationId = await Notifications.scheduleNotificationAsync({
        content: {
            title: `${event.activityname}`,
            body: `Due in ${minutesBefore} minutes - ${event.course.shortname}`,
            data: { eventId: event.id, url: event.url },
        },
        trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: new Date(notificationTime) },
    })

    return notificationId
}

export const scheduleAllEventNotifications = async (
    events: TimelineEvent[],
    reminderMinutes: number[]
): Promise<void> => {
    const settings = useSettingsStore.getState()
    if (!settings.notificationsEnabled) return

    await cancelAllScheduledNotifications()

    for (const event of events) {
        const ids: string[] = []
        for (const mins of reminderMinutes) {
            const id = await scheduleEventNotification(event, mins)
            if (id) ids.push(id)
        }
        if (ids.length > 0) {
            scheduledNotifications.set(String(event.id), ids)
        }
    }
}

export const cancelAllScheduledNotifications = async (): Promise<void> => {
    await Notifications.cancelAllScheduledNotificationsAsync()
    scheduledNotifications.clear()
}

export const startBackgroundRefresh = (): void => {
    if (refreshIntervalId) stopBackgroundRefresh()

    const settings = useSettingsStore.getState()
    const intervalMs = settings.refreshIntervalMinutes * 60 * 1000

    const doRefresh = async () => {
        const dashboardStore = useDashboardStore.getState()
        try {
            await dashboardStore.fetchDashboard()
            const { upcomingEvents } = useDashboardStore.getState()
            const { reminders, notificationsEnabled } = useSettingsStore.getState()

            if (notificationsEnabled && upcomingEvents.length > 0) {
                await scheduleAllEventNotifications(upcomingEvents, reminders)
            }
        } catch (error) {
            dashboardStore.addLog('Background refresh failed', 'error')
        }
    }

    doRefresh()
    refreshIntervalId = setInterval(doRefresh, intervalMs)
}

export const stopBackgroundRefresh = (): void => {
    if (refreshIntervalId) {
        clearInterval(refreshIntervalId)
        refreshIntervalId = null
    }
}

export const restartBackgroundRefresh = (): void => {
    stopBackgroundRefresh()
    startBackgroundRefresh()
}
