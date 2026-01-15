import { View, Text, StyleSheet, Modal, Pressable, FlatList } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { Colors, Spacing, Radius } from '@/constants/theme'
import { useColorScheme } from '@/hooks/use-color-scheme'
import type { DutyLeaveInfo } from '@/types'

interface DutyLeaveModalProps {
  visible: boolean
  dutyLeaves: DutyLeaveInfo[]
  onClose: () => void
  onRemove: (courseId: string, bunkId: string) => void
}

// parse date for display
const formatDate = (dateStr: string): string => {
  const match = dateStr.match(/(\w{3})\s+(\d{1,2})\s+(\w{3})/)
  if (match) return `${match[2]} ${match[3]}`
  return dateStr.slice(0, 15)
}

export function DutyLeaveModal({ visible, dutyLeaves, onClose, onRemove }: DutyLeaveModalProps) {
  const colorScheme = useColorScheme()
  const isDark = colorScheme === 'dark'
  const theme = isDark ? Colors.dark : Colors.light

  const renderItem = ({ item }: { item: DutyLeaveInfo }) => (
    <View style={[styles.item, { borderBottomColor: theme.border }]}>
      <View style={styles.itemContent}>
        <Text style={[styles.courseName, { color: theme.text }]} numberOfLines={1}>
          {item.courseName}
        </Text>
        <View style={styles.itemMeta}>
          <Text style={[styles.date, { color: theme.textSecondary }]}>
            {formatDate(item.date)}
          </Text>
          {item.timeSlot && (
            <Text style={[styles.time, { color: theme.textSecondary }]}>
              {item.timeSlot}
            </Text>
          )}
        </View>
        {item.note && (
          <Text style={[styles.note, { color: theme.textSecondary }]} numberOfLines={2}>
            {item.note}
          </Text>
        )}
      </View>
      <Pressable
        onPress={() => onRemove(item.courseId, item.bunkId)}
        hitSlop={8}
        style={styles.removeBtn}
      >
        <Ionicons name="close-circle" size={22} color={Colors.status.danger} />
      </Pressable>
    </View>
  )

  const renderEmpty = () => (
    <View style={styles.empty}>
      <Ionicons name="checkmark-circle-outline" size={48} color={theme.textSecondary} />
      <Text style={[styles.emptyText, { color: theme.textSecondary }]}>
        No duty leaves marked
      </Text>
    </View>
  )

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <Pressable style={styles.backdrop} onPress={onClose} />
        <View style={[styles.modal, { backgroundColor: theme.background }]}>
          {/* header */}
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <Ionicons name="briefcase-outline" size={20} color={Colors.status.info} />
              <Text style={[styles.title, { color: theme.text }]}>All Duty Leaves</Text>
            </View>
            <Pressable onPress={onClose} hitSlop={8}>
              <Ionicons name="close" size={24} color={theme.textSecondary} />
            </Pressable>
          </View>

          {/* count */}
          <Text style={[styles.count, { color: theme.textSecondary }]}>
            {dutyLeaves.length} duty leave{dutyLeaves.length !== 1 ? 's' : ''} across all courses
          </Text>

          {/* list */}
          <FlatList
            data={dutyLeaves}
            keyExtractor={(item) => `${item.courseId}-${item.bunkId}`}
            renderItem={renderItem}
            ListEmptyComponent={renderEmpty}
            style={styles.list}
            contentContainerStyle={dutyLeaves.length === 0 ? styles.emptyContainer : undefined}
          />
        </View>
      </View>
    </Modal>
  )
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  modal: {
    width: '90%',
    maxWidth: 400,
    maxHeight: '70%',
    borderRadius: Radius.lg,
    padding: Spacing.lg,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
  },
  count: {
    fontSize: 12,
    marginTop: Spacing.xs,
    marginBottom: Spacing.md,
  },
  list: {
    flexGrow: 0,
  },
  emptyContainer: {
    flex: 1,
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.sm,
    borderBottomWidth: 1,
  },
  itemContent: {
    flex: 1,
    gap: 2,
  },
  courseName: {
    fontSize: 14,
    fontWeight: '500',
  },
  itemMeta: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  date: {
    fontSize: 12,
  },
  time: {
    fontSize: 12,
  },
  note: {
    fontSize: 11,
    fontStyle: 'italic',
    marginTop: 2,
  },
  removeBtn: {
    padding: Spacing.xs,
  },
  empty: {
    alignItems: 'center',
    paddingVertical: Spacing.xl,
    gap: Spacing.sm,
  },
  emptyText: {
    fontSize: 14,
  },
})
