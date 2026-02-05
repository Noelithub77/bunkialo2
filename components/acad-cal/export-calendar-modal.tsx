import { Button } from "@/components/ui/button";
import { Colors } from "@/constants/theme";
import { useColorScheme } from "@/hooks/use-color-scheme";
import type { AcademicEvent } from "@/types";
import { generateICSContent } from "@/utils/ics-export";
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

      if (Platform.OS === "android") {
        // android: open with app chooser
        const contentUri = await getContentUriAsync(filePath);
        await startActivityAsync("android.intent.action.VIEW", {
          data: contentUri,
          type: "text/calendar",
          flags: 1, // FLAG_GRANT_READ_URI_PERMISSION
        });
        setExportSuccess(true);
      } else {
        // iOS: use share sheet
        const canShare = await isAvailableAsync();
        if (canShare) {
          await shareAsync(filePath, {
            mimeType: "text/calendar",
            dialogTitle: "Export Calendar",
            UTI: "public.calendar-event",
          });
          setExportSuccess(true);
        }
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
      <Pressable className="flex-1 justify-end bg-black/45" onPress={onClose}>
        <Pressable
          className="max-h-[80%] rounded-t-3xl px-4 pt-4 pb-6"
          style={{ backgroundColor: theme.background }}
        >
          <View className="mb-4 flex-row items-center justify-between">
            <Text className="text-lg font-semibold" style={{ color: theme.text }}>
              Export to Calendar
            </Text>
            <Pressable onPress={onClose} hitSlop={8}>
              <Ionicons name="close" size={20} color={theme.textSecondary} />
            </Pressable>
          </View>

          <ScrollView
            contentContainerClassName="gap-4 pb-4"
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
                  {events.length} Events
                </Text>
                <Text
                  className="mt-0.5 text-[13px]"
                  style={{ color: theme.textSecondary }}
                >
                  {termName}
                </Text>
              </View>
            </View>

            <Text className="text-[15px] font-semibold" style={{ color: theme.text }}>
              How to add to your calendar
            </Text>

            <View className="gap-2">
              {steps.map((step, index) => (
                <View key={index} className="flex-row items-center gap-2">
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
                  Calendar exported successfully
                </Text>
              </View>
            )}
          </ScrollView>

          <View className="mt-4 w-full flex-row gap-2">
            <Button
              title="Cancel"
              variant="secondary"
              onPress={onClose}
              className="flex-1"
            />
            <Button
              title={isExporting ? "Exporting..." : "Export"}
              onPress={handleExport}
              disabled={isExporting || events.length === 0}
              className="flex-1"
            />
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
};
