import {
  createDesktopPairing,
  getDesktopPairingStatus,
  revokeDesktopPairing,
} from "@/services/desktop-pairing";
import { refreshAuthSession } from "@/services/auth/lms-auth";
import { Toast } from "@/components/shared/ui/molecules/toast";
import { Colors } from "@/constants/theme";
import * as Clipboard from "expo-clipboard";
import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Pressable, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

interface DesktopPluginSectionProps {
  autoCreate?: boolean;
  theme: {
    text: string;
    textSecondary: string;
    border: string;
    background: string;
    backgroundSecondary?: string;
  };
}

export function DesktopPluginSection({ autoCreate = false, theme }: DesktopPluginSectionProps) {
  const [paired, setPaired] = useState(false);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const pair = useCallback(async (): Promise<void> => {
    setLoading(true);
    try {
      if (!(await refreshAuthSession())) {
        throw new Error("Sign in to Bunkialo again before pairing.");
      }
      const nextToken = await createDesktopPairing();
      setToken(nextToken);
      setPaired(true);
      await Clipboard.setStringAsync(nextToken);
      Toast.show("Pairing code copied", { type: "success" });
    } catch (error) {
      Toast.show(error instanceof Error ? error.message : "Pairing failed.", { type: "error" });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let active = true;
    const load = async (): Promise<void> => {
      const existing = await getDesktopPairingStatus();
      if (existing && !(await refreshAuthSession())) {
        Toast.show("Sign in to Bunkialo again to repair desktop pairing.", { type: "error" });
      }
      if (!active) return;
      setPaired(existing);
      if (!existing && autoCreate) await pair();
    };
    void load();
    return () => {
      active = false;
    };
  }, [autoCreate, pair]);

  const copyToken = async (): Promise<void> => {
    if (!token) return;
    await Clipboard.setStringAsync(token);
    Toast.show("Pairing code copied", { type: "success" });
  };

  const revoke = async (): Promise<void> => {
    setLoading(true);
    try {
      await revokeDesktopPairing();
      setPaired(false);
      setToken(null);
      Toast.show("Desktop pairing revoked", { type: "success" });
    } catch (error) {
      Toast.show(error instanceof Error ? error.message : "Could not revoke pairing.", { type: "error" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Text className="mb-2 ml-1 text-xs font-semibold uppercase" style={{ color: theme.textSecondary }}>
        Desktop plugin
      </Text>
      <View className="mb-6 overflow-hidden rounded-xl border" style={{ borderColor: theme.border }}>
        <View className="flex-row items-center gap-3 px-4 py-4">
          <Ionicons name="desktop-outline" size={20} color={theme.textSecondary} />
          <View className="flex-1">
            <Text className="text-sm font-semibold" style={{ color: theme.text }}>Omarchy</Text>
            <Text className="text-xs" style={{ color: theme.textSecondary }}>
              {paired ? "Connected" : "Not connected"}
            </Text>
          </View>
          <Ionicons
            name={paired ? "checkmark-circle" : "ellipse-outline"}
            size={18}
            color={paired ? Colors.status.success : theme.textSecondary}
          />
        </View>
        {token ? (
          <View className="gap-3 border-t px-4 py-4" style={{ borderTopColor: theme.border }}>
            <View className="flex-row items-start gap-3">
              <View className="flex-1 gap-1">
                <Text className="text-sm font-semibold" style={{ color: theme.text }}>
                  Credentials JSON
                </Text>
                <Text className="text-xs leading-5" style={{ color: theme.textSecondary }}>
                  Paste this into the Omarchy Bunkialo plugin settings.
                </Text>
              </View>
              <Pressable
                accessibilityLabel="Copy credentials JSON"
                accessibilityRole="button"
                accessibilityHint="Copies the credentials JSON to the clipboard"
                className="rounded-lg p-3"
                style={{ backgroundColor: theme.backgroundSecondary ?? theme.background }}
                onPress={() => void copyToken()}
              >
                <Ionicons name="copy-outline" size={20} color={theme.text} />
              </Pressable>
            </View>
            <View
              className="rounded-lg border px-3 py-3"
              style={{
                backgroundColor: theme.backgroundSecondary ?? theme.background,
                borderColor: theme.border,
              }}
            >
              <Text
                selectable
                className="text-xs leading-5"
                style={{ color: theme.text, fontFamily: "monospace" }}
              >
                {token}
              </Text>
            </View>
          </View>
        ) : paired ? (
          <View className="gap-1 border-t px-4 py-4" style={{ borderTopColor: theme.border }}>
            <Text className="text-sm font-semibold" style={{ color: theme.text }}>
              Desktop already connected
            </Text>
            <Text className="text-xs leading-5" style={{ color: theme.textSecondary }}>
              Generate a replacement code if you need to connect another Omarchy plugin.
            </Text>
          </View>
        ) : null}
        <View className="flex-row gap-3 border-t px-4 py-4" style={{ borderTopColor: theme.border }}>
          <Pressable
            accessibilityLabel={paired ? "Replace pairing" : "Create pairing"}
            accessibilityRole="button"
            accessibilityHint="Generates a pairing code and copies it to the clipboard"
            disabled={loading}
            className="min-h-12 flex-1 flex-row items-center justify-center gap-2 rounded-lg px-4 py-3"
            style={{ backgroundColor: theme.text, opacity: loading ? 0.5 : 1 }}
            onPress={() => void pair()}
          >
            {loading ? (
              <ActivityIndicator color={theme.background} />
            ) : (
              <Ionicons name={paired ? "refresh-outline" : "add-outline"} size={20} color={theme.background} />
            )}
            <Text className="text-sm font-semibold" style={{ color: theme.background }}>
              {paired ? "Replace code" : "Create pairing"}
            </Text>
          </Pressable>
          {paired ? (
            <Pressable
              accessibilityLabel="Revoke desktop pairing"
              accessibilityRole="button"
              accessibilityHint="Disconnects the Omarchy plugin"
              disabled={loading}
              className="min-h-12 flex-1 flex-row items-center justify-center gap-2 rounded-lg border px-4 py-3"
              style={{ borderColor: theme.border, opacity: loading ? 0.5 : 1 }}
              onPress={() => void revoke()}
            >
              <Ionicons name="trash-outline" size={20} color={theme.textSecondary} />
              <Text className="text-sm font-semibold" style={{ color: theme.textSecondary }}>
                Revoke
              </Text>
            </Pressable>
          ) : null}
        </View>
      </View>
    </>
  );
}
