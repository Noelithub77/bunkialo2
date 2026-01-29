import { syncWifixBackgroundTask } from "@/background/wifix-background";
import { ExternalLink } from "@/components/shared/external-link";
import { Button } from "@/components/ui/button";
import { Container } from "@/components/ui/container";
import { Colors, Radius, Spacing } from "@/constants/theme";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { getCredentials } from "@/services/auth";
import {
  checkConnectivity,
  getDefaultPortalBaseUrl,
  loginToCaptivePortal,
  logoutFromCaptivePortal,
} from "@/services/wifix";
import { useWifixStore } from "@/stores/wifix-store";
import type { WifixConnectionState } from "@/types";
import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const inFlightRef = useRef(false);
  const lastAttemptRef = useRef(0);

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
      const nowMs = Date.now();
      if (inFlightRef.current) return;
      if (shouldLogin && nowMs - lastAttemptRef.current < 15000) return;
      inFlightRef.current = true;
      lastAttemptRef.current = nowMs;
      setIsConnecting(true);
      setStatus("checking");
      setMessage(null);
      try {
        const result = await checkConnectivity();
        setStatus(result.state);
        setPortalUrl(result.portalUrl);
        syncPortalBaseUrl(result.portalBaseUrl);
        setLastCheckedAt(Date.now());

        if (shouldLogin && result.state === "captive") {
          const credentials = await getCredentials();
          if (!credentials) {
            setMessage("Login to Bunkialo first to save WiFi credentials.");
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
            syncPortalBaseUrl(
              updated.portalBaseUrl ?? loginResult.portalBaseUrl,
            );
            setLastCheckedAt(Date.now());
          }
        } else if (shouldLogin && result.state === "offline") {
          setMessage("No captive portal detected.");
        }
      } finally {
        setIsConnecting(false);
        inFlightRef.current = false;
      }
    },
    [storedPortalBaseUrl, syncPortalBaseUrl],
  );

  useEffect(() => {
    runConnectivityCheck(false);
  }, [runConnectivityCheck]);

  // Background task handles auto reconnect; avoid polling on this screen.

  const portalDisplayUrl = portalUrl ?? "Not detected";
  const baseDisplayUrl =
    portalBaseUrl ?? storedPortalBaseUrl ?? getDefaultPortalBaseUrl();
  const isBusy = isConnecting || isLoggingOut;

  const handleLogoutInternet = useCallback(async () => {
    if (inFlightRef.current) return;
    inFlightRef.current = true;
    setIsLoggingOut(true);
    setStatus("checking");
    setMessage(null);

    try {
      const logoutResult = await logoutFromCaptivePortal({
        portalUrl,
        portalBaseUrl: storedPortalBaseUrl ?? portalBaseUrl,
      });
      setMessage(logoutResult.message);
      syncPortalBaseUrl(logoutResult.portalBaseUrl);

      const updated = await checkConnectivity();
      setStatus(updated.state);
      setPortalUrl(updated.portalUrl);
      syncPortalBaseUrl(updated.portalBaseUrl ?? logoutResult.portalBaseUrl);
      setLastCheckedAt(Date.now());
    } finally {
      setIsLoggingOut(false);
      inFlightRef.current = false;
    }
  }, [portalUrl, storedPortalBaseUrl, portalBaseUrl, syncPortalBaseUrl]);

  return (
    <Container>
      <LinearGradient
        colors={["#0A0A0A", "#000000", "#0A0A0A"]}
        style={StyleSheet.absoluteFill}
      />
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.headerRow}>
          <Pressable
            onPress={() => router.back()}
            style={[
              styles.backIcon,
              { backgroundColor: theme.backgroundSecondary },
            ]}
            hitSlop={8}
          >
            <Ionicons name="arrow-back" size={18} color={theme.text} />
          </Pressable>
          <View style={styles.headerText}>
            <View style={styles.titleRow}>
              <Text style={[styles.headerTitle, { color: theme.text }]}>
                WiFix
              </Text>
              <View
                style={[
                  styles.betaBadge,
                  { backgroundColor: Colors.status.warning },
                ]}
              >
                <Text style={styles.betaText}>BETA</Text>
              </View>
            </View>
            <Text
              style={[styles.headerSubtitle, { color: theme.textSecondary }]}
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
        </View>

        <View
          style={[styles.statusCard, { borderColor: statusMeta.color + "55" }]}
        >
          <View style={styles.statusRow}>
            <View style={styles.statusLeft}>
              <Ionicons
                name={statusMeta.icon}
                size={22}
                color={statusMeta.color}
              />
              <View>
                <Text style={[styles.statusLabel, { color: theme.text }]}>
                  {statusMeta.label}
                </Text>
                <Text
                  style={[styles.statusDetail, { color: theme.textSecondary }]}
                >
                  {statusMeta.detail}
                </Text>
              </View>
            </View>
            <Text style={[styles.statusTime, { color: theme.textSecondary }]}>
              Last check: {formatLastCheck(lastCheckedAt)}
            </Text>
          </View>

          <View style={styles.divider} />

          <View style={styles.infoRow}>
            <Text style={[styles.infoLabel, { color: theme.textSecondary }]}>
              Captive portal URL
            </Text>
            <Text
              style={[styles.infoValue, { color: theme.text }]}
              numberOfLines={2}
            >
              {portalDisplayUrl}
            </Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={[styles.infoLabel, { color: theme.textSecondary }]}>
              Portal base
            </Text>
            <Text
              style={[styles.infoValue, { color: theme.text }]}
              numberOfLines={1}
            >
              {baseDisplayUrl}
            </Text>
          </View>
          {message && (
            <View style={styles.infoRow}>
              <Text style={[styles.infoLabel, { color: theme.textSecondary }]}>
                Status
              </Text>
              <Text
                style={[styles.infoValue, { color: theme.text }]}
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
            disabled={isBusy}
          />
          <Button
            title="Check Status"
            onPress={() => runConnectivityCheck(false)}
            variant="secondary"
            disabled={isBusy}
          />
          <Button
            title={isLoggingOut ? "Logging out..." : "Logout Internet"}
            onPress={handleLogoutInternet}
            variant="danger"
            loading={isLoggingOut}
            disabled={isBusy}
          />
        </View>

        <View style={styles.footer}>
          <Text style={[styles.footerText, { color: theme.textSecondary }]}>
            Keep WiFix enabled for automatic reconnects
          </Text>
          <ExternalLink href="https://wifix.iiitk.in/" style={styles.linkRow}>
            <Text style={[styles.linkText, { color: theme.textSecondary }]}>
              wifix.iiitk.in
            </Text>
          </ExternalLink>
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
    gap: Spacing.sm,
  },
  backIcon: {
    width: 36,
    height: 36,
    borderRadius: Radius.full,
    alignItems: "center",
    justifyContent: "center",
  },
  headerText: {
    flex: 1,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: "700",
    letterSpacing: 0.5,
  },
  betaBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  betaText: {
    fontSize: 10,
    fontWeight: "700",
    color: Colors.black,
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
  linkRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
  },
  footerText: {
    fontSize: 11,
  },
  linkText: {
    fontSize: 12,
    textDecorationLine: "underline",
  },
});
