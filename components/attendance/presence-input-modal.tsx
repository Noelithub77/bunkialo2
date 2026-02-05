import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Colors } from "@/constants/theme";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { Ionicons } from "@expo/vector-icons";
import { useEffect, useState } from "react";
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  Text,
  View,
} from "react-native";

interface PresenceInputModalProps {
  visible: boolean;
  onClose: () => void;
  onConfirm: (note: string) => void;
}

export function PresenceInputModal({
  visible,
  onClose,
  onConfirm,
}: PresenceInputModalProps) {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";
  const theme = isDark ? Colors.dark : Colors.light;

  const [note, setNote] = useState("");

  useEffect(() => {
    if (visible) setNote("");
  }, [visible]);

  const handleConfirm = () => {
    onConfirm(note);
    onClose();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        className="flex-1 items-center justify-center"
      >
        <Pressable className="absolute inset-0 bg-black/60" onPress={onClose} />
        <View
          className="w-[90%] max-w-[360px] rounded-2xl p-6"
          style={{ backgroundColor: theme.background }}
        >
          <View className="mb-1 flex-row items-center gap-2">
            <Ionicons
              name="checkmark-circle-outline"
              size={20}
              color={Colors.status.success}
            />
            <Text className="text-lg font-semibold" style={{ color: theme.text }}>
              Mark as Present
            </Text>
          </View>

          <Text
            className="mb-4 text-[13px]"
            style={{ color: theme.textSecondary }}
          >
            Enter reason (LMS error, late entry, etc.)
          </Text>

          <Input
            placeholder="e.g. LMS not updated, was present"
            value={note}
            onChangeText={setNote}
            autoFocus
          />

          <View className="mt-6 w-full flex-row gap-2">
            <Button
              title="Cancel"
              variant="secondary"
              onPress={onClose}
              className="flex-1"
            />
            <Button
              title="Mark Present"
              onPress={handleConfirm}
              className="flex-1"
            />
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
