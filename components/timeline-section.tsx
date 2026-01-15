import { Colors, Spacing } from '@/constants/theme'
import { useColorScheme } from '@/hooks/use-color-scheme'
import type { TimelineEvent } from '@/types'
import { StyleSheet, Text, View } from 'react-native'
import { EventCard } from './event-card'

type TimelineSectionProps = {
    events: TimelineEvent[]
}

const groupByDate = (events: TimelineEvent[]): Map<string, TimelineEvent[]> => {
    const groups = new Map<string, TimelineEvent[]>()

    events.forEach((event) => {
        const date = new Date(event.timesort * 1000)
        const key = date.toLocaleDateString('en-US', {
            weekday: 'long',
            month: 'long',
            day: 'numeric',
            year: 'numeric',
        })

        const existing = groups.get(key) || []
        groups.set(key, [...existing, event])
    })

    return groups
}

export const TimelineSection = ({ events }: TimelineSectionProps) => {
    const colorScheme = useColorScheme()
    const isDark = colorScheme === 'dark'
    const theme = isDark ? Colors.dark : Colors.light

    const grouped = groupByDate(events)

    if (events.length === 0) {
        return (
            <View style={styles.empty}>
                <Text style={[styles.emptyText, { color: theme.textSecondary }]}>
                    No upcoming events
                </Text>
            </View>
        )
    }

    return (
        <View style={styles.container}>
            {Array.from(grouped.entries()).map(([date, dateEvents]) => (
                <View key={date} style={styles.dateGroup}>
                    <View style={styles.dateHeader}>
                        <View style={[styles.dot, { backgroundColor: Colors.status.info }]} />
                        <Text style={[styles.dateText, { color: theme.text }]}>{date}</Text>
                    </View>
                    <View style={styles.eventsColumn}>
                        <View style={[styles.line, { backgroundColor: theme.border }]} />
                        <View style={styles.eventsList}>
                            {dateEvents.map((event) => (
                                <EventCard key={event.id} event={event} />
                            ))}
                        </View>
                    </View>
                </View>
            ))}
        </View>
    )
}

const styles = StyleSheet.create({
    container: {
        gap: Spacing.lg,
    },
    dateGroup: {
        gap: Spacing.sm,
    },
    dateHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.sm,
    },
    dot: {
        width: 10,
        height: 10,
        borderRadius: 5,
    },
    dateText: {
        fontSize: 14,
        fontWeight: '600',
    },
    eventsColumn: {
        flexDirection: 'row',
        paddingLeft: 4,
    },
    line: {
        width: 2,
        marginRight: Spacing.md,
    },
    eventsList: {
        flex: 1,
        gap: Spacing.sm,
    },
    empty: {
        alignItems: 'center',
        paddingVertical: Spacing.xl,
    },
    emptyText: {
        fontSize: 14,
    },
})
