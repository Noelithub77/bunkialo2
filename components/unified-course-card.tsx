import { SwipeableBunkItem } from '@/components/swipeable-bunk-item'
import { GradientCard } from '@/components/ui/gradient-card'
import { CalendarTheme, Colors, Radius, Spacing } from '@/constants/theme'
import { useColorScheme } from '@/hooks/use-color-scheme'
import { filterPastBunks, selectCourseStats } from '@/stores/bunk-store'
import type { AttendanceRecord, AttendanceStatus, BunkRecord, CourseAttendance, CourseBunkData, MarkedDates, SessionType } from '@/types'
import { Ionicons } from '@expo/vector-icons'
import { useMemo, useState } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import { Calendar, DateData } from 'react-native-calendars'

interface UnifiedCourseCardProps {
    course: CourseAttendance
    bunkData: CourseBunkData | undefined
    isEditMode: boolean
    onEdit: () => void
    onAddBunk: () => void
    onMarkDL: (bunkId: string) => void
    onRemoveDL: (bunkId: string) => void
    onMarkPresent: (bunkId: string) => void
    onRemovePresent: (bunkId: string) => void
    onUpdateNote: (bunkId: string, note: string) => void
}

// 80% threshold
const getPercentageColor = (percentage: number) =>
    percentage >= 80 ? Colors.status.success : Colors.status.danger

// parse time slot and return duration in hours
const parseDurationInHours = (timeSlot: string | null): number => {
    if (!timeSlot) return 0
    const timeMatch = timeSlot.match(/(\d{1,2})(?::(\d{2}))?(AM|PM)\s*-\s*(\d{1,2})(?::(\d{2}))?(AM|PM)/i)
    if (!timeMatch) return 0

    const [, startHour, startMin, startMeridiem, endHour, endMin, endMeridiem] = timeMatch
    const startHours24 = (parseInt(startHour) % 12) + (startMeridiem.toUpperCase() === 'PM' ? 12 : 0)
    const endHours24 = (parseInt(endHour) % 12) + (endMeridiem.toUpperCase() === 'PM' ? 12 : 0)
    const startMinutes = startHours24 * 60 + (startMin ? parseInt(startMin) : 0)
    const endMinutes = endHours24 * 60 + (endMin ? parseInt(endMin) : 0)
    return (endMinutes - startMinutes) / 60
}

const getSessionType = (desc: string, dateStr: string): SessionType => {
    const lower = desc.toLowerCase()
    if (lower.includes('tutorial')) return 'tutorial'

    const { time } = parseDateString(dateStr)
    if (parseDurationInHours(time) >= 2) return 'lab'
    if (lower.includes('lab')) return 'lab'

    return 'regular'
}

// parse "Thu 1 Jan 2026 11AM - 12PM" -> { date: "2026-01-01", time: "11AM - 12PM" }
const parseDateString = (dateStr: string): { date: string | null; time: string | null } => {
    const cleaned = dateStr.trim()
    const timeMatch = cleaned.match(/(\d{1,2}(?::\d{2})?(?:AM|PM)\s*-\s*\d{1,2}(?::\d{2})?(?:AM|PM))/i)
    const time = timeMatch ? timeMatch[1] : null

    const dateMatch = cleaned.match(/(\d{1,2})\s+(\w{3})\s+(\d{4})/)
    if (!dateMatch) return { date: null, time }

    const [, day, monthStr, year] = dateMatch
    const months: Record<string, string> = {
        jan: '01', feb: '02', mar: '03', apr: '04', may: '05', jun: '06',
        jul: '07', aug: '08', sep: '09', oct: '10', nov: '11', dec: '12'
    }
    const month = months[monthStr.toLowerCase()]
    if (!month) return { date: null, time }

    return { date: `${year}-${month}-${day.padStart(2, '0')}`, time }
}

// filter records up to today only
const filterPastRecords = (records: AttendanceRecord[]): AttendanceRecord[] => {
    const today = new Date()
    today.setHours(23, 59, 59, 999)
    return records.filter(record => {
        const { date } = parseDateString(record.date)
        if (!date) return false
        return new Date(date) <= today
    })
}

// status to color
const getStatusColor = (status: AttendanceStatus): string => {
    switch (status) {
        case 'Present': return Colors.status.success
        case 'Absent': return Colors.status.danger
        case 'Late': return Colors.status.warning
        case 'Excused': return Colors.status.info
        case 'Unknown': return Colors.status.unknown
    }
}

const buildMarkedDates = (records: AttendanceRecord[], selectedDate: string | null): MarkedDates => {
    const marked: MarkedDates = {}

    for (const record of records) {
        const { date } = parseDateString(record.date)
        if (!date) continue

        const color = getStatusColor(record.status)
        const sessionType = getSessionType(record.description, record.date)

        if (!marked[date]) {
            marked[date] = { dots: [] }
        }
        marked[date].dots.push({
            key: `${sessionType}-${record.status}-${marked[date].dots.length}`,
            color,
        })
    }

    // mark selected date
    if (selectedDate && marked[selectedDate]) {
        marked[selectedDate] = { ...marked[selectedDate], selected: true }
    }

    return marked
}

const getMostRecentDate = (records: AttendanceRecord[]): string | null => {
    let mostRecent: string | null = null
    let mostRecentTime = 0
    for (const record of records) {
        const { date } = parseDateString(record.date)
        if (!date) continue
        const time = new Date(date).getTime()
        if (time > mostRecentTime) {
            mostRecentTime = time
            mostRecent = date
        }
    }
    return mostRecent
}

export function UnifiedCourseCard({
    course,
    bunkData,
    isEditMode,
    onEdit,
    onAddBunk,
    onMarkDL,
    onRemoveDL,
    onMarkPresent,
    onRemovePresent,
    onUpdateNote,
}: UnifiedCourseCardProps) {
    const [expanded, setExpanded] = useState(false)
    const [selectedDate, setSelectedDate] = useState<string | null>(null)
    const [showTotal, setShowTotal] = useState(false)
    const colorScheme = useColorScheme()
    const isDark = colorScheme === 'dark'
    const theme = isDark ? Colors.dark : Colors.light
    const calTheme = isDark ? CalendarTheme.dark : CalendarTheme.light

    const courseAlias = bunkData?.config?.alias || course.courseName
    const courseColor = bunkData?.config?.color
    const isConfigured = bunkData?.isConfigured && bunkData?.config

    // attendance stats (past only)
    const pastRecords = useMemo(() => filterPastRecords(course.records), [course.records])
    const totalSessions = pastRecords.length
    const attended = pastRecords.filter(r => r.status === 'Present').length
    const percentage = totalSessions > 0 ? Math.round((attended / totalSessions) * 100) : 0
    const percentageColor = getPercentageColor(percentage)

    // bunk stats
    const stats = bunkData ? selectCourseStats(bunkData) : null
    const pastBunks = bunkData ? filterPastBunks(bunkData.bunks) : []

    // bunks display
    const bunksDisplay = showTotal
        ? `${stats?.usedBunks ?? 0}/${stats?.totalBunks ?? 0}`
        : (stats?.bunksLeft ?? 0).toString()
    const bunksLabel = showTotal ? 'used' : 'left'
    const bunksColor = !isConfigured
        ? theme.textSecondary
        : (stats?.bunksLeft ?? 0) <= 0
            ? Colors.status.danger
            : (stats?.bunksLeft ?? 0) <= 3
                ? Colors.status.warning
                : Colors.status.success

    // calendar data
    const markedDates = useMemo(() => buildMarkedDates(pastRecords, selectedDate), [pastRecords, selectedDate])
    const initialDate = useMemo(() => getMostRecentDate(pastRecords), [pastRecords])

    // bunks for selected date
    const selectedBunks = useMemo((): BunkRecord[] => {
        if (!selectedDate || !bunkData) return []
        return pastBunks.filter(bunk => {
            const { date } = parseDateString(bunk.date)
            return date === selectedDate
        })
    }, [selectedDate, pastBunks, bunkData])

    const handleCardPress = () => {
        if (isEditMode) {
            onEdit()
        } else {
            setExpanded(!expanded)
        }
    }

    const handleDayPress = (day: DateData) => {
        setSelectedDate(prev => prev === day.dateString ? null : day.dateString)
    }

    if (totalSessions === 0 && pastBunks.length === 0) {
        return (
            <GradientCard>
                <View style={styles.header}>
                    <View style={styles.headerLeft}>
                        {courseColor && <View style={[styles.colorDot, { backgroundColor: courseColor }]} />}
                        <Text style={[styles.courseName, { color: theme.text }]} numberOfLines={2}>
                            {courseAlias}
                        </Text>
                    </View>
                    <Text style={[styles.noData, { color: theme.textSecondary }]}>
                        No data
                    </Text>
                </View>
            </GradientCard>
        )
    }

    return (
        <GradientCard>
            <Pressable onPress={handleCardPress} style={isEditMode && styles.editModeCard}>
                <View style={styles.header}>
                    <View style={styles.headerLeft}>
                        {courseColor && <View style={[styles.colorDot, { backgroundColor: courseColor }]} />}
                        <View style={styles.headerInfo}>
                            <Text style={[styles.courseName, { color: theme.text }]} numberOfLines={2}>
                                {courseAlias}
                            </Text>
                            <Text style={[styles.sessionCount, { color: theme.textSecondary }]}>
                                {attended} / {totalSessions} sessions
                            </Text>
                        </View>
                    </View>

                    <View style={styles.headerRight}>
                        {/* attendance percentage */}
                        <Text style={[styles.percentage, { color: percentageColor }]}>
                            {percentage}%
                        </Text>

                        {/* bunks left or setup */}
                        {isConfigured ? (
                            <Pressable onPress={(e) => { e.stopPropagation(); setShowTotal(!showTotal) }}>
                                <View style={styles.bunksDisplay}>
                                    <Text style={[styles.bunksValue, showTotal && styles.bunksValueSmall, { color: bunksColor }]}>
                                        {bunksDisplay}
                                    </Text>
                                    <Text style={[styles.bunksLabel, { color: theme.textSecondary }]}>{bunksLabel}</Text>
                                </View>
                            </Pressable>
                        ) : (
                            <Pressable onPress={(e) => { e.stopPropagation(); onEdit() }} style={[styles.configBtn, { borderColor: Colors.status.warning }]}>
                                <Ionicons name="settings-outline" size={14} color={Colors.status.warning} />
                                <Text style={[styles.configText, { color: Colors.status.warning }]}>Setup</Text>
                            </Pressable>
                        )}

                        <Ionicons
                            name={expanded ? 'chevron-up' : 'chevron-down'}
                            size={20}
                            color={theme.textSecondary}
                        />
                    </View>
                </View>
            </Pressable>

            {expanded && (
                <View style={styles.expandedContent}>
                    <View style={[styles.divider, { backgroundColor: theme.border }]} />

                    {/* calendar */}
                    <Calendar
                        markingType="multi-dot"
                        markedDates={markedDates}
                        initialDate={initialDate || undefined}
                        onDayPress={handleDayPress}
                        enableSwipeMonths
                        hideExtraDays
                        theme={{
                            calendarBackground: calTheme.calendarBackground,
                            dayTextColor: calTheme.dayTextColor,
                            textDisabledColor: calTheme.textDisabledColor,
                            monthTextColor: calTheme.monthTextColor,
                            arrowColor: calTheme.arrowColor,
                            todayTextColor: calTheme.todayTextColor,
                            textDayFontSize: 14,
                            textMonthFontSize: 14,
                            textMonthFontWeight: '600',
                        }}
                    />

                    {/* selected date bunks */}
                    {selectedDate && selectedBunks.length > 0 && (
                        <View style={[styles.sessionDetails, { borderTopColor: theme.border }]}>
                            {selectedBunks.map((bunk) => (
                                <SwipeableBunkItem
                                    key={bunk.id}
                                    bunk={bunk}
                                    onMarkDL={() => onMarkDL(bunk.id)}
                                    onRemoveDL={() => onRemoveDL(bunk.id)}
                                    onMarkPresent={() => onMarkPresent(bunk.id)}
                                    onRemovePresent={() => onRemovePresent(bunk.id)}
                                    onUpdateNote={(note) => onUpdateNote(bunk.id, note)}
                                />
                            ))}
                        </View>
                    )}

                    {/* bunk list (all past absences) */}
                    {pastBunks.length > 0 && (
                        <View style={styles.bunkSection}>
                            <Text style={[styles.sectionTitle, { color: theme.textSecondary }]}>
                                Absences ({pastBunks.length})
                            </Text>
                            <View style={styles.bunksList}>
                                {pastBunks.map((bunk) => (
                                    <SwipeableBunkItem
                                        key={bunk.id}
                                        bunk={bunk}
                                        onMarkDL={() => onMarkDL(bunk.id)}
                                        onRemoveDL={() => onRemoveDL(bunk.id)}
                                        onMarkPresent={() => onMarkPresent(bunk.id)}
                                        onRemovePresent={() => onRemovePresent(bunk.id)}
                                        onUpdateNote={(note) => onUpdateNote(bunk.id, note)}
                                    />
                                ))}
                            </View>
                        </View>
                    )}

                    {/* add bunk button */}
                    <Pressable onPress={onAddBunk} style={[styles.addBunkBtn, { borderColor: theme.border }]}>
                        <Ionicons name="add-circle-outline" size={16} color={theme.textSecondary} />
                        <Text style={[styles.addBunkText, { color: theme.textSecondary }]}>Add Bunk</Text>
                    </Pressable>

                    {/* swipe hint */}
                    {pastBunks.length > 0 && (
                        <Text style={[styles.swipeHint, { color: theme.textSecondary }]}>
                            Swipe left = Present · Swipe right = DL
                        </Text>
                    )}

                    {/* legend */}
                    <View style={styles.legend}>
                        <View style={styles.legendItem}>
                            <View style={[styles.legendDot, { backgroundColor: Colors.status.success }]} />
                            <Text style={[styles.legendText, { color: theme.textSecondary }]}>P</Text>
                        </View>
                        <View style={styles.legendItem}>
                            <View style={[styles.legendDot, { backgroundColor: Colors.status.danger }]} />
                            <Text style={[styles.legendText, { color: theme.textSecondary }]}>A</Text>
                        </View>
                        <View style={styles.legendItem}>
                            <View style={[styles.legendDot, { backgroundColor: Colors.status.unknown }]} />
                            <Text style={[styles.legendText, { color: theme.textSecondary }]}>?</Text>
                        </View>
                    </View>
                </View>
            )}
        </GradientCard>
    )
}

const styles = StyleSheet.create({
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
    },
    headerLeft: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: Spacing.sm,
        marginRight: Spacing.md,
    },
    colorDot: {
        width: 12,
        height: 12,
        borderRadius: 6,
        marginTop: 4,
    },
    headerInfo: {
        flex: 1,
    },
    headerRight: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.sm,
    },
    courseName: {
        fontSize: 16,
        fontWeight: '600',
    },
    sessionCount: {
        fontSize: 13,
        marginTop: 4,
    },
    percentage: {
        fontSize: 20,
        fontWeight: '700',
    },
    bunksDisplay: {
        alignItems: 'center',
    },
    bunksValue: {
        fontSize: 18,
        fontWeight: '700',
    },
    bunksValueSmall: {
        fontSize: 14,
    },
    bunksLabel: {
        fontSize: 9,
    },
    configBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        paddingHorizontal: Spacing.sm,
        paddingVertical: Spacing.xs,
        borderWidth: 1,
        borderRadius: Radius.sm,
    },
    configText: {
        fontSize: 12,
        fontWeight: '500',
    },
    editModeCard: {
        opacity: 0.8,
    },
    noData: {
        fontSize: 13,
    },
    expandedContent: {
        marginTop: Spacing.md,
    },
    divider: {
        height: 1,
        marginBottom: Spacing.md,
    },
    sessionDetails: {
        marginTop: Spacing.sm,
        paddingTop: Spacing.sm,
        borderTopWidth: 1,
    },
    bunkSection: {
        marginTop: Spacing.md,
    },
    sectionTitle: {
        fontSize: 12,
        fontWeight: '500',
        marginBottom: Spacing.sm,
    },
    bunksList: {
        gap: 0,
    },
    addBunkBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: Spacing.xs,
        marginTop: Spacing.md,
        paddingVertical: Spacing.sm,
        borderWidth: 1,
        borderRadius: Radius.sm,
        borderStyle: 'dashed',
    },
    addBunkText: {
        fontSize: 13,
    },
    swipeHint: {
        fontSize: 10,
        textAlign: 'center',
        marginTop: Spacing.sm,
        opacity: 0.6,
    },
    legend: {
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        gap: Spacing.md,
        marginTop: Spacing.md,
        paddingTop: Spacing.sm,
    },
    legendItem: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
    },
    legendDot: {
        width: 6,
        height: 6,
        borderRadius: 3,
    },
    legendText: {
        fontSize: 10,
    },
})
