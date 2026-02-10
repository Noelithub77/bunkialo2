import { Colors } from "@/constants/theme";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { Ionicons } from "@expo/vector-icons";
import * as Application from "expo-application";
import Constants from "expo-constants";
import * as Updates from "expo-updates";
import {
  Linking,
  Modal,
  Pressable,
  Text,
  useWindowDimensions,
  View,
} from "react-native";

type DevInfoModalProps = {
  visible: boolean;
  onClose: () => void;
};

export const DevInfoModal = ({ visible, onClose }: DevInfoModalProps) => {
  const { height } = useWindowDimensions();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";
  const theme = isDark ? Colors.dark : Colors.light;
  const isCompactMobile = height <= 740;

  const expoConfig = Constants.expoConfig;
  const configBuildNumber =
    expoConfig?.ios?.buildNumber ??
    (expoConfig?.android?.versionCode
      ? String(expoConfig.android.versionCode)
      : null);

  const appVersion =
    Constants.appOwnership === "expo"
      ? (expoConfig?.version ?? Application.nativeApplicationVersion ?? "0.0.0")
      : (Application.nativeApplicationVersion ??
        expoConfig?.version ??
        "0.0.0");

  const buildVersion =
    Constants.appOwnership === "expo"
      ? (configBuildNumber ?? Application.nativeBuildVersion)
      : (Application.nativeBuildVersion ?? configBuildNumber);

  // OTA update info - message is stored in metadata when using `eas update --message`
  const manifest = Updates.manifest as Record<string, unknown> | null;
  const metadata = manifest?.metadata as Record<string, string> | undefined;
  const updateMessage = metadata?.message;
  const updateId = Updates.updateId;
  const updateCreatedAt = Updates.createdAt;

  // Show update section if we have any OTA update info
  const hasUpdateInfo = updateId && Constants.appOwnership !== "expo";
  const buyMeCoffeeUrl = "upi://pay?pa=noelmcv7@oksbi&cu=INR";
  const linkColor = isDark ? "#60A5FA" : "#2563EB";

  const openUrl = (url: string) => {
    Linking.openURL(url).catch(() => {
      // Ignore errors to avoid blocking the modal flow if target app/browser is unavailable.
    });
  };

  return (
    <Modal visible={visible} transparent animationType="fade">
      <Pressable
        className={`flex-1 items-center justify-center bg-black/55 ${isCompactMobile ? "p-2.5" : "p-3"}`}
        onPress={onClose}
      >
        <Pressable
          className={`w-full rounded-3xl border ${isCompactMobile ? "max-w-[320px] p-3.5" : "max-w-[330px] p-4"}`}
          style={{
            backgroundColor: theme.background,
            borderColor: theme.border,
          }}
          onPress={(event) => event.stopPropagation()}
        >
          <View className={`${isCompactMobile ? "mb-2" : "mb-3"} flex-row items-center justify-between`}>
            <Text className={`${isCompactMobile ? "text-[17px]" : "text-[18px]"} font-semibold`} style={{ color: theme.text }}>
              About
            </Text>
            <Pressable
              onPress={onClose}
              className="h-8 w-8 items-center justify-center rounded-full"
              style={{ backgroundColor: theme.backgroundSecondary }}
            >
              <Ionicons name="close" size={22} color={theme.textSecondary} />
            </Pressable>
          </View>

          <View
            className={`${isCompactMobile ? "mb-2.5 px-3 py-2" : "mb-4 px-4 py-3"} rounded-2xl border`}
            style={{
              backgroundColor: theme.backgroundSecondary,
              borderColor: theme.border,
            }}
          >
            <Text className={`${isCompactMobile ? "text-[15px]" : "text-base"} font-semibold`} style={{ color: theme.text }}>
              Bunkialo
            </Text>
            <Text className={`${isCompactMobile ? "mt-0.5 text-[12px]" : "mt-1 text-[13px]"}`} style={{ color: theme.textSecondary }}>
              {buildVersion ? `${appVersion} (${buildVersion})` : appVersion}
            </Text>
          </View>

          {hasUpdateInfo && (
            <View
              className={`${isCompactMobile ? "mb-2.5 px-3 py-2" : "mb-3 px-3.5 py-2.5"} rounded-2xl border`}
              style={{
                backgroundColor: theme.backgroundSecondary,
                borderColor: theme.border,
              }}
            >
              <Text className="text-[11px] font-semibold uppercase tracking-[1.1px]" style={{ color: theme.textSecondary }}>
                Current Update
              </Text>
              {updateMessage && (
                <Text
                  className={`${isCompactMobile ? "mt-0.5 text-[12px]" : "mt-1 text-[13px]"}`}
                  style={{ color: theme.text }}
                  numberOfLines={1}
                >
                  {updateMessage}
                </Text>
              )}
              <View className={`${isCompactMobile ? "mt-1.5" : "mt-2"} flex-row items-center justify-between`}>
                {updateCreatedAt && (
                  <Text className={`${isCompactMobile ? "text-[10px]" : "text-[11px]"}`} style={{ color: theme.textSecondary }}>
                    {updateCreatedAt.toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    })}
                  </Text>
                )}
                <Text
                  className={`${isCompactMobile ? "text-[10px]" : "text-[11px]"}`}
                  style={{ color: theme.textSecondary, fontFamily: "monospace" }}
                  numberOfLines={1}
                >
                  {updateId.slice(0, 8)}
                </Text>
              </View>
            </View>
          )}

          <View
            className={`${isCompactMobile ? "px-3 py-2" : "px-3.5 py-2.5"} rounded-2xl border`}
            style={{
              backgroundColor: theme.backgroundSecondary,
              borderColor: theme.border,
            }}
          >
            <View className={`${isCompactMobile ? "gap-1.5" : "gap-2"}`}>
              <Text
                className="text-[11px] font-semibold uppercase tracking-[1.1px]"
                style={{ color: theme.textSecondary }}
              >
                Credits
              </Text>
              <Text className={`${isCompactMobile ? "text-[12px]" : "text-[13px]"}`} style={{ color: theme.textSecondary }}>
                Made by{" "}
                <Text
                  onPress={() => openUrl("https://www.linkedin.com/in/noel-georgi/")}
                  className="underline"
                  style={{ color: linkColor, fontWeight: "600" }}
                >
                  Noel Georgi
                </Text>
              </Text>

              <Text className={`${isCompactMobile ? "text-[12px]" : "text-[13px]"}`} style={{ color: theme.textSecondary }}>
                Ideas by{" "}
                <Text
                  onPress={() =>
                    openUrl("https://www.linkedin.com/in/srimoneyshankar-ajith-a5a6831ba/")
                  }
                  className="underline"
                  style={{ color: linkColor, fontWeight: "600" }}
                >
                  Srimoney
                </Text>
                {" & "}
                <Text
                  onPress={() => openUrl("https://www.linkedin.com/in/niranjan-vasudevan/")}
                  className="underline"
                  style={{ color: linkColor, fontWeight: "600" }}
                >
                  Niranjan V
                </Text>
              </Text>

              <Pressable
                onPress={() => openUrl(buyMeCoffeeUrl)}
                className="mt-1 self-start rounded-xl px-3 py-2"
                style={{ backgroundColor: Colors.status.warning }}
              >
                <View className="flex-row items-center gap-1.5">
                  <Ionicons name="cafe-outline" size={14} color={Colors.black} />
                  <Text className={`${isCompactMobile ? "text-[12px]" : "text-[13px]"} font-semibold`} style={{ color: Colors.black }}>
                    Buy me a coffee
                  </Text>
                </View>
              </Pressable>
            </View>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
};
