import { Container } from "@/components/ui/container";
import { Button } from "@/components/ui/button";
import { Colors, Radius, Spacing } from "@/constants/theme";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { getCredentials } from "@/services/auth";
import {
  checkConnectivity,
  getDefaultPortalBaseUrl,
  loginToCaptivePortal,
} from "@/services/wifix";
import { useWifixStore } from "@/stores/wifix-store";
import { syncWifixBackgroundTask } from "@/background/wifix-background";
import type { WifixConnectionState } from "@/types";
import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from "react-native";

const formatTimestamp = (date: Date): string => {
  const day = date.getDate().toString().padStart(2, "0");
  const month = (date.getMonth() + 1).toString().padStart(2, "0");
  const hours = date.getHours().toString().padStart(2, "0");
  const minutes = date.getMinutes().toString().padStart(2, "0");
  const seconds = date.getSeconds().toString().padStart(2, "0");
  return `${day}/${month}, ${hours}:${minutes}:${seconds}`;
};

const formatLastCheck = (timestamp: number | null): string => {
  if (!timestamp) return "Not checked yet";
  const date = new Date(timestamp);
  return date.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
  });
};

type StatusIconName =
  | "checkmark-circle"
  | "wifi"
  | "alert-circle"
  | "refresh"
  | "radio-button-off";

const getStatusMeta = (
  state: WifixConnectionState,
): { label: string; detail: string; color: string; icon: StatusIconName } => {
  switch (state) {
    case "online":
      return {
        label: "Online",
        detail: "Internet access looks good",
        color: Colors.status.success,
        icon: "checkmark-circle",
      };
    case "captive":
      return {
        label: "Captive Portal",
        detail: "Login required",
        color: Colors.status.warning,
        icon: "wifi",
      };
    case "offline":
      return {
        label: "Offline",
        detail: "No internet access",
        color: Colors.status.danger,
        icon: "alert-circle",
      };
    case "checking":
      return {
        label: "Checking",
        detail: "Testing connection",
        color: Colors.status.info,
        icon: "refresh",
      };
    default:
      return {
        label: "Idle",
        detail: "Waiting for action",
        color: Colors.gray[400],
        icon: "radio-button-off",
      };
  }
};

export default function WifixScreen() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";
  const theme = isDark ? Colors.dark : Colors.light;

  const {
    autoReconnectEnabled,
    portalBaseUrl: storedPortalBaseUrl,
    setAutoReconnectEnabled,
    setPortalBaseUrl,
  } = useWifixStore();

  const [now, setNow] = useState(() => new Date());
  const [status, setStatus] = useState<WifixConnectionState>("idle");
  const [portalUrl, setPortalUrl] = useState<string | null>(null);
  const [portalBaseUrl, setPortalBaseUrlLocal] = useState<string | null>(
    storedPortalBaseUrl,
  );
  const [message, setMessage] = useState<string | null>(null);
  const [lastCheckedAt, setLastCheckedAt] = useState<number | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  const statusMeta = useMemo(() => getStatusMeta(status), [status]);

  const syncPortalBaseUrl = useCallback(
    (nextBaseUrl: string | null) => {
      if (!nextBaseUrl) return;
      setPortalBaseUrlLocal(nextBaseUrl);
      if (nextBaseUrl !== storedPortalBaseUrl) {
        setPortalBaseUrl(nextBaseUrl);
      }
    },
    [setPortalBaseUrl, storedPortalBaseUrl],
  );

  const runConnectivityCheck = useCallback(
    async (shouldLogin: boolean) => {
      if (isConnecting) return;
      setIsConnecting(true);
      setStatus("checking");
      setMessage(null);

      const result = await checkConnectivity();
      setStatus(result.state);
      setPortalUrl(result.portalUrl);
      syncPortalBaseUrl(result.portalBaseUrl);
      setLastCheckedAt(Date.now());

      if (shouldLogin && result.state === "captive") {
        const credentials = await getCredentials();
        if (!credentials) {
          setMessage("Login to Bunkialo first to save WiFi credentials.");
          setIsConnecting(false);
          return;
        }

        const loginResult = await loginToCaptivePortal({
          username: credentials.username,
          password: credentials.password,
          portalUrl: result.portalUrl,
          portalBaseUrl: result.portalBaseUrl ?? storedPortalBaseUrl,
        });

        setMessage(loginResult.message);
        syncPortalBaseUrl(loginResult.portalBaseUrl);

        if (loginResult.success) {
          const updated = await checkConnectivity();
          setStatus(updated.state);
          setPortalUrl(updated.portalUrl);
          syncPortalBaseUrl(updated.portalBaseUrl ?? loginResult.portalBaseUrl);
          setLastCheckedAt(Date.now());
        }
      } else if (shouldLogin && result.state === "offline") {
        setMessage("No captive portal detected.");
      }

      setIsConnecting(false);
    },
    [
      isConnecting,
      storedPortalBaseUrl,
      syncPortalBaseUrl,
      setPortalUrl,
      setStatus,
    ],
  );

  useEffect(() => {
    runConnectivityCheck(false);
  }, [runConnectivityCheck]);

  useEffect(() => {
    if (!autoReconnectEnabled) return;
    const id = setInterval(() => {
      runConnectivityCheck(true);
    }, 45000);
    return () => clearInterval(id);
  }, [autoReconnectEnabled, runConnectivityCheck]);

  const portalDisplayUrl = portalUrl ?? "Not detected";
  const baseDisplayUrl =
    portalBaseUrl ?? storedPortalBaseUrl ?? getDefaultPortalBaseUrl();

  return (
    <Container>
      <LinearGradient
        colors={["#0A0A0A", "#000000", "#0A0A0A"]}
        style={StyleSheet.absoluteFill}
      />
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.headerRow}>
          <View style={styles.headerLeft}>
            <Text style={[styles.headerTitle, { color: theme.text }]}>WiFix</Text>
            <Text style={[styles.headerSubtitle, { color: theme.textSecondary }]}
            >
              WiFixing {formatTimestamp(now)}
            </Text>
          </View>
          <Switch
            value={autoReconnectEnabled}
            onValueChange={(enabled) => {
              setAutoReconnectEnabled(enabled);
              syncWifixBackgroundTask();
            }}
            trackColor={{
              false: Colors.gray[700],
              true: Colors.status.info,
            }}
            thumbColor={Colors.white}
          />
        </View>

        <View style={styles.hero}>
          <Image
            source={require("../../assets/icons/wifix.png")}
            style={styles.logo}
            contentFit="contain"
          />
          <Text style={[styles.heroTitle, { color: theme.text }]}>WiFix</Text>
          <Text style={[styles.heroSubtitle, { color: theme.textSecondary }]}
          >
            Auto captive portal reconnect
          </Text>
        </View>

        <View
          style={[
            styles.statusCard,
            { borderColor: statusMeta.color + "55" },
          ]}
        >
          <View style={styles.statusRow}>
            <View style={styles.statusLeft}>
              <Ionicons
                name={statusMeta.icon}
                size={22}
                color={statusMeta.color}
              />
              <View>
                <Text style={[styles.statusLabel, { color: theme.text }]}
                >
                  {statusMeta.label}
                </Text>
                <Text
                  style={[
                    styles.statusDetail,
                    { color: theme.textSecondary },
                  ]}
                >
                  {statusMeta.detail}
                </Text>
              </View>
            </View>
            <Text style={[styles.statusTime, { color: theme.textSecondary }]}
            >
              Last check: {formatLastCheck(lastCheckedAt)}
            </Text>
          </View>

          <View style={styles.divider} />

          <View style={styles.infoRow}>
            <Text style={[styles.infoLabel, { color: theme.textSecondary }]}
            >
              Captive portal URL
            </Text>
            <Text style={[styles.infoValue, { color: theme.text }]}
              numberOfLines={2}
            >
              {portalDisplayUrl}
            </Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={[styles.infoLabel, { color: theme.textSecondary }]}
            >
              Portal base
            </Text>
            <Text style={[styles.infoValue, { color: theme.text }]}
              numberOfLines={1}
            >
              {baseDisplayUrl}
            </Text>
          </View>
          {message && (
            <View style={styles.infoRow}>
              <Text style={[styles.infoLabel, { color: theme.textSecondary }]}
              >
                Status
              </Text>
              <Text style={[styles.infoValue, { color: theme.text }]}
                numberOfLines={2}
              >
                {message}
              </Text>
            </View>
          )}
        </View>

        <View style={styles.actions}>
          <Button
            title={isConnecting ? "Reconnecting..." : "Reconnect"}
            onPress={() => runConnectivityCheck(true)}
            loading={isConnecting}
          />
          <Button
            title="Check Status"
            onPress={() => runConnectivityCheck(false)}
            variant="secondary"
          />
        </View>

        <View style={styles.footer}>
          <Pressable
            style={styles.backButton}
            onPress={() => router.back()}
          >
            <Ionicons name="arrow-back" size={16} color={theme.textSecondary} />
            <Text style={[styles.backText, { color: theme.textSecondary }]}
            >
              Back to Dashboard
            </Text>
          </Pressable>
          <Text style={[styles.footerText, { color: theme.textSecondary }]}
          >
            Keep WiFix enabled for automatic reconnects
          </Text>
        </View>
      </ScrollView>
    </Container>
  );
}

const styles = StyleSheet.create({
  content: {
    padding: Spacing.lg,
    paddingBottom: Spacing.xxl,
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: Spacing.lg,
  },
  headerLeft: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: "700",
    letterSpacing: 0.5,
  },
  headerSubtitle: {
    fontSize: 12,
    marginTop: Spacing.xs,
  },
  hero: {
    alignItems: "center",
    marginBottom: Spacing.xl,
  },
  logo: {
    width: 120,
    height: 120,
    marginBottom: Spacing.md,
  },
  heroTitle: {
    fontSize: 28,
    fontWeight: "700",
    letterSpacing: 1,
  },
  heroSubtitle: {
    fontSize: 13,
    marginTop: Spacing.xs,
  },
  statusCard: {
    borderRadius: Radius.lg,
    borderWidth: 1,
    backgroundColor: "rgba(8, 8, 8, 0.9)",
    padding: Spacing.lg,
    marginBottom: Spacing.lg,
  },
  statusRow: {
    gap: Spacing.md,
  },
  statusLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
  },
  statusLabel: {
    fontSize: 18,
    fontWeight: "600",
  },
  statusDetail: {
    fontSize: 12,
    marginTop: 2,
  },
  statusTime: {
    fontSize: 11,
    marginTop: Spacing.sm,
  },
  divider: {
    height: 1,
    backgroundColor: Colors.gray[800],
    marginVertical: Spacing.md,
  },
  infoRow: {
    marginBottom: Spacing.sm,
  },
  infoLabel: {
    fontSize: 11,
    textTransform: "uppercase",
    letterSpacing: 1,
    marginBottom: 4,
  },
  infoValue: {
    fontSize: 14,
  },
  actions: {
    gap: Spacing.sm,
    marginBottom: Spacing.lg,
  },
  footer: {
    alignItems: "center",
    gap: Spacing.xs,
  },
  backButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
  },
  backText: {
    fontSize: 12,
  },
  footerText: {
    fontSize: 11,
  },
});
