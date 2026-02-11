import { syncWifixBackgroundTask } from "@/background/wifix-background";
import { ExternalLink } from "@/components/shared/external-link";
import { Container } from "@/components/ui/container";
import { Input } from "@/components/ui/input";
import { WifixLogModal } from "@/components/wifix";
import { Colors, Radius } from "@/constants/theme";
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
        style={{
          position: "absolute",
          top: 0,
          right: 0,
          bottom: 0,
          left: 0,
        }}
      />
      <ScrollView contentContainerClassName="px-6 pb-12 pt-6">
        <View className="mb-6 flex-row items-center justify-between gap-3">
          <Pressable
            onPress={() => router.back()}
            className="h-10 w-10 items-center justify-center"
            style={{
              backgroundColor: theme.backgroundSecondary,
              borderRadius: Radius.full,
            }}
            hitSlop={8}
          >
            <Ionicons name="arrow-back" size={20} color={theme.text} />
          </Pressable>
          <View className="flex-1">
            <View className="flex-row items-center gap-2">
              <Text
                className="text-[26px] font-bold tracking-[0.6px]"
                style={{ color: theme.text }}
              >
                WiFix
              </Text>
              <View
                className="px-2.5 py-1"
                style={{
                  backgroundColor: Colors.status.warning,
                  borderRadius: 6,
                }}
              >
                <Text
                  className="text-[11px] font-bold tracking-[0.6px]"
                  style={{ color: Colors.black }}
                >
                  BETA
                </Text>
              </View>
            </View>
            <Text className="mt-1 text-[13px]" style={{ color: theme.textSecondary }}>
              WiFixing {formatTimestamp(now)}
            </Text>
          </View>
          <View className="flex-row items-center gap-3">
            <Pressable
              onPress={() => setShowConfigModal(true)}
              className="h-10 w-10 items-center justify-center"
              style={{
                backgroundColor: theme.backgroundSecondary,
                borderRadius: Radius.full,
              }}
              hitSlop={8}
            >
              <Ionicons name="settings-outline" size={20} color={theme.text} />
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

        <View className="mb-8 items-center">
          <Pressable onPress={() => setShowLogModal(true)} hitSlop={20}>
            <Image
              source={require("../assets/icons/wifix.png")}
              style={{ width: 144, height: 144, opacity: 0.95 }}
              contentFit="contain"
            />
          </Pressable>
        </View>

        {showMobileDataWarning && (
          <View
            className="mb-4 flex-row gap-4 p-4"
            style={{
              borderRadius: Radius.md,
              borderWidth: 1,
              borderColor: Colors.status.warning,
              backgroundColor: "rgba(255, 193, 7, 0.1)",
            }}
          >
            <Ionicons name="warning" size={24} color={Colors.status.warning} />
            <View className="flex-1">
              <Text
                className="mb-1 text-base font-semibold"
                style={{ color: theme.text }}
              >
                Mobile Data Detected
              </Text>
              <Text className="mb-2 text-sm" style={{ color: theme.textSecondary }}>
                Mobile data may prevent WiFi login. Please disable it in settings
                and retry.
              </Text>
              <View className="flex-row gap-2">
                <Pressable
                  onPress={() => Linking.openSettings()}
                  className="rounded-md px-4 py-1.5"
                  style={{ backgroundColor: theme.backgroundSecondary }}
                >
                  <Text className="text-sm" style={{ color: theme.text }}>
                    Open Settings
                  </Text>
                </Pressable>
                <Pressable
                  onPress={() => {
                    setShowMobileDataWarning(false);
                    runConnectivityCheck(true);
                  }}
                  className="rounded-md px-4 py-1.5"
                  style={{ backgroundColor: Colors.status.warning }}
                >
                  <Text
                    className="text-sm font-medium"
                    style={{ color: Colors.black }}
                  >
                    I&apos;ve Disabled It
                  </Text>
                </Pressable>
              </View>
            </View>
          </View>
        )}

        <View
          className="mb-6 rounded-2xl border p-6"
          style={{
            borderColor: `${statusMeta.color}55`,
            backgroundColor: "rgba(8, 8, 8, 0.9)",
          }}
        >
          <View className="gap-4">
            <View className="flex-row items-center gap-4">
              <Ionicons name={statusMeta.icon} size={24} color={statusMeta.color} />
              <View>
                <Text className="text-xl font-semibold" style={{ color: theme.text }}>
                  {statusMeta.label}
                </Text>
                <Text className="mt-[3px] text-[13px]" style={{ color: theme.textSecondary }}>
                  {statusMeta.detail}
                </Text>
              </View>
            </View>
          </View>

          <View className="my-5 h-px" style={{ backgroundColor: Colors.gray[800] }} />

          <View className="mb-3">
            <Text
              className="mb-1 text-xs uppercase tracking-[1.2px]"
              style={{ color: theme.textSecondary }}
            >
              Selected portal URL
            </Text>
            <View className="flex-1 flex-row items-center gap-2">
              <Text className="flex-1 text-[15px]" style={{ color: theme.text }} numberOfLines={2}>
                {portalDisplayUrl}
              </Text>
              <Pressable
                onPress={() => runConnectivityCheck(false)}
                disabled={isBusy}
                className="h-9 w-9 items-center justify-center"
                style={{ borderRadius: Radius.full }}
                hitSlop={8}
              >
                {isConnecting ? (
                  <ActivityIndicator size="small" color={theme.textSecondary} />
                ) : (
                  <Ionicons
                    name="refresh"
                    size={18}
                    color={isBusy ? Colors.gray[500] : theme.textSecondary}
                  />
                )}
              </Pressable>
            </View>
          </View>
          <View className="mb-3">
            <Text
              className="mb-1 text-xs uppercase tracking-[1.2px]"
              style={{ color: theme.textSecondary }}
            >
              Selected source
            </Text>
            <Text className="text-[15px]" style={{ color: theme.text }}>
              {effectiveSourceLabel}
            </Text>
          </View>
          <View className="mb-3">
            <Text
              className="mb-1 text-xs uppercase tracking-[1.2px]"
              style={{ color: theme.textSecondary }}
            >
              Portal base
            </Text>
            <Text
              className="text-[15px]"
              style={{ color: theme.text }}
              numberOfLines={1}
            >
              {baseDisplayUrl}
            </Text>
          </View>
          {message && (
            <View className="mb-2">
              <Text
                className="mb-1 text-xs uppercase tracking-[1.2px]"
                style={{ color: theme.textSecondary }}
              >
                Status
              </Text>
              <Text
                className="text-[15px]"
                style={{ color: theme.text }}
                numberOfLines={2}
              >
                {message}
              </Text>
            </View>
          )}
        </View>

        <View className="mb-7 gap-2">
          <View className="mb-2 flex-row justify-center gap-5">
            <Pressable
              onPress={() => runConnectivityCheck(true)}
              disabled={isBusy}
              className="h-[72px] w-[72px] items-center justify-center"
              style={({ pressed }) => ({
                backgroundColor: theme.backgroundSecondary,
                borderRadius: Radius.full,
                opacity: isBusy ? 0.5 : 1,
                transform: pressed ? [{ scale: 0.9 }] : undefined,
              })}
              hitSlop={16}
            >
              {isConnecting ? (
                <ActivityIndicator size="small" color={theme.text} />
              ) : (
                <Ionicons name="refresh" size={30} color={theme.text} />
              )}
            </Pressable>
            <Pressable
              onPress={handleLogoutInternet}
              disabled={isBusy}
              className="h-[72px] w-[72px] items-center justify-center"
              style={({ pressed }) => ({
                backgroundColor: `${Colors.status.danger}22`,
                borderRadius: Radius.full,
                opacity: isBusy ? 0.5 : 1,
                transform: pressed ? [{ scale: 0.9 }] : undefined,
              })}
              hitSlop={16}
            >
              {isLoggingOut ? (
                <ActivityIndicator size="small" color={Colors.status.danger} />
              ) : (
                <Ionicons name="log-out" size={30} color={Colors.status.danger} />
              )}
            </Pressable>
          </View>
        </View>

        <View className="items-center gap-1">
          <Text className="text-xs" style={{ color: theme.textSecondary }}>
            Keep WiFix enabled for automatic reconnects
          </Text>
          <View className="flex-row items-center gap-1">
            <ExternalLink href="https://wifix.iiitk.in/">
              <Text className="text-[13px] underline" style={{ color: theme.textSecondary }}>
                wifix.iiitk.in
              </Text>
            </ExternalLink>
          </View>
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
          className="absolute inset-0"
          style={{ backgroundColor: "rgba(0, 0, 0, 0.55)" }}
          onPress={() => setShowConfigModal(false)}
        />
        <View className="flex-1 justify-end p-5">
          <View
            className="gap-4 rounded-2xl border p-5"
            style={{
              backgroundColor: theme.background,
              borderColor: Colors.gray[800],
            }}
          >
            <View className="flex-row items-center justify-between">
              <Text
                className="text-base font-bold tracking-[0.4px]"
                style={{ color: theme.text }}
              >
                Portal
              </Text>
              <View className="flex-row items-center gap-2">
                <Pressable
                  onPress={handleApplyManualUrl}
                  className="h-8 w-8 items-center justify-center"
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
                  className="h-8 w-8 items-center justify-center"
                  hitSlop={8}
                >
                  <Ionicons name="close" size={20} color={theme.text} />
                </Pressable>
              </View>
            </View>

            <View className="flex-row items-center gap-2">
              <Text
                className="text-[11px] uppercase tracking-[1px]"
                style={{ color: theme.textSecondary }}
              >
                Source
              </Text>
              <View className="flex-row flex-wrap gap-1.5">
                <Pressable
                  onPress={() => handleSelectPortalSource("auto")}
                  className="rounded-full border px-4 py-1.5"
                  style={
                    portalSource === "auto"
                      ? {
                          backgroundColor: Colors.status.warning,
                          borderColor: Colors.status.warning,
                        }
                      : { borderColor: Colors.gray[700] }
                  }
                >
                  <Text
                    className="text-[11px] font-bold uppercase tracking-[0.5px]"
                    style={{
                      color:
                        portalSource === "auto"
                          ? Colors.black
                          : theme.textSecondary,
                    }}
                  >
                    Auto
                  </Text>
                </Pressable>
                <Pressable
                  onPress={() => handleSelectPortalSource("manual")}
                  className="rounded-full border px-4 py-1.5"
                  style={
                    portalSource === "manual"
                      ? {
                          backgroundColor: Colors.status.warning,
                          borderColor: Colors.status.warning,
                        }
                      : { borderColor: Colors.gray[700] }
                  }
                >
                  <Text
                    className="text-[11px] font-bold uppercase tracking-[0.5px]"
                    style={{
                      color:
                        portalSource === "manual"
                          ? Colors.black
                          : theme.textSecondary,
                    }}
                  >
                    Manual
                  </Text>
                </Pressable>
              </View>
              <View className="ml-auto">
                <Text className="text-xs" style={{ color: theme.text }}>
                  Using: {effectiveSourceLabel}
                </Text>
              </View>
            </View>

            {effectivePortalSource !== portalSource && (
              <Text className="text-xs" style={{ color: theme.textSecondary }}>
                Selected source unavailable; using {effectiveSourceLabel}.
              </Text>
            )}

            <View className="flex-row items-center gap-2">
              <Text
                className="text-[11px] uppercase tracking-[1px]"
                style={{ color: theme.textSecondary }}
              >
                Preset
              </Text>
              <View className="flex-row flex-wrap gap-1.5">
                {WIFIX_PORTAL_PRESETS.map((preset) => {
                  const isActive = manualPortalUrl === preset.url;
                  return (
                    <Pressable
                      key={preset.id}
                      onPress={() => handlePresetSelect(preset.url)}
                      className="rounded-full border px-4 py-1.5"
                      style={
                        isActive
                          ? {
                              backgroundColor: Colors.status.warning,
                              borderColor: Colors.status.warning,
                            }
                          : { borderColor: Colors.gray[700] }
                      }
                    >
                      <Text
                        className="text-[11px] font-bold uppercase tracking-[0.5px]"
                        style={{
                          color: isActive ? Colors.black : theme.textSecondary,
                        }}
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
            <Text className="text-xs" style={{ color: theme.textSecondary }}>
              Auto-adds http://, :1000 and /keepalive.
            </Text>
            {normalizedManualPreview &&
              normalizedManualPreview !== manualInput && (
                <Text className="text-xs font-medium" style={{ color: theme.text }}>
                  Normalized: {normalizedManualPreview}
                </Text>
              )}

            <View className="flex-row items-center justify-between gap-2">
              <View className="flex-1">
                <Text
                  className="text-[11px] uppercase tracking-[1px]"
                  style={{ color: theme.textSecondary }}
                >
                  Active
                </Text>
                <Text className="text-xs" style={{ color: theme.text }}>
                  {portalDisplayUrl}
                </Text>
              </View>
              <Pressable
                onPress={handleApplyManualUrl}
                className="rounded-md px-4 py-2"
                style={({ pressed }) => ({
                  backgroundColor: Colors.status.info,
                  opacity: pressed ? 0.7 : 1,
                })}
              >
                <Text
                  className="text-sm font-semibold"
                  style={{ color: Colors.black }}
                >
                  Apply
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </Container>
  );
}
