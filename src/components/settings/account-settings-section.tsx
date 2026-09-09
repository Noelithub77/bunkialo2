import { LoginCredentialsStep } from "@/components/auth/login-credentials-step";
import { PortalChallengeStep } from "@/components/auth/portal-challenge-step";
import { Toast } from "@/components/shared/ui/molecules/toast";
import { checkAttendanceSession } from "@/services/auth/attendance-auth";
import { login } from "@/services/auth/login";
import { getAttendanceCredentials } from "@/services/auth/secure-auth-storage";
import { useAuthStore } from "@/stores/auth-store";
import type { AuthLoginRequest } from "@/types";
import { Ionicons } from "@expo/vector-icons";
import { useEffect, useState } from "react";
import { Modal, Pressable, Text, View } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";

type AccountKind = "lms" | "attendancePortal";
type ChallengeRequest = Extract<
  AuthLoginRequest,
  { provider: "attendancePortal"; mode: "totp" | "emailOtp" | "backupCode" }
>;

interface AccountSettingsSectionProps {
  lmsUsername: string | null;
  theme: {
    text: string;
    textSecondary: string;
    border: string;
    background: string;
  };
}

export function AccountSettingsSection({
  lmsUsername,
  theme,
}: AccountSettingsSectionProps) {
  const [attendanceEmail, setAttendanceEmail] = useState<string | null>(null);
  const [attendanceConnected, setAttendanceConnected] = useState<boolean | null>(
    null,
  );
  const [editing, setEditing] = useState<AccountKind | null>(null);
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [challenge, setChallenge] = useState<ChallengeRequest | null>(null);
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const completeLogin = useAuthStore((state) => state.completeLogin);

  useEffect(() => {
    void getAttendanceCredentials().then((saved) =>
      setAttendanceEmail(saved?.email ?? null),
    );
    void checkAttendanceSession().then(setAttendanceConnected);
  }, []);

  const openEditor = (account: AccountKind): void => {
    setEditing(account);
    setIdentifier(
      account === "lms" ? (lmsUsername ?? "") : (attendanceEmail ?? ""),
    );
    setPassword("");
    setChallenge(null);
    setCode("");
    setError(null);
  };

  const closeEditor = (): void => {
    if (!loading) setEditing(null);
  };

  const handleResult = (result: Awaited<ReturnType<typeof login>>): void => {
    if (result.status === "success") {
      if (editing === "attendancePortal") {
        setAttendanceEmail(identifier.trim().toLowerCase());
        setAttendanceConnected(true);
      } else {
        completeLogin(identifier.trim());
      }
      Toast.show("Account updated", { type: "success" });
      setEditing(null);
      return;
    }
    if (result.status === "challenge") {
      setChallenge({
        provider: "attendancePortal",
        mode: result.challenge,
        intermediate: result.intermediate,
        code: "",
      });
      return;
    }
    setError(result.message);
  };

  const submit = async (): Promise<void> => {
    if (!editing) return;
    setLoading(true);
    setError(null);
    const request: AuthLoginRequest = challenge
      ? { ...challenge, code: code.trim() }
      : editing === "lms"
        ? {
            provider: "lms",
            mode: "password",
            username: identifier.trim(),
            password,
          }
        : {
            provider: "attendancePortal",
            mode: "password",
            email: identifier.trim(),
            password,
          };
    const result = await login(request);
    setLoading(false);
    handleResult(result);
  };

  return (
    <>
      <Text
        className="mb-2 ml-1 text-xs font-semibold uppercase"
        style={{ color: theme.textSecondary }}
      >
        Accounts
      </Text>
      <View
        className="mb-6 overflow-hidden rounded-xl border"
        style={{ borderColor: theme.border }}
      >
        {(
          [
            ["lms", "LMS", lmsUsername, "school-outline"],
            [
              "attendancePortal",
              "Attendance",
              attendanceConnected === true
                ? attendanceEmail ?? "Connected"
                : attendanceConnected === false
                  ? attendanceEmail
                  : attendanceEmail ?? "Checking...",
              "calendar-outline",
            ],
          ] as const
        ).map(([kind, label, value, icon], index) => (
          <Pressable
            key={kind}
            onPress={() => openEditor(kind)}
            className="flex-row items-center gap-3 px-4 py-4"
            style={
              index
                ? { borderTopWidth: 1, borderTopColor: theme.border }
                : undefined
            }
          >
            <Ionicons name={icon} size={20} color={theme.textSecondary} />
            <View className="flex-1">
              <Text
                className="text-sm font-semibold"
                style={{ color: theme.text }}
              >
                {label}
              </Text>
              <Text className="text-xs" style={{ color: theme.textSecondary }}>
                {value ?? "Not connected"}
              </Text>
            </View>
            <Text
              className="text-xs font-semibold"
              style={{ color: theme.textSecondary }}
            >
              Change
            </Text>
          </Pressable>
        ))}
      </View>

      <Modal
        visible={editing !== null}
        transparent
        animationType="slide"
        onRequestClose={closeEditor}
      >
        <View className="flex-1 justify-end bg-black/50">
          <Pressable className="absolute inset-0" onPress={closeEditor} />
          <View className="max-h-[88%] rounded-t-[28px] bg-zinc-950">
            <KeyboardAwareScrollView
              contentContainerClassName="p-6 pb-10"
              keyboardShouldPersistTaps="handled"
              bottomOffset={24}
              showsVerticalScrollIndicator={false}
            >
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
                  accountLabel={
                    editing === "lms" ? "LMS account" : "Attendance account"
                  }
                  identifier={identifier}
                  identifierLabel={
                    editing === "lms" ? "Roll number" : "Institute email"
                  }
                  identifierType={
                    editing === "lms" ? "default" : "email-address"
                  }
                  password={password}
                  error={error}
                  loading={loading}
                  submitLabel="Validate and save"
                  onIdentifierChange={setIdentifier}
                  onPasswordChange={setPassword}
                  onSubmit={() => void submit()}
                />
              )}
            </KeyboardAwareScrollView>
          </View>
        </View>
      </Modal>
    </>
  );
}
