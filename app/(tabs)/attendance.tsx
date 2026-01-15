import { AttendanceCard } from '@/components/attendance-card'
import { Container } from '@/components/ui/container'
import { Colors, Spacing } from '@/constants/theme'
import { useColorScheme } from '@/hooks/use-color-scheme'
import { useAttendanceStore } from '@/stores/attendance-store'
import { Ionicons } from '@expo/vector-icons'
import { router } from 'expo-router'
import { useCallback, useEffect, useState } from 'react'
import { ActivityIndicator, FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native'

const formatSyncTime = (timestamp: number | null): string => {
  if (!timestamp) return ''
  const date = new Date(timestamp)
  const today = new Date()
  const isToday = date.toDateString() === today.toDateString()

  if (isToday) {
    const hours = date.getHours().toString().padStart(2, '0')
    const minutes = date.getMinutes().toString().padStart(2, '0')
    return `${hours}:${minutes}`
  }

  const day = date.getDate()
  const month = date.toLocaleString('en-US', { month: 'short' })
  return `${day} ${month}`
}

export default function AttendanceScreen() {
  const colorScheme = useColorScheme()
  const isDark = colorScheme === 'dark'
  const theme = isDark ? Colors.dark : Colors.light

  const { courses, isLoading, lastSyncTime, fetchAttendance } = useAttendanceStore()
  const [showTooltip, setShowTooltip] = useState(false)

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
      <Text style={[styles.screenTitle, { color: theme.text }]}>Attendance</Text>
      <View style={styles.headerActions}>
        {lastSyncTime && (
          <Pressable
            onPressIn={() => setShowTooltip(true)}
            onPressOut={() => setShowTooltip(false)}
            onLongPress={() => setShowTooltip(false)}
            style={styles.headerRight}
          >
            <Ionicons name="refresh-outline" size={14} color={theme.textSecondary} />
            <Text style={[styles.syncTime, { color: theme.textSecondary }]}>
              {formatSyncTime(lastSyncTime)}
            </Text>
            {showTooltip && (
              <View style={[styles.tooltip, { backgroundColor: theme.backgroundSecondary }]}>
                <Text style={[styles.tooltipText, { color: theme.text }]}>Last refresh</Text>
              </View>
            )}
          </Pressable>
        )}
        <Pressable onPress={() => router.push('/settings')} style={styles.settingsButton}>
          <Ionicons name="settings-outline" size={20} color={theme.textSecondary} />
        </Pressable>
      </View>
    </View>
  )

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
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  screenTitle: {
    fontSize: 28,
    fontWeight: '700',
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    position: 'relative',
  },
  syncTime: {
    fontSize: 12,
  },
  settingsButton: {
    padding: Spacing.sm,
  },
  tooltip: {
    position: 'absolute',
    top: 24,
    right: 0,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: 4,
    zIndex: 10,
  },
  tooltipText: {
    fontSize: 11,
    fontWeight: '500',
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
