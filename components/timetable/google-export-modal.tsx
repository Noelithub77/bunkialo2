import { Button } from "@/components/ui/button";
import { Colors, Radius, Spacing } from "@/constants/theme";
import { useColorScheme } from "@/hooks/use-color-scheme";
import {
  exportToGoogleCalendar,
  getAccessToken,
  getSignInErrorMessage,
  signIn,
} from "@/services/google-calendar";
import type { GoogleExportStatus, TimetableSlot } from "@/types";
import { Ionicons } from "@expo/vector-icons";
import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";

interface GoogleExportModalProps {
  visible: boolean;
  onClose: () => void;
  slots: TimetableSlot[];
}

export const GoogleExportModal = ({
  visible,
  onClose,
  slots,
}: GoogleExportModalProps) => {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";
  const theme = isDark ? Colors.dark : Colors.light;

  const [status, setStatus] = useState<GoogleExportStatus>("idle");
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const [error, setError] = useState<string | null>(null);
  const [eventsCreated, setEventsCreated] = useState(0);

  const runExport = useCallback(
    async (accessToken: string) => {
      const result = await exportToGoogleCalendar(
        slots,
        accessToken,
        (statusUpdate, current, total) => {
          setStatus(statusUpdate as GoogleExportStatus);
          if (current !== undefined && total !== undefined) {
            setProgress({ current, total });
          }
        },
      );

      if (result.success) {
        setStatus("success");
        setEventsCreated(result.eventsCreated);
      } else {
        setStatus("error");
        setError(result.error ?? "Export failed");
      }
    },
    [slots],
  );

  const handleExport = async () => {
    setStatus("authenticating");
    setError(null);

    try {
      // try existing token first
      let accessToken = await getAccessToken();

      // need sign-in
      if (!accessToken) {
        accessToken = await signIn();
      }

      await runExport(accessToken);
    } catch (err) {
      setStatus("error");
      setError(getSignInErrorMessage(err));
    }
  };

  const handleClose = () => {
    setStatus("idle");
    setProgress({ current: 0, total: 0 });
    setError(null);
    setEventsCreated(0);
    onClose();
  };

  const statusMessage = (() => {
    switch (status) {
      case "authenticating":
        return "Signing in with Google...";
      case "creating_calendar":
        return "Setting up calendar...";
      case "clearing_events":
        return "Clearing old events...";
      case "adding_events":
        return `Adding events (${progress.current}/${progress.total})...`;
      case "success":
        return `Added ${eventsCreated} recurring events`;
      case "error":
        return error ?? "Something went wrong";
      default:
        return "";
    }
  })();

  const isLoading = [
    "authenticating",
    "creating_calendar",
    "clearing_events",
    "adding_events",
  ].includes(status);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={handleClose}
    >
      <Pressable style={styles.backdrop} onPress={handleClose}>
        <Pressable
          style={[styles.sheet, { backgroundColor: theme.background }]}
          onPress={(e) => e.stopPropagation()}
        >
          {/* header */}
          <View style={styles.header}>
            <Text style={[styles.title, { color: theme.text }]}>
              Sync to Google Calendar
            </Text>
            <Pressable onPress={handleClose} hitSlop={8}>
              <Ionicons name="close" size={20} color={theme.textSecondary} />
            </Pressable>
          </View>

          {/* content */}
          <View style={styles.content}>
            {/* info box */}
            <View
              style={[
                styles.infoBox,
                { backgroundColor: theme.backgroundSecondary },
              ]}
            >
              <Ionicons
                name="calendar-outline"
                size={24}
                color={Colors.status.info}
              />
              <View style={styles.infoText}>
                <Text style={[styles.infoTitle, { color: theme.text }]}>
                  {slots.length} Classes
                </Text>
                <Text
                  style={[styles.infoSubtitle, { color: theme.textSecondary }]}
                >
                  Weekly recurring events until semester end
                </Text>
              </View>
            </View>

            {/* status display */}
            {status !== "idle" && (
              <View
                style={[
                  styles.statusBox,
                  {
                    backgroundColor:
                      status === "success"
                        ? Colors.status.success + "15"
                        : status === "error"
                          ? Colors.status.danger + "15"
                          : theme.backgroundSecondary,
                  },
                ]}
              >
                {isLoading && (
                  <ActivityIndicator size="small" color={theme.text} />
                )}
                {status === "success" && (
                  <Ionicons
                    name="checkmark-circle"
                    size={20}
                    color={Colors.status.success}
                  />
                )}
                {status === "error" && (
                  <Ionicons
                    name="alert-circle"
                    size={20}
                    color={Colors.status.danger}
                  />
                )}
                <Text
                  style={[
                    styles.statusText,
                    {
                      color:
                        status === "success"
                          ? Colors.status.success
                          : status === "error"
                            ? Colors.status.danger
                            : theme.text,
                    },
                  ]}
                >
                  {statusMessage}
                </Text>
              </View>
            )}

            {/* notes */}
            {status === "idle" && (
              <View style={[styles.noteBox, { borderColor: theme.border }]}>
                <Ionicons
                  name="information-circle-outline"
                  size={16}
                  color={theme.textSecondary}
                />
                <Text style={[styles.noteText, { color: theme.textSecondary }]}>
                  Creates a "bunkialo-timetable" calendar in your Google
                  account. Previous events will be replaced.
                </Text>
              </View>
            )}
          </View>

          {/* footer */}
          <View style={styles.footer}>
            <Button
              title="Cancel"
              variant="secondary"
              onPress={handleClose}
              style={styles.footerBtn}
            />
            <Button
              title={
                isLoading
                  ? "Syncing..."
                  : status === "success"
                    ? "Done"
                    : "Sync"
              }
              onPress={status === "success" ? handleClose : handleExport}
              disabled={isLoading || slots.length === 0}
              style={styles.footerBtn}
            />
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.45)",
    justifyContent: "flex-end",
  },
  sheet: {
    borderTopLeftRadius: Radius.xl,
    borderTopRightRadius: Radius.xl,
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.lg,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: Spacing.md,
  },
  title: {
    fontSize: 18,
    fontWeight: "600",
  },
  content: {
    gap: Spacing.md,
    paddingBottom: Spacing.md,
  },
  infoBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
    padding: Spacing.md,
    borderRadius: Radius.lg,
  },
  infoText: {
    flex: 1,
  },
  infoTitle: {
    fontSize: 16,
    fontWeight: "600",
  },
  infoSubtitle: {
    fontSize: 13,
    marginTop: 2,
  },
  statusBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    padding: Spacing.md,
    borderRadius: Radius.md,
  },
  statusText: {
    fontSize: 14,
    fontWeight: "500",
    flex: 1,
  },
  noteBox: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: Spacing.sm,
    padding: Spacing.sm,
    borderWidth: 1,
    borderRadius: Radius.md,
  },
  noteText: {
    fontSize: 12,
    flex: 1,
    lineHeight: 18,
  },
  footer: {
    flexDirection: "row",
    gap: Spacing.sm,
    marginTop: Spacing.md,
  },
  footerBtn: {
    flex: 1,
  },
});
