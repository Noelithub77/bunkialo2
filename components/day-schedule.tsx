import { Colors, Radius, Spacing } from '@/constants/theme'
import { useColorScheme } from '@/hooks/use-color-scheme'
import { useBunkStore } from '@/stores/bunk-store'
import { formatTimeDisplay } from '@/stores/timetable-store'
import type { DayOfWeek, TimetableSlot } from '@/types'
import { Ionicons } from '@expo/vector-icons'
import { useMemo } from 'react'
import { StyleSheet, Text, View } from 'react-native'

interface DayScheduleProps {
    slots: TimetableSlot[]
    selectedDay: DayOfWeek
}

export function DaySchedule({ slots, selectedDay }: DayScheduleProps) {
    const colorScheme = useColorScheme()
    const isDark = colorScheme === 'dark'
    const theme = isDark ? Colors.dark : Colors.light
    const bunkCourses = useBunkStore((state) => state.courses)

    const getCourseColor = (courseId: string): string => {
        const course = bunkCourses.find(c => c.courseId === courseId)
        return course?.config?.color || Colors.courseColors[0]
    }

    const daySlots = useMemo(() => {
        return slots
            .filter(s => s.dayOfWeek === selectedDay)
            .sort((a, b) => a.startTime.localeCompare(b.startTime))
    }, [slots, selectedDay])

    const now = new Date()
    const currentDay = now.getDay() as DayOfWeek
    const currentTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`
    const isToday = selectedDay === currentDay

    if (daySlots.length === 0) {
        return (
            <View style={[styles.emptyContainer, { backgroundColor: theme.backgroundSecondary }]}>
                <Ionicons name="cafe-outline" size={32} color={theme.textSecondary} />
                <Text style={[styles.emptyText, { color: theme.textSecondary }]}>
                    No classes scheduled
                </Text>
            </View>
        )
    }

    return (
        <View style={styles.container}>
            {daySlots.map((slot, index) => {
                const courseColor = getCourseColor(slot.courseId)
                const isNow = isToday && currentTime >= slot.startTime && currentTime < slot.endTime
                const isPast = isToday && currentTime >= slot.endTime

                return (
                    <View key={slot.id} style={styles.slotRow}>
                        {/* time column */}
                        <View style={styles.timeColumn}>
                            <Text style={[styles.timeText, { color: isPast ? theme.textSecondary : theme.text }]}>
                                {formatTimeDisplay(slot.startTime)}
                            </Text>
                            <Text style={[styles.timeDash, { color: theme.textSecondary }]}>-</Text>
                            <Text style={[styles.timeText, { color: isPast ? theme.textSecondary : theme.textSecondary }]}>
                                {formatTimeDisplay(slot.endTime)}
                            </Text>
                        </View>

                        {/* timeline indicator */}
                        <View style={styles.timeline}>
                            <View
                                style={[
                                    styles.timelineDot,
                                    { backgroundColor: isNow ? Colors.status.success : courseColor },
                                    isPast && { opacity: 0.4 },
                                ]}
                            />
                            {index < daySlots.length - 1 && (
                                <View style={[styles.timelineLine, { backgroundColor: theme.border }]} />
                            )}
                        </View>

                        {/* slot card */}
                        <View
                            style={[
                                styles.slotCard,
                                { backgroundColor: courseColor + (isPast ? '30' : '20') },
                                { borderLeftColor: courseColor, borderLeftWidth: 3 },
                                isNow && styles.nowCard,
                            ]}
                        >
                            <View style={styles.cardHeader}>
                                <Text
                                    style={[styles.courseName, { color: isPast ? theme.textSecondary : theme.text }]}
                                    numberOfLines={1}
                                >
                                    {slot.courseName}
                                </Text>
                                {isNow && (
                                    <View style={[styles.nowBadge, { backgroundColor: Colors.status.success }]}>
                                        <Text style={styles.nowText}>NOW</Text>
                                    </View>
                                )}
                            </View>
                            <View style={styles.cardFooter}>
                                <View style={[styles.typeBadge, { backgroundColor: theme.backgroundSecondary }]}>
                                    <Text style={[styles.typeText, { color: theme.textSecondary }]}>
                                        {slot.sessionType.charAt(0).toUpperCase() + slot.sessionType.slice(1)}
                                    </Text>
                                </View>
                            </View>
                        </View>
                    </View>
                )
            })}
        </View>
    )
}

const styles = StyleSheet.create({
    container: {
        gap: Spacing.xs,
    },
    emptyContainer: {
        borderRadius: Radius.lg,
        padding: Spacing.xl,
        alignItems: 'center',
        justifyContent: 'center',
        gap: Spacing.sm,
    },
    emptyText: {
        fontSize: 14,
    },
    slotRow: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        minHeight: 72,
    },
    timeColumn: {
        width: 56,
        alignItems: 'flex-end',
        paddingRight: Spacing.sm,
        paddingTop: 2,
    },
    timeText: {
        fontSize: 11,
        fontWeight: '500',
    },
    timeDash: {
        fontSize: 10,
    },
    timeline: {
        width: 20,
        alignItems: 'center',
    },
    timelineDot: {
        width: 10,
        height: 10,
        borderRadius: 5,
        marginTop: 4,
    },
    timelineLine: {
        width: 2,
        flex: 1,
        marginTop: 4,
    },
    slotCard: {
        flex: 1,
        borderRadius: Radius.md,
        padding: Spacing.md,
        marginLeft: Spacing.sm,
    },
    nowCard: {
        borderWidth: 1,
        borderColor: Colors.status.success,
    },
    cardHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: Spacing.sm,
    },
    courseName: {
        fontSize: 14,
        fontWeight: '600',
        flex: 1,
    },
    nowBadge: {
        paddingHorizontal: Spacing.xs,
        paddingVertical: 2,
        borderRadius: Radius.sm,
    },
    nowText: {
        fontSize: 9,
        fontWeight: '700',
        color: Colors.white,
    },
    cardFooter: {
        marginTop: Spacing.xs,
    },
    typeBadge: {
        alignSelf: 'flex-start',
        paddingHorizontal: Spacing.sm,
        paddingVertical: 2,
        borderRadius: Radius.sm,
    },
    typeText: {
        fontSize: 10,
    },
})
