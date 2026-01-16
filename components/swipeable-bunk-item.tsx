import { Colors, Radius, Spacing } from '@/constants/theme'
import { useColorScheme } from '@/hooks/use-color-scheme'
import type { BunkRecord } from '@/types'
import { Ionicons } from '@expo/vector-icons'
import { useState } from 'react'
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native'
import { Gesture, GestureDetector } from 'react-native-gesture-handler'
import Animated, { runOnJS, useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated'

// parse date for display
const formatDate = (dateStr: string): string => {
    const match = dateStr.match(/(\w{3})\s+(\d{1,2})\s+(\w{3})/)
    if (match) return `${match[2]} ${match[3]}`
    return dateStr.slice(0, 15)
}

interface SwipeableBunkItemProps {
    bunk: BunkRecord
    showHint?: boolean
    onMarkDL: () => void
    onRemoveDL: () => void
    onMarkPresent: () => void
    onRemovePresent: () => void
    onUpdateNote: (note: string) => void
}

const SWIPE_THRESHOLD = 80
const ACTION_WIDTH = 80

export function SwipeableBunkItem({
    bunk,
    showHint = false,
    onMarkDL,
    onRemoveDL,
    onMarkPresent,
    onRemovePresent,
    onUpdateNote,
}: SwipeableBunkItemProps) {
    const colorScheme = useColorScheme()
    const isDark = colorScheme === 'dark'
    const theme = isDark ? Colors.dark : Colors.light

    const [showNote, setShowNote] = useState(false)
    const [noteText, setNoteText] = useState(bunk.note)

    const translateX = useSharedValue(0)

    const handleLeftAction = () => {
        if (bunk.isMarkedPresent) {
            onRemovePresent()
        } else {
            onMarkPresent()
        }
    }

    const handleRightAction = () => {
        if (bunk.isDutyLeave) {
            onRemoveDL()
        } else {
            onMarkDL()
        }
    }

    const panGesture = Gesture.Pan()
        .activeOffsetX([-10, 10])
        .onUpdate((e) => {
            // clamp translation
            translateX.value = Math.max(-ACTION_WIDTH, Math.min(ACTION_WIDTH, e.translationX))
        })
        .onEnd((e) => {
            if (e.translationX < -SWIPE_THRESHOLD) {
                // swiped left -> present action
                runOnJS(handleLeftAction)()
            } else if (e.translationX > SWIPE_THRESHOLD) {
                // swiped right -> DL action
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

    // determine item state styling
    const isPresent = bunk.isMarkedPresent
    const isDL = bunk.isDutyLeave
    const itemOpacity = isPresent ? 0.5 : 1

    return (
        <View style={[styles.container, { borderBottomColor: theme.border }]}>
            {/* left action (present) - revealed on swipe left */}
            <Animated.View style={[styles.action, styles.leftAction, leftActionStyle]}>
                <View style={[styles.actionInner, { backgroundColor: isPresent ? Colors.gray[600] : Colors.status.success }]}>
                    <Ionicons name={isPresent ? 'close' : 'checkmark'} size={20} color={Colors.white} />
                    <Text style={styles.actionText}>{isPresent ? 'Undo' : 'Present'}</Text>
                </View>
            </Animated.View>

            {/* right action (DL) - revealed on swipe right */}
            <Animated.View style={[styles.action, styles.rightAction, rightActionStyle]}>
                <View style={[styles.actionInner, { backgroundColor: isDL ? Colors.gray[600] : Colors.status.info }]}>
                    <Ionicons name={isDL ? 'close' : 'briefcase'} size={20} color={Colors.white} />
                    <Text style={styles.actionText}>{isDL ? 'Undo' : 'DL'}</Text>
                </View>
            </Animated.View>

            {/* main content */}
            <GestureDetector gesture={panGesture}>
                <Animated.View style={[styles.content, { backgroundColor: theme.background }, animatedStyle]}>
                    <Pressable onPress={() => setShowNote(!showNote)} style={{ opacity: itemOpacity }}>
                        <View style={styles.row}>
                            {/* source tag */}
                            <View style={[styles.sourceTag, { backgroundColor: bunk.source === 'lms' ? Colors.status.info : Colors.status.warning }]}>
                                <Text style={styles.sourceText}>{bunk.source.toUpperCase()}</Text>
                            </View>

                            {/* date + time */}
                            <View style={styles.dateSection}>
                                <Text style={[styles.dateText, { color: theme.text }, isPresent && styles.strikethrough]}>
                                    {formatDate(bunk.date)}
                                </Text>
                                {bunk.timeSlot && (
                                    <Text style={[styles.timeText, { color: theme.textSecondary }]}>{bunk.timeSlot}</Text>
                                )}
                            </View>

                            {/* status badges */}
                            {isPresent && (
                                <View style={[styles.badge, { backgroundColor: Colors.status.success }]}>
                                    <Ionicons name="checkmark" size={10} color={Colors.white} />
                                    <Text style={styles.badgeText}>Present</Text>
                                </View>
                            )}
                            {isDL && (
                                <View style={[styles.badge, { backgroundColor: Colors.status.info }]}>
                                    <Ionicons name="briefcase" size={10} color={Colors.white} />
                                    <Text style={styles.badgeText}>DL</Text>
                                </View>
                            )}

                            {/* note indicator */}
                            {(bunk.note || bunk.presenceNote || bunk.dutyLeaveNote) && !showNote && (
                                <View style={styles.noteIndicator}>
                                    <Ionicons name="chatbubble" size={14} color={Colors.status.info} />
                                </View>
                            )}

                            {/* swipe hints - show on unmarked items */}
                            {!isPresent && !isDL && (
                                <View style={styles.swipeHints}>
                                    <Ionicons name="chevron-back" size={12} color={Colors.status.success} />
                                    <Ionicons name="chevron-forward" size={12} color={Colors.status.info} />
                                </View>
                            )}
                        </View>
                    </Pressable>

                    {/* expanded note section */}
                    {showNote && (
                        <View style={styles.noteSection}>
                            {isPresent && bunk.presenceNote && (
                                <Text style={[styles.noteDisplay, { color: Colors.status.success }]}>
                                    Present: {bunk.presenceNote}
                                </Text>
                            )}
                            {isDL && bunk.dutyLeaveNote && (
                                <Text style={[styles.noteDisplay, { color: Colors.status.info }]}>
                                    DL: {bunk.dutyLeaveNote}
                                </Text>
                            )}
                            <TextInput
                                style={[styles.noteInput, { color: theme.text, borderColor: theme.border }]}
                                placeholder="Add note..."
                                placeholderTextColor={theme.textSecondary}
                                value={noteText}
                                onChangeText={setNoteText}
                                onBlur={() => onUpdateNote(noteText)}
                                multiline
                            />
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
    },
    row: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.sm,
    },
    sourceTag: {
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 4,
    },
    sourceText: {
        color: Colors.white,
        fontSize: 9,
        fontWeight: '600',
    },
    dateSection: {
        flex: 1,
    },
    dateText: {
        fontSize: 14,
        fontWeight: '500',
    },
    strikethrough: {
        textDecorationLine: 'line-through',
    },
    timeText: {
        fontSize: 11,
    },
    badge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 3,
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: Radius.full,
    },
    badgeText: {
        color: Colors.white,
        fontSize: 10,
        fontWeight: '600',
    },
    noteIndicator: {
        marginLeft: 4,
    },
    swipeHints: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 2,
        opacity: 0.4,
    },
    noteSection: {
        marginTop: Spacing.sm,
    },
    noteDisplay: {
        fontSize: 12,
        fontStyle: 'italic',
        marginBottom: Spacing.xs,
    },
    noteInput: {
        fontSize: 13,
        borderWidth: 1,
        borderRadius: Radius.sm,
        padding: Spacing.sm,
        minHeight: 36,
    },
})
