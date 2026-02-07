import { View, Text, Modal, Pressable, FlatList } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Colors } from "@/constants/theme";
import { useColorScheme } from "@/hooks/use-color-scheme";
import type { DutyLeaveInfo } from "@/types";

interface DutyLeaveModalProps {
  visible: boolean;
  dutyLeaves: DutyLeaveInfo[];
  onClose: () => void;
  onRemove: (courseId: string, bunkId: string) => void;
}

// parse date for display
const formatDate = (dateStr: string): string => {
  const match = dateStr.match(/(\w{3})\s+(\d{1,2})\s+(\w{3})/);
  if (match) return `${match[2]} ${match[3]}`;
  return dateStr.slice(0, 15);
};

export function DutyLeaveModal({
  visible,
  dutyLeaves,
  onClose,
  onRemove,
}: DutyLeaveModalProps) {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";
  const theme = isDark ? Colors.dark : Colors.light;

  const renderItem = ({ item }: { item: DutyLeaveInfo }) => (
    <View className="flex-row items-center border-b py-2" style={{ borderBottomColor: theme.border }}>
      <View className="flex-1 gap-0.5">
        <Text
          className="text-[14px] font-medium"
          style={{ color: theme.text }}
          numberOfLines={1}
        >
          {item.courseName}
        </Text>
        <View className="flex-row gap-2">
          <Text className="text-[12px]" style={{ color: theme.textSecondary }}>
            {formatDate(item.date)}
          </Text>
          {item.timeSlot && (
            <Text className="text-[12px]" style={{ color: theme.textSecondary }}>
              {item.timeSlot}
            </Text>
          )}
        </View>
        {item.note && (
          <Text
            className="mt-0.5 text-[11px] italic"
            style={{ color: theme.textSecondary }}
            numberOfLines={2}
          >
            {item.note}
          </Text>
        )}
      </View>
      <Pressable
        onPress={() => onRemove(item.courseId, item.bunkId)}
        hitSlop={8}
        className="p-1"
      >
        <Ionicons name="close-circle" size={22} color={Colors.status.danger} />
      </Pressable>
    </View>
  );

  const renderEmpty = () => (
    <View className="items-center gap-2 py-8">
      <Ionicons
        name="checkmark-circle-outline"
        size={48}
        color={theme.textSecondary}
      />
      <Text className="text-[14px]" style={{ color: theme.textSecondary }}>
        No duty leaves marked
      </Text>
    </View>
  );

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View className="flex-1 items-center justify-center">
        <Pressable className="absolute inset-0 bg-black/60" onPress={onClose} />
        <View
          className="w-[90%] max-w-[400px] max-h-[70%] rounded-2xl p-6"
          style={{ backgroundColor: theme.background }}
        >
          {/* header */}
          <View className="flex-row items-center justify-between">
            <View className="flex-row items-center gap-2">
              <Ionicons
                name="briefcase-outline"
                size={20}
                color={Colors.status.info}
              />
              <Text className="text-[18px] font-semibold" style={{ color: theme.text }}>
                All Duty Leaves
              </Text>
            </View>
            <Pressable onPress={onClose} hitSlop={8}>
              <Ionicons name="close" size={24} color={theme.textSecondary} />
            </Pressable>
          </View>

          {/* count */}
          <Text className="mb-4 mt-1 text-[12px]" style={{ color: theme.textSecondary }}>
            {dutyLeaves.length} duty leave{dutyLeaves.length !== 1 ? "s" : ""}{" "}
            across all courses
          </Text>

          {/* list */}
          <FlatList
            data={dutyLeaves}
            keyExtractor={(item) => `${item.courseId}-${item.bunkId}`}
            renderItem={renderItem}
            ListEmptyComponent={renderEmpty}
            className="flex-grow-0"
            contentContainerClassName={dutyLeaves.length === 0 ? "flex-1" : ""}
          />
        </View>
      </View>
    </Modal>
  );
}
