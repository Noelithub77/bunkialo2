import { Colors, Radius, Spacing } from "@/constants/theme";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { useBunkStore } from "@/stores/bunk-store";
import {
    formatTimeDisplay,
    getDayName,
    getNearbySlots,
} from "@/stores/timetable-store";
import type { TimetableSlot } from "@/types";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import { useCallback, useMemo, useRef, useState } from "react";
import {
    Dimensions,
    FlatList,
    StyleSheet,
    Text,
    View,
    type ViewToken,
} from "react-native";

interface UpNextCarouselProps {
  slots: TimetableSlot[];
}

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const CARD_WIDTH = SCREEN_WIDTH * 0.65;
const CARD_SPACING = Spacing.sm;
const SIDE_SPACING = (SCREEN_WIDTH - CARD_WIDTH) / 2;

export function UpNextCarousel({ slots }: UpNextCarouselProps) {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";
  const theme = isDark ? Colors.dark : Colors.light;
  const bunkCourses = useBunkStore((state) => state.courses);
  const flatListRef = useRef<FlatList>(null);
  const [activeIndex, setActiveIndex] = useState(2); // center card

  const getCourseColor = (courseId: string): string => {
    const course = bunkCourses.find((c) => c.courseId === courseId);
    return course?.config?.color || Colors.courseColors[0];
  };

  const nearbySlots = useMemo(() => getNearbySlots(slots), [slots]);

  const now = new Date();
  const currentDay = now.getDay();
  const currentTime = `${now.getHours().toString().padStart(2, "0")}:${now.getMinutes().toString().padStart(2, "0")}`;

  // find if there's a currently active class
  const currentClass = nearbySlots.find(
    (slot) =>
      slot.dayOfWeek === currentDay &&
      currentTime >= slot.startTime &&
      currentTime < slot.endTime,
  );

  // find the next class if no current class exists
  const nextClass = !currentClass
    ? nearbySlots.find((slot) => {
        if (slot.dayOfWeek !== currentDay) return true;
        return slot.startTime > currentTime;
      })
    : null;

  // find initial scroll index (current or next class)
  const initialScrollIndex = useMemo(() => {
    if (nearbySlots.length === 0) return 0;
    const currentIndex = nearbySlots.findIndex(
      (slot) => slot.id === (currentClass?.id || nextClass?.id),
    );
    return currentIndex >= 0 ? currentIndex : 0;
  }, [nearbySlots, currentClass, nextClass]);

  const viewabilityConfig = useRef({
    itemVisiblePercentThreshold: 50,
    minimumViewTime: 50,
  }).current;

  // debounced snap back after 2s inactivity
  const snapTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const resetSnapTimer = useCallback(() => {
    // clear existing timer
    if (snapTimerRef.current) {
      clearTimeout(snapTimerRef.current);
    }
    // start new timer - snap back after 2s inactivity
    const centerIndex = Math.min(initialScrollIndex, nearbySlots.length - 1);
    snapTimerRef.current = setTimeout(() => {
      flatListRef.current?.scrollToIndex({
        index: centerIndex,
        animated: true,
      });
    }, 2000);
  }, [nearbySlots.length, initialScrollIndex]);

  const onViewableItemsChanged = useCallback(
    ({ viewableItems }: { viewableItems: ViewToken[] }) => {
      if (viewableItems.length > 0) {
        const newIndex = viewableItems[0].index ?? 0;
        if (newIndex !== activeIndex) {
          setActiveIndex(newIndex);
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          // reset timer on any scroll
          resetSnapTimer();
        }
      }
    },
    [activeIndex, resetSnapTimer],
  );

  if (nearbySlots.length === 0) {
    return (
      <View
        style={[
          styles.emptyCard,
          { backgroundColor: theme.backgroundSecondary },
        ]}
      >
        <Ionicons name="moon-outline" size={32} color={theme.textSecondary} />
        <Text style={[styles.emptyText, { color: theme.textSecondary }]}>
          No classes scheduled
        </Text>
      </View>
    );
  }

  const renderCard = ({
    item,
    index,
  }: {
    item: TimetableSlot;
    index: number;
  }) => {
    const courseColor = getCourseColor(item.courseId);
    const isCurrentlyActive =
      item.dayOfWeek === currentDay &&
      currentTime >= item.startTime &&
      currentTime < item.endTime;
    const isNextClass = nextClass?.id === item.id;
    const isFinished =
      item.dayOfWeek === currentDay && currentTime >= item.endTime;
    const isFutureClass = !isCurrentlyActive && !isNextClass && !isFinished;
    const isActive = index === activeIndex;

    const gradientColors = isDark
      ? ([courseColor + "50", courseColor + "25"] as const)
      : ([courseColor + "40", courseColor + "15"] as const);

    // day label logic
    const slotDay = item.dayOfWeek;
    const isToday = slotDay === currentDay;
    const dayLabel = isToday ? "Today" : getDayName(slotDay, false);

    // determine status color and text
    let statusColor = courseColor;
    let statusText = dayLabel;
    let borderColor: string | undefined = undefined;
    let cardOpacity = 1;

    if (isCurrentlyActive) {
      statusColor = Colors.status.success;
      statusText = "Now";
      borderColor = Colors.status.success;
    } else if (isNextClass) {
      statusColor = Colors.status.unknown;
      statusText = "Next";
      borderColor = Colors.status.unknown;
    } else if (isFinished) {
      statusColor = theme.textSecondary;
      statusText = "Done";
      cardOpacity = 0.5;
    } else if (isFutureClass) {
      cardOpacity = 0.6;
    }

    return (
      <View style={[styles.cardWrapper, { width: CARD_WIDTH }]}>
        <LinearGradient
          colors={gradientColors}
          style={[
            styles.card,
            !isActive && styles.cardInactive,
            borderColor && {
              borderColor,
              borderWidth: 2,
            },
            (isFinished || isFutureClass) && { opacity: cardOpacity },
          ]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        >
          {/* status row */}
          <View style={styles.statusRow}>
            <View
              style={[styles.statusDot, { backgroundColor: statusColor }]}
            />
            <Text style={[styles.statusText, { color: statusColor }]}>
              {statusText}
            </Text>
          </View>

          {/* course name */}
          <Text
            style={[styles.courseName, { color: theme.text }]}
            numberOfLines={2}
          >
            {item.courseName}
          </Text>

          {/* time */}
          <View style={styles.timeRow}>
            <Ionicons
              name="time-outline"
              size={14}
              color={theme.textSecondary}
            />
            <Text style={[styles.timeText, { color: theme.text }]}>
              {formatTimeDisplay(item.startTime)} -{" "}
              {formatTimeDisplay(item.endTime)}
            </Text>
          </View>

          {/* session type */}
          <View style={[styles.typeBadge, { backgroundColor: courseColor }]}>
            <Text style={styles.typeText}>
              {item.sessionType.charAt(0).toUpperCase() +
                item.sessionType.slice(1)}
            </Text>
          </View>
        </LinearGradient>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <FlatList
        ref={flatListRef}
        data={nearbySlots}
        renderItem={renderCard}
        keyExtractor={(item, index) => `${item.id}-${index}`}
        horizontal
        showsHorizontalScrollIndicator={false}
        snapToInterval={CARD_WIDTH + CARD_SPACING}
        decelerationRate="fast"
        contentContainerStyle={{
          paddingHorizontal: SIDE_SPACING,
        }}
        ItemSeparatorComponent={() => <View style={{ width: CARD_SPACING }} />}
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={viewabilityConfig}
        initialScrollIndex={initialScrollIndex}
        getItemLayout={(_, index) => ({
          length: CARD_WIDTH + CARD_SPACING,
          offset: (CARD_WIDTH + CARD_SPACING) * index,
          index,
        })}
        onMomentumScrollEnd={resetSnapTimer}
      />

      {/* pagination dots */}
      <View style={styles.pagination}>
        {nearbySlots.map((_, index) => (
          <View
            key={index}
            style={[
              styles.dot,
              {
                backgroundColor:
                  index === activeIndex ? theme.text : theme.border,
              },
            ]}
          />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginHorizontal: -Spacing.md, // full bleed
  },
  emptyCard: {
    borderRadius: Radius.lg,
    padding: Spacing.xl,
    alignItems: "center",
    justifyContent: "center",
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
    minHeight: 140,
  },
  cardInactive: {
    opacity: 0.7,
    transform: [{ scale: 0.95 }],
  },
  statusRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  statusText: {
    fontSize: 11,
    fontWeight: "600",
    textTransform: "uppercase",
  },
  courseName: {
    fontSize: 18,
    fontWeight: "700",
  },
  timeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
  },
  timeText: {
    fontSize: 13,
    fontWeight: "500",
  },
  typeBadge: {
    alignSelf: "flex-start",
    paddingHorizontal: Spacing.sm,
    paddingVertical: 3,
    borderRadius: Radius.sm,
  },
  typeText: {
    fontSize: 11,
    fontWeight: "600",
    color: Colors.white,
  },
  pagination: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 6,
    marginTop: Spacing.xs,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
});
