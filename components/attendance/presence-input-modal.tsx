import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Colors, Radius, Spacing } from "@/constants/theme";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { Ionicons } from "@expo/vector-icons";
import { useEffect, useState } from "react";
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
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
        style={styles.overlay}
      >
        <Pressable style={styles.backdrop} onPress={onClose} />
        <View style={[styles.modal, { backgroundColor: theme.background }]}>
          <View style={styles.header}>
            <Ionicons
              name="checkmark-circle-outline"
              size={20}
              color={Colors.status.success}
            />
            <Text style={[styles.title, { color: theme.text }]}>
              Mark as Present
            </Text>
          </View>

          <Text style={[styles.subtitle, { color: theme.textSecondary }]}>
            Enter reason (LMS error, late entry, etc.)
          </Text>

          <Input
            placeholder="e.g. LMS not updated, was present"
            value={note}
            onChangeText={setNote}
            autoFocus
          />

          <View style={styles.actions}>
            <Button
              title="Cancel"
              variant="secondary"
              onPress={onClose}
              style={styles.btn}
            />
            <Button
              title="Mark Present"
              onPress={handleConfirm}
              style={styles.btn}
            />
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.6)",
  },
  modal: {
    width: "90%",
    maxWidth: 360,
    borderRadius: Radius.lg,
    padding: Spacing.lg,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    marginBottom: Spacing.xs,
  },
  title: {
    fontSize: 18,
    fontWeight: "600",
  },
  subtitle: {
    fontSize: 13,
    marginBottom: Spacing.md,
  },
  actions: {
    flexDirection: "row",
    gap: Spacing.sm,
    marginTop: Spacing.lg,
  },
  btn: {
    flex: 1,
  },
});
