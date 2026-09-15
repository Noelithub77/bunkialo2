import { Colors } from "@/constants/theme";
import { useColorScheme } from "@/hooks/use-color-scheme";
import type { WearTimetableSource } from "../../../shared/wear-timetable";
import { Ionicons } from "@expo/vector-icons";
import { useEffect, useState } from "react";
import { ActivityIndicator, Modal, Pressable, ScrollView, Text, View } from "react-native";

interface WearTimetableModalProps {
  visible: boolean;
  source: WearTimetableSource;
  accountSlotCount: number;
  lastSyncedAt: number | null;
  onClose: () => void;
  onSave: (source: WearTimetableSource) => Promise<string | null>;
  onReset: () => Promise<string | null>;
  onEditManually: () => void;
}

const sourceOptions: Array<{
  value: WearTimetableSource;
  title: string;
  description: string;
}> = [
  {
    value: "template",
    title: "Built-in template",
    description: "Use the timetable defined in the Wear OS app code.",
  },
  {
    value: "account",
    title: "Current account timetable",
    description: "Send the timetable generated from your current account.",
  },
  {
    value: "manual",
    title: "Manually edited timetable",
    description: "Send your mobile timetable after editing courses or slots.",
  },
];

export function WearTimetableModal({
  visible,
  source,
  accountSlotCount,
  lastSyncedAt,
  onClose,
  onSave,
  onReset,
  onEditManually,
}: WearTimetableModalProps) {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";
  const theme = isDark ? Colors.dark : Colors.light;
  const [selectedSource, setSelectedSource] = useState<WearTimetableSource>(source);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (visible) {
      setSelectedSource(source);
      setMessage(null);
    }
  }, [source, visible]);

  const handleSave = async () => {
    setIsSaving(true);
    setMessage(null);
    const error = await onSave(selectedSource);
    setIsSaving(false);
    if (error) {
      setMessage(error);
      return;
    }
    onClose();
  };

  const handleReset = async () => {
    setIsSaving(true);
    setMessage(null);
    const error = await onReset();
    setIsSaving(false);
    if (error) {
      setMessage(error);
      return;
    }
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View className="flex-1 items-center justify-center">
        <Pressable className="absolute inset-0 bg-black/60" onPress={onClose} />
        <View
          className="max-h-[88%] w-[92%] max-w-[430px] rounded-2xl p-5"
          style={{ backgroundColor: theme.background }}
        >
          <View className="mb-4 flex-row items-start justify-between">
            <View className="flex-1">
              <Text className="text-xl font-bold" style={{ color: theme.text }}>
                Wear OS timetable
              </Text>
              <Text className="mt-1 text-xs" style={{ color: theme.textSecondary }}>
                The built-in template stays the default and reset target.
              </Text>
            </View>
            <Pressable onPress={onClose} hitSlop={8}>
              <Ionicons name="close" size={22} color={theme.textSecondary} />
            </Pressable>
          </View>

          <ScrollView showsVerticalScrollIndicator={false}>
            <View className="gap-2">
              {sourceOptions.map((option) => {
                const isSelected = selectedSource === option.value;
                const isAccountUnavailable =
                  option.value !== "template" && accountSlotCount === 0;
                return (
                  <Pressable
                    key={option.value}
                    disabled={isSaving}
                    onPress={() => setSelectedSource(option.value)}
                    className="rounded-xl border p-3"
                    style={{
                      backgroundColor: isSelected
                        ? theme.backgroundSecondary
                        : "transparent",
                      borderColor: isSelected ? theme.text : theme.border,
                      opacity: isAccountUnavailable ? 0.55 : 1,
                    }}
                  >
                    <View className="flex-row items-start gap-3">
                      <Ionicons
                        name={isSelected ? "radio-button-on" : "radio-button-off"}
                        size={20}
                        color={isSelected ? theme.text : theme.textSecondary}
                      />
                      <View className="flex-1">
                        <Text className="font-semibold" style={{ color: theme.text }}>
                          {option.title}
                        </Text>
                        <Text className="mt-1 text-xs" style={{ color: theme.textSecondary }}>
                          {option.description}
                        </Text>
                      </View>
                    </View>
                  </Pressable>
                );
              })}
            </View>

            <View
              className="mt-3 rounded-xl px-3 py-2"
              style={{ backgroundColor: theme.backgroundSecondary }}
            >
              <Text className="text-xs" style={{ color: theme.textSecondary }}>
                {accountSlotCount > 0
                  ? `${accountSlotCount} timetable slots are ready from this phone.`
                  : "Refresh attendance first to load account timetable slots."}
              </Text>
              {lastSyncedAt && (
                <Text className="mt-1 text-xs" style={{ color: theme.textSecondary }}>
                  Last sent: {new Date(lastSyncedAt).toLocaleString()}
                </Text>
              )}
            </View>

            <Pressable
              disabled={isSaving}
              onPress={onEditManually}
              className="mt-3 flex-row items-center justify-center gap-2 rounded-xl border px-3 py-2.5"
              style={{ borderColor: theme.border }}
            >
              <Ionicons name="pencil-outline" size={16} color={theme.text} />
              <Text className="text-sm font-semibold" style={{ color: theme.text }}>
                Edit courses manually
              </Text>
            </Pressable>

            {message && (
              <Text className="mt-3 text-center text-xs" style={{ color: Colors.status.danger }}>
                {message}
              </Text>
            )}

            <View className="mt-4 flex-row gap-2">
              <Pressable
                disabled={isSaving}
                onPress={() => void handleReset()}
                className="flex-1 rounded-xl border px-3 py-3"
                style={{ borderColor: theme.border }}
              >
                <Text className="text-center text-sm font-semibold" style={{ color: theme.text }}>
                  Reset to template
                </Text>
              </Pressable>
              <Pressable
                disabled={isSaving}
                onPress={() => void handleSave()}
                className="flex-1 items-center justify-center rounded-xl px-3 py-3"
                style={{ backgroundColor: theme.text, opacity: isSaving ? 0.7 : 1 }}
              >
                {isSaving ? (
                  <ActivityIndicator color={theme.background} />
                ) : (
                  <Text className="text-center text-sm font-semibold" style={{ color: theme.background }}>
                    Send to watch
                  </Text>
                )}
              </Pressable>
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}
