import ImageViewing from "react-native-image-viewing";
import { Pressable } from "react-native";
import { Ionicons } from "@expo/vector-icons";
export function AttachmentZoom({
  uri,
  onClose,
}: {
  uri: string;
  onClose: () => void;
}) {
  return (
    <ImageViewing
      images={[{ uri }]}
      imageIndex={0}
      visible
      onRequestClose={onClose}
      doubleTapToZoomEnabled
      swipeToCloseEnabled
      HeaderComponent={() => (
        <Pressable
          accessibilityLabel="Close zoom"
          onPress={onClose}
          className="mr-4 mt-14 h-12 w-12 items-center justify-center self-end"
        >
          <Ionicons name="close" size={26} color="white" />
        </Pressable>
      )}
    />
  );
}
