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
import { format } from "date-fns";
import * as Clipboard from "expo-clipboard";
import * as DocumentPicker from "expo-document-picker";
import {
  documentDirectory,
  readAsStringAsync,
  writeAsStringAsync,
} from "expo-file-system/legacy";
import { isAvailableAsync, shareAsync } from "expo-sharing";
import { useMemo, useState } from "react";
import {
  Alert,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";

interface BunkTransferModalProps {
  visible: boolean;
  onClose: () => void;
  scope: BunkTransferScope;
  courses: CourseBunkData[];
  allowImport?: boolean;
}

export const BunkTransferModal = ({
  visible,
  onClose,
  scope,
  courses,
  allowImport = true,
}: BunkTransferModalProps) => {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";
  const theme = isDark ? Colors.dark : Colors.light;
  const accent = Colors.accent;

  const [inputText, setInputText] = useState("");
  const [isBusy, setIsBusy] = useState(false);
  const [activeSubTab, setActiveSubTab] = useState<"export" | "import">(
    allowImport ? "export" : "export",
  );

  const { addBunk, markAsDutyLeave, removeDutyLeave } = useBunkStore();

  const MiniActionButton = (props: {
    title: string;
    icon: keyof typeof Ionicons.glyphMap;
    onPress: () => void;
    disabled?: boolean;
    className?: string;
  }) => {
    const bg = theme.backgroundSecondary;
    const border = theme.border;

    return (
      <Pressable
        onPress={props.onPress}
        disabled={props.disabled}
        className={`h-12 flex-row items-center justify-center gap-2 rounded-2xl border px-3 ${props.className ?? ""}`}
        style={({ pressed }) => [
          { backgroundColor: bg, borderColor: border },
          pressed && !props.disabled ? { transform: [{ scale: 0.98 }] } : null,
          props.disabled ? { opacity: 0.55 } : null,
          // Minimal lift so it reads like a tappable control.
          Platform.select({
            ios: {
              shadowColor: "#000",
              shadowOpacity: isDark ? 0.18 : 0.07,
              shadowRadius: 12,
              shadowOffset: { width: 0, height: 6 },
            },
            android: { elevation: isDark ? 1 : 1 },
            default: {},
          }),
        ]}
      >
        <Ionicons name={props.icon} size={18} color={theme.textSecondary} />
        <Text className="text-[13px] font-semibold" style={{ color: theme.text }}>
          {props.title}
        </Text>
      </Pressable>
    );
  };

  const rows = useMemo(() => buildBunkTransferRows(courses, scope), [courses, scope]);
  const rowCountLabel = useMemo(() => {
    if (rows.length === 0) return "No rows";
    if (rows.length === 1) return "1 row";
    return `${rows.length} rows`;
  }, [rows.length]);

  const title =
    scope === "duty-leave"
      ? allowImport
        ? "Duty Leave Export / Import"
        : "Duty Leave Export"
      : allowImport
        ? "All Bunks Export / Import"
        : "All Bunks Export";

  const subtitle = useMemo(() => {
    const scopeLabel = scope === "duty-leave" ? "Duty Leaves" : "All Bunks";
    return allowImport
      ? `${scopeLabel} - ${rowCountLabel}`
      : `${scopeLabel} - ${rowCountLabel}`;
  }, [allowImport, rowCountLabel, scope]);

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
    if (rows.length === 0) {
      Alert.alert("Nothing to export", "No matching bunks found for this export.");
      return;
    }
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
    if (rows.length === 0) {
      Alert.alert("Nothing to export", "No matching bunks found for this export.");
      return;
    }
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
    if (rows.length === 0) {
      Alert.alert("Nothing to copy", "No matching bunks found for this export.");
      return;
    }
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
    let createdCount = 0;

    for (const row of parsedRows) {
      const course = courseNameMap.get(row.courseName.toLowerCase());
      if (!course) continue;

      const targetBunk = course.bunks.find((bunk) => {
        const bunkIsoDate = parseBunkDateToIso(bunk.date);
        if (!bunkIsoDate || bunkIsoDate !== row.date) return false;
        const bunkSlot = normalizeSlot(bunk.timeSlot);
        return bunkSlot === row.slot;
      });

      if (!targetBunk) {
        // When importing "All Bunks", we need to be able to restore user-created bunks
        // on a fresh device (where the bunk record doesn't exist yet).
        if (scope === "all-bunks") {
          const formattedDate = format(
            new Date(`${row.date}T00:00:00`),
            "dd MMM yyyy",
          );
          addBunk(course.courseId, {
            date: formattedDate,
            description: "Imported bunk",
            timeSlot: row.slot,
            note: "",
            isDutyLeave: row.type === "DL",
            dutyLeaveNote: row.type === "DL" ? "Imported from transfer" : "",
            isMarkedPresent: false,
            presenceNote: "",
          });
          createdCount += 1;
          matchedCount += 1;
        }
        continue;
      }

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
        ? `Applied ${matchedCount} row${matchedCount === 1 ? "" : "s"}${
            createdCount > 0
              ? ` (created ${createdCount} bunk${createdCount === 1 ? "" : "s"})`
              : ""
          }.`
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
        style={{ backgroundColor: isDark ? "rgba(0,0,0,0.6)" : "rgba(0,0,0,0.45)" }}
        onPress={onClose}
      >
        <Pressable
          className="max-h-[90%] overflow-hidden rounded-t-[28px] border px-4 pt-3 pb-6"
          style={{ backgroundColor: theme.background, borderColor: theme.border }}
          onPress={(event) => event.stopPropagation()}
        >
          <View className="items-center">
            <View
              className="mb-3 h-1.5 w-10 rounded-full"
              style={{ backgroundColor: isDark ? Colors.gray[700] : Colors.gray[300] }}
            />
          </View>

          <View className="mb-3 flex-row items-start justify-between">
            <View className="flex-1 pr-3">
              <View className="flex-row items-center gap-2">
                <View
                  className="h-9 w-9 items-center justify-center rounded-xl border"
                  style={{ borderColor: theme.border, backgroundColor: theme.backgroundSecondary }}
                >
                  <Ionicons
                    name={scope === "duty-leave" ? "briefcase-outline" : "calendar-outline"}
                    size={18}
                    color={accent}
                  />
                </View>
                <View className="flex-1">
                  <Text className="text-[16px] font-semibold" style={{ color: theme.text }}>
                    {title}
                  </Text>
                  <Text className="text-[12px]" style={{ color: theme.textSecondary }}>
                    {subtitle}
                  </Text>
                </View>
              </View>
            </View>

            <Pressable
              onPress={onClose}
              hitSlop={10}
              className="h-10 w-10 items-center justify-center rounded-xl border"
              style={{ borderColor: theme.border, backgroundColor: theme.backgroundSecondary }}
            >
              <Ionicons name="close" size={18} color={theme.textSecondary} />
            </Pressable>
          </View>

          <ScrollView
            contentContainerClassName="gap-3 pb-5"
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            <View
              className="flex-row rounded-2xl border p-1"
              style={{ borderColor: theme.border, backgroundColor: theme.backgroundSecondary }}
            >
              <Pressable
                onPress={() => setActiveSubTab("export")}
                className="flex-1 items-center justify-center rounded-xl py-2.5"
                style={
                  activeSubTab === "export"
                    ? { backgroundColor: theme.background, borderColor: theme.border }
                    : undefined
                }
              >
                <Text
                  className="text-[13px] font-semibold"
                  style={{
                    color: activeSubTab === "export" ? theme.text : theme.textSecondary,
                  }}
                >
                  Export
                </Text>
              </Pressable>

              {allowImport && (
                <Pressable
                  onPress={() => setActiveSubTab("import")}
                  className="flex-1 items-center justify-center rounded-xl py-2.5"
                  style={
                    activeSubTab === "import"
                      ? { backgroundColor: theme.background, borderColor: theme.border }
                      : undefined
                  }
                >
                  <Text
                    className="text-[13px] font-semibold"
                    style={{
                      color: activeSubTab === "import" ? theme.text : theme.textSecondary,
                    }}
                  >
                    Import
                  </Text>
                </Pressable>
              )}
            </View>

            {activeSubTab === "export" && (
              <View className="flex-row flex-wrap gap-2">
                <MiniActionButton
                  title="Export CSV"
                  icon="document-text-outline"
                  onPress={handleExportCsv}
                  disabled={isBusy}
                  className="min-w-[48%] flex-1"
                />
                <MiniActionButton
                  title="Export Excel"
                  icon="grid-outline"
                  onPress={handleExportExcel}
                  disabled={isBusy}
                  className="min-w-[48%] flex-1"
                />
                <MiniActionButton
                  title="Copy to Clipboard"
                  icon="copy-outline"
                  onPress={handleCopy}
                  disabled={isBusy}
                  className="min-w-[48%] flex-1"
                />
              </View>
            )}

            {allowImport && activeSubTab === "import" && (
              <View className="gap-2">
                <View className="flex-row flex-wrap gap-2">
                  <MiniActionButton
                    title="Import File"
                    icon="cloud-upload-outline"
                    onPress={handleImportFile}
                    disabled={isBusy}
                    className="min-w-[48%] flex-1"
                  />
                  <MiniActionButton
                    title="Clipboard"
                    icon="clipboard-outline"
                    onPress={handleImportClipboard}
                    disabled={isBusy}
                    className="min-w-[48%] flex-1"
                  />
                </View>

                <TextInput
                  placeholder="Paste export here"
                  placeholderTextColor={theme.textSecondary}
                  multiline
                  value={inputText}
                  onChangeText={setInputText}
                  className="min-h-[132px] rounded-2xl border px-3 py-3 text-[13px]"
                  style={{
                    borderColor: theme.border,
                    color: theme.text,
                    backgroundColor: theme.backgroundSecondary,
                    textAlignVertical: "top",
                  }}
                />

                <MiniActionButton
                  title="Import Pasted Data"
                  icon="checkmark-circle-outline"
                  onPress={() => handleApplyImport(inputText)}
                  disabled={isBusy || inputText.trim().length === 0}
                  className="w-full"
                />
              </View>
            )}

            {/* legacy layout removed */}
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
};
