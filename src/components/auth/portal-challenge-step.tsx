import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { AuthLoginRequest } from "@/types";
import { Text, View } from "react-native";

type ChallengeMode = Extract<
  AuthLoginRequest,
  { provider: "attendancePortal"; mode: "totp" | "emailOtp" | "backupCode" }
>["mode"];

interface PortalChallengeStepProps {
  mode: ChallengeMode;
  code: string;
  error: string | null;
  loading: boolean;
  onCodeChange: (code: string) => void;
  onSubmit: () => void;
  onUseBackupCode?: () => void;
}

export function PortalChallengeStep({
  mode,
  code,
  error,
  loading,
  onCodeChange,
  onSubmit,
  onUseBackupCode,
}: PortalChallengeStepProps) {
  return (
    <View className="gap-5">
      <View className="gap-1">
        <Text className="text-xs font-semibold uppercase tracking-[2px] text-zinc-400">
          Verification
        </Text>
        <Text className="text-2xl font-bold text-zinc-50">
          {mode === "emailOtp" ? "Check your email" : "Enter your code"}
        </Text>
      </View>
      <Input
        label={mode === "backupCode" ? "Backup code" : "Verification code"}
        value={code}
        onChangeText={onCodeChange}
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType={mode === "backupCode" ? "default" : "number-pad"}
        returnKeyType="go"
        onSubmitEditing={() => code.trim() && onSubmit()}
      />
      {error ? <Text className="text-sm text-red-200">{error}</Text> : null}
      <Button
        title="Verify"
        onPress={onSubmit}
        loading={loading}
        disabled={!code.trim()}
      />
      {mode === "totp" && onUseBackupCode ? (
        <Button
          title="Use a backup code"
          variant="ghost"
          onPress={onUseBackupCode}
        />
      ) : null}
    </View>
  );
}
