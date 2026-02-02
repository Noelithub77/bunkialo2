import { syncWifixBackgroundTask } from "@/background/wifix-background";
import { ExternalLink } from "@/components/shared/external-link";
import { Container } from "@/components/ui/container";
import { Input } from "@/components/ui/input";
import { WifixLogModal } from "@/components/wifix";
import { Colors, Radius, Spacing } from "@/constants/theme";
import {
  DEFAULT_MANUAL_PORTAL_URL,
  WIFIX_PORTAL_PRESETS,
} from "@/constants/wifix";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { getCredentials } from "@/services/auth";
import {
  checkConnectivity,
  getDefaultPortalBaseUrl,
  getPortalBaseUrl,
  loginToCaptivePortal,
  logoutFromCaptivePortal,
  normalizePortalUrlInput,
  resolvePortalSelection,
} from "@/services/wifix";
import { useWifixStore } from "@/stores/wifix-store";
import type { WifixConnectionState, WifixPortalSource } from "@/types";
import { Ionicons } from "@expo/vector-icons";
import NetInfo from "@react-native-community/netinfo";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import * as Linking from "expo-linking";
import { router } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Modal,
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
    manualPortalUrl,
    portalSource,
    setAutoReconnectEnabled,
    setPortalBaseUrl,
    setManualPortalUrl,
    setPortalSource,
  } = useWifixStore();

  const [now, setNow] = useState(() => new Date());
  const [status, setStatus] = useState<WifixConnectionState>("idle");
  const [portalUrl, setPortalUrl] = useState<string | null>(null);
  const [portalBaseUrl, setPortalBaseUrlLocal] = useState<string | null>(
    storedPortalBaseUrl,
  );
  const [manualInput, setManualInput] = useState<string>(
    manualPortalUrl ?? DEFAULT_MANUAL_PORTAL_URL,
  );
  const [manualError, setManualError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [showMobileDataWarning, setShowMobileDataWarning] = useState(false);
  const [showConfigModal, setShowConfigModal] = useState(false);
  const [showLogModal, setShowLogModal] = useState(false);
  const inFlightRef = useRef(false);
  const lastAttemptRef = useRef(0);

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (!manualPortalUrl) {
      if (manualInput !== DEFAULT_MANUAL_PORTAL_URL) {
        setManualInput(DEFAULT_MANUAL_PORTAL_URL);
      }
      return;
    }
    if (manualPortalUrl !== manualInput) {
      setManualInput(manualPortalUrl);
    }
  }, [manualPortalUrl, manualInput]);

  const statusMeta = useMemo(() => getStatusMeta(status), [status]);
  const normalizedManualPreview = useMemo(
    () => normalizePortalUrlInput(manualInput),
    [manualInput],
  );
  const resolvedSelection = useMemo(
    () =>
      resolvePortalSelection({
        detectedPortalUrl: portalUrl,
        detectedPortalBaseUrl: getPortalBaseUrl(portalUrl),
        manualPortalUrl,
        portalSource,
      }),
    [manualPortalUrl, portalSource, portalUrl],
  );
  const selectedPortalUrl = resolvedSelection.portalUrl;
  const selectedPortalBaseUrl =
    resolvedSelection.portalBaseUrl ??
    storedPortalBaseUrl ??
    getDefaultPortalBaseUrl();
  const effectivePortalSource = resolvedSelection.source;

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

  const resolveSelectionFor = useCallback(
    (detectedUrl: string | null, detectedBaseUrl: string | null) =>
      resolvePortalSelection({
        detectedPortalUrl: detectedUrl,
        detectedPortalBaseUrl: detectedBaseUrl,
        manualPortalUrl,
        portalSource,
      }),
    [manualPortalUrl, portalSource],
  );

  const handleApplyManualUrl = useCallback(() => {
    const normalized = normalizePortalUrlInput(manualInput);
    if (!normalized) {
      setManualError("Enter a valid URL or IP address.");
      return;
    }
    setManualError(null);
    setManualInput(normalized);
    setManualPortalUrl(normalized);
    setPortalSource("manual");
    syncPortalBaseUrl(getPortalBaseUrl(normalized));
  }, [manualInput, setManualPortalUrl, setPortalSource, syncPortalBaseUrl]);

  const handlePresetSelect = useCallback(
    (presetUrl: string) => {
      const normalized = normalizePortalUrlInput(presetUrl) ?? presetUrl;
      setManualError(null);
      setManualInput(normalized);
      setManualPortalUrl(normalized);
      setPortalSource("manual");
      syncPortalBaseUrl(getPortalBaseUrl(normalized));
    },
    [setManualPortalUrl, setPortalSource, syncPortalBaseUrl],
  );

  const handleSelectPortalSource = useCallback(
    (source: WifixPortalSource) => {
      setPortalSource(source);
      if (source === "manual") {
        const fallbackManual =
          manualPortalUrl ??
          normalizePortalUrlInput(manualInput) ??
          DEFAULT_MANUAL_PORTAL_URL;
        if (!manualPortalUrl) {
          setManualPortalUrl(fallbackManual);
          setManualInput(fallbackManual);
        }
        syncPortalBaseUrl(getPortalBaseUrl(fallbackManual));
      }
    },
    [
      manualPortalUrl,
      manualInput,
      setManualPortalUrl,
      setPortalSource,
      syncPortalBaseUrl,
    ],
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
        const selection = resolveSelectionFor(
          result.portalUrl,
          result.portalBaseUrl,
        );
        syncPortalBaseUrl(selection.portalBaseUrl ?? result.portalBaseUrl);

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
            portalUrl: selection.portalUrl,
            portalBaseUrl:
              selection.portalBaseUrl ?? storedPortalBaseUrl ?? portalBaseUrl,
          });

          setMessage(loginResult.message);
          syncPortalBaseUrl(loginResult.portalBaseUrl);

          if (loginResult.success) {
            const updated = await checkConnectivity();
            setStatus(updated.state);
            setPortalUrl(updated.portalUrl);
            const updatedSelection = resolveSelectionFor(
              updated.portalUrl,
              updated.portalBaseUrl,
            );
            syncPortalBaseUrl(
              updatedSelection.portalBaseUrl ?? loginResult.portalBaseUrl,
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
    [
      portalBaseUrl,
      resolveSelectionFor,
      storedPortalBaseUrl,
      syncPortalBaseUrl,
    ],
  );

  useEffect(() => {
    runConnectivityCheck(false);
  }, [runConnectivityCheck]);

  // Background task handles auto reconnect; avoid polling on this screen.

  const portalDisplayUrl = selectedPortalUrl ?? "Not available";
  const baseDisplayUrl = selectedPortalBaseUrl;
  const isBusy = isConnecting || isLoggingOut;
  const selectedSourceLabel =
    portalSource === "auto" ? "Auto-detected" : "Manual";
  const effectiveSourceLabel =
    effectivePortalSource === "auto" ? "Auto-detected" : "Manual";

  const handleLogoutInternet = useCallback(async () => {
    if (inFlightRef.current) return;
    inFlightRef.current = true;
    setIsLoggingOut(true);
    setStatus("checking");
    setMessage(null);

    try {
      const selection = resolveSelectionFor(
        portalUrl,
        getPortalBaseUrl(portalUrl),
      );
      const logoutResult = await logoutFromCaptivePortal({
        portalUrl: selection.portalUrl,
        portalBaseUrl:
          selection.portalBaseUrl ?? storedPortalBaseUrl ?? portalBaseUrl,
      });
      setMessage(logoutResult.message);
      syncPortalBaseUrl(logoutResult.portalBaseUrl);

      const updated = await checkConnectivity();
      setStatus(updated.state);
      setPortalUrl(updated.portalUrl);
      const updatedSelection = resolveSelectionFor(
        updated.portalUrl,
        updated.portalBaseUrl,
      );
      syncPortalBaseUrl(
        updatedSelection.portalBaseUrl ?? logoutResult.portalBaseUrl,
      );
    } finally {
      setIsLoggingOut(false);
      inFlightRef.current = false;
    }
  }, [portalUrl, storedPortalBaseUrl, resolveSelectionFor, syncPortalBaseUrl]);

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
          <View style={styles.headerActions}>
            <Pressable
              onPress={() => setShowConfigModal(true)}
              style={[
                styles.configButton,
                { backgroundColor: theme.backgroundSecondary },
              ]}
              hitSlop={8}
            >
              <Ionicons name="settings-outline" size={18} color={theme.text} />
            </Pressable>
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
              Selected portal URL
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
              Selected source
            </Text>
            <Text style={[styles.infoValue, { color: theme.text }]}>
              {effectiveSourceLabel}
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

      <Modal
        visible={showConfigModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowConfigModal(false)}
      >
        <Pressable
          style={styles.modalBackdrop}
          onPress={() => setShowConfigModal(false)}
        />
        <View style={styles.modalSheetWrap}>
          <View style={[styles.modalSheet, { backgroundColor: theme.background }]}>
            <View style={styles.modalTopRow}>
              <Text style={[styles.modalTitle, { color: theme.text }]}>
                Portal
              </Text>
              <View style={styles.modalTopActions}>
                <Pressable
                  onPress={handleApplyManualUrl}
                  style={styles.modalIconButton}
                  hitSlop={8}
                >
                  <Ionicons
                    name="checkmark-circle"
                    size={22}
                    color={Colors.status.success}
                  />
                </Pressable>
                <Pressable
                  onPress={() => setShowConfigModal(false)}
                  style={styles.modalIconButton}
                  hitSlop={8}
                >
                  <Ionicons name="close" size={20} color={theme.text} />
                </Pressable>
              </View>
            </View>

            <View style={styles.modalRow}>
              <Text style={[styles.modalLabel, { color: theme.textSecondary }]}>
                Source
              </Text>
              <View style={styles.modalChips}>
                <Pressable
                  onPress={() => handleSelectPortalSource("auto")}
                  style={[
                    styles.chip,
                    portalSource === "auto" && styles.chipActive,
                  ]}
                >
                  <Text
                    style={[
                      styles.chipText,
                      {
                        color:
                          portalSource === "auto"
                            ? Colors.black
                            : theme.textSecondary,
                      },
                    ]}
                  >
                    Auto
                  </Text>
                </Pressable>
                <Pressable
                  onPress={() => handleSelectPortalSource("manual")}
                  style={[
                    styles.chip,
                    portalSource === "manual" && styles.chipActive,
                  ]}
                >
                  <Text
                    style={[
                      styles.chipText,
                      {
                        color:
                          portalSource === "manual"
                            ? Colors.black
                            : theme.textSecondary,
                      },
                    ]}
                  >
                    Manual
                  </Text>
                </Pressable>
              </View>
              <View style={styles.modalRowRight}>
                <Text style={[styles.modalValue, { color: theme.text }]}>
                  Using: {effectiveSourceLabel}
                </Text>
              </View>
            </View>

            {effectivePortalSource !== portalSource && (
              <Text style={[styles.modalHint, { color: theme.textSecondary }]}>
                Selected source unavailable; using {effectiveSourceLabel}.
              </Text>
            )}

            <View style={styles.modalRow}>
              <Text style={[styles.modalLabel, { color: theme.textSecondary }]}>
                Preset
              </Text>
              <View style={styles.modalChips}>
                {WIFIX_PORTAL_PRESETS.map((preset) => {
                  const isActive = manualPortalUrl === preset.url;
                  return (
                    <Pressable
                      key={preset.id}
                      onPress={() => handlePresetSelect(preset.url)}
                      style={[styles.chip, isActive && styles.chipActive]}
                    >
                      <Text
                        style={[
                          styles.chipText,
                          {
                            color: isActive
                              ? Colors.black
                              : theme.textSecondary,
                          },
                        ]}
                      >
                        {preset.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>

            <Input
              label="Manual URL or IP"
              value={manualInput}
              onChangeText={(value) => {
                setManualInput(value);
                if (manualError) setManualError(null);
              }}
              autoCapitalize="none"
              autoCorrect={false}
              placeholder="172.16.222.1 or http://..."
              error={manualError ?? undefined}
            />
            <Text style={[styles.helperText, { color: theme.textSecondary }]}>
              Auto-adds http://, :1000 and /keepalive.
            </Text>
            {normalizedManualPreview &&
              normalizedManualPreview !== manualInput && (
                <Text style={[styles.normalizedText, { color: theme.text }]}>
                  Normalized: {normalizedManualPreview}
                </Text>
              )}

            <View style={styles.modalFooterRow}>
              <View style={styles.modalFooterInfo}>
                <Text style={[styles.modalLabel, { color: theme.textSecondary }]}>
                  Active
                </Text>
                <Text style={[styles.modalValue, { color: theme.text }]}>
                  {portalDisplayUrl}
                </Text>
              </View>
              <Pressable
                onPress={handleApplyManualUrl}
                style={({ pressed }) => [
                  styles.manualButton,
                  pressed && styles.manualButtonPressed,
                ]}
              >
                <Text style={styles.manualButtonText}>Apply</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
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
  headerActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
  },
  backIcon: {
    width: 36,
    height: 36,
    borderRadius: Radius.full,
    alignItems: "center",
    justifyContent: "center",
  },
  configButton: {
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
  helperText: {
    fontSize: 12,
  },
  normalizedText: {
    fontSize: 12,
    fontWeight: "500",
  },
  manualButton: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.md,
    backgroundColor: Colors.status.info,
  },
  manualButtonPressed: {
    opacity: 0.7,
  },
  manualButtonText: {
    fontSize: 14,
    fontWeight: "600",
    color: Colors.black,
  },
  modalBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0, 0, 0, 0.55)",
  },
  modalSheetWrap: {
    flex: 1,
    justifyContent: "flex-end",
    padding: Spacing.lg,
  },
  modalSheet: {
    borderRadius: Radius.lg,
    padding: Spacing.lg,
    borderWidth: 1,
    borderColor: Colors.gray[800],
    gap: Spacing.md,
  },
  modalTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  modalTopActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: "700",
    letterSpacing: 0.4,
  },
  modalIconButton: {
    width: 32,
    height: 32,
    alignItems: "center",
    justifyContent: "center",
  },
  modalRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
  },
  modalRowRight: {
    marginLeft: "auto",
  },
  modalLabel: {
    fontSize: 11,
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  modalValue: {
    fontSize: 12,
  },
  modalHint: {
    fontSize: 12,
  },
  modalChips: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.xs,
  },
  chip: {
    paddingHorizontal: Spacing.md,
    paddingVertical: 6,
    borderRadius: Radius.full,
    borderWidth: 1,
    borderColor: Colors.gray[700],
  },
  chipActive: {
    backgroundColor: Colors.status.warning,
    borderColor: Colors.status.warning,
  },
  chipText: {
    fontSize: 11,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  modalFooterRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: Spacing.sm,
  },
  modalFooterInfo: {
    flex: 1,
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
