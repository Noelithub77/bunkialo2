import { Colors } from "@/constants/theme";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { useBunkStore } from "@/stores/bunk-store";
import type { CourseBunkData } from "@/types";
import { Toast } from "@/components";
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
  ActivityIndicator,
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
  const [busyAction, setBusyAction] = useState<
    | null
    | "export-csv"
    | "export-excel"
    | "copy"
    | "import-file"
    | "import-clipboard"
    | "import-paste"
  >(null);
  const [activeSubTab, setActiveSubTab] = useState<"export" | "import">(
    allowImport ? "export" : "export",
  );

  const { addBunk, markAsDutyLeave, removeDutyLeave } = useBunkStore();

  const showToast = (
    message: string,
    type: "default" | "success" | "error" | "warning" | "info" = "default",
  ) => {
    Toast.show(message, { type, position: "top" });
  };

  const MiniActionButton = (props: {
    title: string;
    icon: keyof typeof Ionicons.glyphMap;
    onPress: () => void;
    disabled?: boolean;
    loading?: boolean;
    className?: string;
  }) => {
    const bg = theme.backgroundSecondary;
    const border = theme.border;

    return (
      <Pressable
        onPress={props.onPress}
        disabled={props.disabled}
        className={`h-14 flex-row items-center justify-start gap-3 rounded-2xl border px-4 ${props.className ?? ""}`}
        style={({ pressed }) => [
          { backgroundColor: bg, borderColor: border },
          pressed && !props.disabled ? { transform: [{ scale: 0.985 }] } : null,
          props.disabled ? { opacity: 0.55 } : null,
          // Minimal lift so it reads like a tappable control.
          Platform.select({
            ios: {
              shadowColor: "#000",
              shadowOpacity: isDark ? 0.18 : 0.07,
              shadowRadius: 12,
              shadowOffset: { width: 0, height: 6 },
            },
            android: { elevation: isDark ? 2 : 1 },
            default: {},
          }),
        ]}
      >
        <View
          className="h-9 w-9 items-center justify-center rounded-xl border"
          style={{ borderColor: theme.border, backgroundColor: theme.background }}
        >
          {props.loading ? (
            <ActivityIndicator size="small" color={theme.textSecondary} />
          ) : (
            <Ionicons name={props.icon} size={18} color={theme.textSecondary} />
          )}
        </View>
        <Text className="text-[14px] font-semibold" style={{ color: theme.text }}>
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
      showToast("Sharing not available on this device.", "warning");
      return;
    }

    if (!documentDirectory) {
      const message = "documentDirectory is unavailable on this platform.";
      showToast(message, "error");
      throw new Error(message);
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
      showToast("Nothing to export.", "info");
      return;
    }
    setIsBusy(true);
    setBusyAction("export-csv");
    try {
      await writeAndShare(rowsToCsv(rows), `bunkialo-${scope}.csv`, "text/csv");
      showToast("Exported CSV.", "success");
    } catch (err: unknown) {
      const message =
        err instanceof Error && err.message
          ? err.message
          : "Could not export CSV. Please try again.";
      showToast(message, "error");
    } finally {
      setIsBusy(false);
      setBusyAction(null);
    }
  };

  const handleExportExcel = async () => {
    if (rows.length === 0) {
      showToast("Nothing to export.", "info");
      return;
    }
    setIsBusy(true);
    setBusyAction("export-excel");
    try {
      await writeAndShare(
        rowsToExcelXml(rows),
        `bunkialo-${scope}.xls`,
        "application/vnd.ms-excel",
      );
      showToast("Exported Excel.", "success");
    } catch (err: unknown) {
      const message =
        err instanceof Error && err.message
          ? err.message
          : "Could not export Excel file. Please try again.";
      showToast(message, "error");
    } finally {
      setIsBusy(false);
      setBusyAction(null);
    }
  };

  const handleCopy = async () => {
    if (rows.length === 0) {
      showToast("Nothing to copy.", "info");
      return;
    }
    setIsBusy(true);
    setBusyAction("copy");
    try {
      await Clipboard.setStringAsync(rowsToCsv(rows));
      showToast("Copied to clipboard.", "success");
    } catch {
      showToast("Copy failed.", "error");
    } finally {
      setIsBusy(false);
      setBusyAction(null);
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
      showToast("No rows found.", "warning");
      return;
    }

    const courseNameMap = getCourseNameMap();

    type ImportOp =
      | { kind: "create"; courseId: string; rowType: "DL" | "BUNK"; dateIso: string; slot: string }
      | { kind: "mark-dl"; courseId: string; bunkId: string }
      | { kind: "remove-dl"; courseId: string; bunkId: string };

    const ops: ImportOp[] = [];
    const destructiveRemovals: { courseName: string; date: string; slot: string }[] = [];

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
        if (scope === "all-bunks") {
          ops.push({
            kind: "create",
            courseId: course.courseId,
            rowType: row.type,
            dateIso: row.date,
            slot: row.slot,
          });
        }
        continue;
      }

      // Desired DL state based on import scope.
      const shouldBeDl = scope === "duty-leave" ? true : row.type === "DL";

      if (shouldBeDl) {
        ops.push({ kind: "mark-dl", courseId: course.courseId, bunkId: targetBunk.id });
      } else {
        // Potentially destructive: removing existing DL markings.
        if (targetBunk.isDutyLeave) {
          destructiveRemovals.push({
            courseName: course.courseName,
            date: row.date,
            slot: row.slot,
          });
        }
        ops.push({ kind: "remove-dl", courseId: course.courseId, bunkId: targetBunk.id });
      }
    }

    const applyOps = () => {
      let matchedCount = 0;
      let createdCount = 0;

      for (const op of ops) {
        if (op.kind === "create") {
          const formattedDate = format(
            new Date(`${op.dateIso}T00:00:00`),
            "dd MMM yyyy",
          );
          addBunk(op.courseId, {
            date: formattedDate,
            description: "Imported bunk",
            timeSlot: op.slot,
            note: "",
            isDutyLeave: op.rowType === "DL",
            dutyLeaveNote: op.rowType === "DL" ? "Imported from transfer" : "",
            isMarkedPresent: false,
            presenceNote: "",
          });
          createdCount += 1;
          matchedCount += 1;
          continue;
        }

        if (op.kind === "mark-dl") {
          markAsDutyLeave(op.courseId, op.bunkId, "Imported from transfer");
          matchedCount += 1;
          continue;
        }

        removeDutyLeave(op.courseId, op.bunkId);
        matchedCount += 1;
      }

      if (matchedCount === 0) {
        showToast("No matching bunks found.", "info");
      } else if (createdCount > 0) {
        showToast(`Imported ${matchedCount} rows (created ${createdCount}).`, "success");
      } else {
        showToast(`Imported ${matchedCount} rows.`, "success");
      }
    };

    if (destructiveRemovals.length > 0) {
      const example = destructiveRemovals[0];
      const message =
        destructiveRemovals.length === 1
          ? `This import will remove Duty Leave from 1 bunk.\n\nExample: ${example.courseName} on ${example.date} (${example.slot})`
          : `This import will remove Duty Leave from ${destructiveRemovals.length} bunks.\n\nExample: ${example.courseName} on ${example.date} (${example.slot})`;

      Alert.alert("Confirm import", message, [
        { text: "Cancel", style: "cancel" },
        { text: "Continue", style: "destructive", onPress: applyOps },
      ]);
      return;
    }

    applyOps();
  };

  const handleImportClipboard = async () => {
    setIsBusy(true);
    setBusyAction("import-clipboard");
    try {
      const text = await Clipboard.getStringAsync();
      handleApplyImport(text);
    } catch {
      showToast("Import failed: clipboard unreadable.", "error");
    } finally {
      setIsBusy(false);
      setBusyAction(null);
    }
  };

  const handleImportFile = async () => {
    setIsBusy(true);
    setBusyAction("import-file");
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ["text/csv", "application/vnd.ms-excel", "text/plain"],
        copyToCacheDirectory: true,
      });

      if (result.canceled || result.assets.length === 0) return;
      const content = await readAsStringAsync(result.assets[0].uri);
      handleApplyImport(content);
    } catch {
      showToast("Import failed: could not read file.", "error");
    } finally {
      setIsBusy(false);
      setBusyAction(null);
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
              <View
                className="rounded-3xl border p-3"
                style={{
                  borderColor: theme.border,
                  backgroundColor: theme.backgroundSecondary,
                }}
              >
                <View className="flex-row flex-wrap gap-3">
                  <MiniActionButton
                    title="Export CSV"
                    icon="document-text-outline"
                    onPress={handleExportCsv}
                    disabled={isBusy}
                    loading={busyAction === "export-csv"}
                    className="min-w-[48%] flex-1"
                  />
                  <MiniActionButton
                    title="Export Excel"
                    icon="grid-outline"
                    onPress={handleExportExcel}
                    disabled={isBusy}
                    loading={busyAction === "export-excel"}
                    className="min-w-[48%] flex-1"
                  />
                  <MiniActionButton
                    title="Copy to Clipboard"
                    icon="copy-outline"
                    onPress={handleCopy}
                    disabled={isBusy}
                    loading={busyAction === "copy"}
                    className="w-full"
                  />
                </View>
              </View>
            )}

            {allowImport && activeSubTab === "import" && (
              <View
                className="rounded-3xl border p-3"
                style={{
                  borderColor: theme.border,
                  backgroundColor: theme.backgroundSecondary,
                }}
              >
                <View className="flex-row flex-wrap gap-3">
                  <MiniActionButton
                    title="Import File"
                    icon="cloud-upload-outline"
                    onPress={handleImportFile}
                    disabled={isBusy}
                    loading={busyAction === "import-file"}
                    className="min-w-[48%] flex-1"
                  />
                  <MiniActionButton
                    title="Clipboard"
                    icon="clipboard-outline"
                    onPress={handleImportClipboard}
                    disabled={isBusy}
                    loading={busyAction === "import-clipboard"}
                    className="min-w-[48%] flex-1"
                  />

                  <TextInput
                    placeholder="Paste export here"
                    placeholderTextColor={theme.textSecondary}
                    multiline
                    value={inputText}
                    onChangeText={setInputText}
                    className="min-h-[132px] w-full rounded-2xl border px-3 py-3 text-[13px]"
                    style={{
                      borderColor: theme.border,
                      color: theme.text,
                      backgroundColor: theme.background,
                      textAlignVertical: "top",
                    }}
                  />

                  <MiniActionButton
                    title="Import Pasted Data"
                    icon="checkmark-circle-outline"
                    onPress={() => {
                      setBusyAction("import-paste");
                      handleApplyImport(inputText);
                      setBusyAction(null);
                    }}
                    disabled={isBusy || inputText.trim().length === 0}
                    loading={busyAction === "import-paste"}
                    className="w-full"
                  />
                </View>
              </View>
            )}

            {/* legacy layout removed */}
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
};
