import { useState } from 'react'
import { View, Text, StyleSheet, Pressable } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { GradientCard } from '@/components/ui/gradient-card'
import { Colors, Spacing, Radius } from '@/constants/theme'
import { useColorScheme } from '@/hooks/use-color-scheme'
import type { CourseAttendance } from '@/types'

interface AttendanceCardProps {
  course: CourseAttendance
}

const getPercentageColor = (percentage: number) => {
  if (percentage >= 75) return Colors.status.success
  if (percentage >= 60) return Colors.status.warning
  return Colors.status.danger
}

export function AttendanceCard({ course }: AttendanceCardProps) {
  const [expanded, setExpanded] = useState(false)
  const colorScheme = useColorScheme()
  const isDark = colorScheme === 'dark'
  const theme = isDark ? Colors.dark : Colors.light
  const percentageColor = getPercentageColor(course.percentage)

  if (course.totalSessions === 0) {
    return (
      <GradientCard>
        <View style={styles.header}>
          <Text style={[styles.courseName, { color: theme.text }]} numberOfLines={2}>
            {course.courseName}
          </Text>
          <Text style={[styles.noData, { color: theme.textSecondary }]}>
            No attendance data
          </Text>
        </View>
      </GradientCard>
    )
  }

  return (
    <GradientCard>
      <Pressable onPress={() => setExpanded(!expanded)}>
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <Text style={[styles.courseName, { color: theme.text }]} numberOfLines={2}>
              {course.courseName}
            </Text>
            <Text style={[styles.sessionCount, { color: theme.textSecondary }]}>
              {course.attended} / {course.totalSessions} sessions
            </Text>
          </View>
          <View style={styles.headerRight}>
            <Text style={[styles.percentage, { color: percentageColor }]}>
              {course.percentage}%
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
        <View style={styles.details}>
          <View style={[styles.divider, { backgroundColor: theme.border }]} />
          
          <View style={styles.tableHeader}>
            <Text style={[styles.tableHeaderText, styles.dateCol, { color: theme.textSecondary }]}>
              Date
            </Text>
            <Text style={[styles.tableHeaderText, styles.descCol, { color: theme.textSecondary }]}>
              Description
            </Text>
            <Text style={[styles.tableHeaderText, styles.statusCol, { color: theme.textSecondary }]}>
              Status
            </Text>
          </View>

          {course.records.map((record, index) => (
            <View 
              key={index} 
              style={[
                styles.tableRow,
                { borderBottomColor: theme.border },
              ]}
            >
              <Text style={[styles.tableCell, styles.dateCol, { color: theme.text }]} numberOfLines={1}>
                {record.date}
              </Text>
              <Text style={[styles.tableCell, styles.descCol, { color: theme.textSecondary }]} numberOfLines={1}>
                {record.description}
              </Text>
              <View style={styles.statusCol}>
                <View style={[
                  styles.statusBadge,
                  { backgroundColor: record.status === 'Present' ? Colors.status.success : Colors.status.danger },
                ]}>
                  <Text style={styles.statusText}>
                    {record.status === 'Present' ? 'P' : 'A'}
                  </Text>
                </View>
              </View>
            </View>
          ))}
        </View>
      )}
    </GradientCard>
  )
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
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
    marginTop: 2,
  },
  percentage: {
    fontSize: 24,
    fontWeight: '700',
  },
  noData: {
    fontSize: 13,
    marginTop: 4,
  },
  details: {
    marginTop: Spacing.md,
  },
  divider: {
    height: 1,
    marginBottom: Spacing.md,
  },
  tableHeader: {
    flexDirection: 'row',
    paddingBottom: Spacing.sm,
  },
  tableHeaderText: {
    fontSize: 12,
    fontWeight: '500',
    textTransform: 'uppercase',
  },
  tableRow: {
    flexDirection: 'row',
    paddingVertical: Spacing.sm,
    borderBottomWidth: 1,
    alignItems: 'center',
  },
  tableCell: {
    fontSize: 13,
  },
  dateCol: {
    width: '30%',
  },
  descCol: {
    flex: 1,
  },
  statusCol: {
    width: 32,
    alignItems: 'center',
  },
  statusBadge: {
    width: 24,
    height: 24,
    borderRadius: Radius.full,
    justifyContent: 'center',
    alignItems: 'center',
  },
  statusText: {
    color: Colors.white,
    fontSize: 12,
    fontWeight: '600',
  },
})
