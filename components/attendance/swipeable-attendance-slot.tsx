import { Colors } from "@/constants/theme";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { getBaseUrl } from "@/services/baseurl";
import { useAuthStore } from "@/stores/auth-store";
import type { AttendanceRecord, AttendanceStatus } from "@/types";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import * as Linking from "expo-linking";
import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from "react-native-reanimated";

interface SwipeableAttendanceSlotProps {
  record: AttendanceRecord;
  timeSlot: string | null;
  courseColor?: string;
  isDutyLeave?: boolean;
  isMarkedPresent?: boolean;
  attendanceModuleId: string | null;
  onMarkPresent: () => void;
  onMarkDL: () => void;
}

const SWIPE_THRESHOLD = 80;
const ACTION_WIDTH = 80;
const SWIPE_ACTIVE_OFFSET_X: [number, number] = [-10, 10];
const SWIPE_FAIL_OFFSET_Y: [number, number] = [-15, 15];
const ACTION_OPACITY_THRESHOLD = 20;
type IoniconName = keyof typeof Ionicons.glyphMap;

// status colors
const getStatusColor = (status: AttendanceStatus): string => {
  switch (status) {
    case "Present":
      return Colors.status.success;
    case "Absent":
      return Colors.status.danger;
    case "Late":
      return Colors.status.warning;
    case "Excused":
      return Colors.status.info;
    case "Unknown":
      return Colors.status.unknown;
  }
};

const getStatusIcon = (status: AttendanceStatus): IoniconName => {
  switch (status) {
    case "Present":
      return "checkmark";
    case "Absent":
      return "close";
    case "Late":
      return "time";
    case "Excused":
      return "document-text";
    case "Unknown":
      return "help";
  }
};

export function SwipeableAttendanceSlot({
  record,
  timeSlot,
  courseColor,
  isDutyLeave = false,
  isMarkedPresent = false,
  attendanceModuleId,
  onMarkPresent,
  onMarkDL,
}: SwipeableAttendanceSlotProps) {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";
  const theme = isDark ? Colors.dark : Colors.light;

  const translateX = useSharedValue(0);
  const [isExpanded, setIsExpanded] = useState(false);

  const triggerHaptic = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  };

  const handleLeftAction = () => {
    triggerHaptic();
    onMarkPresent();
  };

  const handleRightAction = () => {
    triggerHaptic();
    onMarkDL();
  };

  const handleOpenLms = () => {
    if (attendanceModuleId) {
      const username = useAuthStore.getState().username;
      const url = `${getBaseUrl(username || undefined)}/mod/attendance/view.php?id=${attendanceModuleId}`;
      Linking.openURL(url);
    }
  };

  const panGesture = Gesture.Pan()
    .activeOffsetX(SWIPE_ACTIVE_OFFSET_X)
    .failOffsetY(SWIPE_FAIL_OFFSET_Y)
    .onUpdate((e) => {
      translateX.value = Math.max(
        -ACTION_WIDTH,
        Math.min(ACTION_WIDTH, e.translationX),
      );
    })
    .onEnd((e) => {
      if (e.translationX < -SWIPE_THRESHOLD) {
        runOnJS(handleLeftAction)();
      } else if (e.translationX > SWIPE_THRESHOLD) {
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

  const statusColor = getStatusColor(record.status);
  const statusIcon = getStatusIcon(record.status);
  const isUnknown = record.status === "Unknown";
  const isAbsent = record.status === "Absent";

  // left action: Present or Undo Present
  const leftActionLabel = isMarkedPresent ? "Undo" : "Present";
  const leftActionIcon = isMarkedPresent ? "close" : "checkmark";
  const leftActionColor = isMarkedPresent
    ? Colors.gray[600]
    : Colors.status.success;

  // right action: DL/Absent or Undo DL
  const rightActionLabel = isUnknown ? "Absent" : isDutyLeave ? "Undo" : "DL";
  const rightActionIcon = isUnknown
    ? "close-circle"
    : isDutyLeave
      ? "close"
      : "briefcase";
  const rightActionColor = isUnknown
    ? Colors.status.danger
    : isDutyLeave
      ? Colors.gray[600]
      : Colors.status.info;
  const itemOpacity = isMarkedPresent ? 0.5 : 1;

  return (
    <View className="relative overflow-hidden border-b" style={{ borderBottomColor: theme.border }}>
      {/* left action (mark present) */}
      <Animated.View
        className="absolute inset-y-0 right-0 w-20 items-end justify-center"
        style={leftActionStyle}
      >
        <View
          className="h-full w-20 items-center justify-center gap-0.5"
          style={{ backgroundColor: leftActionColor }}
        >
          <Ionicons name={leftActionIcon} size={20} color={Colors.white} />
          <Text className="text-[10px] font-semibold text-white">
            {leftActionLabel}
          </Text>
        </View>
      </Animated.View>

      {/* right action (mark DL or Absent for Unknown) */}
      <Animated.View
        className="absolute inset-y-0 left-0 w-20 items-start justify-center"
        style={rightActionStyle}
      >
        <View
          className="h-full w-20 items-center justify-center gap-0.5"
          style={{ backgroundColor: rightActionColor }}
        >
          <Ionicons name={rightActionIcon} size={20} color={Colors.white} />
          <Text className="text-[10px] font-semibold text-white">
            {rightActionLabel}
          </Text>
        </View>
      </Animated.View>

      {/* main content */}
      <GestureDetector gesture={panGesture}>
        <Animated.View
          className="px-1 py-2"
          style={[{ backgroundColor: theme.background }, animatedStyle]}
        >
          <Pressable
            onPress={() => setIsExpanded(!isExpanded)}
            style={{ opacity: itemOpacity }}
          >
            <View className="flex-row items-center gap-2">
              {/* course color bar */}
              {courseColor && (
                <View
                  className="h-8 w-[3px] rounded-[2px]"
                  style={{ backgroundColor: courseColor }}
                />
              )}

              {/* time slot */}
              <View className="flex-1">
                <Text className="text-[14px] font-medium" style={{ color: theme.text }}>
                  {timeSlot || "No time"}
                </Text>
                <Text
                  className="text-[11px]"
                  style={{ color: theme.textSecondary }}
                  numberOfLines={1}
                >
                  {record.description}
                </Text>
              </View>

              {/* status badge */}
              <View
                className="flex-row items-center gap-[3px] rounded-full px-2 py-1"
                style={{ backgroundColor: statusColor }}
              >
                <Ionicons
                  name={statusIcon}
                  size={12}
                  color={Colors.white}
                />
                <Text className="text-[10px] font-semibold text-white">
                  {record.status.charAt(0)}
                </Text>
              </View>

              {/* DL badge */}
              {isDutyLeave && (
                <View
                  className="flex-row items-center gap-[3px] rounded-full px-2 py-1"
                  style={{ backgroundColor: Colors.status.info }}
                >
                  <Ionicons name="briefcase" size={10} color={Colors.white} />
                  <Text className="text-[10px] font-semibold text-white">DL</Text>
                </View>
              )}

              {/* Present badge */}
              {isMarkedPresent && (
                <View
                  className="flex-row items-center gap-[3px] rounded-full px-2 py-1"
                  style={{ backgroundColor: Colors.status.success }}
                >
                  <Ionicons name="checkmark" size={10} color={Colors.white} />
                  <Text className="text-[10px] font-semibold text-white">P</Text>
                </View>
              )}

              {/* Open in LMS button */}
              {attendanceModuleId && (
                <Pressable
                  onPress={(e) => {
                    e.stopPropagation();
                    handleOpenLms();
                  }}
                  className="p-1"
                  hitSlop={8}
                >
                  <Ionicons
                    name="open-outline"
                    size={16}
                    color={theme.textSecondary}
                  />
                </Pressable>
              )}

              {/* swipe hints for absent/unknown */}
              {(isAbsent || isUnknown) && (
                <View className="flex-row items-center gap-0.5 opacity-40">
                  <Ionicons
                    name="chevron-back"
                    size={12}
                    color={Colors.status.success}
                  />
                  <Ionicons
                    name="chevron-forward"
                    size={12}
                    color={
                      isUnknown ? Colors.status.danger : Colors.status.info
                    }
                  />
                </View>
              )}
            </View>
          </Pressable>

          {/* expanded details */}
          {isExpanded && record.remarks && (
            <View className="mt-2 pl-4">
              <Text
                className="text-[12px] italic"
                style={{ color: theme.textSecondary }}
              >
                {record.remarks}
              </Text>
            </View>
          )}
        </Animated.View>
      </GestureDetector>
    </View>
  );
}
