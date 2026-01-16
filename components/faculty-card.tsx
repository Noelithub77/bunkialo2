import { Colors, Radius, Spacing } from '@/constants/theme'
import { useColorScheme } from '@/hooks/use-color-scheme'
import type { Faculty } from '@/types'
import { Ionicons } from '@expo/vector-icons'
import { Image } from 'expo-image'
import * as Linking from 'expo-linking'
import { memo } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'

interface FacultyCardProps {
  faculty: Faculty
  onPress: () => void
}

export const FacultyCard = memo(function FacultyCard({ faculty, onPress }: FacultyCardProps) {
  const colorScheme = useColorScheme()
  const isDark = colorScheme === 'dark'
  const theme = isDark ? Colors.dark : Colors.light

  const handlePhone = () => {
    if (faculty.contact.phone) {
      const phone = faculty.contact.phone.replace(/[^0-9+]/g, '')
      Linking.openURL(`tel:${phone}`)
    }
  }

  const handleEmail = () => {
    if (faculty.contact.email) {
      Linking.openURL(`mailto:${faculty.contact.email}`)
    }
  }

  const handleWebpage = () => {
    if (faculty.page.link) {
      Linking.openURL(faculty.page.link)
    }
  }

  return (
    <Pressable
      style={[styles.card, { backgroundColor: theme.backgroundSecondary }]}
      onPress={onPress}
    >
      <View style={styles.header}>
        {faculty.imageUrl ? (
          <Image
            source={{ uri: faculty.imageUrl }}
            style={styles.avatar}
            contentFit="cover"
          />
        ) : (
          <View style={[styles.avatar, styles.avatarPlaceholder, { backgroundColor: theme.border }]}>
            <Ionicons name="person" size={24} color={theme.textSecondary} />
          </View>
        )}

        <View style={styles.info}>
          <Text style={[styles.name, { color: theme.text }]} numberOfLines={1}>
            {faculty.name}
          </Text>
          <Text style={[styles.designation, { color: theme.textSecondary }]} numberOfLines={1}>
            {faculty.designation}
          </Text>
          {faculty.contact.room && (
            <View style={styles.roomRow}>
              <Ionicons name="location-outline" size={12} color={Colors.status.info} />
              <Text style={[styles.room, { color: Colors.status.info }]}>
                {faculty.contact.room}
              </Text>
            </View>
          )}
        </View>
      </View>

      <View style={styles.actions}>
        {faculty.contact.phone && (
          <Pressable
            style={[styles.actionBtn, { backgroundColor: isDark ? Colors.gray[800] : Colors.gray[200] }]}
            onPress={handlePhone}
            hitSlop={8}
          >
            <Ionicons name="call-outline" size={18} color={theme.text} />
          </Pressable>
        )}
        {faculty.contact.email && (
          <Pressable
            style={[styles.actionBtn, { backgroundColor: isDark ? Colors.gray[800] : Colors.gray[200] }]}
            onPress={handleEmail}
            hitSlop={8}
          >
            <Ionicons name="mail-outline" size={18} color={theme.text} />
          </Pressable>
        )}
        {faculty.page.link && (
          <Pressable
            style={[styles.actionBtn, { backgroundColor: isDark ? Colors.gray[800] : Colors.gray[200] }]}
            onPress={handleWebpage}
            hitSlop={8}
          >
            <Ionicons name="globe-outline" size={18} color={theme.text} />
          </Pressable>
        )}
      </View>
    </Pressable>
  )
})

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: Spacing.md,
    borderRadius: Radius.md,
    gap: Spacing.md,
  },
  header: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: Radius.full,
  },
  avatarPlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  info: {
    flex: 1,
    gap: 2,
  },
  name: {
    fontSize: 15,
    fontWeight: '600',
  },
  designation: {
    fontSize: 12,
  },
  roomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
  },
  room: {
    fontSize: 11,
    fontWeight: '500',
  },
  actions: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  actionBtn: {
    width: 36,
    height: 36,
    borderRadius: Radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
})
