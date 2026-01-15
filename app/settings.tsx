import { Container } from '@/components/ui/container'
import { Colors, Radius, Spacing } from '@/constants/theme'
import { useColorScheme } from '@/hooks/use-color-scheme'
import { useAttendanceStore } from '@/stores/attendance-store'
import { useAuthStore } from '@/stores/auth-store'
import { useBunkStore } from '@/stores/bunk-store'
import { Ionicons } from '@expo/vector-icons'
import { router } from 'expo-router'
import { ActivityIndicator, Alert, Linking, Pressable, StyleSheet, Text, View } from 'react-native'

type SettingRowProps = {
  icon: keyof typeof Ionicons.glyphMap
  label: string
  onPress: () => void
  loading?: boolean
  danger?: boolean
  theme: typeof Colors.light
}

const SettingRow = ({ icon, label, onPress, loading, danger, theme }: SettingRowProps) => (
  <Pressable
    style={({ pressed }) => [
      styles.row,
      { backgroundColor: pressed ? theme.backgroundSecondary : 'transparent' }
    ]}
    onPress={onPress}
    disabled={loading}
  >
    <View style={styles.rowLeft}>
      <Ionicons
        name={icon}
        size={20}
        color={danger ? Colors.status.danger : theme.textSecondary}
      />
      <Text style={[styles.rowLabel, { color: danger ? Colors.status.danger : theme.text }]}>
        {label}
      </Text>
    </View>
    {loading ? (
      <ActivityIndicator size="small" color={theme.textSecondary} />
    ) : (
      <Ionicons name="chevron-forward" size={18} color={theme.textSecondary} />
    )}
  </Pressable>
)

export default function SettingsScreen() {
  const colorScheme = useColorScheme()
  const isDark = colorScheme === 'dark'
  const theme = isDark ? Colors.dark : Colors.light

  const { username, logout } = useAuthStore()
  const { fetchAttendance, clearAttendance, isLoading } = useAttendanceStore()
  const { resetToLms } = useBunkStore()

  const handleLogout = () => {
    Alert.alert('Logout', 'Are you sure?', [
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
    ])
  }

  const handleClearCache = () => {
    Alert.alert('Clear Cache', 'Remove all cached attendance data?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Clear', style: 'destructive', onPress: clearAttendance },
    ])
  }

  const handleResetBunks = () => {
    Alert.alert(
      'Reset Bunks to LMS',
      'This will remove all your notes, duty leaves, and course configs. LMS data becomes the sole truth.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Reset', style: 'destructive', onPress: resetToLms },
      ]
    )
  }

  return (
    <Container>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={theme.text} />
        </Pressable>
        <Text style={[styles.title, { color: theme.text }]}>Settings</Text>
        <View style={styles.placeholder} />
      </View>
      <View style={styles.content}>
        {/* Profile */}
        <View style={styles.profile}>
          <View style={[styles.avatar, { backgroundColor: theme.backgroundSecondary }]}>
            <Ionicons name="person" size={28} color={theme.textSecondary} />
          </View>
          <Text style={[styles.username, { color: theme.text }]}>{username}</Text>
        </View>

        {/* Settings list */}
        <View style={[styles.list, { borderColor: theme.border }]}>
          <SettingRow
            icon="refresh"
            label="Refresh Attendance"
            onPress={fetchAttendance}
            loading={isLoading}
            theme={theme}
          />
          <View style={[styles.divider, { backgroundColor: theme.border }]} />
          <SettingRow
            icon="trash-outline"
            label="Clear Cache"
            onPress={handleClearCache}
            theme={theme}
          />
          <View style={[styles.divider, { backgroundColor: theme.border }]} />
          <SettingRow
            icon="refresh-circle-outline"
            label="Reset Bunks to LMS"
            onPress={handleResetBunks}
            theme={theme}
          />
          <View style={[styles.divider, { backgroundColor: theme.border }]} />
          <SettingRow
            icon="log-out-outline"
            label="Logout"
            onPress={handleLogout}
            danger
            theme={theme}
          />
        </View>

        {/* Footer */}
        <View style={styles.footer}>
          <Text style={[styles.footerText, { color: theme.textSecondary }]}>
            Bunkialo v1.0.0
          </Text>
          <View style={styles.devInfo}>
            <Text style={[styles.footerText, { color: theme.textSecondary }]}>Made by </Text>
            <Pressable onPress={() => Linking.openURL('https://www.linkedin.com/in/noel-georgi/')}>
              <Text style={[styles.devLink, { color: theme.textSecondary }]}>Noel Georgi</Text>
            </Pressable>
            <Text style={[styles.footerText, { color: theme.textSecondary }]}> & </Text>
            <Pressable onPress={() => Linking.openURL('https://www.linkedin.com/in/srimoneyshankar-ajith-a5a6831ba/')}>
              <Text style={[styles.devLink, { color: theme.textSecondary }]}>Srimoney</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Container>
  )
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.md,
    marginBottom: Spacing.md,
  },
  backButton: {
    padding: Spacing.sm,
  },
  title: {
    fontSize: 20,
    fontWeight: '600',
  },
  placeholder: {
    width: 40,
  },
  content: {
    flex: 1,
    padding: Spacing.lg,
  },
  profile: {
    alignItems: 'center',
    paddingVertical: Spacing.xl,
    gap: Spacing.md,
  },
  avatar: {
    width: 72,
    height: 72,
    borderRadius: Radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  username: {
    fontSize: 20,
    fontWeight: '600',
  },
  list: {
    borderRadius: Radius.md,
    borderWidth: 1,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.md,
  },
  rowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  rowLabel: {
    fontSize: 16,
  },
  divider: {
    height: 1,
    marginLeft: Spacing.md + 20 + Spacing.sm, // icon width + gap
  },
  footer: {
    marginTop: 'auto',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  footerText: {
    fontSize: 12,
  },
  devInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  devLink: {
    fontSize: 12,
    textDecorationLine: 'underline',
  },
})
