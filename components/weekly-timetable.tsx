import { Colors, Radius, Spacing } from '@/constants/theme'
import { useColorScheme } from '@/hooks/use-color-scheme'
import { useBunkStore } from '@/stores/bunk-store'
import { formatTimeDisplay, getDayName } from '@/stores/timetable-store'
import type { DayOfWeek, TimetableSlot } from '@/types'
import { useMemo } from 'react'
import { ScrollView, StyleSheet, Text, View } from 'react-native'

interface WeeklyTimetableProps {
    slots: TimetableSlot[]
}

const DAYS: DayOfWeek[] = [1, 2, 3, 4, 5, 6] // Mon-Sat

export function WeeklyTimetable({ slots }: WeeklyTimetableProps) {
    const colorScheme = useColorScheme()
    const isDark = colorScheme === 'dark'
    const theme = isDark ? Colors.dark : Colors.light
    const bunkCourses = useBunkStore((state) => state.courses)

    // get course color
    const getCourseColor = (courseId: string): string => {
        const course = bunkCourses.find(c => c.courseId === courseId)
        return course?.config?.color || Colors.courseColors[0]
    }

    // group slots by day
    const slotsByDay = useMemo(() => {
        const grouped = new Map<DayOfWeek, TimetableSlot[]>()
        DAYS.forEach(day => grouped.set(day, []))

        slots.forEach(slot => {
            if (DAYS.includes(slot.dayOfWeek)) {
                grouped.get(slot.dayOfWeek)!.push(slot)
            }
        })

        // sort each day's slots by time
        grouped.forEach((daySlots) => {
            daySlots.sort((a, b) => a.startTime.localeCompare(b.startTime))
        })

        return grouped
    }, [slots])

    const currentDay = new Date().getDay() as DayOfWeek
    const currentTime = `${new Date().getHours().toString().padStart(2, '0')}:${new Date().getMinutes().toString().padStart(2, '0')}`

    return (
        <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
            {DAYS.map((day) => {
                const daySlots = slotsByDay.get(day) || []
                const isToday = day === currentDay

                return (
                    <View key={day} style={[styles.dayRow, isToday && styles.todayRow]}>
                        {/* day label */}
                        <View style={[styles.dayLabel, isToday && { backgroundColor: theme.text }]}>
                            <Text style={[styles.dayText, isToday && { color: theme.background }]}>
                                {getDayName(day)}
                            </Text>
                        </View>

                        {/* slots */}
                        <View style={styles.slotsContainer}>
                            {daySlots.length === 0 ? (
                                <Text style={[styles.noSlots, { color: theme.textSecondary }]}>No classes</Text>
                            ) : (
                                daySlots.map((slot) => {
                                    const courseColor = getCourseColor(slot.courseId)
                                    const isNow = isToday && currentTime >= slot.startTime && currentTime < slot.endTime
                                    const isPast = isToday && currentTime >= slot.endTime

                                    return (
                                        <View
                                            key={slot.id}
                                            style={[
                                                styles.slotCard,
                                                { backgroundColor: courseColor + (isPast ? '40' : 'CC') },
                                                isNow && styles.nowCard,
                                            ]}
                                        >
                                            <View style={styles.slotHeader}>
                                                <Text style={[styles.slotTime, isPast && styles.pastText]} numberOfLines={1}>
                                                    {formatTimeDisplay(slot.startTime)} - {formatTimeDisplay(slot.endTime)}
                                                </Text>
                                                {isNow && (
                                                    <View style={styles.nowBadge}>
                                                        <Text style={styles.nowText}>NOW</Text>
                                                    </View>
                                                )}
                                            </View>
                                            <Text style={[styles.slotName, isPast && styles.pastText]} numberOfLines={1}>
                                                {slot.courseName}
                                            </Text>
                                            <Text style={[styles.slotType, isPast && styles.pastText]}>
                                                {slot.sessionType.charAt(0).toUpperCase() + slot.sessionType.slice(1)}
                                            </Text>
                                        </View>
                                    )
                                })
                            )}
                        </View>
                    </View>
                )
            })}
        </ScrollView>
    )
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    dayRow: {
        flexDirection: 'row',
        marginBottom: Spacing.md,
        gap: Spacing.sm,
    },
    todayRow: {
        // highlight today
    },
    dayLabel: {
        width: 40,
        paddingVertical: Spacing.xs,
        borderRadius: Radius.sm,
        alignItems: 'center',
        justifyContent: 'center',
    },
    dayText: {
        fontSize: 12,
        fontWeight: '600',
        color: Colors.gray[500],
    },
    slotsContainer: {
        flex: 1,
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: Spacing.xs,
    },
    noSlots: {
        fontSize: 12,
        paddingVertical: Spacing.sm,
    },
    slotCard: {
        paddingHorizontal: Spacing.sm,
        paddingVertical: Spacing.xs,
        borderRadius: Radius.sm,
        minWidth: 100,
    },
    nowCard: {
        borderWidth: 2,
        borderColor: Colors.status.success,
    },
    slotHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.xs,
    },
    slotTime: {
        fontSize: 10,
        fontWeight: '500',
        color: Colors.white,
    },
    nowBadge: {
        backgroundColor: Colors.status.success,
        paddingHorizontal: 4,
        paddingVertical: 1,
        borderRadius: 4,
    },
    nowText: {
        fontSize: 8,
        fontWeight: '700',
        color: Colors.white,
    },
    slotName: {
        fontSize: 12,
        fontWeight: '600',
        color: Colors.white,
        marginTop: 2,
    },
    slotType: {
        fontSize: 9,
        color: 'rgba(255,255,255,0.8)',
    },
    pastText: {
        opacity: 0.6,
    },
})
