import { Colors, Radius, Spacing } from '@/constants/theme'
import { useColorScheme } from '@/hooks/use-color-scheme'
import type { AttendanceRecord, AttendanceStatus } from '@/types'
import { Ionicons } from '@expo/vector-icons'
import * as Haptics from 'expo-haptics'
import { useState } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import { Gesture, GestureDetector } from 'react-native-gesture-handler'
import Animated, { runOnJS, useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated'

interface SwipeableAttendanceSlotProps {
    record: AttendanceRecord
    timeSlot: string | null
    courseColor?: string
    onMarkPresent: () => void
    onMarkDL: () => void
}

const SWIPE_THRESHOLD = 80
const ACTION_WIDTH = 80

// status colors
const getStatusColor = (status: AttendanceStatus): string => {
    switch (status) {
        case 'Present': return Colors.status.success
        case 'Absent': return Colors.status.danger
        case 'Late': return Colors.status.warning
        case 'Excused': return Colors.status.info
        case 'Unknown': return Colors.status.unknown
    }
}

const getStatusIcon = (status: AttendanceStatus): string => {
    switch (status) {
        case 'Present': return 'checkmark'
        case 'Absent': return 'close'
        case 'Late': return 'time'
        case 'Excused': return 'document-text'
        case 'Unknown': return 'help'
    }
}

export function SwipeableAttendanceSlot({
    record,
    timeSlot,
    courseColor,
    onMarkPresent,
    onMarkDL,
}: SwipeableAttendanceSlotProps) {
    const colorScheme = useColorScheme()
    const isDark = colorScheme === 'dark'
    const theme = isDark ? Colors.dark : Colors.light

    const translateX = useSharedValue(0)
    const [isExpanded, setIsExpanded] = useState(false)

    const triggerHaptic = () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
    }

    const handleLeftAction = () => {
        triggerHaptic()
        onMarkPresent()
    }

    const handleRightAction = () => {
        triggerHaptic()
        onMarkDL()
    }

    const panGesture = Gesture.Pan()
        .activeOffsetX([-10, 10])
        .failOffsetY([-15, 15])
        .onUpdate((e) => {
            translateX.value = Math.max(-ACTION_WIDTH, Math.min(ACTION_WIDTH, e.translationX))
        })
        .onEnd((e) => {
            if (e.translationX < -SWIPE_THRESHOLD) {
                runOnJS(handleLeftAction)()
            } else if (e.translationX > SWIPE_THRESHOLD) {
                runOnJS(handleRightAction)()
            }
            translateX.value = withSpring(0, { damping: 20 })
        })

    const animatedStyle = useAnimatedStyle(() => ({
        transform: [{ translateX: translateX.value }],
    }))

    const leftActionStyle = useAnimatedStyle(() => ({
        opacity: withTiming(translateX.value < -20 ? 1 : 0, { duration: 150 }),
    }))

    const rightActionStyle = useAnimatedStyle(() => ({
        opacity: withTiming(translateX.value > 20 ? 1 : 0, { duration: 150 }),
    }))

    const statusColor = getStatusColor(record.status)
    const statusIcon = getStatusIcon(record.status)
    const isUnknown = record.status === 'Unknown'
    const isAbsent = record.status === 'Absent'
    const rightActionLabel = isUnknown ? 'Absent' : 'DL'
    const rightActionIcon = isUnknown ? 'close-circle' : 'briefcase'
    const rightActionColor = isUnknown ? Colors.status.danger : Colors.status.info

    return (
        <View style={[styles.container, { borderBottomColor: theme.border }]}>
            {/* left action (mark present) */}
            <Animated.View style={[styles.action, styles.leftAction, leftActionStyle]}>
                <View style={[styles.actionInner, { backgroundColor: Colors.status.success }]}>
                    <Ionicons name="checkmark" size={20} color={Colors.white} />
                    <Text style={styles.actionText}>Present</Text>
                </View>
            </Animated.View>

            {/* right action (mark DL or Absent for Unknown) */}
            <Animated.View style={[styles.action, styles.rightAction, rightActionStyle]}>
                <View style={[styles.actionInner, { backgroundColor: rightActionColor }]}>
                    <Ionicons name={rightActionIcon} size={20} color={Colors.white} />
                    <Text style={styles.actionText}>{rightActionLabel}</Text>
                </View>
            </Animated.View>

            {/* main content */}
            <GestureDetector gesture={panGesture}>
                <Animated.View style={[styles.content, { backgroundColor: theme.background }, animatedStyle]}>
                    <Pressable onPress={() => setIsExpanded(!isExpanded)}>
                        <View style={styles.row}>
                            {/* course color bar */}
                            {courseColor && <View style={[styles.colorBar, { backgroundColor: courseColor }]} />}

                            {/* time slot */}
                            <View style={styles.timeSection}>
                                <Text style={[styles.timeText, { color: theme.text }]}>
                                    {timeSlot || 'No time'}
                                </Text>
                                <Text style={[styles.descText, { color: theme.textSecondary }]} numberOfLines={1}>
                                    {record.description}
                                </Text>
                            </View>

                            {/* status badge */}
                            <View style={[styles.statusBadge, { backgroundColor: statusColor }]}>
                                <Ionicons name={statusIcon as any} size={12} color={Colors.white} />
                                <Text style={styles.statusText}>{record.status.charAt(0)}</Text>
                            </View>

                            {/* swipe hints for absent/unknown */}
                            {(isAbsent || isUnknown) && (
                                <View style={styles.swipeHints}>
                                    <Ionicons name="chevron-back" size={12} color={Colors.status.success} />
                                    <Ionicons name="chevron-forward" size={12} color={isUnknown ? Colors.status.danger : Colors.status.info} />
                                </View>
                            )}
                        </View>
                    </Pressable>

                    {/* expanded details */}
                    {isExpanded && record.remarks && (
                        <View style={styles.remarks}>
                            <Text style={[styles.remarksText, { color: theme.textSecondary }]}>
                                {record.remarks}
                            </Text>
                        </View>
                    )}
                </Animated.View>
            </GestureDetector>
        </View>
    )
}

const styles = StyleSheet.create({
    container: {
        position: 'relative',
        borderBottomWidth: 1,
        overflow: 'hidden',
    },
    action: {
        position: 'absolute',
        top: 0,
        bottom: 0,
        width: ACTION_WIDTH,
        justifyContent: 'center',
    },
    leftAction: {
        right: 0,
        alignItems: 'flex-end',
    },
    rightAction: {
        left: 0,
        alignItems: 'flex-start',
    },
    actionInner: {
        width: ACTION_WIDTH,
        height: '100%',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 2,
    },
    actionText: {
        color: Colors.white,
        fontSize: 10,
        fontWeight: '600',
    },
    content: {
        paddingVertical: Spacing.sm,
        paddingHorizontal: Spacing.xs,
    },
    row: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.sm,
    },
    colorBar: {
        width: 3,
        height: 32,
        borderRadius: 2,
    },
    timeSection: {
        flex: 1,
    },
    timeText: {
        fontSize: 14,
        fontWeight: '500',
    },
    descText: {
        fontSize: 11,
    },
    statusBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 3,
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: Radius.full,
    },
    statusText: {
        color: Colors.white,
        fontSize: 10,
        fontWeight: '600',
    },
    swipeHints: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 2,
        opacity: 0.4,
    },
    remarks: {
        marginTop: Spacing.sm,
        paddingLeft: Spacing.md,
    },
    remarksText: {
        fontSize: 12,
        fontStyle: 'italic',
    },
})
