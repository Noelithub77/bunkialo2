import { useEffect, useCallback } from 'react'
import { StyleSheet, FlatList, RefreshControl, View, Text, ActivityIndicator } from 'react-native'
import { Container } from '@/components/ui/container'
import { StatsHeader } from '@/components/stats-header'
import { AttendanceCard } from '@/components/attendance-card'
import { useAttendanceStore } from '@/stores/attendance-store'
import { useColorScheme } from '@/hooks/use-color-scheme'
import { Colors, Spacing } from '@/constants/theme'

export default function AttendanceScreen() {
  const colorScheme = useColorScheme()
  const isDark = colorScheme === 'dark'
  const theme = isDark ? Colors.dark : Colors.light
  
  const { courses, isLoading, lastSyncTime, error, fetchAttendance } = useAttendanceStore()

  useEffect(() => {
    if (courses.length === 0) {
      fetchAttendance()
    }
  }, [])

  const handleRefresh = useCallback(() => {
    fetchAttendance()
  }, [fetchAttendance])

  const renderHeader = () => (
    <View style={styles.header}>
      <StatsHeader courses={courses} lastSyncTime={lastSyncTime} />
      {error && (
        <Text style={styles.error}>{error}</Text>
      )}
    </View>
  )

  const renderEmpty = () => {
    if (isLoading) {
      return (
        <View style={styles.empty}>
          <ActivityIndicator size="large" color={theme.text} />
          <Text style={[styles.emptyText, { color: theme.textSecondary }]}>
            Fetching attendance data...
          </Text>
        </View>
      )
    }
    return (
      <View style={styles.empty}>
        <Text style={[styles.emptyText, { color: theme.textSecondary }]}>
          No courses found. Pull to refresh.
        </Text>
      </View>
    )
  }

  return (
    <Container>
      <FlatList
        data={courses}
        keyExtractor={(item) => item.courseId}
        renderItem={({ item }) => <AttendanceCard course={item} />}
        ListHeaderComponent={renderHeader}
        ListEmptyComponent={renderEmpty}
        contentContainerStyle={styles.list}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        refreshControl={
          <RefreshControl
            refreshing={isLoading}
            onRefresh={handleRefresh}
            tintColor={theme.text}
          />
        }
      />
    </Container>
  )
}

const styles = StyleSheet.create({
  list: {
    padding: Spacing.md,
    paddingBottom: Spacing.xxl,
  },
  header: {
    marginBottom: Spacing.md,
  },
  separator: {
    height: Spacing.md,
  },
  empty: {
    alignItems: 'center',
    paddingVertical: Spacing.xxl,
    gap: Spacing.md,
  },
  emptyText: {
    fontSize: 14,
  },
  error: {
    color: Colors.status.danger,
    fontSize: 14,
    textAlign: 'center',
    marginTop: Spacing.md,
  },
})
