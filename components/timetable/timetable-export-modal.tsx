import { Button } from "@/components/ui/button";
import { Colors, Radius, Spacing } from "@/constants/theme";
import { useColorScheme } from "@/hooks/use-color-scheme";
import type { TimetableSlot } from "@/types";
import { generateTimetableICSContent } from "@/utils/ics-export";
import { Ionicons } from "@expo/vector-icons";
import {
  documentDirectory,
  getContentUriAsync,
  writeAsStringAsync,
} from "expo-file-system/legacy";
import { startActivityAsync } from "expo-intent-launcher";
import { isAvailableAsync, shareAsync } from "expo-sharing";
import { useState } from "react";
import {
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

interface TimetableExportModalProps {
  visible: boolean;
  onClose: () => void;
  slots: TimetableSlot[];
}

export const TimetableExportModal = ({
  visible,
  onClose,
  slots,
}: TimetableExportModalProps) => {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";
  const theme = isDark ? Colors.dark : Colors.light;

  const [isExporting, setIsExporting] = useState(false);
  const [exportSuccess, setExportSuccess] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleExport = async () => {
    setIsExporting(true);
    setExportSuccess(false);
    setErrorMessage(null);

    try {
      const icsContent = generateTimetableICSContent(
        slots,
        "Bunkialo - Timetable",
      );
      const fileName = "bunkialo-timetable.ics";
      const filePath = `${documentDirectory}${fileName}`;

      await writeAsStringAsync(filePath, icsContent);

      if (Platform.OS === "android") {
        const contentUri = await getContentUriAsync(filePath);
        await startActivityAsync("android.intent.action.VIEW", {
          data: contentUri,
          type: "text/calendar",
          flags: 1,
        });
      } else {
        const canShare = await isAvailableAsync();
        if (canShare) {
          await shareAsync(filePath, {
            mimeType: "text/calendar",
            dialogTitle: "Export Timetable",
            UTI: "public.calendar-event",
          });
        }
      }

      setExportSuccess(true);
    } catch {
      setErrorMessage("Export failed. Please try again.");
    } finally {
      setIsExporting(false);
    }
  };

  const handleClose = () => {
    setIsExporting(false);
    setExportSuccess(false);
    setErrorMessage(null);
    onClose();
  };

  const steps = [
    "Tap 'Export' to create a timetable file",
    "Open it with your calendar app",
    "Confirm to add weekly recurring classes",
  ];

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
              Export Timetable
            </Text>
            <Pressable onPress={handleClose} hitSlop={8}>
              <Ionicons name="close" size={20} color={theme.textSecondary} />
            </Pressable>
          </View>

          <ScrollView
            contentContainerStyle={styles.content}
            showsVerticalScrollIndicator={false}
          >
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

            <Text style={[styles.sectionTitle, { color: theme.text }]}>
              How to add to your calendar
            </Text>

            <View style={styles.stepsList}>
              {steps.map((step, index) => (
                <View key={step} style={styles.stepRow}>
                  <View
                    style={[
                      styles.stepNumber,
                      { backgroundColor: theme.backgroundSecondary },
                    ]}
                  >
                    <Text
                      style={[styles.stepNumberText, { color: theme.text }]}
                    >
                      {index + 1}
                    </Text>
                  </View>
                  <Text
                    style={[styles.stepText, { color: theme.textSecondary }]}
                  >
                    {step}
                  </Text>
                </View>
              ))}
            </View>

            <View style={[styles.noteBox, { borderColor: theme.border }]}>
              <Ionicons
                name="information-circle-outline"
                size={16}
                color={theme.textSecondary}
              />
              <Text style={[styles.noteText, { color: theme.textSecondary }]}>
                Works with Google Calendar, Apple Calendar, Outlook, and any app
                that supports .ics files
              </Text>
            </View>

            {exportSuccess && (
              <View
                style={[
                  styles.successBox,
                  { backgroundColor: Colors.status.success + "20" },
                ]}
              >
                <Ionicons
                  name="checkmark-circle"
                  size={18}
                  color={Colors.status.success}
                />
                <Text
                  style={[styles.successText, { color: Colors.status.success }]}
                >
                  Timetable exported successfully
                </Text>
              </View>
            )}

            {errorMessage && (
              <View
                style={[
                  styles.errorBox,
                  { backgroundColor: Colors.status.danger + "20" },
                ]}
              >
                <Ionicons
                  name="alert-circle"
                  size={18}
                  color={Colors.status.danger}
                />
                <Text style={[styles.errorText, { color: Colors.status.danger }]}>
                  {errorMessage}
                </Text>
              </View>
            )}
          </ScrollView>

          {/* footer */}
          <View style={styles.footer}>
            <Button
              title="Cancel"
              variant="secondary"
              onPress={handleClose}
              style={styles.footerBtn}
            />
            <Button
              title={isExporting ? "Exporting..." : "Export"}
              onPress={handleExport}
              disabled={isExporting || slots.length === 0}
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
    maxHeight: "80%",
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
  sectionTitle: {
    fontSize: 15,
    fontWeight: "600",
    marginTop: Spacing.sm,
  },
  stepsList: {
    gap: Spacing.sm,
  },
  stepRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
  },
  stepNumber: {
    width: 24,
    height: 24,
    borderRadius: Radius.full,
    alignItems: "center",
    justifyContent: "center",
  },
  stepNumberText: {
    fontSize: 12,
    fontWeight: "600",
  },
  stepText: {
    fontSize: 14,
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
  successBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    padding: Spacing.sm,
    borderRadius: Radius.md,
  },
  successText: {
    fontSize: 13,
    fontWeight: "500",
  },
  errorBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    padding: Spacing.sm,
    borderRadius: Radius.md,
  },
  errorText: {
    fontSize: 13,
    fontWeight: "500",
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
