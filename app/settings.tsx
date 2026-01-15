import { LogsSection } from '@/components/logs-section'
import { Container } from '@/components/ui/container'
import { Colors, Radius, Spacing } from '@/constants/theme'
import { useColorScheme } from '@/hooks/use-color-scheme'
import { useAttendanceStore } from '@/stores/attendance-store'
import { useAuthStore } from '@/stores/auth-store'
import { useBunkStore } from '@/stores/bunk-store'
import { useDashboardStore } from '@/stores/dashboard-store'
import { useSettingsStore } from '@/stores/settings-store'
import { Ionicons } from '@expo/vector-icons'
import { router } from 'expo-router'
import { useState } from 'react'
import { ActivityIndicator, Alert, Linking, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from 'react-native'

type SettingRowProps = {
  icon: keyof typeof Ionicons.glyphMap
  label: string
  onPress?: () => void
  loading?: boolean
  danger?: boolean
  theme: typeof Colors.light
  rightElement?: React.ReactNode
}

const SettingRow = ({ icon, label, onPress, loading, danger, theme, rightElement }: SettingRowProps) => (
  <Pressable
    style={({ pressed }) => [
      styles.row,
      { backgroundColor: pressed && onPress ? theme.backgroundSecondary : 'transparent' }
    ]}
    onPress={onPress}
    disabled={loading || !onPress}
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
    ) : rightElement ? (
      rightElement
    ) : onPress ? (
      <Ionicons name="chevron-forward" size={18} color={theme.textSecondary} />
    ) : null}
  </Pressable>
)

export default function SettingsScreen() {
  const colorScheme = useColorScheme()
  const isDark = colorScheme === 'dark'
  const theme = isDark ? Colors.dark : Colors.light

  const { username, logout } = useAuthStore()
  const { fetchAttendance, clearAttendance, isLoading } = useAttendanceStore()
  const { resetToLms } = useBunkStore()
  const { logs, clearLogs } = useDashboardStore()
  const { refreshIntervalMinutes, reminders, notificationsEnabled, setRefreshInterval, addReminder, removeReminder, toggleNotifications } = useSettingsStore()

  const [newReminder, setNewReminder] = useState('')

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
    Alert.alert('Clear Cache', 'Remove all cached data?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Clear', style: 'destructive', onPress: clearAttendance },
    ])
  }

  const handleResetBunks = () => {
    Alert.alert(
      'Reset Bunks to LMS',
      'This will remove all your notes, duty leaves, and course configs.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Reset', style: 'destructive', onPress: resetToLms },
      ]
    )
  }

  const handleSetRefreshInterval = () => {
    Alert.alert(
      'Refresh Interval',
      'Choose refresh interval in minutes',
      [
        { text: '5 min', onPress: () => setRefreshInterval(5) },
        { text: '15 min', onPress: () => setRefreshInterval(15) },
        { text: '30 min', onPress: () => setRefreshInterval(30) },
        { text: '60 min', onPress: () => setRefreshInterval(60) },
        { text: 'Cancel', style: 'cancel' },
      ]
    )
  }

  const handleAddReminder = () => {
    const mins = parseInt(newReminder, 10)
    if (!isNaN(mins) && mins > 0) {
      addReminder(mins)
      setNewReminder('')
    }
  }

  return (
    <Container>
      <ScrollView showsVerticalScrollIndicator={false}>
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

          {/* Dashboard Settings */}
          <Text style={[styles.sectionTitle, { color: theme.textSecondary }]}>Dashboard</Text>
          <View style={[styles.list, { borderColor: theme.border }]}>
            <SettingRow
              icon="time-outline"
              label={`Refresh: ${refreshIntervalMinutes} min`}
              onPress={handleSetRefreshInterval}
              theme={theme}
            />
            <View style={[styles.divider, { backgroundColor: theme.border }]} />
            <SettingRow
              icon="notifications-outline"
              label="Notifications"
              theme={theme}
              rightElement={
                <Switch
                  value={notificationsEnabled}
                  onValueChange={toggleNotifications}
                  trackColor={{ false: theme.border, true: Colors.status.success }}
                  thumbColor={Colors.white}
                />
              }
            />
          </View>

          {/* Custom Reminders */}
          <Text style={[styles.sectionTitle, { color: theme.textSecondary }]}>Custom Reminders</Text>
          <View style={[styles.list, { borderColor: theme.border }]}>
            {reminders.map((mins) => (
              <View key={mins} style={styles.reminderRow}>
                <Text style={[styles.reminderText, { color: theme.text }]}>
                  {mins} min before
                </Text>
                <Pressable onPress={() => removeReminder(mins)}>
                  <Ionicons name="close-circle" size={20} color={Colors.status.danger} />
                </Pressable>
              </View>
            ))}
            <View style={styles.addReminderRow}>
              <TextInput
                style={[styles.reminderInput, { color: theme.text, borderColor: theme.border }]}
                placeholder="mins"
                placeholderTextColor={theme.textSecondary}
                value={newReminder}
                onChangeText={setNewReminder}
                keyboardType="numeric"
              />
              <Pressable style={[styles.addButton, { backgroundColor: Colors.status.info }]} onPress={handleAddReminder}>
                <Ionicons name="add" size={20} color={Colors.white} />
              </Pressable>
            </View>
          </View>

          {/* General Settings */}
          <Text style={[styles.sectionTitle, { color: theme.textSecondary }]}>General</Text>
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

          {/* Logs Section */}
          <Text style={[styles.sectionTitle, { color: theme.textSecondary }]}>Logs</Text>
          <LogsSection logs={logs} onClear={clearLogs} />

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
            </View>
            <View style={styles.ideaInfo}>
              <Text style={[styles.footerText, { color: theme.textSecondary }]}>Idea of </Text>
              <Pressable onPress={() => Linking.openURL('https://www.linkedin.com/in/srimoneyshankar-ajith-a5a6831ba/')}>
                <Text style={[styles.devLink, { color: theme.textSecondary }]}>Srimoney</Text>
              </Pressable>
              <Text style={[styles.footerText, { color: theme.textSecondary }]}> & </Text>
              <Pressable onPress={() => Linking.openURL('https://www.linkedin.com/in/niranjan-vasudevan/')}>
                <Text style={[styles.devLink, { color: theme.textSecondary }]}>Niranjan V</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </ScrollView>
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
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.xxl,
  },
  profile: {
    alignItems: 'center',
    paddingVertical: Spacing.lg,
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
  sectionTitle: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    marginTop: Spacing.lg,
    marginBottom: Spacing.sm,
    marginLeft: Spacing.xs,
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
    fontSize: 15,
  },
  divider: {
    height: 1,
    marginLeft: Spacing.md + 20 + Spacing.sm,
  },
  reminderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
  },
  reminderText: {
    fontSize: 14,
  },
  addReminderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    padding: Spacing.md,
  },
  reminderInput: {
    flex: 1,
    height: 36,
    borderRadius: Radius.sm,
    borderWidth: 1,
    paddingHorizontal: Spacing.sm,
    fontSize: 14,
  },
  addButton: {
    width: 36,
    height: 36,
    borderRadius: Radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  footer: {
    marginTop: Spacing.xl,
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
  ideaInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  devLink: {
    fontSize: 12,
    textDecorationLine: 'underline',
  },
})
