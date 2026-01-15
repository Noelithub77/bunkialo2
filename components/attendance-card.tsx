import { useState, useMemo } from 'react'
import { View, Text, StyleSheet, Pressable } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { Calendar, DateData } from 'react-native-calendars'
import { GradientCard } from '@/components/ui/gradient-card'
import { Colors, Spacing, CalendarTheme } from '@/constants/theme'
import { useColorScheme } from '@/hooks/use-color-scheme'
import { useBunkStore } from '@/stores/bunk-store'
import type { CourseAttendance, AttendanceRecord, MarkedDates, SessionType } from '@/types'

interface AttendanceCardProps {
  course: CourseAttendance
}

// 80% threshold
const getPercentageColor = (percentage: number) => {
  return percentage >= 80 ? Colors.status.success : Colors.status.danger
}

const getSessionType = (desc: string): SessionType => {
  const lower = desc.toLowerCase()
  if (lower.includes('lab')) return 'lab'
  if (lower.includes('tutorial')) return 'tutorial'
  return 'regular'
}

// parse "Thu 1 Jan 2026 11AM - 12PM" -> { date: "2026-01-01", time: "11AM - 12PM" }
const parseDateString = (dateStr: string): { date: string | null; time: string | null } => {
  const cleaned = dateStr.trim()

  // extract time slot (e.g., "11AM - 12PM" or "2PM - 3:55PM")
  const timeMatch = cleaned.match(/(\d{1,2}(?::\d{2})?(?:AM|PM)\s*-\s*\d{1,2}(?::\d{2})?(?:AM|PM))/i)
  const time = timeMatch ? timeMatch[1] : null

  // extract date part
  const dateMatch = cleaned.match(/(\d{1,2})\s+(\w{3})\s+(\d{4})/)
  if (!dateMatch) return { date: null, time }

  const [, day, monthStr, year] = dateMatch
  const months: Record<string, string> = {
    jan: '01', feb: '02', mar: '03', apr: '04', may: '05', jun: '06',
    jul: '07', aug: '08', sep: '09', oct: '10', nov: '11', dec: '12'
  }
  const month = months[monthStr.toLowerCase()]
  if (!month) return { date: null, time }

  return {
    date: `${year}-${month}-${day.padStart(2, '0')}`,
    time
  }
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

const buildMarkedDates = (records: AttendanceRecord[]): MarkedDates => {
  const marked: MarkedDates = {}
  const statusColors: Record<string, string> = {
    Present: Colors.status.success,
    Absent: Colors.status.danger,
    Late: Colors.status.warning,
    Excused: Colors.status.info,
  }

  for (const record of records) {
    const { date } = parseDateString(record.date)
    if (!date) continue

    const color = statusColors[record.status] || Colors.status.info
    const sessionType = getSessionType(record.description)

    if (!marked[date]) {
      marked[date] = { dots: [] }
    }

    marked[date].dots.push({
      key: `${sessionType}-${record.status}-${marked[date].dots.length}`,
      color,
    })
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

export function AttendanceCard({ course }: AttendanceCardProps) {
  const [expanded, setExpanded] = useState(false)
  const [selectedDate, setSelectedDate] = useState<string | null>(null)
  const colorScheme = useColorScheme()
  const isDark = colorScheme === 'dark'
  const theme = isDark ? Colors.dark : Colors.light
  const calTheme = isDark ? CalendarTheme.dark : CalendarTheme.light

  // get alias from bunk store if available
  const bunkCourses = useBunkStore((state) => state.courses)
  const courseAlias = useMemo(() => {
    const bunkCourse = bunkCourses.find((c) => c.courseId === course.courseId)
    return bunkCourse?.config?.alias || course.courseName
  }, [bunkCourses, course.courseId, course.courseName])

  // filter to past sessions only
  const pastRecords = useMemo(() => filterPastRecords(course.records), [course.records])
  const totalSessions = pastRecords.length
  const attended = pastRecords.filter(r => r.status === 'Present').length
  const percentage = totalSessions > 0 ? Math.round((attended / totalSessions) * 100) : 0

  const percentageColor = getPercentageColor(percentage)
  const markedDates = useMemo(() => buildMarkedDates(pastRecords), [pastRecords])
  const initialDate = useMemo(() => getMostRecentDate(pastRecords), [pastRecords])

  // sessions on selected date with parsed time
  const selectedSessions = useMemo(() => {
    if (!selectedDate) return []
    return pastRecords
      .filter(r => parseDateString(r.date).date === selectedDate)
      .map(r => ({
        ...r,
        timeSlot: parseDateString(r.date).time
      }))
  }, [selectedDate, pastRecords])

  if (totalSessions === 0) {
    return (
      <GradientCard>
        <View style={styles.header}>
          <Text style={[styles.courseName, { color: theme.text }]} numberOfLines={2}>
            {courseAlias}
          </Text>
          <Text style={[styles.noData, { color: theme.textSecondary }]}>
            No attendance data
          </Text>
        </View>
      </GradientCard>
    )
  }

  const handleDayPress = (day: DateData) => {
    setSelectedDate(prev => prev === day.dateString ? null : day.dateString)
  }

  return (
    <GradientCard>
      <Pressable onPress={() => setExpanded(!expanded)}>
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <Text style={[styles.courseName, { color: theme.text }]} numberOfLines={2}>
              {courseAlias}
            </Text>
            <Text style={[styles.sessionCount, { color: theme.textSecondary }]}>
              {attended} / {totalSessions} sessions
            </Text>
          </View>
          <View style={styles.headerRight}>
            <Text style={[styles.percentage, { color: percentageColor }]}>
              {percentage}%
            </Text>
            <Ionicons
              name={expanded ? 'chevron-up' : 'chevron-down'}
              size={20}
              color={theme.textSecondary}
            />
          </View>
        </View>
      </Pressable>

      {expanded && (
        <View style={styles.calendarContainer}>
          <View style={[styles.divider, { backgroundColor: theme.border }]} />

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

          {/* selected date sessions */}
          {selectedDate && selectedSessions.length > 0 && (
            <View style={[styles.sessionDetails, { borderTopColor: theme.border }]}>
              {selectedSessions.map((session, idx) => {
                const sessionType = getSessionType(session.description)
                const typeColor = Colors.sessionType[sessionType]
                const statusColor = {
                  Present: Colors.status.success,
                  Absent: Colors.status.danger,
                  Late: Colors.status.warning,
                  Excused: Colors.status.info,
                }[session.status]

                return (
                  <View key={idx} style={styles.sessionRow}>
                    <View style={[styles.typeBar, { backgroundColor: typeColor }]} />
                    <View style={styles.sessionInfo}>
                      <Text style={[styles.timeSlot, { color: theme.text }]}>
                        {session.timeSlot || 'No time'}
                      </Text>
                      <Text style={[styles.sessionType, { color: theme.textSecondary }]}>
                        {sessionType.charAt(0).toUpperCase() + sessionType.slice(1)}
                      </Text>
                    </View>
                    <View style={[styles.statusBadge, { backgroundColor: statusColor }]}>
                      <Text style={styles.statusText}>
                        {session.status.charAt(0)}
                      </Text>
                    </View>
                  </View>
                )
              })}
            </View>
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
              <View style={[styles.legendDot, { backgroundColor: Colors.status.warning }]} />
              <Text style={[styles.legendText, { color: theme.textSecondary }]}>L</Text>
            </View>
            <View style={styles.legendSpacer} />
            <View style={styles.legendItem}>
              <View style={[styles.legendBar, { backgroundColor: Colors.sessionType.lab }]} />
              <Text style={[styles.legendText, { color: theme.textSecondary }]}>Lab</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendBar, { backgroundColor: Colors.sessionType.tutorial }]} />
              <Text style={[styles.legendText, { color: theme.textSecondary }]}>Tut</Text>
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
    marginRight: Spacing.md,
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
    fontSize: 24,
    fontWeight: '700',
  },
  noData: {
    fontSize: 13,
    marginTop: 4,
  },
  calendarContainer: {
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
    gap: Spacing.sm,
  },
  sessionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  typeBar: {
    width: 3,
    height: 32,
    borderRadius: 2,
  },
  sessionInfo: {
    flex: 1,
  },
  timeSlot: {
    fontSize: 14,
    fontWeight: '500',
  },
  sessionType: {
    fontSize: 11,
  },
  statusBadge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
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
  legendSpacer: {
    width: Spacing.sm,
  },
  legendDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  legendBar: {
    width: 3,
    height: 10,
    borderRadius: 2,
  },
  legendText: {
    fontSize: 10,
  },
})
