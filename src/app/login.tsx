import { Button } from "@/components/ui/button";
import { Container } from "@/components/ui/container";
import { Input } from "@/components/ui/input";
import { Colors, Spacing } from "@/constants/theme";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { useAuthStore } from "@/stores/auth-store";
import { useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  View,
} from "react-native";

export default function LoginScreen() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";
  const theme = isDark ? Colors.dark : Colors.light;

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const { login, isLoading, error, setError } = useAuthStore();

  const handleLogin = async () => {
    if (!username.trim() || !password.trim()) {
      setError("Please enter both username and password");
      return;
    }

    await login(username.trim(), password);
  };

  return (
    <Container>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.keyboardView}
      >
        <View style={styles.content}>
          <View style={styles.header}>
            <Text style={[styles.title, { color: theme.text }]}>Bunkialo</Text>
            <Text style={[styles.subtitle, { color: theme.textSecondary }]}>
              Please enter your LMS creds
            </Text>
          </View>

          <View style={styles.form}>
            <Input
              label="Username"
              placeholder="Enter your rollno."
              value={username}
              onChangeText={setUsername}
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="username"
              textContentType="username"
              importantForAutofill="yes"
            />

            <Input
              label="Password"
              placeholder="Enter your password"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="password"
              textContentType="password"
              importantForAutofill="yes"
            />

            {error && <Text style={styles.error}>{error}</Text>}

            <Button title="Sign In" onPress={handleLogin} loading={isLoading} />
          </View>

          <Text style={[styles.footer, { color: theme.textSecondary }]}>
            Your credentials are stored securely on device
          </Text>
        </View>
      </KeyboardAvoidingView>
    </Container>
  );
}

const styles = StyleSheet.create({
  keyboardView: {
    flex: 1,
  },
  content: {
    flex: 1,
    padding: Spacing.lg,
    justifyContent: "center",
  },
  header: {
    alignItems: "center",
    marginBottom: Spacing.xxl,
  },
  title: {
    fontSize: 32,
    fontWeight: "700",
    letterSpacing: -1,
  },
  subtitle: {
    fontSize: 14,
    marginTop: Spacing.xs,
  },
  form: {
    gap: Spacing.md,
  },
  error: {
    color: Colors.status.danger,
    fontSize: 14,
    textAlign: "center",
  },
  footer: {
    fontSize: 12,
    textAlign: "center",
    marginTop: Spacing.xxl,
  },
});
