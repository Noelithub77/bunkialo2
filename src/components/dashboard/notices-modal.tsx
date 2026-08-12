import { NotificationInboxControls } from "@/components/dashboard/notification-inbox-controls";
import { NotificationListItem } from "@/components/dashboard/notification-list-item";
import { ConfirmModal } from "@/components/modals/confirm-modal";
import { Colors } from "@/constants/theme";
import { POPUP_NOTICES } from "@/data/popups";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { ATTENDANCE_PORTAL_URL } from "@/services/auth/attendance-auth";
import { usePopupStore } from "@/stores/popup-store";
import { usePortalNotificationStore } from "@/stores/portal-notification-store";
import type { NotificationConcern, NotificationInboxItem } from "@/types";
import {
  getNotificationPriority,
  isNotificationRecent,
} from "@/utils/notification-inbox";
import { Ionicons } from "@expo/vector-icons";
import React from "react";
import {
  Linking,
  Modal,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { MD3DarkTheme, MD3LightTheme, PaperProvider } from "react-native-paper";
import { useSafeAreaInsets } from "react-native-safe-area-context";

interface NoticesModalProps {
  visible: boolean;
  onClose: () => void;
}

type ClearTarget = "current" | "all";

const makePortalUrl = (link: string): string =>
  link.startsWith("http")
    ? link
    : `${ATTENDANCE_PORTAL_URL}${link.startsWith("/") ? "" : "/"}${link}`;

export function NoticesModal({ visible, onClose }: NoticesModalProps) {
  const isDark = useColorScheme() === "dark";
  const theme = isDark ? Colors.dark : Colors.light;
  const insets = useSafeAreaInsets();
  const [concern, setConcern] = React.useState<NotificationConcern>("all");
  const [expandedId, setExpandedId] = React.useState<string | null>(null);
  const [clearTarget, setClearTarget] = React.useState<ClearTarget | null>(
    null,
  );

  const portalItems = usePortalNotificationStore((state) => state.items);
  const markPortalRead = usePortalNotificationStore((state) => state.markRead);
  const markAllPortalRead = usePortalNotificationStore(
    (state) => state.markAllRead,
  );
  const dismissPortal = usePortalNotificationStore((state) => state.dismiss);
  const prunePortal = usePortalNotificationStore((state) => state.pruneExpired);
  const seenPopupIds = usePopupStore((state) => state.seenPopupIds);
  const dismissedPopupIds = usePopupStore((state) => state.dismissedPopupIds);
  const markPopupSeen = usePopupStore((state) => state.markAsSeen);
  const markAllPopupsSeen = usePopupStore((state) => state.markAllAsSeen);
  const dismissPopups = usePopupStore((state) => state.dismissPopups);
  const prunePopups = usePopupStore((state) => state.pruneExpiredPopups);

  React.useEffect(() => {
    if (!visible) return;
    prunePortal();
    prunePopups();
  }, [prunePopups, prunePortal, visible]);

  const notifications = React.useMemo<NotificationInboxItem[]>(() => {
    const attendanceItems: NotificationInboxItem[] = portalItems
      .filter((item) => isNotificationRecent(item.createdAt))
      .map((item) => ({
        id: `attendance-${item.id}`,
        sourceId: item.id,
        source: "attendance",
        priority: getNotificationPriority(item.kind),
        title: item.title,
        body: item.body,
        createdAt: item.createdAt,
        isRead: item.readAt !== null,
        action: item.link
          ? {
              type: "openUrl" as const,
              label: "Open attendance",
              url: makePortalUrl(item.link),
            }
          : undefined,
      }));

    const appItems: NotificationInboxItem[] = POPUP_NOTICES.filter(
      (notice) =>
        isNotificationRecent(notice.timestamp) &&
        !dismissedPopupIds.includes(notice.id),
    ).map((notice) => ({
      id: `app-${notice.id}`,
      sourceId: notice.id,
      source: "app",
      priority: getNotificationPriority("APP", notice.isImportant),
      title: notice.title,
      body: notice.description,
      createdAt: notice.timestamp,
      isRead: seenPopupIds.includes(notice.id),
      imageSource: isDark
        ? (notice.imageSourceDark ?? notice.imageSource)
        : (notice.imageSourceLight ?? notice.imageSource),
      action:
        notice.ctaAction === "open-url" && notice.ctaUrl
          ? {
              type: "openUrl" as const,
              label: notice.ctaLabel ?? "Open",
              url: notice.ctaUrl,
            }
          : notice.ctaAction === "run-lms-feedback-autofill"
            ? {
                type: "runPopupAction" as const,
                label: notice.ctaLabel ?? "Open",
                noticeId: notice.id,
              }
            : undefined,
    }));

    return [...attendanceItems, ...appItems].sort(
      (first, second) =>
        new Date(second.createdAt).getTime() -
        new Date(first.createdAt).getTime(),
    );
  }, [dismissedPopupIds, isDark, portalItems, seenPopupIds]);

  const filteredNotifications = React.useMemo(
    () =>
      concern === "all"
        ? notifications
        : notifications.filter((item) => item.source === concern),
    [concern, notifications],
  );

  const currentItems = React.useMemo(
    () =>
      concern === "all"
        ? notifications
        : notifications.filter((item) => item.source === concern),
    [concern, notifications],
  );
  const concernCounts = React.useMemo<Record<NotificationConcern, number>>(
    () => ({
      all: notifications.length,
      attendance: notifications.filter((item) => item.source === "attendance")
        .length,
      app: notifications.filter((item) => item.source === "app").length,
    }),
    [notifications],
  );
  const markCurrentRead = (): void => {
    if (concern !== "app") void markAllPortalRead();
    if (concern !== "attendance") markAllPopupsSeen();
  };

  const clearNotifications = (target: ClearTarget): void => {
    const items = target === "all" ? notifications : currentItems;
    dismissPortal(
      items
        .filter((item) => item.source === "attendance")
        .map((item) => item.sourceId),
    );
    dismissPopups(
      items
        .filter((item) => item.source === "app")
        .map((item) => item.sourceId),
    );
    setExpandedId(null);
    setClearTarget(null);
  };

  const handleItemPress = (item: NotificationInboxItem): void => {
    setExpandedId((current) => (current === item.id ? null : item.id));
    markItemRead(item);
  };

  const markItemRead = (item: NotificationInboxItem): void => {
    if (item.isRead) return;
    if (item.source === "attendance") {
      void markPortalRead(item.sourceId);
    } else {
      markPopupSeen(item.sourceId);
    }
  };

  const clearItem = (item: NotificationInboxItem): void => {
    if (item.source === "attendance") {
      dismissPortal([item.sourceId]);
    } else {
      dismissPopups([item.sourceId]);
    }
    setExpandedId((current) => (current === item.id ? null : current));
  };

  const handleItemAction = (item: NotificationInboxItem): void => {
    if (!item.action) return;
    if (item.action.type === "openUrl") {
      void Linking.openURL(item.action.url);
      return;
    }
    onClose();
  };

  const emptyMessage =
    notifications.length === 0
      ? "No notifications yet."
      : "No notifications in this tab.";

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <GestureHandlerRootView style={{ flex: 1 }}>
        <PaperProvider theme={isDark ? MD3DarkTheme : MD3LightTheme}>
          <View
            className="flex-1"
            style={{
              backgroundColor: isDark ? "rgba(0,0,0,0.82)" : "rgba(0,0,0,0.28)",
            }}
          >
            <Pressable className="absolute inset-0" onPress={onClose} />
            <View
              className="mx-3 mt-14 flex-1 overflow-hidden rounded-[28px] border"
              style={{
                backgroundColor: theme.background,
                borderColor: theme.border,
                marginBottom: insets.bottom + 14,
              }}
            >
              <NotificationInboxControls
                concern={concern}
                counts={concernCounts}
                hasCurrentItems={currentItems.length > 0}
                hasAnyItems={notifications.length > 0}
                theme={theme}
                onConcernChange={setConcern}
                onMarkCurrentRead={markCurrentRead}
                onRequestClearCurrent={() => setClearTarget("current")}
                onRequestClearAll={() => setClearTarget("all")}
                onClose={onClose}
              />

              <ScrollView
                contentInsetAdjustmentBehavior="automatic"
                showsVerticalScrollIndicator={false}
                contentContainerClassName="gap-3 p-4 pb-8"
              >
                {filteredNotifications.length === 0 ? (
                  <View className="items-center gap-3 px-6 py-16">
                    <View
                      className="h-14 w-14 items-center justify-center rounded-2xl"
                      style={{ backgroundColor: theme.backgroundSecondary }}
                    >
                      <Ionicons
                        name="checkmark-done-outline"
                        size={24}
                        color={theme.textSecondary}
                      />
                    </View>
                    <Text
                      className="text-center text-[13px]"
                      style={{ color: theme.textSecondary }}
                    >
                      {emptyMessage}
                    </Text>
                  </View>
                ) : (
                  filteredNotifications.map((item) => (
                    <NotificationListItem
                      key={item.id}
                      item={item}
                      expanded={expandedId === item.id}
                      theme={theme}
                      onPress={() => handleItemPress(item)}
                      onAction={() => handleItemAction(item)}
                      onMarkRead={() => markItemRead(item)}
                      onClear={() => clearItem(item)}
                    />
                  ))
                )}
              </ScrollView>
            </View>

            <ConfirmModal
              visible={clearTarget !== null}
              title={
                clearTarget === "all" ? "Clear everything?" : "Clear this tab?"
              }
              message="Cleared notifications stay hidden after the next sync."
              confirmText="Clear"
              variant="destructive"
              icon="trash-outline"
              onCancel={() => setClearTarget(null)}
              onConfirm={() => clearNotifications(clearTarget ?? "current")}
            />
          </View>
        </PaperProvider>
      </GestureHandlerRootView>
    </Modal>
  );
}
