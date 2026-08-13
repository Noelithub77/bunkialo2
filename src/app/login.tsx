import GrainyGradient from "@/components/shared/ui/organisms/grainy-gradient";
import { LoginCredentialsStep } from "@/components/auth/login-credentials-step";
import { login } from "@/services/auth/login";
import { getWebCredential } from "@/services/auth/web-password-manager.web";
import { useAuthStore } from "@/stores/auth-store";
import { StatusBar } from "expo-status-bar";
import { useEffect, useState } from "react";
import { Text, View } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { SafeAreaView } from "react-native-safe-area-context";

export default function LoginScreen() {
  const [rollNumber, setRollNumber] = useState("");
  const [lmsPassword, setLmsPassword] = useState("");
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
      completeLogin(rollNumber.trim());
      return;
    }
    if (result.status === "failure") setError(result.message);
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
            <View className="gap-2">
              <Text className="text-5xl font-black tracking-[-2px] text-zinc-50">
                Bunkialo
              </Text>
              <Text className="text-sm text-zinc-400">
                Sign in with your LMS account to continue.
              </Text>
            </View>

            <View className="rounded-[28px] border border-zinc-700/60 bg-black/80 p-5">
              <LoginCredentialsStep
                accountLabel="LMS"
                identifier={rollNumber}
                identifierLabel="Roll number"
                password={lmsPassword}
                error={error}
                loading={loading}
                submitLabel="Sign in"
                onIdentifierChange={setRollNumber}
                onPasswordChange={setLmsPassword}
                onSubmit={() => void submitLms()}
              />
            </View>
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
