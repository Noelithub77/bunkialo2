import { Colors, Radius, Spacing } from "@/constants/theme";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { Ionicons } from "@expo/vector-icons";
import {
    Modal,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    View,
} from "react-native";

interface SelectionOption {
  label: string;
  value: string | number;
}

interface SelectionModalProps {
  visible: boolean;
  title: string;
  message?: string;
  options: SelectionOption[];
  icon?: keyof typeof Ionicons.glyphMap;
  onClose: () => void;
  onSelect: (value: string | number) => void;
}

export function SelectionModal({
  visible,
  title,
  message,
  options,
  icon,
  onClose,
  onSelect,
}: SelectionModalProps) {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";
  const theme = isDark ? Colors.dark : Colors.light;

  const handleSelect = (value: string | number) => {
    onSelect(value);
    onClose();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <Pressable style={styles.backdrop} onPress={onClose} />
        <View style={[styles.modal, { backgroundColor: theme.background }]}>
          <View style={styles.header}>
            {icon && (
              <View
                style={[
                  styles.iconBadge,
                  { backgroundColor: Colors.status.info },
                ]}
              >
                <Ionicons name={icon} size={18} color={Colors.white} />
              </View>
            )}
            <Text style={[styles.title, { color: theme.text }]}>{title}</Text>
          </View>

          {message && (
            <Text style={[styles.message, { color: theme.textSecondary }]}>
              {message}
            </Text>
          )}

          <ScrollView
            style={styles.optionsList}
            showsVerticalScrollIndicator={false}
          >
            {options.map((option) => (
              <Pressable
                key={option.value.toString()}
                style={({ pressed }) => [
                  styles.option,
                  {
                    backgroundColor: pressed
                      ? theme.backgroundSecondary
                      : "transparent",
                  },
                ]}
                onPress={() => handleSelect(option.value)}
              >
                <Text style={[styles.optionText, { color: theme.text }]}>
                  {option.label}
                </Text>
                <Ionicons
                  name="chevron-forward"
                  size={18}
                  color={theme.textSecondary}
                />
              </Pressable>
            ))}
          </ScrollView>
        </View>
      </View>
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
    maxWidth: 380,
    borderRadius: Radius.lg,
    padding: Spacing.lg,
    maxHeight: "70%",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  iconBadge: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    fontSize: 18,
    fontWeight: "600",
    flex: 1,
  },
  message: {
    fontSize: 13,
    lineHeight: 18,
    marginBottom: Spacing.md,
  },
  optionsList: {
    maxHeight: 300,
  },
  option: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.sm,
    borderRadius: Radius.sm,
  },
  optionText: {
    fontSize: 15,
  },
});
