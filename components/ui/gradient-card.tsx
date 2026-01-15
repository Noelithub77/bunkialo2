import { StyleSheet, ViewProps, View } from 'react-native'
import { LinearGradient } from 'expo-linear-gradient'
import { Colors, Gradients, Radius, Spacing } from '@/constants/theme'
import { useColorScheme } from '@/hooks/use-color-scheme'

interface GradientCardProps extends ViewProps {
  variant?: 'card' | 'header' | 'button'
}

export function GradientCard({ children, style, variant = 'card', ...props }: GradientCardProps) {
  const colorScheme = useColorScheme()
  const isDark = colorScheme === 'dark'
  const gradients = isDark ? Gradients.dark : Gradients.light
  const colors = gradients[variant] as [string, string]

  return (
    <View style={[styles.wrapper, style]} {...props}>
      <LinearGradient
        colors={colors}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.gradient}
      >
        <View style={styles.content}>
          {children}
        </View>
      </LinearGradient>
    </View>
  )
}

const styles = StyleSheet.create({
  wrapper: {
    borderRadius: Radius.lg,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: Colors.gray[800],
  },
  gradient: {
    flex: 1,
  },
  content: {
    padding: Spacing.md,
  },
})
