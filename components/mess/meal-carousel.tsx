import { Colors } from "@/constants/theme";
import {
  MEAL_TIMES,
  getNearbyMeals,
  type Meal,
  type MealType,
} from "@/data/mess";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { useGestureUiStore } from "@/stores/gesture-ui-store";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useFocusEffect } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  Dimensions,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  Pressable,
  Text,
  View,
  type ViewToken,
} from "react-native";
import { FlatList } from "react-native-gesture-handler";

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const CARD_WIDTH = SCREEN_WIDTH * 0.65;
const CARD_SPACING = 8;
const SIDE_SPACING = (SCREEN_WIDTH - CARD_WIDTH) / 2;

const MEAL_ICONS: Record<MealType, keyof typeof Ionicons.glyphMap> = {
  breakfast: "sunny-outline",
  lunch: "restaurant-outline",
  snacks: "cafe-outline",
  dinner: "moon-outline",
};

export function MealCarousel() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";
  const theme = isDark ? Colors.dark : Colors.light;
  const flatListRef = useRef<FlatList>(null);
  const setHorizontalContentGestureActive = useGestureUiStore(
    (state) => state.setHorizontalContentGestureActive,
  );
  const [activeIndex, setActiveIndex] = useState(0);
  const [expandedMeal, setExpandedMeal] = useState<MealType | null>(null);
  const [hasInitialScrolled, setHasInitialScrolled] = useState(false);

  // recompute time on focus
  const [, setFocusKey] = useState(0);
  useFocusEffect(
    useCallback(() => {
      setFocusKey((k) => k + 1);
    }, []),
  );

  const now = new Date();
  const { meals, initialIndex } = getNearbyMeals(now);

  const currentTime = `${now.getHours().toString().padStart(2, "0")}:${now.getMinutes().toString().padStart(2, "0")}`;

  const viewabilityConfig = useRef({
    itemVisiblePercentThreshold: 50,
    minimumViewTime: 50,
  }).current;

  // snap back after 2s inactivity
  const snapTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const resetSnapTimer = useCallback(() => {
    if (snapTimerRef.current) clearTimeout(snapTimerRef.current);
    snapTimerRef.current = setTimeout(() => {
      flatListRef.current?.scrollToIndex({
        index: initialIndex,
        animated: true,
      });
    }, 2000);
  }, [initialIndex]);

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

  // Initialize activeIndex to match initialIndex to prevent jitter
  useEffect(() => {
    setActiveIndex(initialIndex);
    // Mark as initial scrolled after a short delay since onMomentumScrollEnd may not fire
    const timer = setTimeout(() => {
      setHasInitialScrolled(true);
    }, 500);
    return () => clearTimeout(timer);
  }, [initialIndex]);

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

  if (meals.length === 0) {
    return (
      <View
        className="items-center justify-center rounded-2xl px-8 py-8 gap-2"
        style={{ backgroundColor: theme.backgroundSecondary }}
      >
        <Ionicons
          name="restaurant-outline"
          size={32}
          color={theme.textSecondary}
        />
        <Text className="text-sm" style={{ color: theme.textSecondary }}>
          No menu available
        </Text>
      </View>
    );
  }

  const formatTime = (time: string) => {
    const [h, m] = time.split(":").map(Number);
    const period = h >= 12 ? "PM" : "AM";
    const hour = h % 12 || 12;
    return `${hour}:${m.toString().padStart(2, "0")} ${period}`;
  };

  const renderCard = ({ item, index }: { item: Meal; index: number }) => {
    const isCurrentlyActive =
      currentTime >= item.startTime && currentTime < item.endTime;
    const isFinished = currentTime >= item.endTime;
    const isActive = index === activeIndex;
    const isExpanded = expandedMeal === item.type;

    const handlePress = () => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      setExpandedMeal(isExpanded ? null : item.type);
    };

    const nextMealIndex = meals.findIndex((m) => currentTime < m.startTime);
    const isNextMeal = index === nextMealIndex && !isCurrentlyActive;

    const cardBackground = theme.backgroundSecondary;
    const chipBackground = isDark ? theme.border : theme.background;

    let statusColor = theme.text;
    let statusText = MEAL_TIMES[item.type].name;
    let borderColor: string | undefined;
    let cardOpacity = 1;

    if (isCurrentlyActive) {
      statusColor = Colors.status.success;
      statusText = "Now";
      borderColor = Colors.status.success;
    } else if (isNextMeal) {
      statusColor = Colors.status.unknown;
      statusText = "Next";
      borderColor = Colors.status.unknown;
    } else if (isFinished) {
      statusColor = theme.textSecondary;
      statusText = "Done";
      cardOpacity = 0.5;
    }

    return (
      <Pressable
        onPress={handlePress}
        className="py-2"
        style={{ width: CARD_WIDTH }}
      >
        <View
          style={[
            { backgroundColor: cardBackground, borderColor: theme.border },
            !isActive && { opacity: 0.7, transform: [{ scale: 0.95 }] },
            borderColor && { borderColor, borderWidth: 2 },
            isFinished && { opacity: cardOpacity },
          ]}
          className="min-h-[160px] rounded-2xl border p-6 gap-2"
        >
          {/* status row */}
          <View className="flex-row items-center gap-1">
            <View
              className="h-2 w-2 rounded-full"
              style={{ backgroundColor: statusColor }}
            />
            <Text className="text-[11px] font-semibold uppercase" style={{ color: statusColor }}>
              {statusText}
            </Text>
            <View className="flex-1" />
            <Ionicons
              name={isExpanded ? "chevron-up" : "chevron-down"}
              size={16}
              color={theme.textSecondary}
            />
          </View>

          {/* meal name */}
          <View className="flex-row items-center gap-2">
            <Ionicons
              name={MEAL_ICONS[item.type]}
              size={24}
              color={theme.text}
            />
            <Text className="text-xl font-bold" style={{ color: theme.text }}>
              {item.name}
            </Text>
          </View>

          {/* time */}
          <View className="flex-row items-center gap-1">
            <Ionicons
              name="time-outline"
              size={14}
              color={theme.textSecondary}
            />
            <Text className="text-[13px] font-medium" style={{ color: theme.text }}>
              {formatTime(item.startTime)} - {formatTime(item.endTime)}
            </Text>
          </View>

          {/* items - preview or full */}
          {isExpanded ? (
            <View className="flex-row flex-wrap gap-1.5">
              {item.items.map((menuItem, i) => (
                <View
                  key={i}
                  className="rounded-lg px-2 py-1"
                  style={{ backgroundColor: chipBackground }}
                >
                  <Text className="text-[11px]" style={{ color: theme.text }}>
                    {menuItem}
                  </Text>
                </View>
              ))}
            </View>
          ) : (
            <Text
              className="text-xs leading-[18px]"
              style={{ color: theme.textSecondary }}
              numberOfLines={2}
              ellipsizeMode="tail"
            >
              {item.items.join(", ")}
            </Text>
          )}
        </View>
      </Pressable>
    );
  };

  return (
    <View className="-mx-4">
      <FlatList
        ref={flatListRef}
        data={meals}
        renderItem={renderCard}
        keyExtractor={(item) => item.type}
        horizontal
        directionalLockEnabled
        nestedScrollEnabled
        scrollEventThrottle={16}
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
      <View className="mt-1 flex-row justify-center gap-1.5">
        {meals.map((_, index) => (
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
