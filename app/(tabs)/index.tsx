import { useEffect, useCallback } from 'react'
import { StyleSheet, FlatList, RefreshControl, View, Text, ActivityIndicator } from 'react-native'
import { Container } from '@/components/ui/container'
import { AttendanceCard } from '@/components/attendance-card'
import { useAttendanceStore } from '@/stores/attendance-store'
import { useColorScheme } from '@/hooks/use-color-scheme'
import { Colors, Spacing } from '@/constants/theme'

const formatSyncTime = (timestamp: number | null): string => {
  if (!timestamp) return ''
  const diff = Date.now() - timestamp
  const minutes = Math.floor(diff / 60000)
  if (minutes < 1) return 'Just now'
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  return `${Math.floor(hours / 24)}d ago`
}

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

  const renderHeader = () => {
    if (!error) return null
    return (
      <View style={styles.header}>
        <Text style={styles.error}>{error}</Text>
      </View>
    )
  }

  const renderFooter = () => {
    if (!lastSyncTime || courses.length === 0) return null
    return (
      <View style={styles.footer}>
        <Text style={[styles.syncText, { color: theme.textSecondary }]}>
          Updated {formatSyncTime(lastSyncTime)}
        </Text>
      </View>
    )
  }

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
        ListFooterComponent={renderFooter}
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
  footer: {
    alignItems: 'center',
    paddingTop: Spacing.lg,
  },
  syncText: {
    fontSize: 12,
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
  },
})
