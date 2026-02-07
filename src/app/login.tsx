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
  Platform,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import {
  KeyboardAwareScrollView,
  KeyboardProvider,
} from "react-native-keyboard-controller";
import { SafeAreaView } from "react-native-safe-area-context";

export default function LoginScreen() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const { login, isLoading, error, setError } = useAuthStore();
  const { width, height } = useWindowDimensions();
  const heroProgress = useRef(new Animated.Value(0)).current;
  const cardProgress = useRef(new Animated.Value(0)).current;
  const isLandscape = width > height;
  const isCompactHeight = height < 780;

  useEffect(() => {
    heroProgress.setValue(0);
    cardProgress.setValue(0);

    Animated.parallel([
      Animated.timing(heroProgress, {
        toValue: 1,
        duration: 150,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(cardProgress, {
        toValue: 1,
        duration: 190,
        delay: 30,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start();
  }, [cardProgress, heroProgress]);

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
        speed={3.2}
        intensity={0.13}
        size={1.8}
        amplitude={0.16}
        brightness={0.02}
        style={styles.absoluteFill}
      />
      <View className="absolute inset-0 bg-black/28" />

      <KeyboardProvider>
        <SafeAreaView
          className="flex-1"
          edges={["top", "bottom"]}
          style={[
            styles.safeArea,
            isCompactHeight && styles.safeAreaCompact,
            isLandscape && styles.safeAreaLandscape,
          ]}
        >
          <KeyboardAwareScrollView
            className="flex-1"
            contentContainerStyle={[
              styles.scrollContent,
              isCompactHeight && styles.scrollContentCompact,
              isLandscape && styles.scrollContentLandscape,
            ]}
            bottomOffset={24}
            extraKeyboardSpace={32}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode={
              Platform.OS === "ios" ? "interactive" : "on-drag"
            }
            showsVerticalScrollIndicator={false}
          >
            <View
              style={[
                styles.contentShell,
                isCompactHeight && styles.contentShellCompact,
                isLandscape && styles.contentShellLandscape,
              ]}
            >
              <Animated.View
                className="gap-4"
                style={[
                  heroAnimatedStyle,
                  styles.heroBlock,
                  isLandscape && styles.heroBlockLandscape,
                ]}
              >
                <View className="self-start rounded-full border border-zinc-700/55 bg-black/40 px-4 py-2">
                  <Text className="text-[11px] font-semibold uppercase tracking-[2.6px] text-zinc-300">
                    sign-in
                  </Text>
                </View>

                <View className="gap-3">
                  <Text
                    className="font-black tracking-[-2px] text-zinc-100"
                    style={[
                      styles.title,
                      isCompactHeight && styles.titleCompact,
                      isLandscape && styles.titleLandscape,
                    ]}
                  >
                    Bunkialo
                  </Text>
                  <Text
                    className="text-zinc-300"
                    style={[
                      styles.subtitle,
                      isCompactHeight && styles.subtitleCompact,
                      isLandscape && styles.subtitleLandscape,
                    ]}
                  >
                    Sign in once to keep attendance, assignments, and reminders
                    synced.
                  </Text>
                </View>
              </Animated.View>

              <Animated.View
                className="gap-5"
                style={[
                  cardAnimatedStyle,
                  styles.cardBlock,
                  isLandscape && styles.cardBlockLandscape,
                ]}
              >
                <View
                  className="rounded-[32px] border border-zinc-700/55 bg-[#080808]/80 p-6"
                  style={styles.formCard}
                >
                  <View className="gap-4">
                    <View className="gap-2">
                      <Text className="ml-1 text-xs font-medium uppercase tracking-[2px] text-zinc-400">
                        Roll Number
                      </Text>
                      <Input
                        placeholder="lms username"
                        value={username}
                        onChangeText={handleUsernameChange}
                        nativeID="username"
                        autoCapitalize="none"
                        autoCorrect={false}
                        autoComplete={
                          Platform.OS === "android" ? "username" : undefined
                        }
                        textContentType={
                          Platform.OS === "ios" ? "username" : undefined
                        }
                        importantForAutofill="yes"
                        placeholderTextColor="#71717A"
                        style={styles.input}
                        keyboardType="default"
                        inputMode="text"
                        returnKeyType="next"
                      />
                    </View>

                    <View className="gap-2">
                      <Text className="ml-1 text-xs font-medium uppercase tracking-[2px] text-zinc-400">
                        Password
                      </Text>
                      <View style={styles.passwordWrap}>
                        <Input
                          placeholder="lms password"
                          value={password}
                          onChangeText={handlePasswordChange}
                          nativeID="password"
                          secureTextEntry={!showPassword}
                          autoCapitalize="none"
                          autoCorrect={false}
                          autoComplete={
                            Platform.OS === "android" ? "password" : undefined
                          }
                          textContentType={
                            Platform.OS === "ios" ? "password" : undefined
                          }
                          importantForAutofill="yes"
                          placeholderTextColor="#71717A"
                          style={styles.passwordInput}
                          returnKeyType="go"
                          onSubmitEditing={() => {
                            if (canSubmit) {
                              void handleLogin();
                            }
                          }}
                        />
                        <Pressable
                          onPress={() => setShowPassword((prev) => !prev)}
                          style={styles.eyeButton}
                          accessibilityRole="button"
                          accessibilityLabel={
                            showPassword ? "Hide password" : "Show password"
                          }
                        >
                          <MaterialCommunityIcons
                            name={
                              showPassword ? "eye-off-outline" : "eye-outline"
                            }
                            size={20}
                            color="#A1A1AA"
                          />
                        </Pressable>
                      </View>
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
          </KeyboardAwareScrollView>
        </SafeAreaView>
      </KeyboardProvider>
    </View>
  );
}

const styles = StyleSheet.create({
  absoluteFill: {
    ...StyleSheet.absoluteFillObject,
  },
  safeArea: {
    paddingHorizontal: 24,
    paddingBottom: 32,
  },
  safeAreaCompact: {
    paddingHorizontal: 18,
    paddingBottom: 20,
  },
  safeAreaLandscape: {
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  input: {
    backgroundColor: "rgba(21, 21, 23, 0.92)",
    borderColor: "#2F2F35",
    color: "#F5F5F5",
  },
  passwordWrap: {
    position: "relative",
  },
  passwordInput: {
    backgroundColor: "rgba(21, 21, 23, 0.92)",
    borderColor: "#2F2F35",
    color: "#F5F5F5",
    paddingRight: 48,
  },
  eyeButton: {
    position: "absolute",
    right: 14,
    top: 14,
    height: 24,
    width: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    fontSize: 54,
    lineHeight: 56,
  },
  titleCompact: {
    fontSize: 46,
    lineHeight: 50,
  },
  titleLandscape: {
    fontSize: 48,
    lineHeight: 50,
  },
  subtitle: {
    maxWidth: 340,
    fontSize: 16,
    lineHeight: 32,
  },
  subtitleCompact: {
    fontSize: 14,
    lineHeight: 26,
  },
  subtitleLandscape: {
    maxWidth: 420,
  },
  contentShell: {
    width: "100%",
    maxWidth: 520,
    alignSelf: "center",
    gap: 30,
  },
  contentShellCompact: {
    gap: 24,
  },
  contentShellLandscape: {
    maxWidth: 980,
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 20,
  },
  heroBlock: {
    width: "100%",
  },
  heroBlockLandscape: {
    width: "44%",
    paddingTop: 8,
  },
  cardBlock: {
    width: "100%",
  },
  cardBlockLandscape: {
    width: "56%",
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
  scrollContentCompact: {
    justifyContent: "flex-start",
    paddingTop: 18,
    paddingBottom: 16,
  },
  scrollContentLandscape: {
    justifyContent: "center",
    paddingVertical: 12,
  },
});
