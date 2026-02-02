import { syncWifixBackgroundTask } from "@/background/wifix-background";
import { ExternalLink } from "@/components/shared/external-link";
import { Container } from "@/components/ui/container";
import { WifixLogModal } from "@/components/wifix";
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
import NetInfo from "@react-native-community/netinfo";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import * as Linking from "expo-linking";
import { router } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
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
  const [isConnecting, setIsConnecting] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [showMobileDataWarning, setShowMobileDataWarning] = useState(false);
  const [showLogModal, setShowLogModal] = useState(false);
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

        // Check if mobile data might interfere
        if (result.state === "captive") {
          const netInfo = await NetInfo.fetch();
          if (netInfo.details?.isConnectionExpensive === true) {
            setShowMobileDataWarning(true);
            setMessage("Mobile data is active. Please disable it to login.");
            return;
          }
        }

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
          <Pressable onPress={() => setShowLogModal(true)} hitSlop={20}>
            <Image
              source={require("../assets/icons/wifix.png")}
              style={styles.logo}
              contentFit="contain"
            />
          </Pressable>
          {/* <Text style={[styles.logoHint, { color: theme.textSecondary }]}>
            Tap logo to view logs
          </Text> */}
        </View>

        {showMobileDataWarning && (
          <View
            style={[styles.warningCard, { borderColor: Colors.status.warning }]}
          >
            <Ionicons name="warning" size={24} color={Colors.status.warning} />
            <View style={styles.warningContent}>
              <Text style={[styles.warningTitle, { color: theme.text }]}>
                Mobile Data Detected
              </Text>
              <Text
                style={[styles.warningText, { color: theme.textSecondary }]}
              >
                Mobile data may prevent WiFi login. Please disable it in
                settings and retry.
              </Text>
              <View style={styles.warningActions}>
                <Pressable
                  onPress={() => Linking.openSettings()}
                  style={[
                    styles.warningButton,
                    { backgroundColor: theme.backgroundSecondary },
                  ]}
                >
                  <Text
                    style={[styles.warningButtonText, { color: theme.text }]}
                  >
                    Open Settings
                  </Text>
                </Pressable>
                <Pressable
                  onPress={() => {
                    setShowMobileDataWarning(false);
                    runConnectivityCheck(true);
                  }}
                  style={[styles.warningButton, styles.warningButtonPrimary]}
                >
                  <Text style={styles.warningButtonTextPrimary}>
                    I&apos;ve Disabled It
                  </Text>
                </Pressable>
              </View>
            </View>
          </View>
        )}

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
          </View>

          <View style={styles.divider} />

          <View style={styles.infoRow}>
            <Text style={[styles.infoLabel, { color: theme.textSecondary }]}>
              Captive portal URL
            </Text>
            <View style={styles.infoRowRight}>
              <Text
                style={[styles.infoValue, { color: theme.text }]}
                numberOfLines={2}
              >
                {portalDisplayUrl}
              </Text>
              <Pressable
                onPress={() => runConnectivityCheck(false)}
                disabled={isBusy}
                style={styles.refreshIconButton}
                hitSlop={8}
              >
                {isConnecting ? (
                  <ActivityIndicator size="small" color={theme.textSecondary} />
                ) : (
                  <Ionicons
                    name="refresh"
                    size={16}
                    color={isBusy ? Colors.gray[500] : theme.textSecondary}
                  />
                )}
              </Pressable>
            </View>
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
          <View style={styles.iconActions}>
            <Pressable
              onPress={() => runConnectivityCheck(true)}
              disabled={isBusy}
              style={({ pressed }) => [
                styles.iconButton,
                styles.iconButtonLarge,
                { backgroundColor: theme.backgroundSecondary },
                isBusy && styles.iconButtonDisabled,
                pressed && styles.iconButtonPressed,
              ]}
              hitSlop={16}
            >
              {isConnecting ? (
                <ActivityIndicator size="small" color={theme.text} />
              ) : (
                <Ionicons name="refresh" size={28} color={theme.text} />
              )}
            </Pressable>
            <Pressable
              onPress={handleLogoutInternet}
              disabled={isBusy}
              style={({ pressed }) => [
                styles.iconButton,
                styles.iconButtonLarge,
                { backgroundColor: Colors.status.danger + "22" },
                isBusy && styles.iconButtonDisabled,
                pressed && styles.iconButtonPressed,
              ]}
              hitSlop={16}
            >
              {isLoggingOut ? (
                <ActivityIndicator size="small" color={Colors.status.danger} />
              ) : (
                <Ionicons
                  name="log-out"
                  size={28}
                  color={Colors.status.danger}
                />
              )}
            </Pressable>
          </View>
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

      <WifixLogModal
        visible={showLogModal}
        onClose={() => setShowLogModal(false)}
      />
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
    opacity: 0.9,
  },
  logoHint: {
    fontSize: 12,
    opacity: 0.6,
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
  infoRowRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    flex: 1,
  },
  infoLabel: {
    fontSize: 11,
    textTransform: "uppercase",
    letterSpacing: 1,
    marginBottom: 4,
  },
  infoValue: {
    fontSize: 14,
    flex: 1,
  },
  actions: {
    gap: Spacing.sm,
    marginBottom: Spacing.lg,
  },
  iconActions: {
    flexDirection: "row",
    justifyContent: "center",
    gap: Spacing.md,
    marginBottom: Spacing.sm,
  },
  iconButton: {
    borderRadius: Radius.full,
    alignItems: "center",
    justifyContent: "center",
  },
  iconButtonLarge: {
    width: 64,
    height: 64,
  },
  iconButtonDisabled: {
    opacity: 0.5,
  },
  iconButtonPressed: {
    transform: [{ scale: 0.9 }],
  },
  refreshIconButton: {
    width: 32,
    height: 32,
    borderRadius: Radius.full,
    alignItems: "center",
    justifyContent: "center",
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
  warningCard: {
    flexDirection: "row",
    padding: Spacing.md,
    borderRadius: Radius.md,
    borderWidth: 1,
    backgroundColor: "rgba(255, 193, 7, 0.1)",
    marginBottom: Spacing.md,
    gap: Spacing.md,
  },
  warningContent: {
    flex: 1,
  },
  warningTitle: {
    fontSize: 16,
    fontWeight: "600",
    marginBottom: Spacing.xs,
  },
  warningText: {
    fontSize: 14,
    marginBottom: Spacing.sm,
  },
  warningActions: {
    flexDirection: "row",
    gap: Spacing.sm,
  },
  warningButton: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: Radius.sm,
  },
  warningButtonPrimary: {
    backgroundColor: Colors.status.warning,
  },
  warningButtonText: {
    fontSize: 14,
  },
  warningButtonTextPrimary: {
    fontSize: 14,
    color: Colors.black,
    fontWeight: "500",
  },
});
