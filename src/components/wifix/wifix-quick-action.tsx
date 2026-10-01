import { scheduleDeferredTask } from "@/utils/scheduling";
import { Toast } from "@/components/shared/ui/molecules/toast";
import { Colors } from "@/constants/theme";
import { getCredentials } from "@/services/auth/lms-auth";
import {
  checkConnectivity,
  getDefaultPortalBaseUrl,
  getPortalBaseUrl,
  isRecognizedCampusPortal,
  loginToCaptivePortal,
  logoutFromCaptivePortal,
  resolvePortalSelection,
  verifyPortalLogin,
} from "@/services/wifix";
import { useWifixStore } from "@/stores/wifix-store";
import type { WifixConnectionState, WifixConnectivityResult } from "@/types";
import { wifixLogger } from "@/utils/wifix-logger";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Platform,
  Pressable,
  Text,
  View,
} from "react-native";

interface WifixQuickActionProps {
  theme: typeof Colors.light;
}

type WifixAction = "startup" | "check" | "login" | "logout";
type WifixPhase = "checking" | "auto-login" | "login" | "verifying" | "logout" | null;

const getPhaseLabel = (phase: WifixPhase): string | null => {
  if (phase === "checking") return "Checking campus WiFi...";
  if (phase === "auto-login") return "Auto login in progress...";
  if (phase === "login") return "Logging in...";
  if (phase === "verifying") return "Verifying internet access...";
  if (phase === "logout") return "Logging out...";
  return null;
};

const getStatusLabel = (
  status: WifixConnectionState,
  campusPortalAvailable: boolean,
  message: string | null,
): string => {
  if (message === "WiFi turned off") return message;
  if (status === "error") return "WiFix could not connect";
  if (!campusPortalAvailable) return "Not in campus WiFi";
  if (status === "online") return "Connected to campus WiFi";
  if (status === "captive") return "Campus WiFi · Login required";
  return "Not connected";
};

const getStatusColor = (
  status: WifixConnectionState,
  campusPortalAvailable: boolean,
): string => {
  if (status === "error") return Colors.status.danger;
  if (!campusPortalAvailable) return Colors.gray[400];
  if (status === "online") return Colors.status.success;
  if (status === "captive") return Colors.status.warning;
  if (status === "offline") return Colors.status.danger;
  return Colors.status.info;
};

export function WifixQuickAction({ theme }: WifixQuickActionProps) {
  const isWeb = Platform.OS === "web";
  const {
    autoReconnectEnabled,
    portalBaseUrl: storedPortalBaseUrl,
    manualPortalUrl,
    portalSource,
    setPortalBaseUrl,
  } = useWifixStore();
  const [settingsReady, setSettingsReady] = useState(
    useWifixStore.persist.hasHydrated(),
  );
  const [status, setStatus] = useState<WifixConnectionState>("idle");
  const [campusPortalAvailable, setCampusPortalAvailable] = useState(false);
  const [portalUrl, setPortalUrl] = useState<string | null>(null);
  const [phase, setPhase] = useState<WifixPhase>("checking");
  const [message, setMessage] = useState<string | null>(null);
  const inFlightRef = useRef(false);

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
      if (nextBaseUrl && nextBaseUrl !== useWifixStore.getState().portalBaseUrl) {
        setPortalBaseUrl(nextBaseUrl);
      }
    },
    [setPortalBaseUrl],
  );

  const applyConnectivity = useCallback((result: WifixConnectivityResult) => {
    setStatus(result.state);
    setPortalUrl(result.portalUrl);
    setCampusPortalAvailable(result.campusPortalAvailable);
  }, []);

  const runAction = useCallback(
    async (action: WifixAction) => {
      if (isWeb || inFlightRef.current) return;
      inFlightRef.current = true;
      setPhase("checking");
      setMessage(null);

      try {
        const connectivity = await checkConnectivity();
        applyConnectivity(connectivity);
        const selection = resolvePortalSelection({
          detectedPortalUrl: connectivity.portalUrl,
          detectedPortalBaseUrl: connectivity.portalBaseUrl,
          manualPortalUrl,
          portalSource,
        });
        syncPortalBaseUrl(
          selection.portalBaseUrl ?? connectivity.portalBaseUrl,
        );

        const shouldAutoLogin =
          action === "startup" &&
          autoReconnectEnabled &&
          isRecognizedCampusPortal(connectivity);
        if (action === "check" || (action === "startup" && !shouldAutoLogin)) {
          if (connectivity.state === "offline") {
            setMessage(connectivity.message ?? "Could not check WiFi connection");
          }
          return;
        }

        if (action === "login" || shouldAutoLogin) {
          if (connectivity.state !== "captive" || !connectivity.campusPortalAvailable) {
            setMessage("Campus login portal was not detected");
            return;
          }
          setPhase(shouldAutoLogin ? "auto-login" : "login");
          const credentials = await getCredentials();
          if (!credentials) {
            setMessage("Sign in to Bunkialo to save WiFi credentials");
            return;
          }

          const loginResult = await loginToCaptivePortal({
            username: credentials.username,
            password: credentials.password,
            portalUrl: selection.portalUrl,
            portalBaseUrl:
              selection.portalBaseUrl ?? storedPortalBaseUrl,
          });
          syncPortalBaseUrl(loginResult.portalBaseUrl);
          if (!loginResult.success) {
            setStatus("captive");
            setMessage(`Login failed: ${loginResult.message}`);
            wifixLogger.error(`Home WiFix login failed: ${loginResult.message}`);
            return;
          }

          setPhase("verifying");
          const verification = await verifyPortalLogin();
          applyConnectivity(verification);
          if (verification.state === "online") {
            setMessage("Login verified · Internet is working");
            Toast.show("Logged in to campus WiFi", {
              type: "success",
              position: "top",
            });
          } else {
            setMessage("Login sent · Internet is still connecting. Tap Login to check again.");
            wifixLogger.error("Home WiFix login was not verified by connectivity check");
          }
          return;
        }

        if (
          connectivity.state !== "online" ||
          !connectivity.campusPortalAvailable
        ) {
          setMessage("Campus WiFi is not connected");
          return;
        }

        setPhase("logout");
        const logoutResult = await logoutFromCaptivePortal({
          portalUrl: selection.portalUrl,
          portalBaseUrl:
            selection.portalBaseUrl ?? storedPortalBaseUrl,
        });
        syncPortalBaseUrl(logoutResult.portalBaseUrl);
        if (!logoutResult.success) {
          setMessage(`Logout failed: ${logoutResult.message}`);
          wifixLogger.error(`Home WiFix logout failed: ${logoutResult.message}`);
          return;
        }

        setStatus("captive");
        setCampusPortalAvailable(true);
        setMessage("Logged out of campus WiFi");
        Toast.show("Logged out of campus WiFi", {
          type: "success",
          position: "top",
        });
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error";
        setStatus("error");
        setMessage(errorMessage);
        wifixLogger.error(`Home WiFix error: ${errorMessage}`);
      } finally {
        setPhase(null);
        inFlightRef.current = false;
      }
    },
    [
      applyConnectivity,
      autoReconnectEnabled,
      isWeb,
      manualPortalUrl,
      portalSource,
      storedPortalBaseUrl,
      syncPortalBaseUrl,
    ],
  );

  const runActionRef = useRef(runAction);
  runActionRef.current = runAction;

  useEffect(() => {
    if (settingsReady) return;
    if (useWifixStore.persist.hasHydrated()) {
      setSettingsReady(true);
      return;
    }
    return useWifixStore.persist.onFinishHydration(() => setSettingsReady(true));
  }, [settingsReady]);

  useEffect(() => {
    if (isWeb || !settingsReady) return;
    const task = scheduleDeferredTask(() => {
      void runActionRef.current("startup");
    });
    return () => task.cancel();
  }, [isWeb, settingsReady]);

  if (isWeb) return null;

  const isCampusPortal = selectedPortalBaseUrl.includes(
    "auth.iiitkottayam.ac.in",
  );
  const canShowLogout = Boolean(
    isCampusPortal && campusPortalAvailable && status === "online",
  );
  const canShowLogin = campusPortalAvailable && status === "captive";
  const action: WifixAction = canShowLogout
    ? "logout"
    : canShowLogin
      ? "login"
      : "check";
  const actionLabel = canShowLogout
    ? "Logout"
    : canShowLogin
      ? "Login"
      : status === "offline" || status === "error"
        ? "Retry"
        : null;
  const phaseLabel = getPhaseLabel(phase);
  const statusColor = phase
    ? Colors.status.info
    : getStatusColor(status, campusPortalAvailable);

  return (
    <View
      className="mb-5 rounded-2xl border px-4 py-3"
      style={{
        backgroundColor: theme.backgroundSecondary,
        borderColor: theme.border,
      }}
    >
      <View className="flex-row items-center justify-between gap-3">
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Open WiFix"
          onPress={() => router.push("/wifix")}
          className="min-w-0 flex-1 flex-row items-center gap-2"
        >
          <Ionicons
            name={status === "online" && !phase ? "checkmark-circle" : "wifi-outline"}
            size={18}
            color={statusColor}
          />
          <Text
            className="shrink text-sm font-medium"
            style={{ color: theme.text }}
            numberOfLines={1}
          >
            {phaseLabel ?? getStatusLabel(status, campusPortalAvailable, message)}
          </Text>
        </Pressable>
        {phase ? (
          <ActivityIndicator size="small" color={Colors.status.info} />
        ) : actionLabel ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`${actionLabel} WiFix`}
            onPress={() => void runAction(action)}
            className="min-w-[88px] flex-row items-center justify-center gap-2 rounded-xl px-4 py-2"
            style={{
              backgroundColor:
                action === "logout"
                  ? Colors.status.danger
                  : action === "login"
                    ? Colors.status.success
                    : Colors.status.warning,
            }}
          >
            {action === "logout" && (
              <Ionicons name="log-out" size={17} color={Colors.black} />
            )}
            <Text className="text-sm font-bold" style={{ color: Colors.black }}>
              {actionLabel}
            </Text>
          </Pressable>
        ) : null}
      </View>
      {!phase && message && message !== "WiFi turned off" && (
        <Text
          className="mt-2 text-xs"
          style={{ color: status === "online" ? Colors.status.success : Colors.status.warning }}
        >
          {message}
        </Text>
      )}
    </View>
  );
}
