import { Colors, Radius, Spacing } from "@/constants/theme";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { Ionicons } from "@expo/vector-icons";
import * as Application from "expo-application";
import Constants from "expo-constants";
import * as Updates from "expo-updates";
import {
  Linking,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";

type DevInfoModalProps = {
  visible: boolean;
  onClose: () => void;
};

export const DevInfoModal = ({ visible, onClose }: DevInfoModalProps) => {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";
  const theme = isDark ? Colors.dark : Colors.light;

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

  // OTA update info
  const manifest = Updates.manifest as Record<string, unknown> | null;
  const extra = manifest?.extra as Record<string, unknown> | undefined;
  const expoClient = extra?.expoClient as Record<string, unknown> | undefined;
  const updateMessage = (expoClient?.extra as Record<string, unknown>)
    ?.updateMessage as string | undefined;
  const updateCreatedAt = Updates.createdAt;

  return (
    <Modal visible={visible} transparent animationType="fade">
      <Pressable style={styles.backdrop} onPress={onClose}>
        <View style={[styles.content, { backgroundColor: theme.background }]}>
          <View style={styles.header}>
            <Text style={[styles.title, { color: theme.text }]}>About</Text>
            <Pressable onPress={onClose} style={styles.closeBtn}>
              <Ionicons name="close" size={22} color={theme.textSecondary} />
            </Pressable>
          </View>

          {/* Version */}
          <View style={styles.versionRow}>
            <Text style={[styles.appName, { color: theme.text }]}>
              Bunkialo
            </Text>
            <Text style={[styles.version, { color: theme.textSecondary }]}>
              {buildVersion ? `${appVersion}(${buildVersion})` : appVersion}
            </Text>
          </View>

          {/* OTA Update Info */}
          {updateMessage && (
            <View
              style={[
                styles.updateBox,
                { backgroundColor: theme.backgroundSecondary },
              ]}
            >
              <Text
                style={[styles.updateLabel, { color: theme.textSecondary }]}
              >
                Latest Update
              </Text>
              <Text style={[styles.updateMessage, { color: theme.text }]}>
                {updateMessage}
              </Text>
              {updateCreatedAt && (
                <Text
                  style={[styles.updateDate, { color: theme.textSecondary }]}
                >
                  {updateCreatedAt.toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                  })}
                </Text>
              )}
            </View>
          )}

          {/* Credits */}
          <View style={styles.credits}>
            <View style={styles.creditRow}>
              <Text
                style={[styles.creditLabel, { color: theme.textSecondary }]}
              >
                Made by
              </Text>
              <Pressable
                onPress={() =>
                  Linking.openURL("https://www.linkedin.com/in/noel-georgi/")
                }
              >
                <Text
                  style={[styles.creditLink, { color: Colors.status.info }]}
                >
                  Noel Georgi
                </Text>
              </Pressable>
            </View>

            <View style={styles.creditRow}>
              <Text
                style={[styles.creditLabel, { color: theme.textSecondary }]}
              >
                Ideas by
              </Text>
              <View style={styles.creditLinks}>
                <Pressable
                  onPress={() =>
                    Linking.openURL(
                      "https://www.linkedin.com/in/srimoneyshankar-ajith-a5a6831ba/",
                    )
                  }
                >
                  <Text
                    style={[styles.creditLink, { color: Colors.status.info }]}
                  >
                    Srimoney
                  </Text>
                </Pressable>
                <Text
                  style={[styles.creditLabel, { color: theme.textSecondary }]}
                >
                  {" & "}
                </Text>
                <Pressable
                  onPress={() =>
                    Linking.openURL(
                      "https://www.linkedin.com/in/niranjan-vasudevan/",
                    )
                  }
                >
                  <Text
                    style={[styles.creditLink, { color: Colors.status.info }]}
                  >
                    Niranjan V
                  </Text>
                </Pressable>
              </View>
            </View>
          </View>
        </View>
      </Pressable>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
    padding: Spacing.lg,
  },
  content: {
    width: "100%",
    maxWidth: 320,
    borderRadius: Radius.lg,
    padding: Spacing.lg,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: Spacing.md,
  },
  title: {
    fontSize: 18,
    fontWeight: "600",
  },
  closeBtn: {
    padding: Spacing.xs,
  },
  versionRow: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  appName: {
    fontSize: 16,
    fontWeight: "600",
  },
  version: {
    fontSize: 14,
  },
  updateBox: {
    padding: Spacing.md,
    borderRadius: Radius.md,
    marginBottom: Spacing.md,
    gap: Spacing.xs,
  },
  updateLabel: {
    fontSize: 11,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  updateMessage: {
    fontSize: 14,
    lineHeight: 20,
  },
  updateDate: {
    fontSize: 11,
    marginTop: Spacing.xs,
  },
  credits: {
    gap: Spacing.sm,
    paddingTop: Spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "rgba(128,128,128,0.2)",
  },
  creditRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
  },
  creditLabel: {
    fontSize: 13,
  },
  creditLinks: {
    flexDirection: "row",
    alignItems: "center",
  },
  creditLink: {
    fontSize: 13,
    fontWeight: "500",
  },
});
