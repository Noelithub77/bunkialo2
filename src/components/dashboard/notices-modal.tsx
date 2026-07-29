import React from "react";
import {
  Linking,
  Modal,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useColorScheme } from "@/hooks/use-color-scheme";
import { Colors } from "@/constants/theme";
import { POPUP_NOTICES } from "@/data/popups";
import { usePopupStore } from "@/stores/popup-store";
import { usePortalNotificationStore } from "@/stores/portal-notification-store";
import { ATTENDANCE_PORTAL_URL } from "@/services/auth/attendance-auth";

interface NoticesModalProps {
  visible: boolean;
  onClose: () => void;
}

export function NoticesModal({ visible, onClose }: NoticesModalProps) {
  const isDark = useColorScheme() === "dark";
  const theme = isDark ? Colors.dark : Colors.light;
  const insets = useSafeAreaInsets();
  const markAsUnseen = usePopupStore((state) => state.markAsUnseen);
  const portalItems = usePortalNotificationStore((state) => state.items);
  const markPortalRead = usePortalNotificationStore((state) => state.markRead);
  const markAllPortalRead = usePortalNotificationStore(
    (state) => state.markAllRead,
  );
  const [runningNoticeId, setRunningNoticeId] = React.useState<string | null>(
    null,
  );

  const runNoticeAction = React.useCallback(
    (noticeId: string) => {
      setRunningNoticeId(noticeId);
      markAsUnseen(noticeId);
      onClose();
      setTimeout(() => {
        setRunningNoticeId(null);
      }, 120);
    },
    [markAsUnseen, onClose],
  );

  // Sort notices by newest first
  const notices = [...POPUP_NOTICES].sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
  );

  const formatTime = (ts: string) => {
    const date = new Date(ts);
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View
        className="flex-1"
        style={{
          backgroundColor: isDark ? "rgba(0,0,0,0.8)" : "rgba(0,0,0,0.3)",
        }}
      >
        <Pressable className="absolute inset-0" onPress={onClose} />

        <View
          className="mx-4 mt-20 flex-1 overflow-hidden rounded-3xl"
          style={{
            backgroundColor: theme.background,
            marginBottom: insets.bottom + 24,
            borderWidth: 1,
            borderColor: isDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.05)",
          }}
        >
          {/* Header */}
          <View
            className="flex-row items-center justify-between border-b p-5"
            style={{ borderBottomColor: theme.border }}
          >
            <View className="flex-row items-center gap-3">
              <View
                className="items-center justify-center rounded-xl p-2"
                style={{ backgroundColor: `${Colors.accent}15` }}
              >
                <Ionicons
                  name="notifications"
                  size={20}
                  color={Colors.accent}
                />
              </View>
              <Text
                className="text-xl font-bold tracking-tight"
                style={{ color: theme.text }}
              >
                Notices
              </Text>
            </View>
            <View className="flex-row items-center gap-2">
              {portalItems.some((item) => !item.readAt) && (
                <Pressable
                  onPress={() => void markAllPortalRead()}
                  className="rounded-full px-3 py-2 active:opacity-50"
                >
                  <Text
                    className="text-xs font-semibold"
                    style={{ color: Colors.accent }}
                  >
                    Read all
                  </Text>
                </Pressable>
              )}
              <Pressable
                onPress={onClose}
                className="items-center justify-center rounded-full p-2 active:opacity-50"
                style={{
                  backgroundColor: isDark ? Colors.gray[800] : Colors.gray[100],
                }}
              >
                <Ionicons name="close" size={20} color={theme.textSecondary} />
              </Pressable>
            </View>
          </View>

          {/* Content */}
          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerClassName="p-5 gap-4"
          >
            {notices.length === 0 && portalItems.length === 0 ? (
              <View className="items-center py-10">
                <Ionicons
                  name="notifications-off-outline"
                  size={48}
                  color={theme.textSecondary}
                />
                <Text
                  className="mt-4 text-center text-sm"
                  style={{ color: theme.textSecondary }}
                >
                  No updates available right now.
                </Text>
              </View>
            ) : (
              <>
                {portalItems.map((notice) => (
                  <Pressable
                    key={`portal-${notice.id}`}
                    onPress={() => {
                      void markPortalRead(notice.id);
                      if (notice.link) {
                        const url = notice.link.startsWith("http")
                          ? notice.link
                          : `${ATTENDANCE_PORTAL_URL}${notice.link.startsWith("/") ? "" : "/"}${notice.link}`;
                        void Linking.openURL(url);
                      }
                    }}
                    className="rounded-2xl border p-4"
                    style={{
                      backgroundColor: theme.backgroundSecondary,
                      borderColor: notice.readAt
                        ? theme.border
                        : `${Colors.accent}80`,
                    }}
                  >
                    <View className="mb-2 flex-row items-center justify-between gap-3">
                      <Text
                        className="shrink text-base font-bold"
                        style={{ color: theme.text }}
                      >
                        {notice.title}
                      </Text>
                      <Text
                        className="text-[10px] font-semibold uppercase"
                        style={{ color: Colors.accent }}
                      >
                        Attendance
                      </Text>
                    </View>
                    <Text
                      className="text-[14px] leading-relaxed"
                      style={{ color: theme.textSecondary }}
                    >
                      {notice.body}
                    </Text>
                    <Text
                      className="mt-2 text-xs"
                      style={{ color: theme.textSecondary }}
                    >
                      {formatTime(notice.createdAt)}
                    </Text>
                  </Pressable>
                ))}
                {notices.map((notice) => (
                <View
                  key={notice.id}
                  className="rounded-2xl border p-4 shadow-sm"
                  style={{
                    backgroundColor: theme.backgroundSecondary,
                    borderColor: theme.border,
                  }}
                >
                  <View className="mb-2 flex-row justify-between items-start gap-4">
                    <View className="flex-row items-center gap-2 shrink">
                      {notice.icon && (
                        <Ionicons
                          name={notice.icon}
                          size={18}
                          color={notice.iconColor || Colors.accent}
                        />
                      )}
                      <Text
                        className="text-base font-bold shrink tracking-tight"
                        style={{ color: theme.text }}
                      >
                        {notice.title}
                      </Text>
                    </View>
                    <Text
                      className="text-xs shrink-0"
                      style={{ color: theme.textSecondary }}
                    >
                      {formatTime(notice.timestamp)}
                    </Text>
                  </View>

                  <Text
                    className="text-[14px] leading-relaxed"
                    style={{ color: theme.textSecondary }}
                  >
                    {notice.description}
                  </Text>

                  {(notice.imageSourceDark ||
                    notice.imageSourceLight ||
                    notice.imageSource) && (
                    <View className="mt-3">
                      <Image
                        source={
                          isDark
                            ? notice.imageSourceDark || notice.imageSource
                            : notice.imageSourceLight || notice.imageSource
                        }
                        style={{ width: "100%", height: 76 }}
                        contentFit="contain"
                      />
                    </View>
                  )}

                  {notice.ctaAction === "run-lms-feedback-autofill" && (
                    <Pressable
                      onPress={() => {
                        void runNoticeAction(notice.id);
                      }}
                      className="mt-3 items-center rounded-xl px-3 py-2.5"
                      style={{ backgroundColor: Colors.accent }}
                      disabled={runningNoticeId === notice.id}
                    >
                      <Text
                        className="text-[13px] font-semibold"
                        style={{ color: Colors.white }}
                      >
                        {runningNoticeId === notice.id
                          ? "Opening..."
                          : "Retry Autofill"}
                      </Text>
                    </Pressable>
                  )}

                  {notice.ctaAction === "open-url" && notice.ctaUrl ? (
                    <Pressable
                      onPress={() => {
                        if (notice.ctaUrl) void Linking.openURL(notice.ctaUrl);
                      }}
                      className="mt-3 items-center rounded-xl px-3 py-2.5"
                      style={{ backgroundColor: Colors.accent }}
                    >
                      <Text
                        className="text-[13px] font-semibold"
                        style={{ color: Colors.white }}
                      >
                        {notice.ctaLabel || "Open"}
                      </Text>
                    </Pressable>
                  ) : null}
                </View>
                ))}
              </>
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}
