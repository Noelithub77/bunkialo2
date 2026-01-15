import { Pressable, Text, StyleSheet, ActivityIndicator, ViewStyle } from 'react-native'
import { LinearGradient } from 'expo-linear-gradient'
import { Colors, Gradients, Radius, Spacing } from '@/constants/theme'
import { useColorScheme } from '@/hooks/use-color-scheme'

interface ButtonProps {
  title: string
  onPress: () => void
  loading?: boolean
  disabled?: boolean
  variant?: 'primary' | 'secondary' | 'ghost'
  style?: ViewStyle
}

export function Button({ 
  title, 
  onPress, 
  loading = false, 
  disabled = false,
  variant = 'primary',
  style,
}: ButtonProps) {
  const colorScheme = useColorScheme()
  const isDark = colorScheme === 'dark'
  const isDisabled = disabled || loading

  if (variant === 'ghost') {
    return (
      <Pressable
        onPress={onPress}
        disabled={isDisabled}
        style={({ pressed }) => [
          styles.ghost,
          pressed && styles.pressed,
          isDisabled && styles.disabled,
          style,
        ]}
      >
        <Text style={[styles.ghostText, { color: isDark ? Colors.white : Colors.black }]}>
          {title}
        </Text>
      </Pressable>
    )
  }

  if (variant === 'secondary') {
    return (
      <Pressable
        onPress={onPress}
        disabled={isDisabled}
        style={({ pressed }) => [
          styles.secondary,
          { borderColor: isDark ? Colors.gray[700] : Colors.gray[300] },
          pressed && styles.pressed,
          isDisabled && styles.disabled,
          style,
        ]}
      >
        {loading ? (
          <ActivityIndicator color={isDark ? Colors.white : Colors.black} />
        ) : (
          <Text style={[styles.secondaryText, { color: isDark ? Colors.white : Colors.black }]}>
            {title}
          </Text>
        )}
      </Pressable>
    )
  }

  return (
    <Pressable
      onPress={onPress}
      disabled={isDisabled}
      style={({ pressed }) => [
        styles.wrapper,
        pressed && styles.pressed,
        isDisabled && styles.disabled,
        style,
      ]}
    >
      <LinearGradient
        colors={Gradients.dark.button as [string, string]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.gradient}
      >
        {loading ? (
          <ActivityIndicator color={Colors.white} />
        ) : (
          <Text style={styles.text}>{title}</Text>
        )}
      </LinearGradient>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  wrapper: {
    borderRadius: Radius.md,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: Colors.gray[700],
  },
  gradient: {
    height: 52,
    justifyContent: 'center',
    alignItems: 'center',
  },
  text: {
    color: Colors.white,
    fontSize: 16,
    fontWeight: '600',
  },
  pressed: {
    opacity: 0.8,
  },
  disabled: {
    opacity: 0.5,
  },
  secondary: {
    height: 52,
    borderRadius: Radius.md,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  secondaryText: {
    fontSize: 16,
    fontWeight: '600',
  },
  ghost: {
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  ghostText: {
    fontSize: 14,
    fontWeight: '500',
  },
})
