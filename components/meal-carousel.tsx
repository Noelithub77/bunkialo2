import { Colors, Radius, Spacing } from '@/constants/theme'
import { MEAL_COLORS, MEAL_TIMES, getNearbyMeals, type Meal, type MealType } from '@/data/mess'
import { useColorScheme } from '@/hooks/use-color-scheme'
import { Ionicons } from '@expo/vector-icons'
import * as Haptics from 'expo-haptics'
import { LinearGradient } from 'expo-linear-gradient'
import { useCallback, useMemo, useRef, useState } from 'react'
import { Dimensions, FlatList, Pressable, StyleSheet, Text, View, type ViewToken } from 'react-native'

const { width: SCREEN_WIDTH } = Dimensions.get('window')
const CARD_WIDTH = SCREEN_WIDTH * 0.65
const CARD_SPACING = Spacing.sm
const SIDE_SPACING = (SCREEN_WIDTH - CARD_WIDTH) / 2

const MEAL_ICONS: Record<MealType, keyof typeof Ionicons.glyphMap> = {
    breakfast: 'sunny-outline',
    lunch: 'restaurant-outline',
    snacks: 'cafe-outline',
    dinner: 'moon-outline',
}

export function MealCarousel() {
    const colorScheme = useColorScheme()
    const isDark = colorScheme === 'dark'
    const theme = isDark ? Colors.dark : Colors.light
    const flatListRef = useRef<FlatList>(null)
    const [activeIndex, setActiveIndex] = useState(0)
    const [expandedMeal, setExpandedMeal] = useState<MealType | null>(null)

    const now = useMemo(() => new Date(), [])
    const { meals, initialIndex } = useMemo(() => getNearbyMeals(now), [now])

    const currentTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`

    const viewabilityConfig = useRef({
        itemVisiblePercentThreshold: 50,
        minimumViewTime: 50,
    }).current

    // snap back after 2s inactivity
    const snapTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

    const resetSnapTimer = useCallback(() => {
        if (snapTimerRef.current) clearTimeout(snapTimerRef.current)
        snapTimerRef.current = setTimeout(() => {
            flatListRef.current?.scrollToIndex({ index: initialIndex, animated: true })
        }, 2000)
    }, [initialIndex])

    const onViewableItemsChanged = useCallback(
        ({ viewableItems }: { viewableItems: ViewToken[] }) => {
            if (viewableItems.length > 0) {
                const newIndex = viewableItems[0].index ?? 0
                if (newIndex !== activeIndex) {
                    setActiveIndex(newIndex)
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
                    resetSnapTimer()
                }
            }
        },
        [activeIndex, resetSnapTimer]
    )

    if (meals.length === 0) {
        return (
            <View style={[styles.emptyCard, { backgroundColor: theme.backgroundSecondary }]}>
                <Ionicons name="restaurant-outline" size={32} color={theme.textSecondary} />
                <Text style={[styles.emptyText, { color: theme.textSecondary }]}>No menu available</Text>
            </View>
        )
    }

    const formatTime = (time: string) => {
        const [h, m] = time.split(':').map(Number)
        const period = h >= 12 ? 'PM' : 'AM'
        const hour = h % 12 || 12
        return `${hour}:${m.toString().padStart(2, '0')} ${period}`
    }

    const renderCard = ({ item, index }: { item: Meal; index: number }) => {
        const mealColor = MEAL_COLORS[item.type]
        const isCurrentlyActive = currentTime >= item.startTime && currentTime < item.endTime
        const isFinished = currentTime >= item.endTime
        const isActive = index === activeIndex
        const isExpanded = expandedMeal === item.type

        const handlePress = () => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
            setExpandedMeal(isExpanded ? null : item.type)
        }

        // find next meal
        const nextMealIndex = meals.findIndex(m => currentTime < m.startTime)
        const isNextMeal = index === nextMealIndex && !isCurrentlyActive

        const gradientColors = isDark
            ? ([mealColor + '50', mealColor + '25'] as const)
            : ([mealColor + '40', mealColor + '15'] as const)

        let statusColor = mealColor
        let statusText = MEAL_TIMES[item.type].name
        let borderColor: string | undefined
        let cardOpacity = 1

        if (isCurrentlyActive) {
            statusColor = Colors.status.success
            statusText = 'Now'
            borderColor = Colors.status.success
        } else if (isNextMeal) {
            statusColor = Colors.status.unknown
            statusText = 'Next'
            borderColor = Colors.status.unknown
        } else if (isFinished) {
            statusColor = theme.textSecondary
            statusText = 'Done'
            cardOpacity = 0.5
        }

        return (
            <Pressable onPress={handlePress} style={[styles.cardWrapper, { width: CARD_WIDTH }]}>
                <LinearGradient
                    colors={gradientColors}
                    style={[
                        styles.card,
                        !isActive && styles.cardInactive,
                        borderColor && { borderColor, borderWidth: 2 },
                        isFinished && { opacity: cardOpacity },
                    ]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                >
                    {/* status row */}
                    <View style={styles.statusRow}>
                        <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
                        <Text style={[styles.statusText, { color: statusColor }]}>{statusText}</Text>
                        <View style={{ flex: 1 }} />
                        <Ionicons
                            name={isExpanded ? 'chevron-up' : 'chevron-down'}
                            size={16}
                            color={theme.textSecondary}
                        />
                    </View>

                    {/* meal name */}
                    <View style={styles.mealHeader}>
                        <Ionicons name={MEAL_ICONS[item.type]} size={24} color={theme.text} />
                        <Text style={[styles.mealName, { color: theme.text }]}>{item.name}</Text>
                    </View>

                    {/* time */}
                    <View style={styles.timeRow}>
                        <Ionicons name="time-outline" size={14} color={theme.textSecondary} />
                        <Text style={[styles.timeText, { color: theme.text }]}>
                            {formatTime(item.startTime)} - {formatTime(item.endTime)}
                        </Text>
                    </View>

                    {/* items - preview or full */}
                    {isExpanded ? (
                        <View style={styles.itemsContainer}>
                            {item.items.map((menuItem, i) => (
                                <View key={i} style={[styles.itemChip, { backgroundColor: theme.backgroundSecondary }]}>
                                    <Text style={[styles.itemText, { color: theme.text }]}>{menuItem}</Text>
                                </View>
                            ))}
                        </View>
                    ) : (
                        <Text style={[styles.itemsPreview, { color: theme.textSecondary }]} numberOfLines={2}>
                            {item.items.slice(0, 4).join(', ')}...
                        </Text>
                    )}
                </LinearGradient>
            </Pressable>
        )
    }

    return (
        <View style={styles.container}>
            <FlatList
                ref={flatListRef}
                data={meals}
                renderItem={renderCard}
                keyExtractor={(item) => item.type}
                horizontal
                showsHorizontalScrollIndicator={false}
                snapToInterval={CARD_WIDTH + CARD_SPACING}
                decelerationRate="fast"
                contentContainerStyle={{ paddingHorizontal: SIDE_SPACING }}
                ItemSeparatorComponent={() => <View style={{ width: CARD_SPACING }} />}
                onViewableItemsChanged={onViewableItemsChanged}
                viewabilityConfig={viewabilityConfig}
                initialScrollIndex={initialIndex}
                getItemLayout={(_, index) => ({
                    length: CARD_WIDTH + CARD_SPACING,
                    offset: (CARD_WIDTH + CARD_SPACING) * index,
                    index,
                })}
                onMomentumScrollEnd={resetSnapTimer}
            />

            {/* pagination dots */}
            <View style={styles.pagination}>
                {meals.map((_, index) => (
                    <View
                        key={index}
                        style={[
                            styles.dot,
                            { backgroundColor: index === activeIndex ? theme.text : theme.border },
                        ]}
                    />
                ))}
            </View>
        </View>
    )
}

const styles = StyleSheet.create({
    container: {
        marginHorizontal: -Spacing.md,
    },
    emptyCard: {
        borderRadius: Radius.lg,
        padding: Spacing.xl,
        alignItems: 'center',
        justifyContent: 'center',
        gap: Spacing.sm,
    },
    emptyText: {
        fontSize: 14,
    },
    cardWrapper: {
        paddingVertical: Spacing.sm,
    },
    card: {
        borderRadius: Radius.lg,
        padding: Spacing.lg,
        gap: Spacing.sm,
        minHeight: 160,
    },
    cardInactive: {
        opacity: 0.7,
        transform: [{ scale: 0.95 }],
    },
    statusRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.xs,
    },
    statusDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
    },
    statusText: {
        fontSize: 11,
        fontWeight: '600',
        textTransform: 'uppercase',
    },
    mealHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.sm,
    },
    mealName: {
        fontSize: 20,
        fontWeight: '700',
    },
    timeRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.xs,
    },
    timeText: {
        fontSize: 13,
        fontWeight: '500',
    },
    itemsPreview: {
        fontSize: 12,
        lineHeight: 18,
    },
    itemsContainer: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 6,
    },
    itemChip: {
        paddingHorizontal: Spacing.sm,
        paddingVertical: 4,
        borderRadius: Radius.sm,
    },
    itemText: {
        fontSize: 11,
    },
    pagination: {
        flexDirection: 'row',
        justifyContent: 'center',
        gap: 6,
        marginTop: Spacing.xs,
    },
    dot: {
        width: 6,
        height: 6,
        borderRadius: 3,
    },
})
