import type { NotificationConcern } from "@/types";
import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { Pressable, Text, View } from "react-native";
import { Divider, Menu } from "react-native-paper";

interface NotificationInboxControlsProps {
  concern: NotificationConcern;
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

export function NotificationInboxControls({
  concern,
  counts,
  hasCurrentItems,
  hasAnyItems,
  theme,
  onConcernChange,
  onMarkCurrentRead,
  onRequestClearCurrent,
  onRequestClearAll,
  onClose,
}: NotificationInboxControlsProps) {
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
    </View>
  );
}
