import { Button } from "@/components/ui/button";
import { Colors } from "@/constants/theme";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { Ionicons } from "@expo/vector-icons";
import { Modal, Pressable, Text, View } from "react-native";

type ConfirmVariant = "default" | "destructive";

interface ConfirmModalProps {
  visible: boolean;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  variant?: ConfirmVariant;
  icon?: keyof typeof Ionicons.glyphMap;
  onCancel: () => void;
  onConfirm: () => void;
}

export function ConfirmModal({
  visible,
  title,
  message,
  confirmText = "Confirm",
  cancelText = "Cancel",
  variant = "default",
  icon,
  onCancel,
  onConfirm,
}: ConfirmModalProps) {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";
  const theme = isDark ? Colors.dark : Colors.light;

  const iconColor =
    variant === "destructive" ? Colors.status.danger : Colors.status.info;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onCancel}
    >
      <View className="flex-1 items-center justify-center">
        <Pressable className="absolute inset-0 bg-black/60" onPress={onCancel} />
        <View
          className="w-[90%] max-w-[380px] rounded-2xl p-6"
          style={{ backgroundColor: theme.background }}
        >
          <View className="mb-2 flex-row items-center gap-2">
            {icon && (
              <View
                className="h-[30px] w-[30px] items-center justify-center rounded-full"
                style={{ backgroundColor: iconColor }}
              >
                <Ionicons name={icon} size={18} color={Colors.white} />
              </View>
            )}
            <Text
              className="flex-1 text-lg font-semibold"
              style={{ color: theme.text }}
            >
              {title}
            </Text>
          </View>

          <Text
            className="text-[13px] leading-[18px]"
            style={{ color: theme.textSecondary }}
          >
            {message}
          </Text>

          <View className="mt-6 w-full flex-row gap-2">
            <Button
              title={cancelText}
              variant="secondary"
              onPress={onCancel}
              className="flex-1"
            />
            <Button
              title={confirmText}
              onPress={onConfirm}
              variant={variant === "destructive" ? "danger" : "primary"}
              className="flex-1"
            />
          </View>
        </View>
      </View>
    </Modal>
  );
}
