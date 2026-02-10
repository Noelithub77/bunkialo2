import { Button } from "@/components/ui/button";
import { Colors } from "@/constants/theme";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { formatTimeDisplay, getDayName } from "@/stores/timetable-store";
import type { SlotConflict, SlotOccurrenceStats } from "@/types";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useEffect, useState } from "react";
import {
  LayoutAnimation,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Text,
  UIManager,
  View,
} from "react-native";

interface SlotConflictModalProps {
  visible: boolean;
  conflicts: SlotConflict[];
  onResolve: (
    conflictIndex: number,
    keep:
      | "manual"
      | "auto"
      | "preferred"
      | "alternative"
      | "keep-outlier"
      | "ignore-outlier",
  ) => void;
  onResolveAllPreferred: () => void;
  onRevertAutoConflict: (conflictId: string) => void;
  onClose: () => void;
}

const formatStats = (occurrence: number, total: number): string =>
  `${occurrence}/${Math.max(total, 1)}`;

const getTotalWeeksFromStats = (stats: SlotOccurrenceStats): number =>
  Math.max(stats.totalWeekSpanCount ?? stats.dayActiveWeekCount, 1);

export function SlotConflictModal({
  visible,
  conflicts,
  onResolve,
  onResolveAllPreferred,
  onRevertAutoConflict,
  onClose,
}: SlotConflictModalProps) {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";
  const theme = isDark ? Colors.dark : Colors.light;

  const hasComparableConflicts = conflicts.some((c) => c.type !== "manual-auto");
  const [selectionOverrides, setSelectionOverrides] = useState<
    Record<string, "preferred" | "alternative" | "keep" | "ignore" | null>
  >({});
  const [showAutoSaved, setShowAutoSaved] = useState(false);
  const [autoSavedTick, setAutoSavedTick] = useState(0);

  useEffect(() => {
    if (
      Platform.OS === "android" &&
      UIManager.setLayoutAnimationEnabledExperimental
    ) {
      UIManager.setLayoutAnimationEnabledExperimental(true);
    }
  }, []);

  useEffect(() => {
    if (!visible) return;
    const nextSelections: Record<
      string,
      "preferred" | "alternative" | "keep" | "ignore" | null
    > = {};
    for (const conflict of conflicts) {
      if (conflict.type !== "manual-auto") {
        nextSelections[conflict.conflictId] = conflict.resolvedChoice;
      }
    }
    setSelectionOverrides(nextSelections);
    setShowAutoSaved(false);
  }, [visible, conflicts]);

  useEffect(() => {
    if (!showAutoSaved) return;
    const timer = setTimeout(() => {
      setShowAutoSaved(false);
    }, 1200);
    return () => clearTimeout(timer);
  }, [showAutoSaved, autoSavedTick]);

  const triggerAutoSaved = () => {
    setAutoSavedTick((prev) => prev + 1);
    setShowAutoSaved(true);
  };

  const getCurrentSelection = (
    conflictId: string,
    resolvedChoice: "preferred" | "alternative" | "keep" | "ignore" | null,
  ) => {
    if (conflictId in selectionOverrides) {
      return selectionOverrides[conflictId] ?? null;
    }
    return resolvedChoice;
  };

  const resolve = (
    index: number,
    keep: "manual" | "auto" | "preferred" | "alternative",
  ) => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    onResolve(index, keep);
    triggerAutoSaved();
  };

  const chooseComparableConflict = (
    conflictIndex: number,
    conflictId: string,
    resolvedChoice: "preferred" | "alternative" | null,
    keep: "preferred" | "alternative",
  ) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    const currentSelection = getCurrentSelection(conflictId, resolvedChoice);
    Haptics.selectionAsync();
    if (currentSelection === keep) {
      onRevertAutoConflict(conflictId);
      setSelectionOverrides((prev) => ({
        ...prev,
        [conflictId]: null,
      }));
    } else {
      onResolve(conflictIndex, keep);
      setSelectionOverrides((prev) => ({
        ...prev,
        [conflictId]: keep,
      }));
    }
    triggerAutoSaved();
  };

  const chooseOutlierConflict = (
    conflictIndex: number,
    conflictId: string,
    resolvedChoice: "keep" | "ignore" | null,
    keep: "keep-outlier" | "ignore-outlier",
  ) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    const currentSelection = getCurrentSelection(conflictId, resolvedChoice);
    const isSameSelection =
      (currentSelection === "keep" && keep === "keep-outlier") ||
      (currentSelection === "ignore" && keep === "ignore-outlier");
    Haptics.selectionAsync();
    if (isSameSelection) {
      onRevertAutoConflict(conflictId);
    } else {
      onResolve(conflictIndex, keep);
    }
    triggerAutoSaved();
  };

  const keepAllPreferredAndClose = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    onResolveAllPreferred();
    onClose();
  };

  const unresolvedCount = conflicts.filter((conflict) => {
    if (conflict.type === "manual-auto") return true;
    const currentSelection = getCurrentSelection(
      conflict.conflictId,
      conflict.resolvedChoice,
    );
    return currentSelection === null;
  }).length;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View className="flex-1 items-center justify-center">
        <Pressable className="absolute inset-0 bg-black/60" onPress={onClose} />
        <View className="w-[92%] max-w-[400px] max-h-[84%] rounded-2xl p-4" style={{ backgroundColor: theme.background }}>
          <View className="mb-2 flex-row items-center justify-between">
            <View className="flex-1 flex-row items-center gap-2">
              <View className="h-[30px] w-[30px] items-center justify-center rounded-full" style={{ backgroundColor: Colors.status.warning + "24" }}>
                <Ionicons name="warning" size={16} color={Colors.status.warning} />
              </View>
              <View>
                <Text className="text-base font-semibold" style={{ color: theme.text }}>
                  Slot Decisions
                </Text>
                <Text className="text-[11px]" style={{ color: theme.textSecondary }}>
                  {unresolvedCount} pending
                </Text>
              </View>
            </View>
            <Pressable onPress={onClose} hitSlop={8}>
              <Ionicons name="close" size={20} color={theme.textSecondary} />
            </Pressable>
          </View>
          <View className="mb-2 h-4">
            {showAutoSaved && (
              <View className="flex-row items-center gap-1">
                <Ionicons
                  name="checkmark-done"
                  size={11}
                  color={Colors.status.success}
                />
                <Text
                  className="text-[10px] font-medium"
                  style={{ color: Colors.status.success }}
                >
                  Auto-saved just now
                </Text>
              </View>
            )}
          </View>

          <ScrollView className="flex-grow-0" contentContainerStyle={{ gap: 8, paddingBottom: 2 }}>
            {conflicts.map((conflict, index) => {
              const currentSelection =
                conflict.type === "manual-auto"
                  ? null
                  : getCurrentSelection(conflict.conflictId, conflict.resolvedChoice);
              const isResolved = currentSelection !== null;
              return (
              <View
                key={index}
                className="rounded-xl p-2.5"
                style={{
                  backgroundColor: theme.backgroundSecondary,
                  opacity: isResolved ? 0.68 : 1,
                }}
              >
                <View className="mb-2 flex-row items-center gap-2">
                  <View className="h-5 w-5 items-center justify-center rounded-full" style={{ backgroundColor: theme.border }}>
                    <Text className="text-[10px] font-bold" style={{ color: theme.text }}>
                      {index + 1}
                    </Text>
                  </View>
                  <View className="flex-1">
                    <Text className="text-[13px] font-semibold" style={{ color: theme.text }}>
                      {conflict.type === "manual-auto"
                        ? conflict.manualSlot.courseName
                        : conflict.type === "time-overlap"
                          ? "Time Clash"
                          : conflict.type === "outlier-review"
                            ? conflict.slot.courseName
                            : conflict.preferredSlot.courseName}
                    </Text>
                    <Text className="text-[10px]" style={{ color: theme.textSecondary }}>
                      {getDayName(
                        conflict.type === "manual-auto"
                          ? conflict.manualSlot.dayOfWeek
                          : conflict.type === "outlier-review"
                            ? conflict.slot.dayOfWeek
                            : conflict.preferredSlot.dayOfWeek,
                        false,
                      )}
                    </Text>
                  </View>
                </View>

                {conflict.type === "manual-auto" ? (
                  <View className="gap-1.5">
                    <View
                      className="flex-row items-center gap-2 rounded-lg border px-2 py-1.5"
                      style={{
                        borderColor: Colors.status.info + "70",
                        backgroundColor: Colors.status.info + "10",
                      }}
                    >
                      <Text className="w-[58px] text-[10px] font-bold" style={{ color: Colors.status.info }}>
                        Manual
                      </Text>
                      <Text className="flex-1 text-[10px]" numberOfLines={1} style={{ color: theme.textSecondary }}>
                        {formatTimeDisplay(conflict.manualSlot.startTime)} - {formatTimeDisplay(conflict.manualSlot.endTime)}
                      </Text>
                      <Button title="Keep" variant="secondary" onPress={() => resolve(index, "manual")} style={{ minWidth: 58, height: 34 }} />
                    </View>
                    <View
                      className="flex-row items-center gap-2 rounded-lg border px-2 py-1.5"
                      style={{
                        borderColor: Colors.status.warning + "70",
                        backgroundColor: Colors.status.warning + "10",
                      }}
                    >
                      <Text className="w-[58px] text-[10px] font-bold" style={{ color: Colors.status.warning }}>
                        LMS
                      </Text>
                      <Text className="flex-1 text-[10px]" numberOfLines={1} style={{ color: theme.textSecondary }}>
                        {formatTimeDisplay(conflict.autoSlot.startTime)} - {formatTimeDisplay(conflict.autoSlot.endTime)}
                        {conflict.autoStats
                          ? ` · ${formatStats(conflict.autoStats.occurrenceCount, getTotalWeeksFromStats(conflict.autoStats))}`
                          : ""}
                      </Text>
                      <Button title="Keep" variant="secondary" onPress={() => resolve(index, "auto")} style={{ minWidth: 58, height: 34 }} />
                    </View>
                  </View>
                ) : conflict.type === "outlier-review" ? (
                  <View className="gap-1.5">
                    <View
                      className="rounded-lg border px-2 py-2"
                      style={{
                        borderColor: Colors.status.warning + "70",
                        backgroundColor: Colors.status.warning + "12",
                      }}
                    >
                      <View className="mb-1 flex-row items-center justify-between">
                        <View className="flex-row items-center gap-2">
                          <Text
                            className="text-[10px] font-bold"
                            style={{ color: Colors.status.warning }}
                          >
                            Outlier Slot
                          </Text>
                          <Text
                            className="text-[9px]"
                            style={{ color: theme.textSecondary }}
                          >
                            {formatStats(
                              conflict.stats.occurrenceCount,
                              getTotalWeeksFromStats(conflict.stats),
                            )}{" "}
                            weeks
                          </Text>
                        </View>
                        <View className="flex-row gap-1">
                          <Pressable
                            onPress={() =>
                              chooseOutlierConflict(
                                index,
                                conflict.conflictId,
                                conflict.resolvedChoice,
                                "keep-outlier",
                              )
                            }
                            className="h-6 w-6 items-center justify-center rounded-md border"
                            style={{
                              borderColor:
                                conflict.resolvedChoice === "keep"
                                  ? Colors.status.success
                                  : theme.border,
                              backgroundColor:
                                conflict.resolvedChoice === "keep"
                                  ? Colors.status.success + "22"
                                  : theme.background,
                            }}
                          >
                            <Ionicons
                              name="checkmark"
                              size={13}
                              color={
                                conflict.resolvedChoice === "keep"
                                  ? Colors.status.success
                                  : theme.textSecondary
                              }
                            />
                          </Pressable>
                          <Pressable
                            onPress={() =>
                              chooseOutlierConflict(
                                index,
                                conflict.conflictId,
                                conflict.resolvedChoice,
                                "ignore-outlier",
                              )
                            }
                            className="h-6 w-6 items-center justify-center rounded-md border"
                            style={{
                              borderColor:
                                conflict.resolvedChoice === "ignore"
                                  ? Colors.status.danger
                                  : theme.border,
                              backgroundColor:
                                conflict.resolvedChoice === "ignore"
                                  ? Colors.status.danger + "1E"
                                  : theme.background,
                            }}
                          >
                            <Ionicons
                              name="close"
                              size={13}
                              color={
                                conflict.resolvedChoice === "ignore"
                                  ? Colors.status.danger
                                  : theme.textSecondary
                              }
                            />
                          </Pressable>
                        </View>
                      </View>
                      <Text
                        className="text-[10px] font-semibold"
                        style={{ color: theme.text }}
                      >
                        {conflict.slot.courseName}
                      </Text>
                      <Text
                        className="text-[9px]"
                        style={{ color: theme.textSecondary }}
                      >
                        {formatTimeDisplay(conflict.slot.startTime)} -{" "}
                        {formatTimeDisplay(conflict.slot.endTime)}
                      </Text>
                    </View>
                  </View>
                ) : (
                  <View className="gap-1.5">
                    <View className="flex-row items-stretch gap-1.5">
                      {(() => {
                        const selectedChoice = currentSelection;
                        const isPreferredSelected = selectedChoice === "preferred";
                        const isAlternativeSelected = selectedChoice === "alternative";
                        const preferredMeta =
                          conflict.preferredStats
                            ? `${formatStats(
                                conflict.preferredStats.occurrenceCount,
                                getTotalWeeksFromStats(conflict.preferredStats),
                              )} weeks`
                            : conflict.preferredSlot.isManual
                              ? "Manual slot"
                              : "LMS slot";
                        const alternativeMeta =
                          conflict.alternativeStats
                            ? `${formatStats(
                                conflict.alternativeStats.occurrenceCount,
                                getTotalWeeksFromStats(conflict.alternativeStats),
                              )} weeks`
                            : conflict.alternativeSlot.isManual
                              ? "Manual slot"
                              : "LMS slot";

                        return (
                          <>
                      <Pressable
                        onPress={() =>
                          chooseComparableConflict(
                            index,
                            conflict.conflictId,
                            conflict.resolvedChoice,
                            "preferred",
                          )
                        }
                        className="flex-1 rounded-lg border px-2 py-2"
                        style={{
                          borderColor: Colors.status.success + "70",
                          backgroundColor:
                            isPreferredSelected
                              ? Colors.status.success + "1F"
                              : Colors.status.success + "12",
                        }}
                      >
                        <View className="flex-row items-center justify-between">
                          <Text
                          className="text-[10px] font-bold"
                          style={{ color: Colors.status.success }}
                        >
                          Preferred
                        </Text>
                          {isPreferredSelected && (
                            <Ionicons
                              name="checkmark-circle"
                              size={14}
                              color={Colors.status.success}
                            />
                          )}
                        </View>
                        <Text
                          className="text-[10px] font-semibold"
                          numberOfLines={1}
                          style={{ color: theme.text }}
                        >
                          {conflict.preferredSlot.courseName}
                        </Text>
                        <Text
                          className="text-[9px]"
                          numberOfLines={1}
                          style={{ color: theme.textSecondary }}
                        >
                          {formatTimeDisplay(conflict.preferredSlot.startTime)} -{" "}
                          {formatTimeDisplay(conflict.preferredSlot.endTime)}
                        </Text>
                        <Text
                          className="text-[9px]"
                          style={{ color: theme.textSecondary }}
                        >
                          {preferredMeta}
                        </Text>
                      </Pressable>

                      <Pressable
                        onPress={() =>
                          chooseComparableConflict(
                            index,
                            conflict.conflictId,
                            conflict.resolvedChoice,
                            "alternative",
                          )
                        }
                        className="flex-1 rounded-lg border px-2 py-2"
                        style={{
                          borderColor: Colors.status.warning + "70",
                          backgroundColor:
                            isAlternativeSelected
                              ? Colors.status.warning + "1F"
                              : Colors.status.warning + "12",
                        }}
                      >
                        <View className="flex-row items-center justify-between">
                          <Text
                          className="text-[10px] font-bold"
                          style={{ color: Colors.status.warning }}
                        >
                          Alternative
                        </Text>
                          {isAlternativeSelected && (
                            <Ionicons
                              name="checkmark-circle"
                              size={14}
                              color={Colors.status.warning}
                            />
                          )}
                        </View>
                        <Text
                          className="text-[10px] font-semibold"
                          numberOfLines={1}
                          style={{ color: theme.text }}
                        >
                          {conflict.alternativeSlot.courseName}
                        </Text>
                        <Text
                          className="text-[9px]"
                          numberOfLines={1}
                          style={{ color: theme.textSecondary }}
                        >
                          {formatTimeDisplay(conflict.alternativeSlot.startTime)} -{" "}
                          {formatTimeDisplay(conflict.alternativeSlot.endTime)}
                        </Text>
                        <Text
                          className="text-[9px]"
                          style={{ color: theme.textSecondary }}
                        >
                          {alternativeMeta}
                        </Text>
                      </Pressable>
                          </>
                        );
                      })()}
                    </View>
                  </View>
                )}
              </View>
            );
            })}
          </ScrollView>

          <View className="mt-2 gap-1.5">
            {hasComparableConflicts && (
              <Button
                title="Keep All Preferred & Close"
                variant="primary"
                onPress={keepAllPreferredAndClose}
                style={{ flex: 1 }}
              />
            )}
          </View>
        </View>
      </View>
    </Modal>
  );
}
