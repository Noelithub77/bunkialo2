import { useEffect } from 'react'
import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native'
import { Stack, router } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import { View, ActivityIndicator, StyleSheet } from 'react-native'
import 'react-native-reanimated'

import { useColorScheme } from '@/hooks/use-color-scheme'
import { useAuthStore } from '@/stores/auth-store'
import { Colors } from '@/constants/theme'

// Custom dark theme with black background
const CustomDarkTheme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    background: Colors.black,
    card: Colors.gray[900],
    border: Colors.gray[800],
  },
}

const CustomLightTheme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    background: Colors.white,
    card: Colors.white,
    border: Colors.gray[200],
  },
}

export default function RootLayout() {
  const colorScheme = useColorScheme()
  const { isLoggedIn, isLoading, checkAuth } = useAuthStore()
  const isDark = colorScheme === 'dark'

  useEffect(() => {
    checkAuth()
  }, [])

  useEffect(() => {
    if (!isLoading) {
      if (isLoggedIn) {
        router.replace('/(tabs)')
      } else {
        router.replace('/login')
      }
    }
  }, [isLoading, isLoggedIn])

  if (isLoading) {
    return (
      <View style={[styles.loading, { backgroundColor: isDark ? Colors.black : Colors.white }]}>
        <ActivityIndicator size="large" color={isDark ? Colors.white : Colors.black} />
      </View>
    )
  }

  return (
    <ThemeProvider value={isDark ? CustomDarkTheme : CustomLightTheme}>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="login" />
        <Stack.Screen name="(tabs)" />
      </Stack>
      <StatusBar style={isDark ? 'light' : 'dark'} />
    </ThemeProvider>
  )
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
})
