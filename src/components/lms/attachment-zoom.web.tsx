import { useState } from "react";
import { Modal, Pressable, ScrollView, View } from "react-native";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
export function AttachmentZoom({
  uri,
  onClose,
}: {
  uri: string;
  onClose: () => void;
}) {
  const [scale, setScale] = useState(1);
  return (
    <Modal visible transparent onRequestClose={onClose}>
      <View className="flex-1 bg-black/95">
        <View className="flex-row justify-end gap-3 px-4 py-3">
          {(["remove", "add", "close"] as const).map((icon) => (
            <Pressable
              key={icon}
              accessibilityLabel={
                icon === "close"
                  ? "Close zoom"
                  : icon === "add"
                    ? "Zoom in"
                    : "Zoom out"
              }
              className="h-11 w-11 items-center justify-center"
              onPress={() =>
                icon === "close"
                  ? onClose()
                  : setScale((value) =>
                      Math.max(
                        1,
                        Math.min(4, value + (icon === "add" ? 0.5 : -0.5)),
                      ),
                    )
              }
            >
              <Ionicons name={icon} color="white" size={24} />
            </Pressable>
          ))}
        </View>
        <ScrollView
          contentContainerStyle={{
            width: `${100 * scale}%`,
            minHeight: "100%",
          }}
        >
          <Image
            source={{ uri }}
            contentFit="contain"
            style={{ width: "100%", height: 1200 * scale }}
          />
        </ScrollView>
      </View>
    </Modal>
  );
}
