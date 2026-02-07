import GrainyGradient from "@/components/shared/ui/organisms/grainy-gradient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuthStore } from "@/stores/auth-store";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { StatusBar } from "expo-status-bar";
import { useEffect, useRef, useState } from "react";
import {
  Animated,
  Easing,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export default function LoginScreen() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [isKeyboardVisible, setIsKeyboardVisible] = useState(false);
  const { login, isLoading, error, setError } = useAuthStore();
  const scrollRef = useRef<ScrollView>(null);
  const heroProgress = useRef(new Animated.Value(0)).current;
  const cardProgress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const showEvent =
      Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow";
    const hideEvent =
      Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide";

    const showListener = Keyboard.addListener(showEvent, () => {
      setIsKeyboardVisible(true);
    });
    const hideListener = Keyboard.addListener(hideEvent, () => {
      setIsKeyboardVisible(false);
    });

    return () => {
      showListener.remove();
      hideListener.remove();
    };
  }, []);

  useEffect(() => {
    heroProgress.setValue(0);
    cardProgress.setValue(0);

    Animated.parallel([
      Animated.timing(heroProgress, {
        toValue: 1,
        duration: 220,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(cardProgress, {
        toValue: 1,
        duration: 280,
        delay: 60,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start();
  }, [cardProgress, heroProgress]);

  const scrollToForm = () => {
    requestAnimationFrame(() => {
      scrollRef.current?.scrollToEnd({ animated: true });
    });
  };

  const clearErrorIfNeeded = () => {
    if (error) {
      setError(null);
    }
  };

  const handleUsernameChange = (value: string) => {
    clearErrorIfNeeded();
    setUsername(value);
  };

  const handlePasswordChange = (value: string) => {
    clearErrorIfNeeded();
    setPassword(value);
  };

  const handleLogin = async () => {
    const trimmedUsername = username.trim();
    const trimmedPassword = password.trim();

    if (!trimmedUsername || !trimmedPassword) {
      setError("Please enter both username and password");
      return;
    }

    await login(trimmedUsername, password);
  };

  const canSubmit = Boolean(username.trim() && password.trim()) && !isLoading;
  const heroAnimatedStyle = {
    opacity: heroProgress,
    transform: [
      {
        translateY: heroProgress.interpolate({
          inputRange: [0, 1],
          outputRange: [14, 0],
        }),
      },
    ],
  };
  const cardAnimatedStyle = {
    opacity: cardProgress,
    transform: [
      {
        translateY: cardProgress.interpolate({
          inputRange: [0, 1],
          outputRange: [20, 0],
        }),
      },
      {
        scale: cardProgress.interpolate({
          inputRange: [0, 1],
          outputRange: [0.985, 1],
        }),
      },
    ],
  };

  return (
    <View className="flex-1 bg-black">
      <StatusBar style="light" />
      <GrainyGradient
        colors={["#111113", "#1B1B20", "#26262C", "#16161A"]}
        speed={1.95}
        intensity={0.13}
        size={1.8}
        amplitude={0.14}
        brightness={0.02}
        style={styles.absoluteFill}
      />
      <View className="absolute inset-0 bg-black/28" />

      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={Platform.OS === "ios" ? 10 : 0}
        className="flex-1"
      >
        <SafeAreaView className="flex-1 px-6 pb-8" edges={["top", "bottom"]}>
          <ScrollView
            ref={scrollRef}
            className="flex-1"
            contentContainerStyle={[
              styles.scrollContent,
              isKeyboardVisible && styles.scrollContentKeyboard,
            ]}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode={
              Platform.OS === "ios" ? "interactive" : "on-drag"
            }
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.contentShell}>
              <Animated.View className="gap-4" style={heroAnimatedStyle}>
                <View className="self-start rounded-full border border-zinc-700/55 bg-black/40 px-4 py-2">
                  <Text className="text-[11px] font-semibold uppercase tracking-[2.6px] text-zinc-300">
                    sign-in
                  </Text>
                </View>

                <View className="gap-3">
                  <Text className="text-[54px] font-black leading-[56px] tracking-[-2px] text-zinc-100">
                    Bunkialo
                  </Text>
                  <Text className="max-w-[340px] text-[16px] leading-8 text-zinc-300">
                    Sign in once to keep attendance, assignments, and reminders
                    synced.
                  </Text>
                </View>
              </Animated.View>

              <Animated.View className="gap-5" style={cardAnimatedStyle}>
                <View
                  className="rounded-[32px] border border-zinc-700/55 bg-[#080808]/80 p-6"
                  style={styles.formCard}
                >
                  <View className="mb-6">
                    <Text className="text-sm text-zinc-400">
                      Sign in with your LMS creds.
                    </Text>
                  </View>

                  <View className="gap-4">
                    <View className="gap-2">
                      <Text className="ml-1 text-xs font-medium uppercase tracking-[2px] text-zinc-400">
                        Roll Number
                      </Text>
                      <Input
                        placeholder="Enter your lms username"
                        value={username}
                        onChangeText={handleUsernameChange}
                        autoCapitalize="none"
                        autoCorrect={false}
                        autoComplete="username"
                        textContentType="username"
                        importantForAutofill="yes"
                        placeholderTextColor="#71717A"
                        style={styles.input}
                        returnKeyType="next"
                        onFocus={scrollToForm}
                        blurOnSubmit={false}
                      />
                    </View>

                    <View className="gap-2">
                      <Text className="ml-1 text-xs font-medium uppercase tracking-[2px] text-zinc-400">
                        Password
                      </Text>
                      <Input
                        placeholder="Enter your lms password"
                        value={password}
                        onChangeText={handlePasswordChange}
                        secureTextEntry
                        autoCapitalize="none"
                        autoCorrect={false}
                        autoComplete="password"
                        textContentType="password"
                        importantForAutofill="yes"
                        placeholderTextColor="#71717A"
                        style={styles.input}
                        returnKeyType="go"
                        onFocus={scrollToForm}
                        onSubmitEditing={() => {
                          if (canSubmit) {
                            void handleLogin();
                          }
                        }}
                      />
                    </View>

                    {error ? (
                      <View className="flex-row items-start gap-2 rounded-xl border border-red-500/40 bg-red-500/10 px-3 py-2.5">
                        <MaterialCommunityIcons
                          name="alert-circle-outline"
                          size={16}
                          color="#FCA5A5"
                        />
                        <Text className="flex-1 text-xs leading-5 text-red-200">
                          {error}
                        </Text>
                      </View>
                    ) : null}

                    <Button
                      title="Sign In"
                      onPress={handleLogin}
                      loading={isLoading}
                      disabled={!canSubmit}
                    />

                    <Text className="pt-2 text-center text-[11px] text-zinc-500">
                      Credentials are encrypted and stored locally.
                    </Text>
                  </View>
                </View>
              </Animated.View>
            </View>
          </ScrollView>
        </SafeAreaView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  absoluteFill: {
    ...StyleSheet.absoluteFillObject,
  },
  input: {
    backgroundColor: "rgba(21, 21, 23, 0.92)",
    borderColor: "#2F2F35",
    color: "#F5F5F5",
  },
  contentShell: {
    width: "100%",
    maxWidth: 520,
    alignSelf: "center",
    gap: 30,
  },
  formCard: {
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.3,
    shadowRadius: 24,
    elevation: 8,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: "center",
    paddingVertical: 28,
  },
  scrollContentKeyboard: {
    justifyContent: "flex-start",
    paddingTop: 20,
    paddingBottom: 24,
  },
});
