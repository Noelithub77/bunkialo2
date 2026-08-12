import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useState } from "react";
import { Pressable, Text, View } from "react-native";

interface LoginCredentialsStepProps {
  accountLabel: string;
  identifier: string;
  identifierLabel: string;
  identifierType?: "default" | "email-address";
  password: string;
  error: string | null;
  loading: boolean;
  submitLabel: string;
  onIdentifierChange: (value: string) => void;
  onPasswordChange: (value: string) => void;
  onSubmit: () => void;
}

export function LoginCredentialsStep({
  accountLabel,
  identifier,
  identifierLabel,
  identifierType = "default",
  password,
  error,
  loading,
  submitLabel,
  onIdentifierChange,
  onPasswordChange,
  onSubmit,
}: LoginCredentialsStepProps) {
  const [showPassword, setShowPassword] = useState(false);
  const ready = Boolean(identifier.trim() && password);

  return (
    <View className="gap-5">
      <View className="gap-1">
        <Text className="text-xs font-semibold uppercase tracking-[2px] text-zinc-400">
          {accountLabel}
        </Text>
        <Text className="text-2xl font-bold text-zinc-50">
          Connect your account
        </Text>
      </View>

      <View className="gap-3">
        <Input
          label={identifierLabel}
          value={identifier}
          onChangeText={onIdentifierChange}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType={identifierType}
          inputMode={identifierType === "email-address" ? "email" : "text"}
          returnKeyType="next"
        />
        <View>
          <Input
            label="Password"
            value={password}
            onChangeText={onPasswordChange}
            secureTextEntry={!showPassword}
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="go"
            onSubmitEditing={() => ready && onSubmit()}
            style={{ paddingRight: 52 }}
          />
          <Pressable
            onPress={() => setShowPassword((visible) => !visible)}
            className="absolute right-3 top-8 h-9 w-9 items-center justify-center"
            accessibilityLabel={
              showPassword ? "Hide password" : "Show password"
            }
          >
            <MaterialCommunityIcons
              name={showPassword ? "eye-off-outline" : "eye-outline"}
              size={20}
              color="#A1A1AA"
            />
          </Pressable>
        </View>
      </View>

      {error ? (
        <Text className="rounded-xl bg-red-500/10 px-3 py-2 text-sm text-red-200">
          {error}
        </Text>
      ) : null}

      <Button
        title={submitLabel}
        onPress={onSubmit}
        loading={loading}
        disabled={!ready}
      />
    </View>
  );
}
