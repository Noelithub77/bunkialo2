import { LoginCredentialsStep } from "@/components/auth/login-credentials-step";
import { PortalChallengeStep } from "@/components/auth/portal-challenge-step";
import { checkAttendanceSession } from "@/services/auth/attendance-auth";
import { login } from "@/services/auth/login";
import type { AuthLoginRequest } from "@/types";
import { useEffect, useState } from "react";
import { Modal, Pressable, Text, View } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";

type ChallengeRequest = Extract<
  AuthLoginRequest,
  { provider: "attendancePortal"; mode: "totp" | "emailOtp" | "backupCode" }
>;

interface AttendanceSetupSheetProps {
  enabled: boolean;
}

export function AttendanceSetupSheet({ enabled }: AttendanceSetupSheetProps) {
  const [visible, setVisible] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [challenge, setChallenge] = useState<ChallengeRequest | null>(null);
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!enabled) return;
    let active = true;
    void checkAttendanceSession()
      .then((connected) => {
        if (active && !connected) setVisible(true);
      })
      .catch(() => {
        // A temporary session check failure should not hide account setup.
        if (active) setVisible(true);
      });
    return () => {
      active = false;
    };
  }, [enabled]);

  const finish = (result: Awaited<ReturnType<typeof login>>): void => {
    if (result.status === "success") {
      setVisible(false);
    } else if (result.status === "challenge") {
      setChallenge({
        provider: "attendancePortal",
        mode: result.challenge,
        intermediate: result.intermediate,
        code: "",
      });
    } else {
      setError(result.message);
    }
  };

  const submit = async (): Promise<void> => {
    setLoading(true);
    setError(null);
    const result = await login(
      challenge
        ? { ...challenge, code: code.trim() }
        : {
            provider: "attendancePortal",
            mode: "password",
            email: email.trim(),
            password,
          },
    );
    setLoading(false);
    finish(result);
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={() => setVisible(false)}
    >
      <View className="flex-1 justify-end bg-black/55">
        <Pressable
          className="absolute inset-0"
          onPress={() => setVisible(false)}
        />
        <View className="max-h-[88%] rounded-t-[30px] border border-zinc-700 bg-zinc-950">
          <KeyboardAwareScrollView
            contentContainerClassName="p-6 pb-10"
            keyboardShouldPersistTaps="handled"
            bottomOffset={24}
            showsVerticalScrollIndicator={false}
          >
            <View className="mx-auto mb-5 h-1 w-10 rounded-full bg-zinc-700" />
            {challenge ? (
              <PortalChallengeStep
                mode={challenge.mode}
                code={code}
                error={error}
                loading={loading}
                onCodeChange={setCode}
                onSubmit={() => void submit()}
                onUseBackupCode={() =>
                  setChallenge(
                    challenge ? { ...challenge, mode: "backupCode" } : null,
                  )
                }
              />
            ) : (
              <LoginCredentialsStep
                accountLabel="Attendance setup"
                identifier={email}
                identifierLabel="Institute email"
                identifierType="email-address"
                password={password}
                error={error}
                loading={loading}
                submitLabel="Connect"
                onIdentifierChange={setEmail}
                onPasswordChange={setPassword}
                onSubmit={() => void submit()}
              />
            )}
            <Pressable
              onPress={() => setVisible(false)}
              className="mt-4 items-center py-2"
            >
              <Text className="text-sm text-zinc-400">Not now</Text>
            </Pressable>
          </KeyboardAwareScrollView>
        </View>
      </View>
    </Modal>
  );
}
