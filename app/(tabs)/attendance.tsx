import { AttendanceCard } from '@/components/attendance-card'
import { DLInputModal } from '@/components/dl-input-modal'
import { PresenceInputModal } from '@/components/presence-input-modal'
import { TotalAbsenceCalendar } from '@/components/total-absence-calendar'
import { Container } from '@/components/ui/container'
import { GradientCard } from '@/components/ui/gradient-card'
import { Colors, Radius, Spacing } from '@/constants/theme'
import { useColorScheme } from '@/hooks/use-color-scheme'
import { useAttendanceStore } from '@/stores/attendance-store'
import { useBunkStore } from '@/stores/bunk-store'
import type { AttendanceRecord } from '@/types'
import { Ionicons } from '@expo/vector-icons'
import * as Haptics from 'expo-haptics'
import { router } from 'expo-router'
import { useCallback, useEffect, useState } from 'react'
import { ActivityIndicator, FlatList, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native'

type TabType = 'courses' | 'absences'

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
  const { courses: bunkCourses, markAsDutyLeave, markAsPresent, syncFromLms } = useBunkStore()

  const [activeTab, setActiveTab] = useState<TabType>('absences')
  const [showTooltip, setShowTooltip] = useState(false)
  const [pendingDL, setPendingDL] = useState<{ courseId: string; record: AttendanceRecord } | null>(null)
  const [pendingPresent, setPendingPresent] = useState<{ courseId: string; record: AttendanceRecord } | null>(null)

  useEffect(() => {
    if (courses.length === 0) {
      fetchAttendance()
    }
  }, [])

  useEffect(() => {
    if (courses.length > 0) {
      syncFromLms()
    }
  }, [courses, syncFromLms])

  const handleRefresh = useCallback(() => {
    fetchAttendance()
  }, [fetchAttendance])

  const handleTabChange = (tab: TabType) => {
    Haptics.selectionAsync()
    setActiveTab(tab)
  }

  // swipe action handlers
  const handleMarkPresent = (courseId: string, record: AttendanceRecord) => {
    setPendingPresent({ courseId, record })
  }

  const findBunkId = useCallback((courseId: string, record: AttendanceRecord): string | null => {
    const course = bunkCourses.find((item) => item.courseId === courseId)
    if (!course) return null
    const bunk = course.bunks.find((item) => item.date === record.date && item.description === record.description)
    return bunk ? bunk.id : null
  }, [bunkCourses])

  const handleConfirmPresent = (note: string) => {
    if (!pendingPresent) return
    const bunkId = findBunkId(pendingPresent.courseId, pendingPresent.record)
    if (!bunkId) {
      setPendingPresent(null)
      return
    }
    markAsPresent(pendingPresent.courseId, bunkId, note)
    setPendingPresent(null)
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
  }

  const handleMarkDL = (courseId: string, record: AttendanceRecord) => {
    setPendingDL({ courseId, record })
  }

  const handleConfirmDL = (note: string) => {
    if (!pendingDL) return
    const bunkId = findBunkId(pendingDL.courseId, pendingDL.record)
    if (!bunkId) {
      setPendingDL(null)
      return
    }
    markAsDutyLeave(pendingDL.courseId, bunkId, note)
    setPendingDL(null)
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
  }

  const renderHeader = () => (
    <View style={styles.headerContainer}>
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

      {/* tab switcher */}
      <View style={[styles.tabBar, { backgroundColor: theme.backgroundSecondary }]}>
        <Pressable
          onPress={() => handleTabChange('absences')}
          style={[styles.tab, activeTab === 'absences' && { backgroundColor: theme.background }]}
        >
          <Ionicons
            name="calendar"
            size={16}
            color={activeTab === 'absences' ? theme.text : theme.textSecondary}
          />
          <Text style={[styles.tabText, { color: activeTab === 'absences' ? theme.text : theme.textSecondary }]}>
            All Bunks
          </Text>
        </Pressable>
        <Pressable
          onPress={() => handleTabChange('courses')}
          style={[styles.tab, activeTab === 'courses' && { backgroundColor: theme.background }]}
        >
          <Ionicons
            name="list"
            size={16}
            color={activeTab === 'courses' ? theme.text : theme.textSecondary}
          />
          <Text style={[styles.tabText, { color: activeTab === 'courses' ? theme.text : theme.textSecondary }]}>
            Courses
          </Text>
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

  // absences tab content
  if (activeTab === 'absences') {
    return (
      <Container>
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.absencesContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={isLoading}
              onRefresh={handleRefresh}
              tintColor={theme.text}
            />
          }
        >
          {renderHeader()}
          <GradientCard>
            <TotalAbsenceCalendar onMarkPresent={handleMarkPresent} onMarkDL={handleMarkDL} />
          </GradientCard>
        </ScrollView>

        <PresenceInputModal
          visible={!!pendingPresent}
          onClose={() => setPendingPresent(null)}
          onConfirm={handleConfirmPresent}
        />

        <DLInputModal
          visible={!!pendingDL}
          onClose={() => setPendingDL(null)}
          onConfirm={handleConfirmDL}
        />
      </Container>
    )
  }

  // courses tab content
  return (
    <Container>
      <FlatList
        data={courses}
        keyExtractor={(item) => item.courseId}
        renderItem={({ item }) => (
          <AttendanceCard
            course={item}
            onMarkPresent={(record) => handleMarkPresent(item.courseId, record)}
            onMarkDL={(record) => handleMarkDL(item.courseId, record)}
          />
        )}
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

      <PresenceInputModal
        visible={!!pendingPresent}
        onClose={() => setPendingPresent(null)}
        onConfirm={handleConfirmPresent}
      />

      <DLInputModal
        visible={!!pendingDL}
        onClose={() => setPendingDL(null)}
        onConfirm={handleConfirmDL}
      />
    </Container>
  )
}

const styles = StyleSheet.create({
  list: {
    padding: Spacing.md,
    paddingBottom: Spacing.xxl,
  },
  headerContainer: {
    marginBottom: Spacing.md,
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
  tabBar: {
    flexDirection: 'row',
    borderRadius: Radius.md,
    padding: 4,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.xs,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.sm,
  },
  tabText: {
    fontSize: 13,
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
  absencesContainer: {
    flex: 1,
    padding: Spacing.md,
  },
  scrollView: {
    flex: 1,
  },
  absencesContent: {
    padding: Spacing.md,
    paddingBottom: Spacing.xxl,
  },
})
