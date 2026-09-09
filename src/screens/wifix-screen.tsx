import { syncWifixBackgroundTask } from "@/background/wifix-background";
import { ExternalLink } from "@/components/shared/external-link";
import { Container } from "@/components/ui/container";
import { Input } from "@/components/ui/input";
import { WifixLogModal } from "@/components/wifix";
import { Toast } from "@/components/shared/ui/molecules/toast";
import { Colors, Radius } from "@/constants/theme";
import {
  DEFAULT_MANUAL_PORTAL_URL,
  WIFIX_PORTAL_PRESETS,
} from "@/constants/wifix";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { getCredentials } from "@/services/auth/lms-auth";
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
import type {
  WifixConnectionState,
  WifixPortalSource,
} from "@/types";
import { wifixLogger } from "@/utils/wifix-logger";
import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Pressable,
  Switch,
  Text,
  View,
  Platform,
} from "react-native";

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
  const isWeb = Platform.OS === "web";
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

  const [status, setStatus] = useState<WifixConnectionState>("idle");
  const [campusPortalAvailable, setCampusPortalAvailable] = useState(false);
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
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [showConfigModal, setShowConfigModal] = useState(false);
  const [showLogModal, setShowLogModal] = useState(false);
  const inFlightRef = useRef(false);

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
      if (inFlightRef.current) return;
      inFlightRef.current = true;
      if (shouldLogin) {
        setIsLoggingIn(true);
      }
      setIsConnecting(true);
      setStatus("checking");
      setMessage(null);
      try {
        const result = await checkConnectivity();
        setStatus(result.state);
        setPortalUrl(result.portalUrl);
        setCampusPortalAvailable(result.campusPortalAvailable);
        const selection = resolveSelectionFor(
          result.portalUrl,
          result.portalBaseUrl,
        );
        syncPortalBaseUrl(selection.portalBaseUrl ?? result.portalBaseUrl);

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
            setCampusPortalAvailable(updated.campusPortalAvailable);
            const updatedSelection = resolveSelectionFor(
              updated.portalUrl,
              updated.portalBaseUrl,
            );
            syncPortalBaseUrl(
              updatedSelection.portalBaseUrl ?? loginResult.portalBaseUrl,
            );
            if (updated.state === "online") {
              Toast.show("Logged in to campus WiFi", {
                type: "success",
                position: "top",
              });
            }
          }
        } else if (shouldLogin && result.state === "offline") {
          setMessage("No captive portal detected.");
        }
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : "WiFix request failed";
        setStatus("error");
        setMessage(errorMessage);
        wifixLogger.error(`WiFix screen error: ${errorMessage}`);
      } finally {
        setIsConnecting(false);
        if (shouldLogin) {
          setIsLoggingIn(false);
        }
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
  const isBusy = isConnecting || isLoggingOut;
  const effectiveSourceLabel =
    effectivePortalSource === "auto" ? "Auto-detected" : "Manual";
  const isCampusPortal = selectedPortalBaseUrl.includes(
    "auth.iiitkottayam.ac.in",
  );
  const canShowLogout =
    isWeb || (campusPortalAvailable && isCampusPortal && status === "online");
  const canShowLogin =
    !isWeb && campusPortalAvailable && status === "captive";
  const showLoginAction = !canShowLogout && (canShowLogin || isLoggingIn);
  const compactStatus =
    status === "checking"
      ? "Checking connection..."
      : isWeb
        ? status === "online"
          ? "Connected"
          : "Connection status unavailable"
        : campusPortalAvailable && status === "online"
          ? "Connected"
          : campusPortalAvailable && status === "captive"
            ? "Campus WiFi"
              : status === "captive"
              ? "Captive portal detected"
              : "Not connected";

  const statusSummary = (
    <View>
      <View className="flex-row items-center gap-2">
        <Ionicons name={statusMeta.icon} size={16} color={statusMeta.color} />
        <Text className="text-sm" style={{ color: theme.textSecondary }}>
          {compactStatus}
        </Text>
      </View>
      {message && message !== compactStatus && (
        <Text
          className="mt-1 text-xs"
          style={{ color: theme.textSecondary }}
          numberOfLines={1}
        >
          {message}
        </Text>
      )}
    </View>
  );

  const handleLogoutInternet = useCallback(async () => {
    if (inFlightRef.current) return;
    inFlightRef.current = true;
    setIsLoggingOut(true);
    setStatus("checking");
    setMessage(null);

    try {
      const verification = isWeb ? null : await checkConnectivity();
      if (verification) {
        setStatus(verification.state);
        setPortalUrl(verification.portalUrl);
        setCampusPortalAvailable(verification.campusPortalAvailable);
      }
      const selection = resolveSelectionFor(
        verification?.portalUrl ?? portalUrl,
        verification?.portalBaseUrl ?? getPortalBaseUrl(portalUrl),
      );
      const logoutBaseUrl =
        selection.portalBaseUrl ?? storedPortalBaseUrl ?? portalBaseUrl;
      if (
        !isWeb &&
        (!logoutBaseUrl ||
          !verification?.campusPortalAvailable ||
          verification.state !== "online" ||
          !logoutBaseUrl.includes("auth.iiitkottayam.ac.in"))
      ) {
        setStatus("offline");
        setMessage("Logout unavailable on this WiFi");
        return;
      }
      const logoutResult = await logoutFromCaptivePortal({
        portalUrl: selection.portalUrl,
        portalBaseUrl: logoutBaseUrl,
      });
      setMessage(logoutResult.message);
      syncPortalBaseUrl(logoutResult.portalBaseUrl);

      const updated = await checkConnectivity();
      setStatus(updated.state);
      setPortalUrl(updated.portalUrl);
      setCampusPortalAvailable(updated.campusPortalAvailable);
      const updatedSelection = resolveSelectionFor(
        updated.portalUrl,
        updated.portalBaseUrl,
      );
      syncPortalBaseUrl(
        updatedSelection.portalBaseUrl ?? logoutResult.portalBaseUrl,
      );
      if (!isWeb && logoutResult.success) {
        setStatus("captive");
        setCampusPortalAvailable(true);
        setPortalUrl(updated.portalUrl ?? selection.portalUrl);
        setMessage(logoutResult.message);
        wifixLogger.info(
          "Logout succeeded; showing the campus WiFi login action while portal state refreshes",
        );
      }
    } finally {
      setIsLoggingOut(false);
      inFlightRef.current = false;
    }
  }, [
    isWeb,
    portalBaseUrl,
    portalUrl,
    resolveSelectionFor,
    storedPortalBaseUrl,
    syncPortalBaseUrl,
  ]);

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
      <KeyboardAwareScrollView
        contentContainerClassName="px-6 pb-12 pt-6"
        keyboardShouldPersistTaps="handled"
        bottomOffset={24}
      >
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

        <View className="mb-7 items-center">
          {(canShowLogout || isLoggingOut) && (
            <View className="mb-4">{statusSummary}</View>
          )}
          {(canShowLogout || isLoggingOut) && (
            <Pressable
              onPress={handleLogoutInternet}
              disabled={isBusy}
              className="mt-4 h-14 w-full flex-row items-center justify-center gap-2"
              style={({ pressed }) => ({
                backgroundColor: Colors.status.danger,
                borderColor: Colors.status.danger,
                borderRadius: Radius.md,
                borderWidth: 1,
                opacity: isBusy ? 0.5 : 1,
                transform: pressed ? [{ scale: 0.98 }] : undefined,
              })}
            >
              {isLoggingOut ? (
                <ActivityIndicator size="small" color={Colors.white} />
              ) : (
                <Ionicons name="log-out" size={22} color={Colors.white} />
              )}
              <Text className="text-base font-semibold" style={{ color: Colors.white }}>
                Logout
              </Text>
            </Pressable>
          )}
          {showLoginAction && (
            <Pressable
              onPress={() => runConnectivityCheck(true)}
              disabled={isBusy}
              className="mt-4 h-14 w-full flex-row items-center justify-center gap-2"
              style={({ pressed }) => ({
                backgroundColor: Colors.status.warning,
                borderColor: Colors.status.warning,
                borderRadius: Radius.md,
                borderWidth: 1,
                opacity: isBusy ? 0.5 : 1,
                transform: pressed ? [{ scale: 0.98 }] : undefined,
              })}
            >
              {isLoggingIn ? (
                <ActivityIndicator size="small" color={Colors.black} />
              ) : (
                <>
                  <Ionicons name="log-in" size={22} color={Colors.black} />
                  <Text className="text-base font-semibold" style={{ color: Colors.black }}>
                    Login
                  </Text>
                </>
              )}
            </Pressable>
          )}
          {!canShowLogout && !isLoggingOut && (
            <View className={showLoginAction ? "mt-4" : ""}>
              {statusSummary}
            </View>
          )}
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
      </KeyboardAwareScrollView>

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
