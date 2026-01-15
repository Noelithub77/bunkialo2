import { Colors, Radius, Spacing } from '@/constants/theme'
import { useColorScheme } from '@/hooks/use-color-scheme'
import type { TimelineEvent } from '@/types'
import { Ionicons } from '@expo/vector-icons'
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native'

type EventCardProps = {
    event: TimelineEvent
    isOverdue?: boolean
}

const formatRelativeTime = (timestamp: number): string => {
    const now = Date.now()
    const diff = timestamp * 1000 - now
    const absDiff = Math.abs(diff)

    const minutes = Math.floor(absDiff / (1000 * 60))
    const hours = Math.floor(absDiff / (1000 * 60 * 60))
    const days = Math.floor(absDiff / (1000 * 60 * 60 * 24))

    if (diff < 0) {
        if (days > 0) return `${days}d overdue`
        if (hours > 0) return `${hours}h overdue`
        return `${minutes}m overdue`
    }

    if (days > 0) return `in ${days}d`
    if (hours > 0) return `in ${hours}h`
    return `in ${minutes}m`
}

const formatDate = (timestamp: number): string => {
    const date = new Date(timestamp * 1000)
    return date.toLocaleDateString('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
    })
}

const formatTime = (timestamp: number): string => {
    const date = new Date(timestamp * 1000)
    return date.toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
    })
}

export const EventCard = ({ event, isOverdue }: EventCardProps) => {
    const colorScheme = useColorScheme()
    const isDark = colorScheme === 'dark'
    const theme = isDark ? Colors.dark : Colors.light

    const openOnLms = () => {
        Linking.openURL(event.url)
    }

    return (
        <View style={[styles.card, { backgroundColor: theme.backgroundSecondary, borderColor: isOverdue ? Colors.status.danger : theme.border }]}>
            <View style={styles.header}>
                <View style={[styles.iconBox, { backgroundColor: isOverdue ? Colors.status.danger : Colors.status.info }]}>
                    <Ionicons name="document-text-outline" size={16} color={Colors.white} />
                </View>
                <View style={styles.meta}>
                    <Text style={[styles.course, { color: theme.textSecondary }]} numberOfLines={1}>
                        {event.course.shortname}
                    </Text>
                    <Text style={[styles.time, { color: isOverdue ? Colors.status.danger : theme.textSecondary }]}>
                        {formatRelativeTime(event.timesort)}
                    </Text>
                </View>
            </View>

            <Text style={[styles.title, { color: theme.text }]} numberOfLines={2}>
                {event.activityname}
            </Text>

            <Text style={[styles.subtitle, { color: theme.textSecondary }]}>
                {formatDate(event.timesort)} at {formatTime(event.timesort)}
            </Text>

            <Pressable
                style={({ pressed }) => [
                    styles.button,
                    { backgroundColor: pressed ? theme.border : 'transparent', borderColor: theme.border }
                ]}
                onPress={openOnLms}
            >
                <Text style={[styles.buttonText, { color: theme.text }]}>View on LMS</Text>
                <Ionicons name="open-outline" size={14} color={theme.textSecondary} />
            </Pressable>
        </View>
    )
}

const styles = StyleSheet.create({
    card: {
        padding: Spacing.md,
        borderRadius: Radius.md,
        borderWidth: 1,
        gap: Spacing.sm,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.sm,
    },
    iconBox: {
        width: 28,
        height: 28,
        borderRadius: Radius.sm,
        alignItems: 'center',
        justifyContent: 'center',
    },
    meta: {
        flex: 1,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    course: {
        fontSize: 12,
        fontWeight: '500',
    },
    time: {
        fontSize: 12,
        fontWeight: '600',
    },
    title: {
        fontSize: 15,
        fontWeight: '600',
        lineHeight: 20,
    },
    subtitle: {
        fontSize: 13,
    },
    button: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: Spacing.xs,
        paddingVertical: Spacing.sm,
        borderRadius: Radius.sm,
        borderWidth: 1,
        marginTop: Spacing.xs,
    },
    buttonText: {
        fontSize: 13,
        fontWeight: '500',
    },
})
