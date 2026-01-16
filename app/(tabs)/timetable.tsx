import { CurrentClassCard } from '@/components/current-class-card'
import { Container } from '@/components/ui/container'
import { GradientCard } from '@/components/ui/gradient-card'
import { WeeklyTimetable } from '@/components/weekly-timetable'
import { Colors, Spacing } from '@/constants/theme'
import { useColorScheme } from '@/hooks/use-color-scheme'
import { useAttendanceStore } from '@/stores/attendance-store'
import { getCurrentAndNextClass, useTimetableStore } from '@/stores/timetable-store'
import { Ionicons } from '@expo/vector-icons'
import * as Haptics from 'expo-haptics'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native'

export default function TimetableScreen() {
    const colorScheme = useColorScheme()
    const isDark = colorScheme === 'dark'
    const theme = isDark ? Colors.dark : Colors.light

    const { slots, lastGeneratedAt, isLoading, generateTimetable, clearTimetable } = useTimetableStore()
    const { courses: attendanceCourses, fetchAttendance, isLoading: isAttendanceLoading } = useAttendanceStore()
    const [refreshing, setRefreshing] = useState(false)

    // generate timetable on first load or if attendance updates
    useEffect(() => {
        if (attendanceCourses.length > 0 && slots.length === 0) {
            generateTimetable()
        }
    }, [attendanceCourses.length])

    // current/next class
    const { currentClass, nextClass } = useMemo(
        () => getCurrentAndNextClass(slots),
        [slots]
    )

    // refresh: fetch attendance then regenerate timetable
    const handleRefresh = useCallback(async () => {
        setRefreshing(true)
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
        await fetchAttendance()
        generateTimetable()
        setRefreshing(false)
    }, [fetchAttendance, generateTimetable])

    // manual regenerate
    const handleRegenerate = () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
        generateTimetable()
    }

    const formatLastGenerated = (timestamp: number | null): string => {
        if (!timestamp) return ''
        const date = new Date(timestamp)
        const now = new Date()
        const isToday = date.toDateString() === now.toDateString()

        if (isToday) {
            return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
        }
        return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    }

    return (
        <Container>
            <ScrollView
                style={styles.scrollView}
                contentContainerStyle={styles.content}
                showsVerticalScrollIndicator={false}
                refreshControl={
                    <RefreshControl
                        refreshing={refreshing || isAttendanceLoading}
                        onRefresh={handleRefresh}
                        tintColor={theme.text}
                    />
                }
            >
                {/* header */}
                <View style={styles.header}>
                    <Text style={[styles.screenTitle, { color: theme.text }]}>Timetable</Text>
                    <Pressable onPress={handleRegenerate} style={styles.refreshBtn}>
                        <Ionicons name="refresh" size={20} color={theme.textSecondary} />
                    </Pressable>
                </View>

                {/* loading state */}
                {isLoading && slots.length === 0 && (
                    <View style={styles.loading}>
                        <ActivityIndicator size="large" color={theme.text} />
                        <Text style={[styles.loadingText, { color: theme.textSecondary }]}>
                            Generating timetable...
                        </Text>
                    </View>
                )}

                {/* empty state */}
                {!isLoading && slots.length === 0 && (
                    <GradientCard>
                        <View style={styles.empty}>
                            <Ionicons name="calendar-outline" size={48} color={theme.textSecondary} />
                            <Text style={[styles.emptyTitle, { color: theme.text }]}>
                                No timetable yet
                            </Text>
                            <Text style={[styles.emptyText, { color: theme.textSecondary }]}>
                                Pull to refresh to fetch attendance data and generate your timetable.
                            </Text>
                        </View>
                    </GradientCard>
                )}

                {/* current/next class card */}
                {slots.length > 0 && (
                    <>
                        <Text style={[styles.sectionTitle, { color: theme.text }]}>Up Next</Text>
                        <CurrentClassCard currentClass={currentClass} nextClass={nextClass} />

                        {/* weekly view */}
                        <View style={styles.weeklySection}>
                            <View style={styles.weeklyHeader}>
                                <Text style={[styles.sectionTitle, { color: theme.text }]}>Weekly Schedule</Text>
                                {lastGeneratedAt && (
                                    <Text style={[styles.lastGenerated, { color: theme.textSecondary }]}>
                                        Updated {formatLastGenerated(lastGeneratedAt)}
                                    </Text>
                                )}
                            </View>
                            <WeeklyTimetable slots={slots} />
                        </View>
                    </>
                )}
            </ScrollView>
        </Container>
    )
}

const styles = StyleSheet.create({
    scrollView: {
        flex: 1,
    },
    content: {
        padding: Spacing.md,
        paddingBottom: Spacing.xxl,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: Spacing.md,
    },
    screenTitle: {
        fontSize: 28,
        fontWeight: '700',
    },
    refreshBtn: {
        padding: Spacing.sm,
    },
    loading: {
        alignItems: 'center',
        paddingVertical: Spacing.xxl,
        gap: Spacing.md,
    },
    loadingText: {
        fontSize: 14,
    },
    empty: {
        alignItems: 'center',
        paddingVertical: Spacing.lg,
        gap: Spacing.sm,
    },
    emptyTitle: {
        fontSize: 18,
        fontWeight: '600',
    },
    emptyText: {
        fontSize: 14,
        textAlign: 'center',
    },
    sectionTitle: {
        fontSize: 16,
        fontWeight: '600',
        marginBottom: Spacing.sm,
        marginTop: Spacing.lg,
    },
    weeklySection: {
        marginTop: Spacing.md,
    },
    weeklyHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: Spacing.sm,
    },
    lastGenerated: {
        fontSize: 11,
    },
})
