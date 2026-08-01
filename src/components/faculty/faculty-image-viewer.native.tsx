import { Colors } from "@/constants/theme";
import { useColorScheme } from "@/hooks/use-color-scheme";
import type { FacultyImageViewerProps } from "./faculty-image-viewer.types";
import ImageViewing from "react-native-image-viewing";
import { Pressable, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

export function FacultyImageViewer({
  imageUrl,
  facultyName,
  designation,
  visible,
  onClose,
}: FacultyImageViewerProps) {
  const isDark = useColorScheme() === "dark";

  return (
    <ImageViewing
      images={[{ uri: imageUrl }]}
      imageIndex={0}
      visible={visible}
      onRequestClose={onClose}
      backgroundColor={isDark ? "#040712F5" : "#0B1220F0"}
      swipeToCloseEnabled
      doubleTapToZoomEnabled
      presentationStyle="overFullScreen"
      HeaderComponent={() => (
        <View className="px-5 pt-14">
          <View className="flex-row items-start justify-between">
            <View
              className="max-w-[80%] rounded-2xl px-4 py-2.5"
              style={{ backgroundColor: "#FFFFFF1A" }}
            >
              <Text className="text-[16px] font-semibold text-white">
                {facultyName}
              </Text>
              <Text className="mt-0.5 text-[12px] text-white/80">
                {designation}
              </Text>
            </View>
            <Pressable
              onPress={onClose}
              className="h-10 w-10 items-center justify-center rounded-full"
              style={{ backgroundColor: "#FFFFFF22" }}
              hitSlop={8}
            >
              <Ionicons name="close" size={20} color="#FFFFFF" />
            </Pressable>
          </View>
        </View>
      )}
      FooterComponent={() => (
        <View className="items-center px-6 pb-12">
          <View
            className="rounded-full px-4 py-2"
            style={{ backgroundColor: "#FFFFFF1A" }}
          >
            <Text className="text-[12px] text-white/90">
              Pinch or double-tap to zoom • Swipe down to close
            </Text>
          </View>
        </View>
      )}
    />
  );
}
