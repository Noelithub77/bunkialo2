import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Colors, Radius, Spacing } from '@/constants/theme'
import { useColorScheme } from '@/hooks/use-color-scheme'
import { getRandomCourseColor } from '@/stores/timetable-store'
import type { CourseBunkData, CourseConfig } from '@/types'
import { Ionicons } from '@expo/vector-icons'
import * as Haptics from 'expo-haptics'
import { useEffect, useState } from 'react'
import { KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'

interface CourseEditModalProps {
  visible: boolean
  course: CourseBunkData | null
  onClose: () => void
  onSave: (courseId: string, config: CourseConfig) => void
}

export function CourseEditModal({ visible, course, onClose, onSave }: CourseEditModalProps) {
  const colorScheme = useColorScheme()
  const isDark = colorScheme === 'dark'
  const theme = isDark ? Colors.dark : Colors.light

  const [credits, setCredits] = useState('')
  const [alias, setAlias] = useState('')
  const [selectedColor, setSelectedColor] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    if (course) {
      setCredits(course.config?.credits?.toString() || '')
      setAlias(course.config?.alias || '')
      setSelectedColor(course.config?.color || getRandomCourseColor())
      setError('')
    }
  }, [course])

  const handleColorSelect = (color: string) => {
    Haptics.selectionAsync()
    setSelectedColor(color)
  }

  const handleSave = () => {
    const creditNum = parseInt(credits, 10)
    if (isNaN(creditNum) || creditNum < 1 || creditNum > 10) {
      setError('Credits must be between 1-10')
      return
    }

    if (course) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
      onSave(course.courseId, {
        credits: creditNum,
        alias: alias.trim() || course.courseName,
        color: selectedColor,
      })
      onClose()
    }
  }

  if (!course) return null

  const totalBunks = credits ? (2 * parseInt(credits, 10) || 0) + 1 : 0

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.overlay}
      >
        <Pressable style={styles.backdrop} onPress={onClose} />
        <View style={[styles.modal, { backgroundColor: theme.background }]}>
          {/* header with color indicator */}
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <View style={[styles.colorIndicator, { backgroundColor: selectedColor }]} />
              <Text style={[styles.title, { color: theme.text }]}>Configure Course</Text>
            </View>
            <Pressable onPress={onClose} hitSlop={8}>
              <Ionicons name="close" size={24} color={theme.textSecondary} />
            </Pressable>
          </View>

          <ScrollView showsVerticalScrollIndicator={false}>
            {/* course name preview */}
            <Text style={[styles.courseName, { color: theme.textSecondary }]} numberOfLines={2}>
              {course.courseName}
            </Text>

            {/* inputs */}
            <View style={styles.form}>
              <Input
                label="Alias (optional)"
                placeholder="Short name for course"
                value={alias}
                onChangeText={setAlias}
              />

              <Input
                label="Credits"
                placeholder="e.g. 3"
                keyboardType="number-pad"
                value={credits}
                onChangeText={(text) => {
                  setCredits(text)
                  setError('')
                }}
                error={error}
              />

              {/* color picker */}
              <View style={styles.colorSection}>
                <Text style={[styles.colorLabel, { color: theme.text }]}>Color</Text>
                <View style={styles.colorGrid}>
                  {Colors.courseColors.map((color) => (
                    <Pressable
                      key={color}
                      onPress={() => handleColorSelect(color)}
                      style={[
                        styles.colorOption,
                        { backgroundColor: color },
                        selectedColor === color && styles.colorSelected,
                      ]}
                    >
                      {selectedColor === color && (
                        <Ionicons name="checkmark" size={16} color={Colors.white} />
                      )}
                    </Pressable>
                  ))}
                </View>
              </View>

              {/* bunks preview */}
              {totalBunks > 0 && (
                <View style={[styles.preview, { backgroundColor: theme.backgroundSecondary }]}>
                  <Text style={[styles.previewLabel, { color: theme.textSecondary }]}>
                    Total bunks allowed
                  </Text>
                  <Text style={[styles.previewValue, { color: theme.text }]}>
                    {totalBunks}
                  </Text>
                  <Text style={[styles.formula, { color: theme.textSecondary }]}>
                    (2 x {credits}) + 1
                  </Text>
                </View>
              )}
            </View>
          </ScrollView>

          {/* actions */}
          <View style={styles.actions}>
            <Button title="Cancel" variant="secondary" onPress={onClose} style={styles.btn} />
            <Button title="Save" onPress={handleSave} style={styles.btn} />
          </View>
        </View>
      </KeyboardAvoidingView>
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
    maxHeight: '80%',
    borderRadius: Radius.lg,
    padding: Spacing.lg,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  colorIndicator: {
    width: 16,
    height: 16,
    borderRadius: 8,
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
  },
  courseName: {
    fontSize: 13,
    marginBottom: Spacing.md,
  },
  form: {
    gap: Spacing.md,
  },
  colorSection: {
    gap: Spacing.sm,
  },
  colorLabel: {
    fontSize: 14,
    fontWeight: '500',
  },
  colorGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  colorOption: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  colorSelected: {
    borderWidth: 3,
    borderColor: Colors.white,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
  },
  preview: {
    padding: Spacing.md,
    borderRadius: Radius.md,
    alignItems: 'center',
    gap: Spacing.xs,
  },
  previewLabel: {
    fontSize: 12,
  },
  previewValue: {
    fontSize: 32,
    fontWeight: '700',
  },
  formula: {
    fontSize: 11,
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
