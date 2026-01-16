import { Container } from '@/components/ui/container'
import { Colors, Radius, Spacing } from '@/constants/theme'
import { useColorScheme } from '@/hooks/use-color-scheme'
import { useFacultyStore } from '@/stores/faculty-store'
import type { Faculty } from '@/types'
import { Ionicons } from '@expo/vector-icons'
import { Image } from 'expo-image'
import * as Linking from 'expo-linking'
import { router, useLocalSearchParams } from 'expo-router'
import { useMemo } from 'react'
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'

export default function FacultyDetailScreen() {
  const colorScheme = useColorScheme()
  const isDark = colorScheme === 'dark'
  const theme = isDark ? Colors.dark : Colors.light

  const { id } = useLocalSearchParams<{ id: string }>()
  const { faculties } = useFacultyStore()

  const faculty = useMemo(() => {
    return faculties.find((f) => f.id === id)
  }, [faculties, id])

  if (!faculty) {
    return (
      <Container>
        <View style={styles.notFound}>
          <Ionicons name="person-outline" size={48} color={theme.textSecondary} />
          <Text style={[styles.notFoundText, { color: theme.textSecondary }]}>
            Faculty not found
          </Text>
          <Pressable onPress={() => router.back()} style={styles.backBtn}>
            <Text style={[styles.backBtnText, { color: Colors.status.info }]}>Go Back</Text>
          </Pressable>
        </View>
      </Container>
    )
  }

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
    <Container>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* header with back button */}
        <View style={styles.header}>
          <Pressable
            onPress={() => router.back()}
            style={[styles.backIcon, { backgroundColor: theme.backgroundSecondary }]}
            hitSlop={8}
          >
            <Ionicons name="arrow-back" size={20} color={theme.text} />
          </Pressable>
        </View>

        {/* profile section */}
        <View style={styles.profileSection}>
          {faculty.imageUrl ? (
            <Image
              source={{ uri: faculty.imageUrl }}
              style={styles.avatar}
              contentFit="cover"
            />
          ) : (
            <View style={[styles.avatar, styles.avatarPlaceholder, { backgroundColor: theme.backgroundSecondary }]}>
              <Ionicons name="person" size={48} color={theme.textSecondary} />
            </View>
          )}

          <Text style={[styles.name, { color: theme.text }]}>{faculty.name}</Text>
          <Text style={[styles.designation, { color: theme.textSecondary }]}>
            {faculty.designation}
          </Text>

          {faculty.additionalRole && (
            <Text style={[styles.additionalRole, { color: Colors.status.info }]}>
              {faculty.additionalRole}
            </Text>
          )}
        </View>

        {/* quick actions */}
        <View style={styles.actionsRow}>
          {faculty.contact.phone && (
            <Pressable
              style={[styles.actionCard, { backgroundColor: theme.backgroundSecondary }]}
              onPress={handlePhone}
            >
              <Ionicons name="call" size={22} color={Colors.status.success} />
              <Text style={[styles.actionLabel, { color: theme.text }]}>Call</Text>
            </Pressable>
          )}
          {faculty.contact.email && (
            <Pressable
              style={[styles.actionCard, { backgroundColor: theme.backgroundSecondary }]}
              onPress={handleEmail}
            >
              <Ionicons name="mail" size={22} color={Colors.status.info} />
              <Text style={[styles.actionLabel, { color: theme.text }]}>Email</Text>
            </Pressable>
          )}
          {faculty.page.link && (
            <Pressable
              style={[styles.actionCard, { backgroundColor: theme.backgroundSecondary }]}
              onPress={handleWebpage}
            >
              <Ionicons name="globe" size={22} color={Colors.status.warning} />
              <Text style={[styles.actionLabel, { color: theme.text }]}>Website</Text>
            </Pressable>
          )}
        </View>

        {/* contact details */}
        <View style={[styles.card, { backgroundColor: theme.backgroundSecondary }]}>
          <Text style={[styles.cardTitle, { color: theme.text }]}>Contact</Text>

          {faculty.contact.room && (
            <View style={styles.infoRow}>
              <Ionicons name="location-outline" size={18} color={Colors.status.info} />
              <View style={styles.infoContent}>
                <Text style={[styles.infoLabel, { color: theme.textSecondary }]}>Room</Text>
                <Text style={[styles.infoValue, { color: theme.text }]}>{faculty.contact.room}</Text>
              </View>
            </View>
          )}

          {faculty.contact.phone && (
            <View style={styles.infoRow}>
              <Ionicons name="call-outline" size={18} color={theme.textSecondary} />
              <View style={styles.infoContent}>
                <Text style={[styles.infoLabel, { color: theme.textSecondary }]}>Phone</Text>
                <Text style={[styles.infoValue, { color: theme.text }]}>{faculty.contact.phone}</Text>
              </View>
            </View>
          )}

          {faculty.contact.email && (
            <View style={styles.infoRow}>
              <Ionicons name="mail-outline" size={18} color={theme.textSecondary} />
              <View style={styles.infoContent}>
                <Text style={[styles.infoLabel, { color: theme.textSecondary }]}>Email</Text>
                <Text style={[styles.infoValue, { color: theme.text }]}>{faculty.contact.email}</Text>
              </View>
            </View>
          )}
        </View>

        {/* areas of expertise */}
        {faculty.areas.length > 0 && (
          <View style={[styles.card, { backgroundColor: theme.backgroundSecondary }]}>
            <Text style={[styles.cardTitle, { color: theme.text }]}>Areas of Expertise</Text>
            <View style={styles.areasList}>
              {faculty.areas.map((area, index) => (
                <View
                  key={index}
                  style={[styles.areaChip, { backgroundColor: isDark ? Colors.gray[800] : Colors.gray[200] }]}
                >
                  <Text style={[styles.areaText, { color: theme.text }]}>{area}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* qualification */}
        {faculty.qualification && (
          <View style={[styles.card, { backgroundColor: theme.backgroundSecondary }]}>
            <Text style={[styles.cardTitle, { color: theme.text }]}>Qualification</Text>
            <Text style={[styles.qualificationText, { color: theme.textSecondary }]}>
              {faculty.qualification}
            </Text>
          </View>
        )}
      </ScrollView>
    </Container>
  )
}

const styles = StyleSheet.create({
  scrollView: {
    flex: 1,
  },
  content: {
    padding: Spacing.md,
    paddingBottom: Spacing.xxl,
  },
  header: {
    marginBottom: Spacing.md,
  },
  backIcon: {
    width: 40,
    height: 40,
    borderRadius: Radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  profileSection: {
    alignItems: 'center',
    marginBottom: Spacing.lg,
  },
  avatar: {
    width: 100,
    height: 100,
    borderRadius: Radius.full,
    marginBottom: Spacing.md,
  },
  avatarPlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  name: {
    fontSize: 22,
    fontWeight: '700',
    textAlign: 'center',
  },
  designation: {
    fontSize: 15,
    marginTop: 4,
    textAlign: 'center',
  },
  additionalRole: {
    fontSize: 13,
    marginTop: 8,
    textAlign: 'center',
    fontWeight: '500',
  },
  actionsRow: {
    flexDirection: 'row',
    gap: Spacing.md,
    marginBottom: Spacing.lg,
  },
  actionCard: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.md,
    borderRadius: Radius.md,
    gap: 6,
  },
  actionLabel: {
    fontSize: 12,
    fontWeight: '500',
  },
  card: {
    padding: Spacing.md,
    borderRadius: Radius.md,
    marginBottom: Spacing.md,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: Spacing.md,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.md,
    marginBottom: Spacing.md,
  },
  infoContent: {
    flex: 1,
  },
  infoLabel: {
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  infoValue: {
    fontSize: 14,
  },
  areasList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  areaChip: {
    paddingHorizontal: Spacing.md,
    paddingVertical: 6,
    borderRadius: Radius.full,
  },
  areaText: {
    fontSize: 13,
  },
  qualificationText: {
    fontSize: 14,
    lineHeight: 20,
  },
  notFound: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.md,
  },
  notFoundText: {
    fontSize: 16,
  },
  backBtn: {
    marginTop: Spacing.md,
  },
  backBtnText: {
    fontSize: 15,
    fontWeight: '500',
  },
})
