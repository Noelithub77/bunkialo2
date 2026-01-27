import { Button } from "@/components/ui/button";
import { Colors, Radius, Spacing } from "@/constants/theme";
import { useColorScheme } from "@/hooks/use-color-scheme";
import type { AcademicEvent } from "@/types";
import { generateICSContent } from "@/utils/ics-export";
import { Ionicons } from "@expo/vector-icons";
import { documentDirectory, writeAsStringAsync } from "expo-file-system/legacy";
import { isAvailableAsync, shareAsync } from "expo-sharing";
import { useState } from "react";
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

interface ExportCalendarModalProps {
  visible: boolean;
  onClose: () => void;
  events: AcademicEvent[];
  termName: string;
}

export const ExportCalendarModal = ({
  visible,
  onClose,
  events,
  termName,
}: ExportCalendarModalProps) => {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";
  const theme = isDark ? Colors.dark : Colors.light;

  const [isExporting, setIsExporting] = useState(false);
  const [exportSuccess, setExportSuccess] = useState(false);

  const handleExport = async () => {
    setIsExporting(true);
    setExportSuccess(false);

    try {
      const icsContent = generateICSContent(events, `Bunkialo - ${termName}`);
      const fileName = `bunkialo-${termName.toLowerCase().replace(/\s+/g, "-")}.ics`;
      const filePath = `${documentDirectory}${fileName}`;

      await writeAsStringAsync(filePath, icsContent);

      const canShare = await isAvailableAsync();
      if (canShare) {
        await shareAsync(filePath, {
          mimeType: "text/calendar",
          dialogTitle: "Export Calendar",
          UTI: "public.calendar-event",
        });
        setExportSuccess(true);
      }
    } catch {
      // handle silently
    } finally {
      setIsExporting(false);
    }
  };

  const steps = [
    "Tap 'Export' to save the calendar file",
    "Open the file with your calendar app",
    "Confirm to add events to your calendar",
  ];

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable
          style={[styles.sheet, { backgroundColor: theme.background }]}
        >
          <View style={styles.header}>
            <Text style={[styles.title, { color: theme.text }]}>
              Export to Calendar
            </Text>
            <Pressable onPress={onClose} hitSlop={8}>
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
                  {events.length} Events
                </Text>
                <Text
                  style={[styles.infoSubtitle, { color: theme.textSecondary }]}
                >
                  {termName}
                </Text>
              </View>
            </View>

            <Text style={[styles.sectionTitle, { color: theme.text }]}>
              How to add to your calendar
            </Text>

            <View style={styles.stepsList}>
              {steps.map((step, index) => (
                <View key={index} style={styles.stepRow}>
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
                  Calendar exported successfully
                </Text>
              </View>
            )}
          </ScrollView>

          <View style={styles.footer}>
            <Button
              title="Cancel"
              variant="secondary"
              onPress={onClose}
              style={styles.footerBtn}
            />
            <Button
              title={isExporting ? "Exporting..." : "Export"}
              onPress={handleExport}
              disabled={isExporting || events.length === 0}
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
  footer: {
    flexDirection: "row",
    gap: Spacing.sm,
    marginTop: Spacing.md,
  },
  footerBtn: {
    flex: 1,
  },
});
