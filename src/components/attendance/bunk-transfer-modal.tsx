import { Button } from "@/components/ui/button";
import { Colors } from "@/constants/theme";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { useBunkStore } from "@/stores/bunk-store";
import type { CourseBunkData } from "@/types";
import {
  buildBunkTransferRows,
  normalizeSlot,
  parseBunkDateToIso,
  parseTransferRows,
  rowsToCsv,
  rowsToExcelXml,
  type BunkTransferScope,
} from "@/utils/bunk-transfer";
import { Ionicons } from "@expo/vector-icons";
import * as Clipboard from "expo-clipboard";
import * as DocumentPicker from "expo-document-picker";
import {
  documentDirectory,
  readAsStringAsync,
  writeAsStringAsync,
} from "expo-file-system/legacy";
import { isAvailableAsync, shareAsync } from "expo-sharing";
import { useMemo, useState } from "react";
import { Alert, Modal, Platform, Pressable, ScrollView, Text, TextInput, View } from "react-native";

interface BunkTransferModalProps {
  visible: boolean;
  onClose: () => void;
  scope: BunkTransferScope;
  courses: CourseBunkData[];
}

export const BunkTransferModal = ({
  visible,
  onClose,
  scope,
  courses,
}: BunkTransferModalProps) => {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";
  const theme = isDark ? Colors.dark : Colors.light;

  const [inputText, setInputText] = useState("");
  const [isBusy, setIsBusy] = useState(false);

  const { markAsDutyLeave, removeDutyLeave } = useBunkStore();

  const rows = useMemo(() => buildBunkTransferRows(courses, scope), [courses, scope]);

  const title = scope === "duty-leave" ? "Duty Leave Export / Import" : "All Bunks Export / Import";

  const writeAndShare = async (
    content: string,
    fileName: string,
    mimeType: string,
  ) => {
    const canShare = await isAvailableAsync();
    if (!canShare) {
      Alert.alert("Sharing not available", "Your device does not support file sharing.");
      return;
    }

    const filePath = `${documentDirectory}${fileName}`;
    await writeAsStringAsync(filePath, content);
    await shareAsync(filePath, {
      mimeType,
      dialogTitle: "Export bunk data",
      UTI: Platform.OS === "ios" ? "public.data" : undefined,
    });
  };

  const handleExportCsv = async () => {
    setIsBusy(true);
    try {
      await writeAndShare(rowsToCsv(rows), `bunkialo-${scope}.csv`, "text/csv");
    } catch {
      Alert.alert("Export failed", "Could not export CSV. Please try again.");
    } finally {
      setIsBusy(false);
    }
  };

  const handleExportExcel = async () => {
    setIsBusy(true);
    try {
      await writeAndShare(
        rowsToExcelXml(rows),
        `bunkialo-${scope}.xls`,
        "application/vnd.ms-excel",
      );
    } catch {
      Alert.alert("Export failed", "Could not export Excel file. Please try again.");
    } finally {
      setIsBusy(false);
    }
  };

  const handleCopy = async () => {
    try {
      await Clipboard.setStringAsync(rowsToCsv(rows));
      Alert.alert("Copied", "Export data copied to clipboard.");
    } catch {
      Alert.alert("Copy failed", "Could not copy export data to clipboard.");
    }
  };

  const getCourseNameMap = () => {
    const map = new Map<string, CourseBunkData>();
    for (const course of courses) {
      const alias = (course.config?.alias ?? "").trim().toLowerCase();
      const name = course.courseName.trim().toLowerCase();
      if (alias) map.set(alias, course);
      if (name) map.set(name, course);
    }
    return map;
  };

  const handleApplyImport = (rawInput: string) => {
    const parsedRows = parseTransferRows(rawInput);
    if (parsedRows.length === 0) {
      Alert.alert("No rows found", "Paste/import a CSV or Excel export with at least one entry.");
      return;
    }

    const courseNameMap = getCourseNameMap();
    let matchedCount = 0;

    for (const row of parsedRows) {
      const course = courseNameMap.get(row.courseName.toLowerCase());
      if (!course) continue;

      const targetBunk = course.bunks.find((bunk) => {
        const bunkIsoDate = parseBunkDateToIso(bunk.date);
        if (!bunkIsoDate || bunkIsoDate !== row.date) return false;
        const bunkSlot = normalizeSlot(bunk.timeSlot);
        return bunkSlot === row.slot;
      });

      if (!targetBunk) continue;

      if (scope === "duty-leave") {
        markAsDutyLeave(course.courseId, targetBunk.id, "Imported from transfer");
      } else if (row.type === "DL") {
        markAsDutyLeave(course.courseId, targetBunk.id, "Imported from transfer");
      } else {
        removeDutyLeave(course.courseId, targetBunk.id);
      }
      matchedCount += 1;
    }

    Alert.alert(
      "Import completed",
      matchedCount > 0
        ? `Applied ${matchedCount} row${matchedCount === 1 ? "" : "s"}.`
        : "No matching bunks found for the imported rows.",
    );
  };

  const handleImportClipboard = async () => {
    setIsBusy(true);
    try {
      const text = await Clipboard.getStringAsync();
      handleApplyImport(text);
    } catch {
      Alert.alert("Import failed", "Could not read clipboard data.");
    } finally {
      setIsBusy(false);
    }
  };

  const handleImportFile = async () => {
    setIsBusy(true);
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ["text/csv", "application/vnd.ms-excel", "text/plain"],
        copyToCacheDirectory: true,
      });

      if (result.canceled || result.assets.length === 0) return;
      const content = await readAsStringAsync(result.assets[0].uri);
      handleApplyImport(content);
    } catch {
      Alert.alert("Import failed", "Could not import the selected file.");
    } finally {
      setIsBusy(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable
        className="flex-1 justify-end"
        style={{ backgroundColor: "rgba(0,0,0,0.45)" }}
        onPress={onClose}
      >
        <Pressable
          className="max-h-[88%] rounded-t-3xl px-4 pt-4 pb-6"
          style={{ backgroundColor: theme.background }}
          onPress={(event) => event.stopPropagation()}
        >
          <View className="mb-4 flex-row items-center justify-between">
            <Text className="text-lg font-semibold" style={{ color: theme.text }}>
              {title}
            </Text>
            <Pressable onPress={onClose} hitSlop={8}>
              <Ionicons name="close" size={20} color={theme.textSecondary} />
            </Pressable>
          </View>

          <ScrollView contentContainerClassName="gap-3 pb-4" showsVerticalScrollIndicator={false}>
            <View className="rounded-xl p-3" style={{ backgroundColor: theme.backgroundSecondary }}>
              <Text className="text-sm font-semibold" style={{ color: theme.text }}>
                Export format
              </Text>
              <Text className="mt-1 text-xs" style={{ color: theme.textSecondary }}>
                Course Name, Date (YYYY-MM-DD), Day, Slot, Type
              </Text>
            </View>

            <View className="flex-row flex-wrap gap-2">
              <Button title="Export CSV" onPress={handleExportCsv} disabled={isBusy || rows.length === 0} className="flex-1" />
              <Button title="Export Excel" onPress={handleExportExcel} disabled={isBusy || rows.length === 0} className="flex-1" />
            </View>

            <Button title="Copy Export to Clipboard" onPress={handleCopy} disabled={isBusy || rows.length === 0} variant="secondary" />

            <View className="mt-2">
              <Text className="mb-2 text-sm font-semibold" style={{ color: theme.text }}>
                Import
              </Text>
              <View className="flex-row flex-wrap gap-2">
                <Button title="Import from File" onPress={handleImportFile} disabled={isBusy} className="flex-1" />
                <Button title="Import from Clipboard" onPress={handleImportClipboard} disabled={isBusy} variant="secondary" className="flex-1" />
              </View>
              <TextInput
                placeholder="Paste CSV / Excel XML data here"
                placeholderTextColor={theme.textSecondary}
                multiline
                value={inputText}
                onChangeText={setInputText}
                className="mt-3 min-h-[120px] rounded-xl border p-3 text-sm"
                style={{ borderColor: theme.border, color: theme.text, textAlignVertical: "top" }}
              />
              <Button
                title="Import Pasted Data"
                onPress={() => handleApplyImport(inputText)}
                disabled={isBusy || inputText.trim().length === 0}
                className="mt-2"
              />
            </View>
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
};
