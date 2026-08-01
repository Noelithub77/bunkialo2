import type {
  NotificationConcern,
  NotificationPriorityFilter,
  NotificationReadFilter,
} from "@/types";
import { NOTIFICATION_RETENTION_DAYS } from "@/utils/notification-inbox";
import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { Pressable, Text, View } from "react-native";
import { Divider, Menu } from "react-native-paper";

interface NotificationInboxControlsProps {
  concern: NotificationConcern;
  readFilter: NotificationReadFilter;
  priorityFilter: NotificationPriorityFilter;
  unreadCount: number;
  counts: Record<NotificationConcern, number>;
  hasCurrentItems: boolean;
  hasAnyItems: boolean;
  theme: {
    text: string;
    textSecondary: string;
    background: string;
    backgroundSecondary: string;
    border: string;
  };
  onConcernChange: (value: NotificationConcern) => void;
  onReadFilterChange: (value: NotificationReadFilter) => void;
  onPriorityFilterChange: (value: NotificationPriorityFilter) => void;
  onMarkCurrentRead: () => void;
  onRequestClearCurrent: () => void;
  onRequestClearAll: () => void;
  onClose: () => void;
}

const concernOptions: {
  value: NotificationConcern;
  label: string;
}[] = [
  { value: "all", label: "All" },
  { value: "attendance", label: "Attendance" },
  { value: "app", label: "App" },
];

const readOptions: { value: NotificationReadFilter; label: string }[] = [
  { value: "all", label: "All status" },
  { value: "unread", label: "Unread" },
  { value: "read", label: "Read" },
];

const priorityOptions: {
  value: NotificationPriorityFilter;
  label: string;
}[] = [
  { value: "all", label: "All priority" },
  { value: "important", label: "Important" },
  { value: "normal", label: "Normal" },
];

const selectedLabel = <T extends string>(
  options: { value: T; label: string }[],
  value: T,
): string => options.find((option) => option.value === value)?.label ?? value;

export function NotificationInboxControls({
  concern,
  readFilter,
  priorityFilter,
  unreadCount,
  counts,
  hasCurrentItems,
  hasAnyItems,
  theme,
  onConcernChange,
  onReadFilterChange,
  onPriorityFilterChange,
  onMarkCurrentRead,
  onRequestClearCurrent,
  onRequestClearAll,
  onClose,
}: NotificationInboxControlsProps) {
  const [readMenuVisible, setReadMenuVisible] = React.useState(false);
  const [priorityMenuVisible, setPriorityMenuVisible] = React.useState(false);
  const [moreMenuVisible, setMoreMenuVisible] = React.useState(false);

  return (
    <View
      className="gap-4 border-b px-5 pb-4 pt-5"
      style={{ borderColor: theme.border }}
    >
      <View className="flex-row items-start justify-between gap-3">
        <View className="flex-1 gap-1">
          <Text
            className="text-[22px] font-bold tracking-tight"
            style={{ color: theme.text }}
          >
            Notifications
          </Text>
          <Text className="text-[12px]" style={{ color: theme.textSecondary }}>
            {unreadCount} unread · last {NOTIFICATION_RETENTION_DAYS} days
          </Text>
        </View>
        <View className="flex-row items-center gap-1">
          <Menu
            visible={moreMenuVisible}
            onDismiss={() => setMoreMenuVisible(false)}
            anchor={
              <Pressable
                onPress={() => setMoreMenuVisible(true)}
                className="h-10 w-10 items-center justify-center rounded-full active:opacity-60"
                style={{ backgroundColor: theme.backgroundSecondary }}
              >
                <Ionicons
                  name="ellipsis-horizontal"
                  size={20}
                  color={theme.textSecondary}
                />
              </Pressable>
            }
          >
            <Menu.Item
              leadingIcon="email-check-outline"
              title={
                concern === "all" ? "Mark all read" : `Mark ${concern} read`
              }
              disabled={!hasCurrentItems}
              onPress={() => {
                setMoreMenuVisible(false);
                onMarkCurrentRead();
              }}
            />
            <Menu.Item
              leadingIcon="notification-clear-all"
              title={concern === "all" ? "Clear inbox" : `Clear ${concern}`}
              disabled={!hasCurrentItems}
              onPress={() => {
                setMoreMenuVisible(false);
                onRequestClearCurrent();
              }}
            />
            {concern !== "all" && (
              <>
                <Divider />
                <Menu.Item
                  leadingIcon="delete-outline"
                  title="Clear everything"
                  disabled={!hasAnyItems}
                  onPress={() => {
                    setMoreMenuVisible(false);
                    onRequestClearAll();
                  }}
                />
              </>
            )}
          </Menu>
          <Pressable
            onPress={onClose}
            className="h-10 w-10 items-center justify-center rounded-full active:opacity-60"
            style={{ backgroundColor: theme.backgroundSecondary }}
          >
            <Ionicons name="close" size={20} color={theme.textSecondary} />
          </Pressable>
        </View>
      </View>

      <View
        className="flex-row rounded-xl p-1"
        style={{ backgroundColor: theme.backgroundSecondary }}
      >
        {concernOptions.map((option) => {
          const selected = concern === option.value;
          return (
            <Pressable
              key={option.value}
              onPress={() => onConcernChange(option.value)}
              className="flex-1 flex-row items-center justify-center gap-1.5 rounded-lg px-2 py-2"
              style={
                selected ? { backgroundColor: theme.background } : undefined
              }
            >
              <Text
                className="text-[12px] font-semibold"
                style={{ color: selected ? theme.text : theme.textSecondary }}
              >
                {option.label}
              </Text>
              <Text
                className="text-[10px]"
                style={{
                  color: selected ? theme.text : theme.textSecondary,
                  fontVariant: ["tabular-nums"],
                }}
              >
                {counts[option.value]}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <View className="flex-row gap-2">
        <Menu
          visible={readMenuVisible}
          onDismiss={() => setReadMenuVisible(false)}
          anchor={
            <Pressable
              onPress={() => setReadMenuVisible(true)}
              className="flex-row items-center gap-1.5 rounded-full border px-3 py-2 active:opacity-60"
              style={{ borderColor: theme.border }}
            >
              <Text
                className="text-[11px] font-semibold"
                style={{ color: theme.text }}
              >
                {selectedLabel(readOptions, readFilter)}
              </Text>
              <Ionicons
                name="chevron-down"
                size={12}
                color={theme.textSecondary}
              />
            </Pressable>
          }
        >
          {readOptions.map((option) => (
            <Menu.Item
              key={option.value}
              title={option.label}
              trailingIcon={readFilter === option.value ? "check" : undefined}
              onPress={() => {
                onReadFilterChange(option.value);
                setReadMenuVisible(false);
              }}
            />
          ))}
        </Menu>

        <Menu
          visible={priorityMenuVisible}
          onDismiss={() => setPriorityMenuVisible(false)}
          anchor={
            <Pressable
              onPress={() => setPriorityMenuVisible(true)}
              className="flex-row items-center gap-1.5 rounded-full border px-3 py-2 active:opacity-60"
              style={{ borderColor: theme.border }}
            >
              <Text
                className="text-[11px] font-semibold"
                style={{ color: theme.text }}
              >
                {selectedLabel(priorityOptions, priorityFilter)}
              </Text>
              <Ionicons
                name="chevron-down"
                size={12}
                color={theme.textSecondary}
              />
            </Pressable>
          }
        >
          {priorityOptions.map((option) => (
            <Menu.Item
              key={option.value}
              title={option.label}
              trailingIcon={
                priorityFilter === option.value ? "check" : undefined
              }
              onPress={() => {
                onPriorityFilterChange(option.value);
                setPriorityMenuVisible(false);
              }}
            />
          ))}
        </Menu>
      </View>
    </View>
  );
}
