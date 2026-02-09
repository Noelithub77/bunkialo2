import { Colors } from "@/constants/theme";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { Ionicons } from "@expo/vector-icons";
import { Modal, Pressable, ScrollView, Text, View } from "react-native";

interface SelectionOption {
  label: string;
  value: string | number;
}

interface SelectionModalProps {
  visible: boolean;
  title: string;
  message?: string;
  options: SelectionOption[];
  selectedValue?: string | number;
  icon?: keyof typeof Ionicons.glyphMap;
  onClose: () => void;
  onSelect: (value: string | number) => void;
}

export function SelectionModal({
  visible,
  title,
  message,
  options,
  selectedValue,
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
      <View className="flex-1 items-center justify-center">
        <Pressable
          className="absolute inset-0"
          style={{ backgroundColor: "rgba(0,0,0,0.6)" }}
          onPress={onClose}
        />
        <View
          className="w-[90%] max-w-[380px] max-h-[70%] rounded-2xl p-6"
          style={{ backgroundColor: theme.background }}
        >
          <View className="mb-2 flex-row items-center gap-2">
            {icon && (
              <View
                className="h-[30px] w-[30px] items-center justify-center rounded-full"
                style={{ backgroundColor: Colors.status.info }}
              >
                <Ionicons name={icon} size={18} color={Colors.white} />
              </View>
            )}
            <Text
              className="flex-1 text-[18px] font-semibold"
              style={{ color: theme.text }}
            >
              {title}
            </Text>
          </View>

          {message && (
            <Text
              className="mb-4 text-[13px] leading-[18px]"
              style={{ color: theme.textSecondary }}
            >
              {message}
            </Text>
          )}

          <ScrollView className="max-h-[300px]" showsVerticalScrollIndicator={false}>
            {options.map((option) => (
              <Pressable
                key={option.value.toString()}
                className="flex-row items-center justify-between rounded-lg px-2 py-4"
                style={({ pressed }) => ({
                  backgroundColor: pressed
                    ? theme.backgroundSecondary
                    : "transparent",
                })}
                onPress={() => handleSelect(option.value)}
              >
                <Text className="text-[15px]" style={{ color: theme.text }}>
                  {option.label}
                </Text>
                {selectedValue !== undefined ? (
                  <Ionicons
                    name={
                      option.value === selectedValue
                        ? "checkmark-circle"
                        : "ellipse-outline"
                    }
                    size={20}
                    color={
                      option.value === selectedValue
                        ? Colors.status.success
                        : theme.textSecondary
                    }
                  />
                ) : (
                  <Ionicons
                    name="chevron-forward"
                    size={18}
                    color={theme.textSecondary}
                  />
                )}
              </Pressable>
            ))}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}
