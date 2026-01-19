import { Button } from '@/components/ui/button'
import { Colors, Radius, Spacing } from '@/constants/theme'
import { useColorScheme } from '@/hooks/use-color-scheme'
import type { AttendanceRecord, CourseAttendance, CourseBunkData } from '@/types'
import { Ionicons } from '@expo/vector-icons'
import { useMemo } from 'react'
import { FlatList, Modal, Pressable, StyleSheet, Text, View } from 'react-native'

interface UnknownStatusModalProps {
    visible: boolean
    courses: CourseAttendance[]
    bunkCourses?: CourseBunkData[]
    onClose: () => void
    onConfirmPresent: (courseId: string, record: AttendanceRecord) => void
    onConfirmAbsent: (courseId: string, record: AttendanceRecord) => void
}

interface UnknownEntry {
    courseId: string
    courseName: string
    record: AttendanceRecord
}

// parse date for display
const formatDate = (dateStr: string): string => {
    const match = dateStr.match(/(\w{3})\s+(\d{1,2})\s+(\w{3})/)
    if (match) return `${match[2]} ${match[3]}`
    return dateStr.slice(0, 15)
}

// parse time
const parseTime = (dateStr: string): string | null => {
    const timeMatch = dateStr.match(/(\d{1,2}(?::\d{2})?(?:AM|PM)\s*-\s*\d{1,2}(?::\d{2})?(?:AM|PM))/i)
    return timeMatch ? timeMatch[1] : null
}

const buildRecordKey = (date: string, description: string): string =>
    `${date.trim()}-${description.trim()}`

// filter past records
const filterPast = (records: AttendanceRecord[]): AttendanceRecord[] => {
    const today = new Date()
    today.setHours(23, 59, 59, 999)
    return records.filter(r => {
        const dateMatch = r.date.match(/(\d{1,2})\s+(\w{3})\s+(\d{4})/)
        if (!dateMatch) return false
        const months: Record<string, string> = {
            jan: '01', feb: '02', mar: '03', apr: '04', may: '05', jun: '06',
            jul: '07', aug: '08', sep: '09', oct: '10', nov: '11', dec: '12'
        }
        const [, day, monthStr, year] = dateMatch
        const month = months[monthStr.toLowerCase()]
        if (!month) return false
        const date = new Date(`${year}-${month}-${day.padStart(2, '0')}`)
        return date <= today
    })
}

export function UnknownStatusModal({
    visible,
    courses,
    bunkCourses,
    onClose,
    onConfirmPresent,
    onConfirmAbsent,
}: UnknownStatusModalProps) {
    const colorScheme = useColorScheme()
    const isDark = colorScheme === 'dark'
    const theme = isDark ? Colors.dark : Colors.light

    // collect all unknown entries
    const resolvedKeysByCourse = useMemo(() => {
        const map = new Map<string, Set<string>>()
        if (!bunkCourses) return map
        for (const course of bunkCourses) {
            const keys = new Set<string>()
            for (const bunk of course.bunks) {
                keys.add(buildRecordKey(bunk.date, bunk.description))
            }
            map.set(course.courseId, keys)
        }
        return map
    }, [bunkCourses])

    const courseNameById = useMemo(() => {
        const map = new Map<string, string>()
        if (!bunkCourses) return map
        for (const course of bunkCourses) {
            map.set(course.courseId, course.config?.alias || course.courseName)
        }
        return map
    }, [bunkCourses])

    const unknownEntries = useMemo((): UnknownEntry[] => {
        const entries: UnknownEntry[] = []
        for (const course of courses) {
            const pastRecords = filterPast(course.records)
            for (const record of pastRecords) {
                if (record.status === 'Unknown') {
                    const resolvedKeys = resolvedKeysByCourse.get(course.courseId)
                    if (resolvedKeys?.has(buildRecordKey(record.date, record.description))) {
                        continue
                    }
                    entries.push({
                        courseId: course.courseId,
                        courseName: courseNameById.get(course.courseId) || course.courseName,
                        record,
                    })
                }
            }
        }
        // sort by date descending
        return entries.sort((a, b) => {
            const dateA = a.record.date
            const dateB = b.record.date
            return dateB.localeCompare(dateA)
        })
    }, [courses, courseNameById, resolvedKeysByCourse])

    const renderItem = ({ item }: { item: UnknownEntry }) => {
        const time = parseTime(item.record.date)
        return (
            <View style={[styles.item, { borderBottomColor: theme.border }]}>
                <View style={styles.itemInfo}>
                    <Text style={[styles.itemCourse, { color: theme.text }]} numberOfLines={1}>
                        {item.courseName}
                    </Text>
                    <View style={styles.itemMeta}>
                        <Text style={[styles.itemDate, { color: theme.textSecondary }]}>
                            {formatDate(item.record.date)}
                        </Text>
                        {time && (
                            <Text style={[styles.itemTime, { color: theme.textSecondary }]}>{time}</Text>
                        )}
                    </View>
                </View>
                <View style={styles.itemActions}>
                    <Pressable
                        onPress={() => onConfirmPresent(item.courseId, item.record)}
                        style={[styles.actionBtn, { backgroundColor: Colors.status.success }]}
                    >
                        <Ionicons name="checkmark" size={16} color={Colors.white} />
                    </Pressable>
                    <Pressable
                        onPress={() => onConfirmAbsent(item.courseId, item.record)}
                        style={[styles.actionBtn, { backgroundColor: Colors.status.danger }]}
                    >
                        <Ionicons name="close" size={16} color={Colors.white} />
                    </Pressable>
                </View>
            </View>
        )
    }

    return (
        <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
            <View style={styles.overlay}>
                <Pressable style={styles.backdrop} onPress={onClose} />
                <View style={[styles.modal, { backgroundColor: theme.background }]}>
                    <View style={styles.header}>
                        <View style={styles.headerLeft}>
                            <View style={[styles.iconBadge, { backgroundColor: Colors.status.unknown }]}>
                                <Ionicons name="help" size={16} color={Colors.white} />
                            </View>
                            <Text style={[styles.title, { color: theme.text }]}>Unconfirmed</Text>
                        </View>
                        <Pressable onPress={onClose} hitSlop={8}>
                            <Ionicons name="close" size={24} color={theme.textSecondary} />
                        </Pressable>
                    </View>

                    {unknownEntries.length === 0 ? (
                        <View style={styles.empty}>
                            <Ionicons name="checkmark-circle" size={48} color={Colors.status.success} />
                            <Text style={[styles.emptyText, { color: theme.textSecondary }]}>
                                All sessions confirmed
                            </Text>
                        </View>
                    ) : (
                        <>
                            <Text style={[styles.subtitle, { color: theme.textSecondary }]}>
                                {unknownEntries.length} session{unknownEntries.length !== 1 ? 's' : ''} need confirmation
                            </Text>
                            <FlatList
                                data={unknownEntries}
                                keyExtractor={(item, idx) => `${item.courseId}-${item.record.date}-${idx}`}
                                renderItem={renderItem}
                                contentContainerStyle={styles.list}
                                showsVerticalScrollIndicator={false}
                            />
                        </>
                    )}

                    <Button title="Close" variant="secondary" onPress={onClose} />
                </View>
            </View>
        </Modal>
    )
}

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        justifyContent: 'flex-end',
    },
    backdrop: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(0,0,0,0.5)',
    },
    modal: {
        maxHeight: '70%',
        borderTopLeftRadius: Radius.lg,
        borderTopRightRadius: Radius.lg,
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
    iconBadge: {
        width: 28,
        height: 28,
        borderRadius: 14,
        alignItems: 'center',
        justifyContent: 'center',
    },
    title: {
        fontSize: 18,
        fontWeight: '600',
    },
    subtitle: {
        fontSize: 13,
        marginBottom: Spacing.md,
    },
    list: {
        paddingBottom: Spacing.md,
    },
    item: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: Spacing.sm,
        borderBottomWidth: 1,
    },
    itemInfo: {
        flex: 1,
        marginRight: Spacing.sm,
    },
    itemCourse: {
        fontSize: 14,
        fontWeight: '500',
    },
    itemMeta: {
        flexDirection: 'row',
        gap: Spacing.sm,
        marginTop: 2,
    },
    itemDate: {
        fontSize: 12,
    },
    itemTime: {
        fontSize: 12,
    },
    itemActions: {
        flexDirection: 'row',
        gap: Spacing.sm,
    },
    actionBtn: {
        width: 32,
        height: 32,
        borderRadius: 16,
        alignItems: 'center',
        justifyContent: 'center',
    },
    empty: {
        alignItems: 'center',
        paddingVertical: Spacing.xxl,
        gap: Spacing.md,
    },
    emptyText: {
        fontSize: 14,
    },
})
