import { Colors } from "@/constants/theme";
import { useColorScheme } from "@/hooks/use-color-scheme";
import type { DashboardLog } from "@/types";
import { Ionicons } from "@expo/vector-icons";
import { useState } from "react";
import { Pressable, Text, View } from "react-native";

type LogsSectionProps = {
  logs: DashboardLog[];
  onClear: () => void;
};

const formatLogTime = (timestamp: number): string => {
  const date = new Date(timestamp);
  return date.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });
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

export const LogsSection = ({ logs, onClear }: LogsSectionProps) => {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";
  const theme = isDark ? Colors.dark : Colors.light;
  const [expanded, setExpanded] = useState(false);

  return (
    <View
      className="overflow-hidden rounded-xl border"
      style={{ borderColor: theme.border }}
    >
      <Pressable
        className="flex-row items-center justify-between p-4"
        onPress={() => setExpanded(!expanded)}
      >
        <View className="flex-row items-center gap-2">
          <Ionicons name="list-outline" size={18} color={theme.textSecondary} />
          <Text className="text-sm font-medium" style={{ color: theme.text }}>
            Sync Logs ({logs.length})
          </Text>
        </View>
        <Ionicons
          name={expanded ? "chevron-up" : "chevron-down"}
          size={18}
          color={theme.textSecondary}
        />
      </Pressable>

      {expanded && (
        <View className="gap-2 px-4 pb-4">
          {logs.length === 0 ? (
            <Text className="text-center text-xs" style={{ color: theme.textSecondary }}>
              No logs yet
            </Text>
          ) : (
            <>
              {logs.slice(0, 10).map((log) => (
                <View key={log.id} className="flex-row items-center gap-2">
                  <View
                    className="h-1.5 w-1.5 rounded-full"
                    style={{ backgroundColor: getLogColor(log.type) }}
                  />
                  <Text
                    className="w-[60px] text-[11px] font-medium"
                    style={{ color: theme.textSecondary }}
                  >
                    {formatLogTime(log.timestamp)}
                  </Text>
                  <Text
                    className="flex-1 text-xs"
                    style={{ color: theme.text }}
                    numberOfLines={1}
                  >
                    {log.message}
                  </Text>
                </View>
              ))}
              {logs.length > 0 && (
                <Pressable className="items-center pt-2" onPress={onClear}>
                  <Text className="text-xs font-medium" style={{ color: Colors.status.danger }}>
                    Clear Logs
                  </Text>
                </Pressable>
              )}
            </>
          )}
        </View>
      )}
    </View>
  );
};
