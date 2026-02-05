import { Button } from "@/components/ui/button";
import { Colors } from "@/constants/theme";
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
      <Pressable
        className="flex-1 justify-end"
        style={{ backgroundColor: "rgba(0,0,0,0.45)" }}
        onPress={handleClose}
      >
        <Pressable
          className="max-h-[80%] rounded-t-3xl px-4 pt-4 pb-6"
          style={{ backgroundColor: theme.background }}
          onPress={(e) => e.stopPropagation()}
        >
          {/* header */}
          <View className="flex-row items-center justify-between mb-4">
            <Text className="text-lg font-semibold" style={{ color: theme.text }}>
              Export Timetable
            </Text>
            <Pressable onPress={handleClose} hitSlop={8}>
              <Ionicons name="close" size={20} color={theme.textSecondary} />
            </Pressable>
          </View>

          <ScrollView
            contentContainerStyle={{ gap: 16, paddingBottom: 16 }}
            showsVerticalScrollIndicator={false}
          >
            <View
              className="flex-row items-center gap-4 rounded-2xl p-4"
              style={{ backgroundColor: theme.backgroundSecondary }}
            >
              <Ionicons
                name="calendar-outline"
                size={24}
                color={Colors.status.info}
              />
              <View className="flex-1">
                <Text className="text-base font-semibold" style={{ color: theme.text }}>
                  {slots.length} Classes
                </Text>
                <Text
                  className="text-[13px] mt-0.5"
                  style={{ color: theme.textSecondary }}
                >
                  Weekly recurring events until semester end
                </Text>
              </View>
            </View>

            <Text className="text-[15px] font-semibold mt-2" style={{ color: theme.text }}>
              How to add to your calendar
            </Text>

            <View className="gap-2">
              {steps.map((step, index) => (
                <View key={step} className="flex-row items-center gap-2">
                  <View
                    className="h-6 w-6 items-center justify-center rounded-full"
                    style={{ backgroundColor: theme.backgroundSecondary }}
                  >
                    <Text
                      className="text-xs font-semibold"
                      style={{ color: theme.text }}
                    >
                      {index + 1}
                    </Text>
                  </View>
                  <Text
                    className="flex-1 text-sm"
                    style={{ color: theme.textSecondary }}
                  >
                    {step}
                  </Text>
                </View>
              ))}
            </View>

            <View
              className="flex-row items-start gap-2 rounded-xl border p-2"
              style={{ borderColor: theme.border }}
            >
              <Ionicons
                name="information-circle-outline"
                size={16}
                color={theme.textSecondary}
              />
              <Text
                className="flex-1 text-xs leading-[18px]"
                style={{ color: theme.textSecondary }}
              >
                Works with Google Calendar, Apple Calendar, Outlook, and any app
                that supports .ics files
              </Text>
            </View>

            {exportSuccess && (
              <View
                className="flex-row items-center gap-2 rounded-xl p-2"
                style={{ backgroundColor: Colors.status.success + "20" }}
              >
                <Ionicons
                  name="checkmark-circle"
                  size={18}
                  color={Colors.status.success}
                />
                <Text
                  className="text-[13px] font-medium"
                  style={{ color: Colors.status.success }}
                >
                  Timetable exported successfully
                </Text>
              </View>
            )}

            {errorMessage && (
              <View
                className="flex-row items-center gap-2 rounded-xl p-2"
                style={{ backgroundColor: Colors.status.danger + "20" }}
              >
                <Ionicons
                  name="alert-circle"
                  size={18}
                  color={Colors.status.danger}
                />
                <Text className="text-[13px] font-medium" style={{ color: Colors.status.danger }}>
                  {errorMessage}
                </Text>
              </View>
            )}
          </ScrollView>

          {/* footer */}
          <View className="mt-4 flex-row gap-2">
            <Button
              title="Cancel"
              variant="secondary"
              onPress={handleClose}
              style={{ flex: 1 }}
            />
            <Button
              title={isExporting ? "Exporting..." : "Export"}
              onPress={handleExport}
              disabled={isExporting || slots.length === 0}
              style={{ flex: 1 }}
            />
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
};
