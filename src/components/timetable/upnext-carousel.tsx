import { Colors } from "@/constants/theme";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { useBunkStore } from "@/stores/bunk-store";
import { useGestureUiStore } from "@/stores/gesture-ui-store";
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
  type LayoutChangeEvent,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  Pressable,
  Text,
  View,
  type ViewToken,
} from "react-native";
import { FlatList } from "react-native-gesture-handler";

interface UpNextCarouselProps {
  slots: TimetableSlot[];
  onCoursePress?: (courseId: string) => void;
}

const CARD_SPACING = 6;
const DEFAULT_CAROUSEL_WIDTH = 360;

export function UpNextCarousel({ slots, onCoursePress }: UpNextCarouselProps) {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";
  const theme = isDark ? Colors.dark : Colors.light;
  const bunkCourses = useBunkStore((state) => state.courses);
  const flatListRef = useRef<FlatList>(null);
  const setHorizontalContentGestureActive = useGestureUiStore(
    (state) => state.setHorizontalContentGestureActive,
  );
  const [activeIndex, setActiveIndex] = useState(0);
  const [hasInitialScrolled, setHasInitialScrolled] = useState(false);
  const [carouselWidth, setCarouselWidth] = useState(DEFAULT_CAROUSEL_WIDTH);

  const cardWidth = useMemo(
    () => Math.max(240, Math.round(carouselWidth * 0.72)),
    [carouselWidth],
  );
  const sideSpacing = useMemo(
    () => Math.max(0, (carouselWidth - cardWidth) / 2),
    [carouselWidth, cardWidth],
  );
  const snapInterval = cardWidth + CARD_SPACING;

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

  const clearSnapTimer = useCallback(() => {
    if (snapTimerRef.current) {
      clearTimeout(snapTimerRef.current);
      snapTimerRef.current = null;
    }
  }, []);

  useEffect(() => {
    return () => {
      clearSnapTimer();
      setHorizontalContentGestureActive(false);
    };
  }, [clearSnapTimer, setHorizontalContentGestureActive]);

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

  const handleCarouselLayout = useCallback(
    (event: LayoutChangeEvent) => {
      const nextWidth = event.nativeEvent.layout.width;
      if (nextWidth > 0 && Math.abs(nextWidth - carouselWidth) > 1) {
        setCarouselWidth(nextWidth);
      }
    },
    [carouselWidth],
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

    const defaultGradientColors = isDark
      ? ([courseColor + "70", courseColor + "32", "#04070D"] as const)
      : ([courseColor + "45", courseColor + "18", "#FFFFFF"] as const);
    const nowGradientColors = isDark
      ? ([Colors.status.success + "36", "#04120C"] as const)
      : ([Colors.status.success + "26", "#FFFFFF"] as const);
    const gradientColors = isCurrentlyActive
      ? nowGradientColors
      : defaultGradientColors;

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
      borderColor = isDark
        ? Colors.status.success + "BF"
        : Colors.status.success + "8F";
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
      <View className="py-0.5" style={{ width: cardWidth }}>
        <Pressable
          disabled={!onCoursePress}
          onPress={() => onCoursePress?.(item.courseId)}
          style={({ pressed }) =>
            onCoursePress && pressed ? { opacity: 0.86 } : undefined
          }
        >
          <View
            className="relative min-h-[146px] overflow-hidden rounded-2xl"
            style={[
              !isActive && { opacity: 0.7, transform: [{ scale: 0.95 }] },
              {
                borderColor:
                  borderColor ?? (isDark ? courseColor + "4A" : courseColor + "3A"),
                borderWidth: 1,
              },
              (isFinished || isFutureClass) && { opacity: cardOpacity },
            ]}
          >
            <LinearGradient
              colors={gradientColors}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={{
                position: "absolute",
                top: 0,
                right: 0,
                bottom: 0,
                left: 0,
              }}
            />
            <View className="px-5 py-4">
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
                  {onCoursePress ? " · Tap to edit" : ""}
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
                  style={{
                    backgroundColor: isCurrentlyActive
                      ? Colors.status.success + "CC"
                      : courseColor + "CC",
                  }}
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
            </View>
          </View>
        </Pressable>
      </View>
    );
  };

  return (
    <View className="w-full items-center" onLayout={handleCarouselLayout}>
      <FlatList
        ref={flatListRef}
        data={nearbySlots}
        renderItem={renderCard}
        keyExtractor={(item, index) => `${item.id}-${index}`}
        horizontal
        directionalLockEnabled
        nestedScrollEnabled
        scrollEventThrottle={16}
        showsHorizontalScrollIndicator={false}
        snapToInterval={snapInterval}
        snapToAlignment="start"
        decelerationRate="fast"
        contentContainerStyle={{
          paddingHorizontal: sideSpacing,
        }}
        ItemSeparatorComponent={() => <View style={{ width: CARD_SPACING }} />}
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={viewabilityConfig}
        initialScrollIndex={initialScrollIndex}
        getItemLayout={(_, index) => ({
          length: snapInterval,
          offset: snapInterval * index,
          index,
        })}
        onScrollBeginDrag={() => {
          clearSnapTimer();
          setHorizontalContentGestureActive(true);
        }}
        onScrollEndDrag={(event: NativeSyntheticEvent<NativeScrollEvent>) => {
          const velocityX = event.nativeEvent.velocity?.x ?? 0;
          if (Math.abs(velocityX) < 0.01) {
            setHorizontalContentGestureActive(false);
          }
        }}
        onMomentumScrollEnd={() => {
          setHorizontalContentGestureActive(false);
          if (!hasInitialScrolled) {
            setHasInitialScrolled(true);
          } else {
            resetSnapTimer();
          }
        }}
      />

      {/* pagination dots */}
      <View className="mt-1.5 flex-row justify-center gap-1.5">
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
