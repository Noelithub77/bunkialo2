import { Toast } from "@/components/shared/ui/molecules/toast";
import { Colors } from "@/constants/theme";
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
import type { WifixConnectionState, WifixConnectivityResult } from "@/types";
import { wifixLogger } from "@/utils/wifix-logger";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  InteractionManager,
  Platform,
  Pressable,
  Text,
  View,
} from "react-native";

interface WifixQuickActionProps {
  theme: typeof Colors.light;
}

type WifixAction = "check" | "login" | "logout";

const getStatusLabel = (
  status: WifixConnectionState,
  campusPortalAvailable: boolean,
): string => {
  if (status === "checking") return "Checking campus WiFi...";
  if (!campusPortalAvailable) return "Not in IIIT Kottayam WiFi";
  if (status === "online") return "Connected";
  if (status === "captive") return "Campus WiFi · Login required";
  return "Not connected";
};

const getStatusColor = (
  status: WifixConnectionState,
  campusPortalAvailable: boolean,
): string => {
  if (!campusPortalAvailable) return Colors.gray[400];
  if (status === "online") return Colors.status.success;
  if (status === "captive") return Colors.status.warning;
  if (status === "error" || status === "offline") return Colors.status.danger;
  return Colors.status.info;
};

export function WifixQuickAction({ theme }: WifixQuickActionProps) {
  const isWeb = Platform.OS === "web";
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
  const [isBusy, setIsBusy] = useState(false);
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
      if (!nextBaseUrl) return;
      setPortalBaseUrlLocal(nextBaseUrl);
      if (nextBaseUrl !== storedPortalBaseUrl) {
        setPortalBaseUrl(nextBaseUrl);
      }
    },
    [setPortalBaseUrl, storedPortalBaseUrl],
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
      setIsBusy(true);
      setStatus("checking");

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

        if (action === "check") return;

        if (action === "login") {
          if (connectivity.state !== "captive") return;
          const credentials = await getCredentials();
          if (!credentials) {
            setStatus("error");
            return;
          }

          const loginResult = await loginToCaptivePortal({
            username: credentials.username,
            password: credentials.password,
            portalUrl: selection.portalUrl,
            portalBaseUrl:
              selection.portalBaseUrl ?? storedPortalBaseUrl ?? portalBaseUrl,
          });
          syncPortalBaseUrl(loginResult.portalBaseUrl);
          if (!loginResult.success) {
            setStatus("error");
            wifixLogger.error(`Home WiFix login failed: ${loginResult.message}`);
            return;
          }

          const verification = await checkConnectivity();
          applyConnectivity(verification);
          if (verification.state === "online") {
            Toast.show("Logged in to campus WiFi", {
              type: "success",
              position: "top",
            });
          }
          return;
        }

        if (
          connectivity.state !== "online" ||
          !connectivity.campusPortalAvailable
        ) {
          return;
        }

        const logoutResult = await logoutFromCaptivePortal({
          portalUrl: selection.portalUrl,
          portalBaseUrl:
            selection.portalBaseUrl ?? storedPortalBaseUrl ?? portalBaseUrl,
        });
        syncPortalBaseUrl(logoutResult.portalBaseUrl);
        if (!logoutResult.success) {
          setStatus("error");
          wifixLogger.error(`Home WiFix logout failed: ${logoutResult.message}`);
          return;
        }

        setStatus("captive");
        setCampusPortalAvailable(true);
        Toast.show("Logged out of campus WiFi", {
          type: "success",
          position: "top",
        });
      } catch (error) {
        setStatus("error");
        wifixLogger.error(
          `Home WiFix error: ${error instanceof Error ? error.message : "Unknown error"}`,
        );
      } finally {
        setIsBusy(false);
        inFlightRef.current = false;
      }
    },
    [
      applyConnectivity,
      isWeb,
      manualPortalUrl,
      portalBaseUrl,
      portalSource,
      storedPortalBaseUrl,
      syncPortalBaseUrl,
    ],
  );

  useEffect(() => {
    if (isWeb) return;
    let timeoutId: ReturnType<typeof setTimeout> | null = null;
    const task = InteractionManager.runAfterInteractions(() => {
      timeoutId = setTimeout(() => {
        void runAction("check");
      }, 0);
    });
    return () => {
      task.cancel();
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [isWeb, runAction]);

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
  const statusColor = getStatusColor(status, campusPortalAvailable);

  return (
    <View
      className="mb-5 flex-row items-center justify-between gap-3 rounded-2xl border px-4 py-3"
      style={{
        backgroundColor: theme.backgroundSecondary,
        borderColor: theme.border,
      }}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Open WiFix"
        onPress={() => router.push("/wifix")}
        className="min-w-0 flex-1 flex-row items-center gap-2"
      >
        <Ionicons
          name={status === "online" ? "checkmark-circle" : "wifi-outline"}
          size={18}
          color={statusColor}
        />
        <Text
          className="shrink text-sm font-medium"
          style={{ color: theme.text }}
          numberOfLines={1}
        >
          {getStatusLabel(status, campusPortalAvailable)}
        </Text>
      </Pressable>
      {actionLabel && (
        <Pressable
          onPress={() => void runAction(action)}
          disabled={isBusy}
          className="min-w-[88px] flex-row items-center justify-center gap-2 rounded-xl px-4 py-2"
          style={{
            backgroundColor:
              action === "logout"
                ? Colors.status.danger
                : action === "login"
                  ? Colors.status.success
                  : Colors.status.warning,
            opacity: isBusy ? 0.6 : 1,
          }}
        >
          {isBusy ? (
            <ActivityIndicator size="small" color={Colors.black} />
          ) : (
            <>
              {action === "logout" && (
                <Ionicons name="log-out" size={17} color={Colors.black} />
              )}
              <Text className="text-sm font-bold" style={{ color: Colors.black }}>
                {actionLabel}
              </Text>
            </>
          )}
        </Pressable>
      )}
    </View>
  );
}
