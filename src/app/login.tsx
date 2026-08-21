import GrainyGradient from "@/components/shared/ui/organisms/grainy-gradient";
import { LoginCredentialsStep } from "@/components/auth/login-credentials-step";
import { PortalChallengeStep } from "@/components/auth/portal-challenge-step";
import { login } from "@/services/auth/login";
import { ATTENDANCE_PORTAL_URL } from "@/services/auth/attendance-auth";
import { getWebCredential } from "@/services/auth/web-password-manager.web";
import { useAuthStore } from "@/stores/auth-store";
import type { AuthLoginRequest } from "@/types";
import { StatusBar } from "expo-status-bar";
import { useEffect, useState } from "react";
import { Linking, Pressable, Text, View } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { SafeAreaView } from "react-native-safe-area-context";

type ChallengeRequest = Extract<
  AuthLoginRequest,
  { provider: "attendancePortal"; mode: "totp" | "emailOtp" | "backupCode" }
>;

export default function LoginScreen() {
  const [step, setStep] = useState<"lms" | "attendance">("lms");
  const [rollNumber, setRollNumber] = useState("");
  const [lmsPassword, setLmsPassword] = useState("");
  const [email, setEmail] = useState("");
  const [portalPassword, setPortalPassword] = useState("");
  const [challenge, setChallenge] = useState<ChallengeRequest | null>(null);
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const completeLogin = useAuthStore((state) => state.completeLogin);

  useEffect(() => {
    if (process.env.EXPO_OS !== "web") return;
    let active = true;
    void getWebCredential().then((credential) => {
      if (!active || !credential) return;
      setRollNumber(credential.identifier);
      setLmsPassword(credential.password);
    });
    return () => {
      active = false;
    };
  }, []);

  const submitLms = async (): Promise<void> => {
    setLoading(true);
    setError(null);
    const result = await login({
      provider: "lms",
      mode: "password",
      username: rollNumber.trim(),
      password: lmsPassword,
    });
    setLoading(false);
    if (result.status === "success") {
      setStep("attendance");
      return;
    }
    if (result.status === "failure") setError(result.message);
  };

  const handlePortalResult = (
    result: Awaited<ReturnType<typeof login>>,
  ): void => {
    if (result.status === "success") {
      completeLogin(rollNumber.trim());
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

  const submitPortal = async (): Promise<void> => {
    setLoading(true);
    setError(null);
    const result = await login({
      provider: "attendancePortal",
      mode: "password",
      email: email.trim(),
      password: portalPassword,
    });
    setLoading(false);
    handlePortalResult(result);
  };

  const submitChallenge = async (): Promise<void> => {
    if (!challenge) return;
    setLoading(true);
    setError(null);
    const result = await login({ ...challenge, code: code.trim() });
    setLoading(false);
    handlePortalResult(result);
  };

  return (
    <View className="flex-1 bg-black">
      <StatusBar style="light" />
      <GrainyGradient
        colors={["#111113", "#1B1B20", "#26262C", "#16161A"]}
        speed={2.2}
        intensity={0.1}
        size={1.6}
        amplitude={0.1}
        brightness={0.015}
        resolutionScale={0.3}
        settleMs={1800}
        style={{ position: "absolute", inset: 0 }}
      />
      <View className="absolute inset-0 bg-black/35" />
      <SafeAreaView className="flex-1 px-5">
        <KeyboardAwareScrollView
          contentContainerClassName="flex-grow justify-center py-8"
          keyboardShouldPersistTaps="handled"
          bottomOffset={24}
        >
          <View className="mx-auto w-full max-w-[520px] gap-6">
            <View className="gap-3 px-1">
              <Text className="text-[42px] font-extrabold leading-[46px] tracking-[-1.5px] text-zinc-50 sm:text-5xl sm:leading-[52px]">
                Bunkialo
              </Text>
              <View className="flex-row items-center gap-2">
                <View className="rounded-full border border-zinc-700 bg-zinc-900 px-2.5 py-1">
                  <Text className="text-[11px] font-semibold uppercase tracking-[1.2px] text-zinc-300">
                    Step {step === "lms" ? "1" : "2"} of 2
                  </Text>
                </View>
                <Text className="flex-1 text-xs leading-5 text-zinc-400">
                  {step === "lms"
                    ? "Connect your LMS account first."
                    : "Now connect your attendance account."}
                </Text>
              </View>
            </View>

            <View className="rounded-[28px] border border-zinc-700/60 bg-black/80 p-5">
              {step === "lms" ? (
                <LoginCredentialsStep
                  accountLabel="LMS"
                  identifier={rollNumber}
                  identifierLabel="Roll number"
                  password={lmsPassword}
                  error={error}
                  loading={loading}
                  submitLabel="Continue"
                  onIdentifierChange={setRollNumber}
                  onPasswordChange={setLmsPassword}
                  onSubmit={() => void submitLms()}
                />
              ) : challenge ? (
                <PortalChallengeStep
                  mode={challenge.mode}
                  code={code}
                  error={error}
                  loading={loading}
                  onCodeChange={setCode}
                  onSubmit={() => void submitChallenge()}
                  onUseBackupCode={() =>
                    setChallenge({ ...challenge, mode: "backupCode" })
                  }
                />
              ) : (
                <LoginCredentialsStep
                  accountLabel="Attendance portal"
                  identifier={email}
                  identifierLabel="Institute email"
                  identifierType="email-address"
                  password={portalPassword}
                  error={error}
                  loading={loading}
                  submitLabel="Finish sign in"
                  onIdentifierChange={setEmail}
                  onPasswordChange={setPortalPassword}
                  onSubmit={() => void submitPortal()}
                />
              )}
            </View>

            {step === "attendance" && !challenge ? (
              <View className="flex-row items-center justify-between">
                <Pressable
                  onPress={() => {
                    setError(null);
                    setStep("lms");
                  }}
                >
                  <Text className="text-sm font-semibold text-zinc-400">
                    Back
                  </Text>
                </Pressable>
                <Pressable
                  onPress={() =>
                    void Linking.openURL(`${ATTENDANCE_PORTAL_URL}/login`)
                  }
                >
                  <Text className="text-sm font-semibold text-zinc-200">
                    Open attendance portal ↗
                  </Text>
                </Pressable>
              </View>
            ) : null}
            <Text className="text-center text-xs text-zinc-500">
              {process.env.EXPO_OS === "web"
                ? "Your browser password manager can securely save and autofill credentials."
                : "Credentials stay encrypted on this device."}
            </Text>
          </View>
        </KeyboardAwareScrollView>
      </SafeAreaView>
    </View>
  );
}
