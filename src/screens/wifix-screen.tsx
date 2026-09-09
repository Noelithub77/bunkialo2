import { ExternalLink } from "@/components/shared/external-link";
import { Container } from "@/components/ui/container";
import { WifixLogModal } from "@/components/wifix";
import { Toast } from "@/components/shared/ui/molecules/toast";
import { Colors, Radius } from "@/constants/theme";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { getCredentials } from "@/services/auth/lms-auth";
import {
  checkConnectivity,
  getDefaultPortalBaseUrl,
  getPortalBaseUrl,
  loginToCaptivePortal,
  logoutFromCaptivePortal,
  resolvePortalSelection,
} from "@/services/wifix";
import { useWifixStore } from "@/stores/wifix-store";
import type { WifixConnectionState } from "@/types";
import { wifixLogger } from "@/utils/wifix-logger";
import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
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
    portalBaseUrl: storedPortalBaseUrl,
    manualPortalUrl,
    portalSource,
    setPortalBaseUrl,
  } = useWifixStore();

  const [status, setStatus] = useState<WifixConnectionState>("idle");
  const [campusPortalAvailable, setCampusPortalAvailable] = useState(false);
  const [portalUrl, setPortalUrl] = useState<string | null>(null);
  const [portalBaseUrl, setPortalBaseUrlLocal] = useState<string | null>(
    storedPortalBaseUrl,
  );
  const [message, setMessage] = useState<string | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [showLogModal, setShowLogModal] = useState(false);
  const inFlightRef = useRef(false);

  const statusMeta = useMemo(() => getStatusMeta(status), [status]);
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
  const selectedPortalBaseUrl =
    resolvedSelection.portalBaseUrl ??
    storedPortalBaseUrl ??
    getDefaultPortalBaseUrl();

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
            setStatus("error");
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
          } else {
            setStatus("error");
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

  const isBusy = isConnecting || isLoggingOut;
  const isCampusPortal = selectedPortalBaseUrl.includes(
    "auth.iiitkottayam.ac.in",
  );
  const canShowLogout = isWeb || (isCampusPortal && status === "online");
  const canShowLogin =
    !isWeb && campusPortalAvailable && status === "captive";
  const showLoginAction = !canShowLogout && (canShowLogin || isLoggingIn);
  const showRetryAction =
    !isWeb &&
    !canShowLogout &&
    !showLoginAction &&
    (status === "error" || status === "offline");
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
      {(status === "error" || status === "offline") &&
        message &&
        message !== compactStatus && (
          <Text
            className="mt-1 text-xs"
            style={{ color: `${Colors.status.danger}B3` }}
            numberOfLines={2}
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
        contentContainerStyle={{ flexGrow: 1 }}
        keyboardShouldPersistTaps="handled"
        bottomOffset={24}
      >
        <View className="mb-6 flex-row items-center gap-3">
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
            <View>
              <Text
                className="text-[26px] font-bold tracking-[0.6px]"
                style={{ color: theme.text }}
              >
                WiFix
              </Text>
            </View>
          </View>
        </View>

        <View className="flex-1 justify-center">
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
            <View className="mb-4">{statusSummary}</View>
            {(canShowLogout || isLoggingOut) && (
              <Pressable
                onPress={handleLogoutInternet}
                disabled={isBusy}
                className="h-14 w-full flex-row items-center justify-center gap-2"
                style={{
                  backgroundColor: Colors.status.danger,
                  borderColor: Colors.status.danger,
                  borderRadius: Radius.md,
                  borderWidth: 1,
                  opacity: isBusy ? 0.5 : 1,
                }}
              >
                {isLoggingOut ? (
                  <ActivityIndicator size="small" color={Colors.black} />
                ) : (
                  <Ionicons name="log-out" size={22} color={Colors.black} />
                )}
                <Text className="text-base font-semibold" style={{ color: Colors.black }}>
                  Logout
                </Text>
              </Pressable>
            )}
            {showLoginAction && (
              <Pressable
                onPress={() => runConnectivityCheck(true)}
                disabled={isBusy}
                className="h-14 w-full flex-row items-center justify-center gap-2"
                style={{
                  backgroundColor: Colors.status.success,
                  borderColor: Colors.status.success,
                  borderRadius: Radius.md,
                  borderWidth: 1,
                  opacity: isBusy ? 0.5 : 1,
                }}
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
            {showRetryAction && (
              <Pressable
                onPress={() => runConnectivityCheck(true)}
                disabled={isBusy}
                className="h-14 w-full flex-row items-center justify-center gap-2"
                style={{
                  backgroundColor: Colors.status.warning,
                  borderColor: Colors.status.warning,
                  borderRadius: Radius.md,
                  borderWidth: 1,
                  opacity: isBusy ? 0.5 : 1,
                }}
              >
                {isLoggingIn ? (
                  <ActivityIndicator size="small" color={Colors.black} />
                ) : (
                  <>
                    <Ionicons name="refresh" size={22} color={Colors.black} />
                    <Text className="text-base font-semibold" style={{ color: Colors.black }}>
                      Retry
                    </Text>
                  </>
                )}
              </Pressable>
            )}
          </View>
        </View>

        <View className="mt-auto items-center gap-1">
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
    </Container>
  );
}
