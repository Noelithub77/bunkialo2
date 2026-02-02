import { Colors, Radius, Spacing } from "@/constants/theme";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { useWifixLogStore } from "@/stores/wifix-log-store";
import type { DashboardLog } from "@/types";
import { Ionicons } from "@expo/vector-icons";
import {
    Modal,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    View,
} from "react-native";

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
      <View style={[styles.container, { backgroundColor: theme.background }]}>
        <View style={[styles.header, { borderBottomColor: theme.border }]}>
          <Pressable onPress={onClose} style={styles.closeButton} hitSlop={8}>
            <Ionicons name="close" size={24} color={theme.text} />
          </Pressable>
          <Text style={[styles.title, { color: theme.text }]}>WiFix Logs</Text>
          <Pressable
            onPress={handleClearLogs}
            style={styles.clearButton}
            hitSlop={8}
            disabled={logs.length === 0}
          >
            <Ionicons
              name="trash-outline"
              size={24}
              color={
                logs.length > 0 ? Colors.status.danger : theme.textSecondary
              }
            />
          </Pressable>
        </View>

        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {logs.length === 0 ? (
            <View style={styles.empty}>
              <Ionicons
                name="document-text-outline"
                size={48}
                color={theme.textSecondary}
              />
              <Text style={[styles.emptyText, { color: theme.textSecondary }]}>
                No logs yet
              </Text>
              <Text
                style={[styles.emptySubText, { color: theme.textSecondary }]}
              >
                WiFix function logs will appear here
              </Text>
            </View>
          ) : (
            logs.map((log) => (
              <View
                key={log.id}
                style={[styles.logItem, { borderColor: theme.border }]}
              >
                <View style={styles.logHeader}>
                  <Ionicons
                    name={getLogIcon(log.type)}
                    size={16}
                    color={getLogColor(log.type)}
                  />
                  <Text
                    style={[styles.logTime, { color: getLogColor(log.type) }]}
                  >
                    {formatLogTime(log.timestamp)}
                  </Text>
                  <View
                    style={[
                      styles.logTypeBadge,
                      { backgroundColor: getLogColor(log.type) + "22" },
                    ]}
                  >
                    <Text
                      style={[
                        styles.logTypeText,
                        { color: getLogColor(log.type) },
                      ]}
                    >
                      {log.type.toUpperCase()}
                    </Text>
                  </View>
                </View>
                <Text style={[styles.logMessage, { color: theme.text }]}>
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

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
  },
  closeButton: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    fontSize: 18,
    fontWeight: "600",
  },
  clearButton: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: Spacing.md,
    gap: Spacing.sm,
  },
  empty: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing.xxl,
    gap: Spacing.md,
  },
  emptyText: {
    fontSize: 16,
    fontWeight: "500",
  },
  emptySubText: {
    fontSize: 14,
    textAlign: "center",
    opacity: 0.7,
  },
  logItem: {
    padding: Spacing.md,
    borderRadius: Radius.md,
    borderWidth: 1,
    backgroundColor: "rgba(0, 0, 0, 0.2)",
  },
  logHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    marginBottom: Spacing.xs,
  },
  logTime: {
    fontSize: 12,
    fontWeight: "500",
    opacity: 0.7,
  },
  logTypeBadge: {
    paddingHorizontal: Spacing.xs,
    paddingVertical: 2,
    borderRadius: 4,
    marginLeft: "auto",
  },
  logTypeText: {
    fontSize: 10,
    fontWeight: "600",
    letterSpacing: 0.5,
  },
  logMessage: {
    fontSize: 14,
    lineHeight: 20,
  },
});
