import { AddBunkModal } from '@/components/add-bunk-modal'
import { CourseEditModal } from '@/components/course-edit-modal'
import { DLInputModal } from '@/components/dl-input-modal'
import { DutyLeaveModal } from '@/components/duty-leave-modal'
import { PresenceInputModal } from '@/components/presence-input-modal'
import { TotalAbsenceCalendar } from '@/components/total-absence-calendar'
import { Container } from '@/components/ui/container'
import { GradientCard } from '@/components/ui/gradient-card'
import { UnifiedCourseCard } from '@/components/unified-course-card'
import { Colors, Radius, Spacing } from '@/constants/theme'
import { useColorScheme } from '@/hooks/use-color-scheme'
import { useAttendanceStore } from '@/stores/attendance-store'
import { getDisplayName, selectAllDutyLeaves, useBunkStore } from '@/stores/bunk-store'
import type { AttendanceRecord, CourseBunkData, CourseConfig } from '@/types'
import { Ionicons } from '@expo/vector-icons'
import * as Haptics from 'expo-haptics'
import { router } from 'expo-router'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { ActivityIndicator, Alert, FlatList, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native'

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
  const {
    courses: bunkCourses,
    syncFromLms,
    updateCourseConfig,
    addBunk,
    markAsDutyLeave,
    removeDutyLeave,
    markAsPresent,
    removePresenceCorrection,
    updateBunkNote,
  } = useBunkStore()

  const [activeTab, setActiveTab] = useState<TabType>('absences')
  const [showTooltip, setShowTooltip] = useState(false)

  // modals for "All Bunks" tab
  const [pendingDL, setPendingDL] = useState<{ courseId: string; record: AttendanceRecord } | null>(null)
  const [pendingPresent, setPendingPresent] = useState<{ courseId: string; record: AttendanceRecord } | null>(null)

  // modals for "Courses" tab
  const [editCourse, setEditCourse] = useState<CourseBunkData | null>(null)
  const [addBunkCourse, setAddBunkCourse] = useState<CourseBunkData | null>(null)
  const [showDLModal, setShowDLModal] = useState(false)
  const [dlPromptBunk, setDlPromptBunk] = useState<{ courseId: string; bunkId: string } | null>(null)
  const [presencePromptBunk, setPresencePromptBunk] = useState<{ courseId: string; bunkId: string } | null>(null)
  const [isEditMode, setIsEditMode] = useState(false)

  const allDutyLeaves = useMemo(() => selectAllDutyLeaves(bunkCourses), [bunkCourses])

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

  // "All Bunks" tab handlers
  const findBunkId = useCallback((courseId: string, record: AttendanceRecord): string | null => {
    const course = bunkCourses.find((item) => item.courseId === courseId)
    if (!course) return null
    const bunk = course.bunks.find((item) => item.date === record.date && item.description === record.description)
    return bunk ? bunk.id : null
  }, [bunkCourses])

  const handleMarkPresentAbsences = (courseId: string, record: AttendanceRecord) => {
    setPendingPresent({ courseId, record })
  }

  const handleConfirmPresentAbsences = (note: string) => {
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

  const handleMarkDLAbsences = (courseId: string, record: AttendanceRecord) => {
    setPendingDL({ courseId, record })
  }

  const handleConfirmDLAbsences = (note: string) => {
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

  // "Courses" tab handlers
  const handleSaveConfig = (courseId: string, config: CourseConfig) => {
    updateCourseConfig(courseId, config)
  }

  const handleAddBunk = (date: string, timeSlot: string, note: string) => {
    if (addBunkCourse) {
      addBunk(addBunkCourse.courseId, {
        date,
        description: 'Manual entry',
        timeSlot,
        note,
        isDutyLeave: false,
        dutyLeaveNote: '',
        isMarkedPresent: false,
        presenceNote: '',
      })
    }
  }

  const handleMarkDLCourses = (courseId: string, bunkId: string) => {
    setDlPromptBunk({ courseId, bunkId })
  }

  const handleConfirmDLCourses = (note: string) => {
    if (dlPromptBunk) {
      markAsDutyLeave(dlPromptBunk.courseId, dlPromptBunk.bunkId, note)
      setDlPromptBunk(null)
    }
  }

  const handleRemoveDL = (courseId: string, bunkId: string) => {
    Alert.alert('Remove Duty Leave', 'This will count as a regular bunk again.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: () => removeDutyLeave(courseId, bunkId) },
    ])
  }

  const handleMarkPresentCourses = (courseId: string, bunkId: string) => {
    setPresencePromptBunk({ courseId, bunkId })
  }

  const handleConfirmPresenceCourses = (note: string) => {
    if (presencePromptBunk) {
      markAsPresent(presencePromptBunk.courseId, presencePromptBunk.bunkId, note)
      setPresencePromptBunk(null)
    }
  }

  const handleRemovePresent = (courseId: string, bunkId: string) => {
    Alert.alert('Remove Presence Mark', 'This will count as an absence again.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: () => removePresenceCorrection(courseId, bunkId) },
    ])
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
          {activeTab === 'courses' && (
            <>
              <Pressable
                onPress={() => setIsEditMode(!isEditMode)}
                style={[styles.editModeBtn, isEditMode && styles.editModeBtnActive, !isEditMode && { backgroundColor: theme.backgroundSecondary }]}
              >
                <Ionicons name="pencil" size={18} color={isEditMode ? Colors.white : theme.textSecondary} />
              </Pressable>
              <Pressable onPress={() => setShowDLModal(true)} style={styles.dlButton}>
                <Ionicons name="briefcase-outline" size={20} color={Colors.status.info} />
                {allDutyLeaves.length > 0 && (
                  <View style={styles.dlBadgeSmall}>
                    <Text style={styles.dlBadgeText}>{allDutyLeaves.length}</Text>
                  </View>
                )}
              </Pressable>
            </>
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

  // "All Bunks" tab content
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
            <TotalAbsenceCalendar onMarkPresent={handleMarkPresentAbsences} onMarkDL={handleMarkDLAbsences} />
          </GradientCard>
        </ScrollView>

        <PresenceInputModal
          visible={!!pendingPresent}
          onClose={() => setPendingPresent(null)}
          onConfirm={handleConfirmPresentAbsences}
        />

        <DLInputModal
          visible={!!pendingDL}
          onClose={() => setPendingDL(null)}
          onConfirm={handleConfirmDLAbsences}
        />
      </Container>
    )
  }

  // "Courses" tab content
  return (
    <Container>
      <FlatList
        data={courses}
        keyExtractor={(item) => item.courseId}
        renderItem={({ item }) => {
          const bunkData = bunkCourses.find((c) => c.courseId === item.courseId)
          return (
            <UnifiedCourseCard
              course={item}
              bunkData={bunkData}
              isEditMode={isEditMode}
              onEdit={() => {
                if (bunkData) {
                  setEditCourse(bunkData)
                  setIsEditMode(false)
                }
              }}
              onAddBunk={() => {
                if (bunkData) setAddBunkCourse(bunkData)
              }}
              onMarkDL={(bunkId) => handleMarkDLCourses(item.courseId, bunkId)}
              onRemoveDL={(bunkId) => handleRemoveDL(item.courseId, bunkId)}
              onMarkPresent={(bunkId) => handleMarkPresentCourses(item.courseId, bunkId)}
              onRemovePresent={(bunkId) => handleRemovePresent(item.courseId, bunkId)}
              onUpdateNote={(bunkId, note) => updateBunkNote(item.courseId, bunkId, note)}
            />
          )
        }}
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

      <CourseEditModal
        visible={!!editCourse}
        course={editCourse}
        onClose={() => setEditCourse(null)}
        onSave={handleSaveConfig}
      />

      <DutyLeaveModal
        visible={showDLModal}
        dutyLeaves={allDutyLeaves}
        onClose={() => setShowDLModal(false)}
        onRemove={handleRemoveDL}
      />

      <DLInputModal
        visible={!!dlPromptBunk}
        onClose={() => setDlPromptBunk(null)}
        onConfirm={handleConfirmDLCourses}
      />

      <PresenceInputModal
        visible={!!presencePromptBunk}
        onClose={() => setPresencePromptBunk(null)}
        onConfirm={handleConfirmPresenceCourses}
      />

      <AddBunkModal
        visible={!!addBunkCourse}
        courseName={addBunkCourse ? getDisplayName(addBunkCourse) : ''}
        onClose={() => setAddBunkCourse(null)}
        onAdd={handleAddBunk}
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
  editModeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  editModeBtnActive: {
    backgroundColor: Colors.status.info,
  },
  dlButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.sm,
  },
  dlBadgeSmall: {
    backgroundColor: Colors.status.info,
    borderRadius: 10,
    minWidth: 18,
    height: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 4,
  },
  dlBadgeText: {
    color: Colors.white,
    fontSize: 10,
    fontWeight: '600',
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
  scrollView: {
    flex: 1,
  },
  absencesContent: {
    padding: Spacing.md,
    paddingBottom: Spacing.xxl,
  },
})
