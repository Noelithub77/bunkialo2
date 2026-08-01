import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Colors } from "@/constants/theme";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { Ionicons } from "@expo/vector-icons";
import { useEffect, useState } from "react";
import { Modal, Pressable, Text, View } from "react-native";

export type PortalChallenge = "none" | "needs2fa" | "needsEmailOtp";

interface PortalConnectModalProps {
  visible: boolean;
  isConnecting: boolean;
  error: string | null;
  challenge: PortalChallenge;
  onClose: () => void;
  onSubmit: (email: string, password: string) => void;
  onSubmitCode: (code: string, useBackupCode: boolean) => void;
}

export function PortalConnectModal({
  visible,
  isConnecting,
  error,
  challenge,
  onClose,
  onSubmit,
  onSubmitCode,
}: PortalConnectModalProps) {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";
  const theme = isDark ? Colors.dark : Colors.light;

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [useBackupCode, setUseBackupCode] = useState(false);

  useEffect(() => {
    if (visible) {
      setEmail("");
      setPassword("");
      setCode("");
      setUseBackupCode(false);
    }
  }, [visible]);

  // A fresh challenge means a fresh code field.
  useEffect(() => {
    setCode("");
    setUseBackupCode(false);
  }, [challenge]);

  const isChallenge = challenge !== "none";
  const canSubmit = isChallenge
    ? code.trim().length > 0 && !isConnecting
    : email.trim().length > 0 && password.length > 0 && !isConnecting;

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
                {isChallenge
                  ? "Two-Factor Verification"
                  : "Connect Attendance Portal"}
              </Text>
              <Text
                className="mt-1 text-[12px]"
                style={{ color: theme.textSecondary }}
              >
                {challenge === "needsEmailOtp"
                  ? "Enter the code sent to your email."
                  : challenge === "needs2fa"
                    ? useBackupCode
                      ? "Enter one of your saved backup codes."
                      : "Enter the code from your authenticator app."
                    : "Attendance moved off Moodle. Sign in to attendance.iiitkottayam.ac.in to restore attendance and your timetable."}
              </Text>
            </View>
            <Pressable onPress={onClose} hitSlop={8}>
              <Ionicons name="close" size={24} color={theme.textSecondary} />
            </Pressable>
          </View>

          {isChallenge ? (
            <View className="gap-3">
              <Input
                label={useBackupCode ? "Backup Code" : "Verification Code"}
                value={code}
                onChangeText={setCode}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType={useBackupCode ? "default" : "number-pad"}
                textContentType={useBackupCode ? "none" : "oneTimeCode"}
                placeholder={useBackupCode ? "xxxx-xxxx" : "123456"}
                editable={!isConnecting}
              />
              {challenge === "needs2fa" && (
                <Pressable
                  onPress={() => setUseBackupCode((prev) => !prev)}
                  disabled={isConnecting}
                >
                  <Text
                    className="text-[12px] underline"
                    style={{ color: theme.textSecondary }}
                  >
                    {useBackupCode
                      ? "Use authenticator code instead"
                      : "Use a backup code instead"}
                  </Text>
                </Pressable>
              )}
            </View>
          ) : (
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
          )}

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
            title={
              isConnecting
                ? isChallenge
                  ? "Verifying…"
                  : "Connecting…"
                : isChallenge
                  ? "Verify"
                  : "Connect"
            }
            onPress={() =>
              isChallenge
                ? onSubmitCode(code.trim(), useBackupCode)
                : onSubmit(email.trim(), password)
            }
            disabled={!canSubmit}
            className="mt-4"
          />
        </View>
      </View>
    </Modal>
  );
}
