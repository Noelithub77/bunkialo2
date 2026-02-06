import { Colors } from "@/constants/theme";
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
import { useFocusEffect } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Dimensions,
  FlatList,
  Text,
  View,
  type ViewToken,
} from "react-native";

interface UpNextCarouselProps {
  slots: TimetableSlot[];
}

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const CARD_WIDTH = SCREEN_WIDTH * 0.72;
const CARD_SPACING = 6;
const SIDE_SPACING = (SCREEN_WIDTH - CARD_WIDTH) / 2;

export function UpNextCarousel({ slots }: UpNextCarouselProps) {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";
  const theme = isDark ? Colors.dark : Colors.light;
  const bunkCourses = useBunkStore((state) => state.courses);
  const flatListRef = useRef<FlatList>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const [hasInitialScrolled, setHasInitialScrolled] = useState(false);

  // recompute time on focus
  const [, setFocusKey] = useState(0);
  useFocusEffect(
    useCallback(() => {
      setFocusKey((k) => k + 1);
    }, []),
  );

  const getCourseColor = (courseId: string): string => {
    const course = bunkCourses.find((c) => c.courseId === courseId);
    return course?.config?.color || Colors.courseColors[0];
  };

  const now = new Date();
  const nearbySlots = getNearbySlots(slots, now);

  const currentDay = now.getDay();
  const currentTime = `${now.getHours().toString().padStart(2, "0")}:${now
    .getMinutes()
    .toString()
    .padStart(2, "0")}`;

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

  // Initialize activeIndex to match initialScrollIndex to prevent jitter
  useEffect(() => {
    setActiveIndex(initialScrollIndex);

    // Mark as initial scrolled after a short delay since onMomentumScrollEnd may not fire
    const timer = setTimeout(() => {
      setHasInitialScrolled(true);
    }, 500);

    return () => clearTimeout(timer);
  }, [initialScrollIndex]);

  const onViewableItemsChanged = useCallback(
    ({ viewableItems }: { viewableItems: ViewToken[] }) => {
      if (viewableItems.length > 0) {
        const newIndex = viewableItems[0].index ?? 0;
        if (newIndex !== activeIndex) {
          setActiveIndex(newIndex);
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          if (hasInitialScrolled) {
            resetSnapTimer();
          }
        }
      }
    },
    [activeIndex, hasInitialScrolled, resetSnapTimer],
  );

  if (nearbySlots.length === 0) {
    return (
      <View
        className="items-center justify-center rounded-2xl px-8 py-8 gap-2"
        style={{ backgroundColor: theme.backgroundSecondary }}
      >
        <Ionicons name="moon-outline" size={32} color={theme.textSecondary} />
        <Text className="text-sm" style={{ color: theme.textSecondary }}>
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
      ? ([courseColor + "70", courseColor + "32", "#04070D"] as const)
      : ([courseColor + "45", courseColor + "18", "#FFFFFF"] as const);

    // day label logic
    const slotDay = item.dayOfWeek;
    const isToday = slotDay === currentDay;
    const dayLabel = isToday ? "Today" : getDayName(slotDay, false);

    // determine status color and text
    let statusColor = courseColor;
    let statusText = dayLabel;
    let borderColor: string | undefined;
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
      cardOpacity = 0.62;
    }

    return (
      <View className="py-1.5" style={{ width: CARD_WIDTH }}>
        <LinearGradient
          colors={gradientColors}
          locations={[0, 0.45, 1]}
          className="relative min-h-[146px] overflow-hidden rounded-2xl px-5 py-4"
          style={[
            !isActive && { opacity: 0.7, transform: [{ scale: 0.95 }] },
            {
              borderColor:
                borderColor ?? (isDark ? courseColor + "4A" : courseColor + "3A"),
              borderWidth: 1,
            },
            isCurrentlyActive &&
              isDark && {
                shadowColor: courseColor,
                shadowOpacity: 0.4,
                shadowOffset: { width: 0, height: 8 },
                shadowRadius: 12,
                elevation: 5,
              },
            (isFinished || isFutureClass) && { opacity: cardOpacity },
          ]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        >
          {/* status row */}
          <View className="flex-row items-center gap-1">
            <View
              className="h-2 w-2 rounded-full"
              style={{ backgroundColor: statusColor }}
            />
            <Text
              className="text-[11px] font-semibold uppercase"
              style={{ color: statusColor, letterSpacing: 0.3 }}
            >
              {statusText}
            </Text>
          </View>

          {/* course name */}
          <Text
            className="mt-2 text-[22px] font-bold leading-[26px]"
            style={{ color: theme.text }}
            numberOfLines={2}
          >
            {item.courseName}
          </Text>

          {/* time */}
          <View className="mt-2 flex-row items-center gap-1">
            <Ionicons
              name="time-outline"
              size={14}
              color={theme.textSecondary}
            />
            <Text className="text-[13px] font-semibold" style={{ color: theme.text }}>
              {formatTimeDisplay(item.startTime)} - {formatTimeDisplay(item.endTime)}
            </Text>
          </View>

          {/* session type and badges */}
          <View className="mt-3 flex-row flex-wrap items-center gap-1">
            <View
              className="rounded-lg px-2 py-[3px]"
              style={{ backgroundColor: courseColor + "CC" }}
            >
              <Text className="text-[11px] font-semibold text-white">
                {item.sessionType.charAt(0).toUpperCase() +
                  item.sessionType.slice(1)}
              </Text>
            </View>
            {item.isManual && (
              <View
                className="rounded-lg px-1 py-[3px]"
                style={{ backgroundColor: Colors.status.info + "40" }}
              >
                <Text
                  className="text-[10px] font-semibold"
                  style={{ color: Colors.status.info }}
                >
                  Manual
                </Text>
              </View>
            )}
            {item.isCustomCourse && (
              <View
                className="rounded-lg px-1 py-[3px]"
                style={{ backgroundColor: Colors.status.success + "40" }}
              >
                <Text
                  className="text-[10px] font-semibold"
                  style={{ color: Colors.status.success }}
                >
                  Custom
                </Text>
              </View>
            )}
          </View>
        </LinearGradient>
      </View>
    );
  };

  return (
    <View
      className="items-center"
      onStartShouldSetResponderCapture={() => true}
      onMoveShouldSetResponderCapture={() => true}
    >
      <FlatList
        ref={flatListRef}
        data={nearbySlots}
        renderItem={renderCard}
        keyExtractor={(item, index) => `${item.id}-${index}`}
        horizontal
        showsHorizontalScrollIndicator={false}
        snapToInterval={CARD_WIDTH + CARD_SPACING}
        snapToAlignment="start"
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
        onMomentumScrollEnd={() => {
          if (!hasInitialScrolled) {
            setHasInitialScrolled(true);
          } else {
            resetSnapTimer();
          }
        }}
      />

      {/* pagination dots */}
      <View className="mt-2 flex-row justify-center gap-1.5">
        {nearbySlots.map((_, index) => (
          <View
            key={index}
            className="h-1.5 w-1.5 rounded-full"
            style={{
              backgroundColor: index === activeIndex ? theme.text : theme.border,
            }}
          />
        ))}
      </View>
    </View>
  );
}
