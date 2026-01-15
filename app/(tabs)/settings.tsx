import { View, Text, StyleSheet, Alert } from 'react-native'
import { router } from 'expo-router'
import { Container } from '@/components/ui/container'
import { Button } from '@/components/ui/button'
import { GradientCard } from '@/components/ui/gradient-card'
import { useAuthStore } from '@/stores/auth-store'
import { useAttendanceStore } from '@/stores/attendance-store'
import { useColorScheme } from '@/hooks/use-color-scheme'
import { Colors, Spacing } from '@/constants/theme'

export default function SettingsScreen() {
  const colorScheme = useColorScheme()
  const isDark = colorScheme === 'dark'
  const theme = isDark ? Colors.dark : Colors.light
  
  const { username, logout } = useAuthStore()
  const { fetchAttendance, clearAttendance, isLoading } = useAttendanceStore()

  const handleLogout = () => {
    Alert.alert(
      'Logout',
      'Are you sure you want to logout?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Logout',
          style: 'destructive',
          onPress: async () => {
            clearAttendance()
            await logout()
            router.replace('/login')
          },
        },
      ]
    )
  }

  const handleRefresh = () => {
    fetchAttendance()
  }

  const handleClearCache = () => {
    Alert.alert(
      'Clear Cache',
      'This will remove all cached attendance data. You will need to refresh to see data again.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear',
          style: 'destructive',
          onPress: () => clearAttendance(),
        },
      ]
    )
  }

  return (
    <Container>
      <View style={styles.content}>
        <Text style={[styles.title, { color: theme.text }]}>Settings</Text>

        <GradientCard>
          <View style={styles.userSection}>
            <Text style={[styles.label, { color: theme.textSecondary }]}>
              Logged in as
            </Text>
            <Text style={[styles.username, { color: theme.text }]}>
              {username}
            </Text>
          </View>
        </GradientCard>

        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: theme.textSecondary }]}>
            Data
          </Text>
          <View style={styles.buttons}>
            <Button
              title="Refresh Attendance"
              onPress={handleRefresh}
              loading={isLoading}
              variant="secondary"
            />
            <Button
              title="Clear Cache"
              onPress={handleClearCache}
              variant="ghost"
            />
          </View>
        </View>

        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: theme.textSecondary }]}>
            Account
          </Text>
          <Button
            title="Logout"
            onPress={handleLogout}
            variant="secondary"
          />
        </View>

        <View style={styles.footer}>
          <Text style={[styles.footerText, { color: theme.textSecondary }]}>
            Bunkialo v1.0.0
          </Text>
          <Text style={[styles.footerText, { color: theme.textSecondary }]}>
            IIIT Kottayam LMS Attendance Tracker
          </Text>
        </View>
      </View>
    </Container>
  )
}

const styles = StyleSheet.create({
  content: {
    flex: 1,
    padding: Spacing.lg,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    marginBottom: Spacing.lg,
  },
  userSection: {
    gap: 4,
  },
  label: {
    fontSize: 13,
  },
  username: {
    fontSize: 18,
    fontWeight: '600',
  },
  section: {
    marginTop: Spacing.xl,
  },
  sectionTitle: {
    fontSize: 13,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: Spacing.md,
  },
  buttons: {
    gap: Spacing.sm,
  },
  footer: {
    marginTop: 'auto',
    alignItems: 'center',
    gap: 4,
  },
  footerText: {
    fontSize: 12,
  },
})
