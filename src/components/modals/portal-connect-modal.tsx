import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Colors } from "@/constants/theme";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { Ionicons } from "@expo/vector-icons";
import { useEffect, useState } from "react";
import { Modal, Pressable, Text, View } from "react-native";

interface PortalConnectModalProps {
  visible: boolean;
  isConnecting: boolean;
  error: string | null;
  onClose: () => void;
  onSubmit: (email: string, password: string) => void;
}

export function PortalConnectModal({
  visible,
  isConnecting,
  error,
  onClose,
  onSubmit,
}: PortalConnectModalProps) {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";
  const theme = isDark ? Colors.dark : Colors.light;

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  useEffect(() => {
    if (visible) {
      setEmail("");
      setPassword("");
    }
  }, [visible]);

  const canSubmit =
    email.trim().length > 0 && password.length > 0 && !isConnecting;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View className="flex-1 items-center justify-center">
        <Pressable className="absolute inset-0 bg-black/60" onPress={onClose} />
        <View
          className="w-[92%] max-w-[420px] rounded-2xl p-6"
          style={{ backgroundColor: theme.background }}
        >
          <View className="mb-4 flex-row items-start justify-between">
            <View className="flex-1">
              <Text
                className="text-[18px] font-semibold"
                style={{ color: theme.text }}
              >
                Connect Attendance Portal
              </Text>
              <Text
                className="mt-1 text-[12px]"
                style={{ color: theme.textSecondary }}
              >
                Attendance moved off Moodle. Sign in to
                attendance.iiitkottayam.ac.in to restore attendance and your
                timetable.
              </Text>
            </View>
            <Pressable onPress={onClose} hitSlop={8}>
              <Ionicons name="close" size={24} color={theme.textSecondary} />
            </Pressable>
          </View>

          <View className="gap-3">
            <Input
              label="Email"
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="email-address"
              textContentType="username"
              placeholder="you@iiitkottayam.ac.in"
              editable={!isConnecting}
            />
            <Input
              label="Password"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              autoCapitalize="none"
              autoCorrect={false}
              textContentType="password"
              editable={!isConnecting}
            />
          </View>

          {error ? (
            <Text
              className="mt-3 text-center text-[12px]"
              style={{ color: Colors.status.danger }}
            >
              {error}
            </Text>
          ) : null}

          <Text
            className="mt-3 text-[11px] leading-4"
            style={{ color: theme.textSecondary }}
          >
            Stored on this device only, in the same secure storage as your
            Moodle login. Never sent anywhere except the portal.
          </Text>

          <Button
            title={isConnecting ? "Connecting…" : "Connect"}
            onPress={() => onSubmit(email.trim(), password)}
            disabled={!canSubmit}
            className="mt-4"
          />
        </View>
      </View>
    </Modal>
  );
}
