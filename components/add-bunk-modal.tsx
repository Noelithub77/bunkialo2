import { useState, useEffect } from 'react'
import { View, Text, StyleSheet, Modal, Pressable, ScrollView } from 'react-native'
import { Calendar, DateData } from 'react-native-calendars'
import { Ionicons } from '@expo/vector-icons'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Colors, Spacing, Radius, CalendarTheme } from '@/constants/theme'
import { useColorScheme } from '@/hooks/use-color-scheme'

interface AddBunkModalProps {
  visible: boolean
  courseName: string
  onClose: () => void
  onAdd: (date: string, timeSlot: string, note: string) => void
}

const TIME_SLOTS = [
  '8AM - 9AM',
  '9AM - 10AM',
  '10AM - 11AM',
  '11AM - 12PM',
  '12PM - 1PM',
  '1PM - 2PM',
  '2PM - 3PM',
  '3PM - 4PM',
  '4PM - 5PM',
]

// format date for display: "2026-01-15" -> "Wed 15 Jan 2026"
const formatDateForRecord = (dateString: string, timeSlot: string): string => {
  const date = new Date(dateString)
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

  const day = days[date.getDay()]
  const dateNum = date.getDate()
  const month = months[date.getMonth()]
  const year = date.getFullYear()

  return `${day} ${dateNum} ${month} ${year} ${timeSlot}`
}

export function AddBunkModal({ visible, courseName, onClose, onAdd }: AddBunkModalProps) {
  const colorScheme = useColorScheme()
  const isDark = colorScheme === 'dark'
  const theme = isDark ? Colors.dark : Colors.light
  const calTheme = isDark ? CalendarTheme.dark : CalendarTheme.light

  const [selectedDate, setSelectedDate] = useState<string | null>(null)
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null)
  const [note, setNote] = useState('')

  useEffect(() => {
    if (visible) {
      setSelectedDate(null)
      setSelectedSlot(null)
      setNote('')
    }
  }, [visible])

  const handleAdd = () => {
    if (selectedDate && selectedSlot) {
      const formattedDate = formatDateForRecord(selectedDate, selectedSlot)
      onAdd(formattedDate, selectedSlot, note)
      onClose()
    }
  }

  const canAdd = selectedDate && selectedSlot

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <Pressable style={styles.backdrop} onPress={onClose} />
        <View style={[styles.modal, { backgroundColor: theme.background }]}>
          {/* header */}
          <View style={styles.header}>
            <Text style={[styles.title, { color: theme.text }]}>Add Bunk</Text>
            <Pressable onPress={onClose} hitSlop={8}>
              <Ionicons name="close" size={24} color={theme.textSecondary} />
            </Pressable>
          </View>

          <Text style={[styles.courseName, { color: theme.textSecondary }]} numberOfLines={1}>
            {courseName}
          </Text>

          <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
            {/* calendar */}
            <Text style={[styles.label, { color: theme.text }]}>Select Date</Text>
            <View style={[styles.calendarWrapper, { borderColor: theme.border }]}>
              <Calendar
                onDayPress={(day: DateData) => setSelectedDate(day.dateString)}
                markedDates={selectedDate ? {
                  [selectedDate]: { selected: true, selectedColor: Colors.status.info }
                } : {}}
                maxDate={new Date().toISOString().split('T')[0]}
                theme={{
                  calendarBackground: 'transparent',
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
            </View>

            {/* time slots */}
            <Text style={[styles.label, { color: theme.text, marginTop: Spacing.md }]}>Select Time Slot</Text>
            <View style={styles.slotsGrid}>
              {TIME_SLOTS.map((slot) => {
                const isSelected = selectedSlot === slot
                return (
                  <Pressable
                    key={slot}
                    onPress={() => setSelectedSlot(slot)}
                    style={[
                      styles.slotBtn,
                      { borderColor: theme.border },
                      isSelected && styles.slotBtnSelected,
                    ]}
                  >
                    <Text style={[
                      styles.slotText,
                      { color: theme.textSecondary },
                      isSelected && styles.slotTextSelected,
                    ]}>
                      {slot}
                    </Text>
                  </Pressable>
                )
              })}
            </View>

            {/* note */}
            <View style={{ marginTop: Spacing.md }}>
              <Input
                label="Note (optional)"
                placeholder="e.g. Sick leave"
                value={note}
                onChangeText={setNote}
              />
            </View>
          </ScrollView>

          {/* actions */}
          <View style={styles.actions}>
            <Button title="Cancel" variant="secondary" onPress={onClose} style={styles.btn} />
            <Button
              title="Add Bunk"
              onPress={handleAdd}
              style={styles.btn}
              disabled={!canAdd}
            />
          </View>
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
    width: '92%',
    maxWidth: 400,
    maxHeight: '85%',
    borderRadius: Radius.lg,
    padding: Spacing.lg,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
  },
  courseName: {
    fontSize: 13,
    marginTop: Spacing.xs,
    marginBottom: Spacing.md,
  },
  content: {
    flexGrow: 0,
  },
  label: {
    fontSize: 13,
    fontWeight: '500',
    marginBottom: Spacing.sm,
  },
  calendarWrapper: {
    borderWidth: 1,
    borderRadius: Radius.md,
    overflow: 'hidden',
  },
  slotsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  slotBtn: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderWidth: 1,
    borderRadius: Radius.sm,
  },
  slotBtnSelected: {
    backgroundColor: Colors.status.info,
    borderColor: Colors.status.info,
  },
  slotText: {
    fontSize: 12,
  },
  slotTextSelected: {
    color: Colors.white,
    fontWeight: '500',
  },
  actions: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginTop: Spacing.lg,
  },
  btn: {
    flex: 1,
  },
})
