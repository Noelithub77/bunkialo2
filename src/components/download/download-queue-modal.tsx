import { Colors } from "@/constants/theme";
import { useColorScheme } from "@/hooks/use-color-scheme";
import {
  selectQueueStats,
  useDownloadQueueStore,
} from "@/stores/download-queue-store";
import type { DownloadQueueItem } from "@/types";
import { Ionicons } from "@expo/vector-icons";
import { FlatList, Modal, Pressable, Text, View } from "react-native";

function ProgressBar({
  progress,
  color,
}: {
  progress: number;
  color: string;
}) {
  return (
    <View className="h-1.5 overflow-hidden rounded-full bg-zinc-800">
      <View
        className="h-full rounded-full"
        style={{
          backgroundColor: color,
          width: `${Math.round(Math.min(Math.max(progress, 0), 1) * 100)}%`,
        }}
      />
    </View>
  );
}

function QueueItem({
  item,
  onRetry,
  onRemove,
}: {
  item: DownloadQueueItem;
  onRetry: () => void;
  onRemove: () => void;
}) {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";
  const theme = isDark ? Colors.dark : Colors.light;

  const statusConfig = {
    pending: { icon: "time-outline" as const, color: theme.textSecondary, label: "Waiting" },
    downloading: { icon: "cloud-download-outline" as const, color: Colors.status.info, label: "Downloading" },
    completed: { icon: "checkmark-circle" as const, color: Colors.status.success, label: "Done" },
    failed: { icon: "alert-circle" as const, color: Colors.status.danger, label: "Failed" },
  };

  const config = statusConfig[item.status];
  const progressPercent =
    item.progress !== null ? Math.round(item.progress * 100) : null;

  return (
    <View
      className="rounded-xl border px-3 py-2.5"
      style={{
        backgroundColor: theme.backgroundSecondary,
        borderColor: theme.border,
      }}
    >
      <View className="flex-row items-start gap-2.5">
        <Ionicons
          name={config.icon}
          size={18}
          color={config.color}
          style={{ marginTop: 1 }}
        />
        <View className="flex-1">
          <Text
            className="text-[13px] font-semibold"
            style={{ color: theme.text }}
            numberOfLines={1}
          >
            {item.fileName}
          </Text>
          <Text
            className="text-[11px]"
            style={{ color: theme.textSecondary }}
            numberOfLines={1}
          >
            {item.courseName}
          </Text>

          {item.status === "downloading" && (
            <View className="mt-2">
              <ProgressBar
                progress={item.progress ?? 0}
                color={Colors.status.info}
              />
              {progressPercent !== null && (
                <Text
                  className="mt-1 text-[10px] font-mono"
                  style={{ color: theme.textSecondary }}
                >
                  {progressPercent}%
                </Text>
              )}
            </View>
          )}

          {item.error && (
            <Text
              className="mt-1 text-[11px]"
              style={{ color: Colors.status.danger }}
              numberOfLines={1}
            >
              {item.error}
            </Text>
          )}
        </View>

        <View className="flex-row items-center gap-1">
          {item.status === "failed" && (
            <Pressable
              onPress={onRetry}
              className="h-7 w-7 items-center justify-center rounded-full"
              style={{ backgroundColor: theme.background }}
            >
              <Ionicons
                name="refresh-outline"
                size={14}
                color={theme.text}
              />
            </Pressable>
          )}
          {(item.status === "completed" || item.status === "failed" || item.status === "pending") && (
            <Pressable
              onPress={onRemove}
              className="h-7 w-7 items-center justify-center rounded-full"
              style={{ backgroundColor: theme.background }}
            >
              <Ionicons
                name="close-outline"
                size={14}
                color={theme.textSecondary}
              />
            </Pressable>
          )}
        </View>
      </View>
    </View>
  );
}

interface DownloadQueueModalProps {
  visible: boolean;
  onClose: () => void;
}

export function DownloadQueueModal({
  visible,
  onClose,
}: DownloadQueueModalProps) {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";
  const theme = isDark ? Colors.dark : Colors.light;

  const items = useDownloadQueueStore((state) => state.items);
  const retry = useDownloadQueueStore((state) => state.retry);
  const remove = useDownloadQueueStore((state) => state.remove);
  const clearFinished = useDownloadQueueStore((state) => state.clearFinished);
  const clearAll = useDownloadQueueStore((state) => state.clearAll);

  const stats = selectQueueStats(items);
  const hasFinished = stats.completed > 0 || stats.failed > 0;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View
        className="flex-1"
        style={{ backgroundColor: theme.background }}
      >
        {/* Header */}
        <View
          className="flex-row items-center justify-between border-b px-4 py-3"
          style={{ borderColor: theme.border }}
        >
          <View>
            <Text
              className="text-lg font-bold"
              style={{ color: theme.text }}
            >
              Downloads
            </Text>
            {stats.total > 0 && (
              <Text
                className="text-[11px]"
                style={{ color: theme.textSecondary }}
              >
                {stats.completed}/{stats.total} completed
                {stats.failed > 0 ? ` · ${stats.failed} failed` : ""}
              </Text>
            )}
          </View>

          <View className="flex-row items-center gap-2">
            {hasFinished && (
              <Pressable
                onPress={clearFinished}
                className="rounded-full border px-3 py-1.5"
                style={{
                  borderColor: theme.border,
                  backgroundColor: theme.backgroundSecondary,
                }}
              >
                <Text
                  className="text-[11px] font-semibold"
                  style={{ color: theme.textSecondary }}
                >
                  Clear done
                </Text>
              </Pressable>
            )}
            <Pressable
              onPress={onClose}
              className="h-9 w-9 items-center justify-center rounded-full"
              style={{ backgroundColor: theme.backgroundSecondary }}
            >
              <Ionicons
                name="close"
                size={20}
                color={theme.text}
              />
            </Pressable>
          </View>
        </View>

        {/* Overall progress */}
        {stats.total > 0 && stats.downloading > 0 && (
          <View className="px-4 py-2">
            <ProgressBar
              progress={stats.totalProgress}
              color={Colors.status.success}
            />
          </View>
        )}

        {/* Queue list */}
        {items.length === 0 ? (
          <View className="flex-1 items-center justify-center gap-3">
            <Ionicons
              name="cloud-download-outline"
              size={40}
              color={theme.textSecondary}
            />
            <Text
              className="text-sm"
              style={{ color: theme.textSecondary }}
            >
              No downloads in queue
            </Text>
          </View>
        ) : (
          <FlatList
            data={items}
            keyExtractor={(item) => item.id}
            contentContainerClassName="gap-2 p-4"
            renderItem={({ item }) => (
              <QueueItem
                item={item}
                onRetry={() => retry(item.id)}
                onRemove={() => remove(item.id)}
              />
            )}
          />
        )}
      </View>
    </Modal>
  );
}
