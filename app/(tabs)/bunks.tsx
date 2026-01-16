import { AddBunkModal } from '@/components/add-bunk-modal'
import { CourseEditModal } from '@/components/course-edit-modal'
import { DLInputModal } from '@/components/dl-input-modal'
import { DutyLeaveModal } from '@/components/duty-leave-modal'
import { PresenceInputModal } from '@/components/presence-input-modal'
import { SwipeableBunkItem } from '@/components/swipeable-bunk-item'
import { Container } from '@/components/ui/container'
import { GradientCard } from '@/components/ui/gradient-card'
import { Colors, Radius, Spacing } from '@/constants/theme'
import { useColorScheme } from '@/hooks/use-color-scheme'
import { useAttendanceStore } from '@/stores/attendance-store'
import { filterPastBunks, getDisplayName, selectAllDutyLeaves, selectCourseStats, useBunkStore } from '@/stores/bunk-store'
import type { CourseBunkData, CourseConfig } from '@/types'
import { Ionicons } from '@expo/vector-icons'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Alert, FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native'
import { GestureHandlerRootView } from 'react-native-gesture-handler'

interface CourseCardProps {
  course: CourseBunkData
  isEditMode: boolean
  onEdit: () => void
  onAddBunk: () => void
  onMarkDL: (bunkId: string) => void
  onRemoveDL: (bunkId: string) => void
  onMarkPresent: (bunkId: string) => void
  onRemovePresent: (bunkId: string) => void
  onUpdateNote: (bunkId: string, note: string) => void
}

const CourseCard = ({ course, isEditMode, onEdit, onAddBunk, onMarkDL, onRemoveDL, onMarkPresent, onRemovePresent, onUpdateNote }: CourseCardProps) => {
  const [expanded, setExpanded] = useState(false)
  const [showTotal, setShowTotal] = useState(false)
  const colorScheme = useColorScheme()
  const isDark = colorScheme === 'dark'
  const theme = isDark ? Colors.dark : Colors.light

  const stats = selectCourseStats(course)
  const pastBunks = filterPastBunks(course.bunks)
  const displayName = getDisplayName(course)
  const isConfigured = course.isConfigured && course.config

  const handleCardPress = () => {
    if (isEditMode) {
      onEdit()
    } else {
      setExpanded(!expanded)
    }
  }

  // bunks display value: toggle between "X left" and "X/Y used"
  const bunksDisplay = showTotal ? `${stats.usedBunks}/${stats.totalBunks}` : stats.bunksLeft.toString()
  const bunksLabel = showTotal ? 'used' : 'left'
  const bunksColor = !isConfigured
    ? theme.textSecondary
    : stats.bunksLeft <= 0
      ? Colors.status.danger
      : stats.bunksLeft <= 3
        ? Colors.status.warning
        : Colors.status.success

  return (
    <GradientCard>
      <Pressable onPress={handleCardPress} style={isEditMode && styles.editModeCard}>
        <View style={styles.cardHeader}>
          <View style={styles.cardLeft}>
            <Text style={[styles.cardName, { color: theme.text }]} numberOfLines={2}>
              {displayName}
            </Text>
            <View style={styles.cardMeta}>
              <Text style={[styles.cardCount, { color: theme.textSecondary }]}>
                {pastBunks.length} absence{pastBunks.length !== 1 ? 's' : ''}
              </Text>
              {stats.dutyLeaveCount > 0 && (
                <View style={styles.dlCount}>
                  <Ionicons name="briefcase" size={10} color={Colors.status.info} />
                  <Text style={[styles.dlCountText, { color: Colors.status.info }]}>
                    {stats.dutyLeaveCount}
                  </Text>
                </View>
              )}
              {stats.markedPresentCount > 0 && (
                <View style={styles.dlCount}>
                  <Ionicons name="checkmark-circle" size={10} color={Colors.status.success} />
                  <Text style={[styles.dlCountText, { color: Colors.status.success }]}>
                    {stats.markedPresentCount}
                  </Text>
                </View>
              )}
            </View>
          </View>

          <View style={styles.cardRight}>
            {isConfigured ? (
              <Pressable onPress={(e) => {
                e.stopPropagation()
                setShowTotal(!showTotal)
              }}>
                <View style={styles.bunksDisplay}>
                  <Text style={[styles.bunksValue, showTotal && styles.bunksValueSmall, { color: bunksColor }]}>
                    {bunksDisplay}
                  </Text>
                  <Text style={[styles.bunksLabel, { color: theme.textSecondary }]}>{bunksLabel}</Text>
                </View>
              </Pressable>
            ) : (
              <Pressable onPress={(e) => {
                e.stopPropagation()
                onEdit()
              }} style={[styles.configBtn, { borderColor: Colors.status.warning }]}>
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

          {/* bunks list (past only) */}
          {pastBunks.length > 0 ? (
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
          ) : (
            <Text style={[styles.noBunks, { color: theme.textSecondary }]}>
              No absences recorded
            </Text>
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
        </View>
      )}
    </GradientCard>
  )
}

export default function BunksScreen() {
  const colorScheme = useColorScheme()
  const isDark = colorScheme === 'dark'
  const theme = isDark ? Colors.dark : Colors.light

  const { courses, syncFromLms, updateCourseConfig, addBunk, markAsDutyLeave, removeDutyLeave, markAsPresent, removePresenceCorrection, updateBunkNote } = useBunkStore()
  const { courses: attendanceCourses, isLoading, fetchAttendance } = useAttendanceStore()

  const [editCourse, setEditCourse] = useState<CourseBunkData | null>(null)
  const [addBunkCourse, setAddBunkCourse] = useState<CourseBunkData | null>(null)
  const [showDLModal, setShowDLModal] = useState(false)
  const [dlPromptBunk, setDlPromptBunk] = useState<{ courseId: string; bunkId: string } | null>(null)
  const [presencePromptBunk, setPresencePromptBunk] = useState<{ courseId: string; bunkId: string } | null>(null)
  const [isEditMode, setIsEditMode] = useState(false)

  const allDutyLeaves = useMemo(() => selectAllDutyLeaves(courses), [courses])

  // sync bunks when attendance changes
  useEffect(() => {
    if (attendanceCourses.length > 0) {
      syncFromLms()
    }
  }, [attendanceCourses])

  // initial fetch if no data
  useEffect(() => {
    if (attendanceCourses.length === 0) {
      fetchAttendance()
    }
  }, [])

  const handleRefresh = useCallback(() => {
    fetchAttendance()
  }, [fetchAttendance])

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

  const handleMarkDL = (courseId: string, bunkId: string) => {
    setDlPromptBunk({ courseId, bunkId })
  }

  const handleConfirmDL = (note: string) => {
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

  const handleMarkPresent = (courseId: string, bunkId: string) => {
    setPresencePromptBunk({ courseId, bunkId })
  }

  const handleConfirmPresence = (note: string) => {
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
    <View style={styles.header}>
      <Text style={[styles.screenTitle, { color: theme.text }]}>Bunks</Text>
      <View style={styles.headerActions}>
        <Pressable onPress={() => setIsEditMode(!isEditMode)} style={[styles.editModeBtn, isEditMode && styles.editModeBtnActive, !isEditMode && { backgroundColor: theme.backgroundSecondary }]}>
          <Ionicons name="pencil" size={20} color={isEditMode ? Colors.white : theme.textSecondary} />
        </Pressable>
        <Pressable onPress={() => setShowDLModal(true)} style={styles.dlButton}>
          <Ionicons name="briefcase-outline" size={20} color={Colors.status.info} />
          {allDutyLeaves.length > 0 && (
            <View style={styles.dlBadgeSmall}>
              <Text style={styles.dlBadgeText}>{allDutyLeaves.length}</Text>
            </View>
          )}
        </Pressable>
      </View>
    </View>
  )

  const renderEmpty = () => {
    if (isLoading) {
      return (
        <View style={styles.empty}>
          <Text style={[styles.emptyText, { color: theme.textSecondary }]}>
            Loading attendance data...
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
    <GestureHandlerRootView style={{ flex: 1 }}>
      <Container>
        <FlatList
          data={courses}
          keyExtractor={(item) => item.courseId}
          renderItem={({ item }) => (
            <CourseCard
              course={item}
              isEditMode={isEditMode}
              onEdit={() => {
                setEditCourse(item)
                setIsEditMode(false)
              }}
              onAddBunk={() => setAddBunkCourse(item)}
              onMarkDL={(bunkId) => handleMarkDL(item.courseId, bunkId)}
              onRemoveDL={(bunkId) => handleRemoveDL(item.courseId, bunkId)}
              onMarkPresent={(bunkId) => handleMarkPresent(item.courseId, bunkId)}
              onRemovePresent={(bunkId) => handleRemovePresent(item.courseId, bunkId)}
              onUpdateNote={(bunkId, note) => updateBunkNote(item.courseId, bunkId, note)}
            />
          )}
          ListHeaderComponent={renderHeader}
          ListEmptyComponent={renderEmpty}
          contentContainerStyle={styles.list}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
          refreshControl={
            <RefreshControl refreshing={isLoading} onRefresh={handleRefresh} tintColor={theme.text} />
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
          onConfirm={handleConfirmDL}
        />

        <PresenceInputModal
          visible={!!presencePromptBunk}
          onClose={() => setPresencePromptBunk(null)}
          onConfirm={handleConfirmPresence}
        />

        <AddBunkModal
          visible={!!addBunkCourse}
          courseName={addBunkCourse ? getDisplayName(addBunkCourse) : ''}
          onClose={() => setAddBunkCourse(null)}
          onAdd={handleAddBunk}
        />
      </Container>
    </GestureHandlerRootView>
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
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  screenTitle: {
    fontSize: 28,
    fontWeight: '700',
  },
  editModeBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  editModeBtnActive: {
    backgroundColor: Colors.status.info,
  },
  editModeCard: {
    opacity: 0.8,
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
  separator: {
    height: Spacing.md,
  },
  empty: {
    alignItems: 'center',
    paddingVertical: Spacing.xxl,
  },
  emptyText: {
    fontSize: 14,
  },

  // card styles
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  cardLeft: {
    flex: 1,
    marginRight: Spacing.md,
  },
  cardName: {
    fontSize: 16,
    fontWeight: '600',
  },
  cardMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginTop: 4,
  },
  cardCount: {
    fontSize: 13,
  },
  dlCount: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  dlCountText: {
    fontSize: 11,
    fontWeight: '500',
  },
  cardRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  bunksDisplay: {
    alignItems: 'center',
  },
  bunksValue: {
    fontSize: 24,
    fontWeight: '700',
  },
  bunksValueSmall: {
    fontSize: 18,
  },
  bunksLabel: {
    fontSize: 10,
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

  // expanded content
  expandedContent: {
    marginTop: Spacing.md,
  },
  divider: {
    height: 1,
    marginBottom: Spacing.md,
  },
  bunksList: {
    gap: 0,
  },
  noBunks: {
    fontSize: 13,
    textAlign: 'center',
    paddingVertical: Spacing.md,
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
})
