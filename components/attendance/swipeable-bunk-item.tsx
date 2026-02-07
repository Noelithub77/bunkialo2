import { Colors } from "@/constants/theme";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { getBaseUrl } from "@/services/baseurl";
import { useAuthStore } from "@/stores/auth-store";
import type { BunkRecord } from "@/types";
import { Ionicons } from "@expo/vector-icons";
import * as Linking from "expo-linking";
import { useState } from "react";
import { Pressable, Text, TextInput, View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from "react-native-reanimated";

// parse date for display
const formatDate = (dateStr: string): string => {
  const match = dateStr.match(/(\w{3})\s+(\d{1,2})\s+(\w{3})/);
  if (match) return `${match[2]} ${match[3]}`;
  return dateStr.slice(0, 15);
};

interface SwipeableBunkItemProps {
  bunk: BunkRecord;
  showHint?: boolean;
  isUnknown?: boolean;
  attendanceModuleId: string | null;
  onMarkDL: () => void;
  onRemoveDL: () => void;
  onMarkPresent: () => void;
  onRemovePresent: () => void;
  onUpdateNote: (note: string) => void;
}

const SWIPE_THRESHOLD = 80;
const ACTION_WIDTH = 80;
const SWIPE_ACTIVE_OFFSET_X: [number, number] = [-10, 10];
const SWIPE_FAIL_OFFSET_Y: [number, number] = [-15, 15];
const ACTION_OPACITY_THRESHOLD = 20;

export function SwipeableBunkItem({
  bunk,
  showHint = false,
  isUnknown = false,
  attendanceModuleId,
  onMarkDL,
  onRemoveDL,
  onMarkPresent,
  onRemovePresent,
  onUpdateNote,
}: SwipeableBunkItemProps) {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";
  const theme = isDark ? Colors.dark : Colors.light;

  const [showNote, setShowNote] = useState(false);
  const [noteText, setNoteText] = useState(bunk.note);

  const translateX = useSharedValue(0);

  const handleOpenLms = () => {
    if (attendanceModuleId) {
      const username = useAuthStore.getState().username;
      const url = `${getBaseUrl(username || undefined)}/mod/attendance/view.php?id=${attendanceModuleId}`;
      Linking.openURL(url);
    }
  };

  const handleLeftAction = () => {
    if (isUnknown) {
      onMarkPresent();
    } else if (bunk.isMarkedPresent) {
      onRemovePresent();
    } else {
      onMarkPresent();
    }
  };

  const handleRightAction = () => {
    if (isUnknown) {
      // for unknown: right swipe = confirm as absent
      onMarkDL();
    } else if (bunk.isDutyLeave) {
      onRemoveDL();
    } else {
      onMarkDL();
    }
  };

  const panGesture = Gesture.Pan()
    .activeOffsetX(SWIPE_ACTIVE_OFFSET_X)
    .failOffsetY(SWIPE_FAIL_OFFSET_Y)
    .onUpdate((e) => {
      // clamp translation
      translateX.value = Math.max(
        -ACTION_WIDTH,
        Math.min(ACTION_WIDTH, e.translationX),
      );
    })
    .onEnd((e) => {
      if (e.translationX < -SWIPE_THRESHOLD) {
        // swiped left -> present action
        runOnJS(handleLeftAction)();
      } else if (e.translationX > SWIPE_THRESHOLD) {
        // swiped right -> DL action
        runOnJS(handleRightAction)();
      }
      translateX.value = withSpring(0, { damping: 20 });
    });

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
  }));

  const leftActionStyle = useAnimatedStyle(() => ({
    opacity: withTiming(translateX.value < -ACTION_OPACITY_THRESHOLD ? 1 : 0, {
      duration: 150,
    }),
  }));

  const rightActionStyle = useAnimatedStyle(() => ({
    opacity: withTiming(translateX.value > ACTION_OPACITY_THRESHOLD ? 1 : 0, {
      duration: 150,
    }),
  }));

  // determine item state styling
  const isPresent = bunk.isMarkedPresent;
  const isDL = bunk.isDutyLeave;
  const itemOpacity = isPresent ? 0.5 : 1;
  const rightHintColor = isUnknown ? Colors.status.danger : Colors.status.info;

  return (
    <View className="border-b" style={{ borderBottomColor: theme.border }}>
      {/* left action (present) - revealed on swipe left */}
      <Animated.View
        className="absolute inset-y-0 right-0 w-20 justify-center pr-2"
        style={leftActionStyle}
      >
        <View
          className="flex-row items-center justify-center gap-2 rounded-full px-3 py-2"
          style={{
            backgroundColor: isPresent
              ? Colors.gray[600]
              : Colors.status.success,
          }}
        >
          <Ionicons
            name={isPresent ? "close" : "checkmark"}
            size={20}
            color={Colors.white}
          />
          <Text className="text-xs font-semibold text-white">
            {isPresent ? "Undo" : "Present"}
          </Text>
        </View>
      </Animated.View>

      {/* right action (DL or Absent for unknown) - revealed on swipe right */}
      <Animated.View
        className="absolute inset-y-0 left-0 w-20 justify-center pl-2"
        style={rightActionStyle}
      >
        <View
          className="flex-row items-center justify-center gap-2 rounded-full px-3 py-2"
          style={{
            backgroundColor: isUnknown
              ? Colors.status.danger
              : isDL
                ? Colors.gray[600]
                : Colors.status.info,
          }}
        >
          <Ionicons
            name={isUnknown ? "close-circle" : isDL ? "close" : "briefcase"}
            size={20}
            color={Colors.white}
          />
          <Text className="text-xs font-semibold text-white">
            {isUnknown ? "Absent" : isDL ? "Undo" : "DL"}
          </Text>
        </View>
      </Animated.View>

      {/* main content */}
      <GestureDetector gesture={panGesture}>
        <Animated.View
          className="bg-white px-4 py-3 dark:bg-black"
          style={[{ backgroundColor: theme.background }, animatedStyle]}
        >
          <Pressable
            onPress={() => {
              if (!isUnknown) setShowNote(!showNote);
            }}
            style={{ opacity: itemOpacity }}
          >
            <View className="flex-row items-center gap-3">
              {/* source tag */}
              <View
                className="rounded-full px-2 py-0.5"
                style={{
                  backgroundColor:
                    bunk.source === "lms"
                      ? Colors.status.info
                      : Colors.status.warning,
                }}
              >
                <Text className="text-[10px] font-semibold text-white">
                  {bunk.source.toUpperCase()}
                </Text>
              </View>

              {/* date + time */}
              <View className="flex-1">
                <Text
                  className="text-sm font-semibold"
                  style={{
                    color: theme.text,
                    textDecorationLine: isPresent ? "line-through" : "none",
                  }}
                >
                  {formatDate(bunk.date)}
                </Text>
                {bunk.timeSlot && (
                  <Text
                    className="text-[12px]"
                    style={{ color: theme.textSecondary }}
                  >
                    {bunk.timeSlot}
                  </Text>
                )}
              </View>

              {/* status badges */}
              {isPresent && (
                <View
                  className="flex-row items-center gap-1 rounded-full px-2 py-1"
                  style={{ backgroundColor: Colors.status.success }}
                >
                  <Ionicons name="checkmark" size={10} color={Colors.white} />
                  <Text className="text-[10px] font-semibold text-white">
                    Present
                  </Text>
                </View>
              )}
              {isDL && (
                <View
                  className="flex-row items-center gap-1 rounded-full px-2 py-1"
                  style={{ backgroundColor: Colors.status.info }}
                >
                  <Ionicons name="briefcase" size={10} color={Colors.white} />
                  <Text className="text-[10px] font-semibold text-white">
                    DL
                  </Text>
                </View>
              )}

              {/* note indicator */}
              {(bunk.note || bunk.presenceNote || bunk.dutyLeaveNote) &&
                !showNote && (
                  <View className="ml-auto">
                    <Ionicons
                      name="chatbubble"
                      size={14}
                      color={Colors.status.info}
                    />
                  </View>
                )}

              {/* Open in LMS button */}
              {attendanceModuleId && !isUnknown && (
                <Pressable
                  onPress={(e) => {
                    e.stopPropagation();
                    handleOpenLms();
                  }}
                  className="ml-2 rounded-full p-2"
                  hitSlop={8}
                >
                  <Ionicons
                    name="open-outline"
                    size={16}
                    color={theme.textSecondary}
                  />
                </Pressable>
              )}

              {/* swipe hints - show on unmarked items */}
              {!isPresent && !isDL && (
                <View className="ml-2 flex-row items-center gap-1">
                  <Ionicons
                    name="chevron-back"
                    size={12}
                    color={Colors.status.success}
                  />
                  <Ionicons
                    name="chevron-forward"
                    size={12}
                    color={rightHintColor}
                  />
                </View>
              )}
            </View>
          </Pressable>

          {/* expanded note section */}
          {showNote && !isUnknown && (
            <View className="mt-3 gap-2">
              {isPresent && bunk.presenceNote && (
                <Text
                  className="text-sm font-semibold"
                  style={{ color: Colors.status.success }}
                >
                  Present: {bunk.presenceNote}
                </Text>
              )}
              {isDL && bunk.dutyLeaveNote && (
                <Text
                  className="text-sm font-semibold"
                  style={{ color: Colors.status.info }}
                >
                  DL: {bunk.dutyLeaveNote}
                </Text>
              )}
              {bunk.note && (
                <Text
                  className="text-sm"
                  style={{ color: theme.textSecondary }}
                >
                  Note: {bunk.note}
                </Text>
              )}
              <TextInput
                className="border rounded-sm py-3 px-4 text-sm"
                style={{
                  borderColor: theme.border,
                  color: theme.text,
                }}
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
  );
}
