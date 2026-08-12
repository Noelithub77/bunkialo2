import { Colors } from "@/constants/theme";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import type { FacultyImageViewerProps } from "./faculty-image-viewer.types";
import { Modal, Pressable, Text, View } from "react-native";

export function FacultyImageViewer({
  imageUrl,
  facultyName,
  designation,
  visible,
  onClose,
}: FacultyImageViewerProps) {
  const isDark = useColorScheme() === "dark";
  const theme = isDark ? Colors.dark : Colors.light;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View className="flex-1 items-center justify-center bg-black/90 p-5">
        <Pressable className="absolute inset-0" onPress={onClose} />
        <View
          className="w-full max-w-2xl overflow-hidden rounded-3xl p-4"
          style={{ backgroundColor: theme.backgroundSecondary }}
        >
          <View className="mb-3 flex-row items-start justify-between gap-3">
            <View className="flex-1">
              <Text
                className="text-[16px] font-semibold"
                style={{ color: theme.text }}
              >
                {facultyName}
              </Text>
              <Text
                className="text-[12px]"
                style={{ color: theme.textSecondary }}
              >
                {designation}
              </Text>
            </View>
            <Pressable
              onPress={onClose}
              className="h-10 w-10 items-center justify-center rounded-full"
              style={{ backgroundColor: theme.background }}
              hitSlop={8}
            >
              <Ionicons name="close" size={20} color={theme.text} />
            </Pressable>
          </View>
          <Image
            source={{ uri: imageUrl }}
            contentFit="contain"
            style={{ width: "100%", height: 520 }}
          />
        </View>
      </View>
    </Modal>
  );
}
