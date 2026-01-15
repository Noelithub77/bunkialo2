import { View, Text, StyleSheet } from 'react-native'
import { GradientCard } from '@/components/ui/gradient-card'
import { Colors, Spacing } from '@/constants/theme'
import { useColorScheme } from '@/hooks/use-color-scheme'
import { selectOverallStats } from '@/stores/attendance-store'
import type { CourseAttendance } from '@/types'

interface StatsHeaderProps {
  courses: CourseAttendance[]
  lastSyncTime: number | null
}

const formatLastSync = (timestamp: number | null): string => {
  if (!timestamp) return 'Never'
  const minutes = Math.floor((Date.now() - timestamp) / 60000)
  if (minutes < 1) return 'Just now'
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  return `${Math.floor(hours / 24)}d ago`
}

export function StatsHeader({ courses, lastSyncTime }: StatsHeaderProps) {
  const colorScheme = useColorScheme()
  const isDark = colorScheme === 'dark'
  const theme = isDark ? Colors.dark : Colors.light
  const stats = selectOverallStats(courses)

  const getOverallColor = () => {
    if (stats.overallPercentage >= 75) return Colors.status.success
    if (stats.overallPercentage >= 60) return Colors.status.warning
    return Colors.status.danger
  }

  return (
    <GradientCard variant="header">
      <View style={styles.container}>
        <View style={styles.mainStat}>
          <Text style={[styles.percentageLabel, { color: theme.textSecondary }]}>
            Overall Attendance
          </Text>
          <Text style={[styles.percentage, { color: getOverallColor() }]}>
            {stats.overallPercentage}%
          </Text>
        </View>
        
        <View style={styles.subStats}>
          <View style={styles.stat}>
            <Text style={[styles.statValue, { color: theme.text }]}>
              {stats.totalCourses}
            </Text>
            <Text style={[styles.statLabel, { color: theme.textSecondary }]}>
              Courses
            </Text>
          </View>
          <View style={[styles.statDivider, { backgroundColor: theme.border }]} />
          <View style={styles.stat}>
            <Text style={[styles.statValue, { color: theme.text }]}>
              {stats.totalAttended}
            </Text>
            <Text style={[styles.statLabel, { color: theme.textSecondary }]}>
              Present
            </Text>
          </View>
          <View style={[styles.statDivider, { backgroundColor: theme.border }]} />
          <View style={styles.stat}>
            <Text style={[styles.statValue, { color: theme.text }]}>
              {stats.totalSessions}
            </Text>
            <Text style={[styles.statLabel, { color: theme.textSecondary }]}>
              Total
            </Text>
          </View>
        </View>

        <Text style={[styles.lastSync, { color: theme.textSecondary }]}>
          Updated {formatLastSync(lastSyncTime)}
        </Text>
      </View>
    </GradientCard>
  )
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
  },
  mainStat: {
    alignItems: 'center',
  },
  percentageLabel: {
    fontSize: 13,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  percentage: {
    fontSize: 56,
    fontWeight: '700',
    marginTop: -4,
  },
  subStats: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: Spacing.md,
  },
  stat: {
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
  },
  statValue: {
    fontSize: 20,
    fontWeight: '600',
  },
  statLabel: {
    fontSize: 12,
    marginTop: 2,
  },
  statDivider: {
    width: 1,
    height: 32,
  },
  lastSync: {
    fontSize: 12,
    marginTop: Spacing.md,
  },
})
