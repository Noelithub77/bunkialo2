import { Colors, Radius } from "@/constants/theme";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { useWifixLogStore } from "@/stores/wifix-log-store";
import type { DashboardLog } from "@/types";
import { Ionicons } from "@expo/vector-icons";
import { Modal, Pressable, ScrollView, Text, View } from "react-native";

type WifixLogModalProps = {
  visible: boolean;
  onClose: () => void;
};

const formatLogTime = (timestamp: number): string => {
  const date = new Date(timestamp);
  return date.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
};

const getLogIcon = (
  type: DashboardLog["type"],
): keyof typeof Ionicons.glyphMap => {
  switch (type) {
    case "success":
      return "checkmark-circle";
    case "error":
      return "alert-circle";
    default:
      return "information-circle";
  }
};

const getLogColor = (type: DashboardLog["type"]): string => {
  switch (type) {
    case "success":
      return Colors.status.success;
    case "error":
      return Colors.status.danger;
    default:
      return Colors.status.info;
  }
};

export const WifixLogModal = ({ visible, onClose }: WifixLogModalProps) => {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";
  const theme = isDark ? Colors.dark : Colors.light;

  const { logs, clearLogs } = useWifixLogStore();

  const handleClearLogs = () => {
    clearLogs();
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View className="flex-1" style={{ backgroundColor: theme.background }}>
        <View
          className="flex-row items-center justify-between px-5 py-3"
          style={{ borderBottomColor: theme.border, borderBottomWidth: 1 }}
        >
          <Pressable
            onPress={onClose}
            className="h-10 w-10 items-center justify-center"
            hitSlop={8}
          >
            <Ionicons name="close" size={24} color={theme.text} />
          </Pressable>
          <Text className="text-[18px] font-semibold" style={{ color: theme.text }}>
            WiFix Logs
          </Text>
          <Pressable
            onPress={handleClearLogs}
            className="h-10 w-10 items-center justify-center"
            hitSlop={8}
            disabled={logs.length === 0}
          >
            <Ionicons
              name="trash-outline"
              size={24}
              color={logs.length > 0 ? Colors.status.danger : theme.textSecondary}
            />
          </Pressable>
        </View>

        <ScrollView
          className="flex-1"
          contentContainerClassName="gap-2 p-4"
          showsVerticalScrollIndicator={false}
        >
          {logs.length === 0 ? (
            <View className="flex-1 items-center justify-center gap-4 py-10">
              <Ionicons
                name="document-text-outline"
                size={48}
                color={theme.textSecondary}
              />
              <Text
                className="text-base font-medium"
                style={{ color: theme.textSecondary }}
              >
                No logs yet
              </Text>
              <Text
                className="text-center text-sm opacity-70"
                style={{ color: theme.textSecondary }}
              >
                WiFix function logs will appear here
              </Text>
            </View>
          ) : (
            logs.map((log) => (
              <View
                key={log.id}
                className="p-4"
                style={{
                  borderColor: theme.border,
                  borderWidth: 1,
                  borderRadius: Radius.md,
                  backgroundColor: "rgba(0, 0, 0, 0.2)",
                }}
              >
                <View className="mb-1 flex-row items-center gap-2">
                  <Ionicons
                    name={getLogIcon(log.type)}
                    size={16}
                    color={getLogColor(log.type)}
                  />
                  <Text
                    className="text-[12px] font-medium opacity-70"
                    style={{ color: getLogColor(log.type) }}
                  >
                    {formatLogTime(log.timestamp)}
                  </Text>
                  <View
                    className="ml-auto px-2 py-[2px]"
                    style={{
                      borderRadius: 4,
                      backgroundColor: `${getLogColor(log.type)}22`,
                    }}
                  >
                    <Text
                      className="text-[10px] font-semibold tracking-[0.5px]"
                      style={{ color: getLogColor(log.type) }}
                    >
                      {log.type.toUpperCase()}
                    </Text>
                  </View>
                </View>
                <Text className="text-sm leading-5" style={{ color: theme.text }}>
                  {log.message}
                </Text>
              </View>
            ))
          )}
        </ScrollView>
      </View>
    </Modal>
  );
};
