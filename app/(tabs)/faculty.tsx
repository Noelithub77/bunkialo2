import { FacultyCard } from '@/components/faculty-card'
import { Container } from '@/components/ui/container'
import { Colors, Radius, Spacing } from '@/constants/theme'
import { useColorScheme } from '@/hooks/use-color-scheme'
import { getTopFaculty, searchFaculty, useFacultyStore } from '@/stores/faculty-store'
import type { Faculty } from '@/types'
import { Ionicons } from '@expo/vector-icons'
import { router } from 'expo-router'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native'

const DEBOUNCE_MS = 150

export default function FacultyScreen() {
  const colorScheme = useColorScheme()
  const isDark = colorScheme === 'dark'
  const theme = isDark ? Colors.dark : Colors.light

  const {
    faculties,
    topFacultyIds,
    recentSearches,
    loadFaculty,
    addRecentSearch,
    removeRecentSearch,
    clearRecentSearches,
  } = useFacultyStore()

  const [searchQuery, setSearchQuery] = useState('')
  const [debouncedQuery, setDebouncedQuery] = useState('')
  const [isSearchFocused, setIsSearchFocused] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (faculties.length === 0) {
      loadFaculty()
    }
  }, [])

  // debounced search
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      setDebouncedQuery(searchQuery)
    }, DEBOUNCE_MS)
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [searchQuery])

  const searchResults = useMemo(() => {
    if (!debouncedQuery.trim()) return []
    return searchFaculty(faculties, debouncedQuery)
  }, [faculties, debouncedQuery])

  const topFaculty = useMemo(() => {
    return getTopFaculty(faculties, topFacultyIds)
  }, [faculties, topFacultyIds])

  const handleFacultyPress = useCallback((faculty: Faculty) => {
    if (searchQuery.trim()) {
      addRecentSearch(searchQuery.trim())
    }
    router.push({
      pathname: '/faculty/[id]',
      params: { id: faculty.id },
    })
  }, [searchQuery, addRecentSearch])

  const handleRecentSearchPress = (query: string) => {
    setSearchQuery(query)
    setDebouncedQuery(query) // instant update for recent searches
  }

  const isSearching = debouncedQuery.trim().length >= 2
  const showRecentSearches = !isSearching && recentSearches.length > 0
  const showTopFaculty = !isSearching && topFaculty.length > 0

  const renderHeader = () => (
    <View style={styles.headerContainer}>
      <Text style={[styles.screenTitle, { color: theme.text }]}>Faculty</Text>

      {/* search box */}
      <View
        style={[
          styles.searchBox,
          {
            backgroundColor: isDark ? Colors.gray[900] : Colors.gray[100],
            borderColor: isSearchFocused ? theme.text : 'transparent',
          },
        ]}
      >
        <Ionicons name="search" size={18} color={theme.textSecondary} />
        <TextInput
          style={[styles.searchInput, { color: theme.text }]}
          placeholder="Search by name, room, or expertise..."
          placeholderTextColor={theme.textSecondary}
          value={searchQuery}
          onChangeText={setSearchQuery}
          onFocus={() => setIsSearchFocused(true)}
          onBlur={() => setIsSearchFocused(false)}
          returnKeyType="search"
        />
        {searchQuery.length > 0 && (
          <Pressable onPress={() => setSearchQuery('')} hitSlop={8}>
            <Ionicons name="close-circle" size={18} color={theme.textSecondary} />
          </Pressable>
        )}
      </View>

      {/* recent searches */}
      {showRecentSearches && (
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { color: theme.textSecondary }]}>
              Recent Searches
            </Text>
            <Pressable onPress={clearRecentSearches} hitSlop={8}>
              <Text style={[styles.clearBtn, { color: Colors.status.danger }]}>Clear</Text>
            </Pressable>
          </View>
          <View style={styles.recentList}>
            {recentSearches.map((query) => (
              <Pressable
                key={query}
                style={[styles.recentChip, { backgroundColor: isDark ? Colors.gray[800] : Colors.gray[200] }]}
                onPress={() => handleRecentSearchPress(query)}
              >
                <Ionicons name="time-outline" size={14} color={theme.textSecondary} />
                <Text style={[styles.recentText, { color: theme.text }]}>{query}</Text>
                <Pressable
                  onPress={() => removeRecentSearch(query)}
                  hitSlop={8}
                  style={styles.removeBtn}
                >
                  <Ionicons name="close" size={14} color={theme.textSecondary} />
                </Pressable>
              </Pressable>
            ))}
          </View>
        </View>
      )}

      {/* top faculty label */}
      {showTopFaculty && !showRecentSearches && (
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: theme.textSecondary }]}>
            Top Faculty
          </Text>
        </View>
      )}

      {/* search results label */}
      {isSearching && (
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: theme.textSecondary }]}>
            {searchResults.length} result{searchResults.length !== 1 ? 's' : ''} found
          </Text>
        </View>
      )}
    </View>
  )

  const renderEmpty = () => {
    if (isSearching && searchResults.length === 0) {
      return (
        <View style={styles.empty}>
          <Ionicons name="search-outline" size={48} color={theme.textSecondary} />
          <Text style={[styles.emptyText, { color: theme.textSecondary }]}>
            No faculty found for "{debouncedQuery}"
          </Text>
        </View>
      )
    }
    return null
  }

  const displayData = isSearching ? searchResults : topFaculty

  return (
    <Container>
      <FlatList
        data={displayData}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <FacultyCard faculty={item} onPress={() => handleFacultyPress(item)} />
        )}
        ListHeaderComponent={renderHeader}
        ListEmptyComponent={renderEmpty}
        contentContainerStyle={styles.list}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        keyboardShouldPersistTaps="handled"
      />
    </Container>
  )
}

const styles = StyleSheet.create({
  list: {
    padding: Spacing.md,
    paddingBottom: Spacing.xxl,
  },
  headerContainer: {
    marginBottom: Spacing.md,
  },
  screenTitle: {
    fontSize: 28,
    fontWeight: '700',
    marginBottom: Spacing.md,
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.md,
    height: 44,
    borderRadius: Radius.md,
    borderWidth: 1,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    height: '100%',
  },
  section: {
    marginTop: Spacing.lg,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  clearBtn: {
    fontSize: 13,
    fontWeight: '500',
  },
  recentList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  recentChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 6,
    paddingLeft: 10,
    paddingRight: 6,
    borderRadius: Radius.full,
  },
  recentText: {
    fontSize: 13,
  },
  removeBtn: {
    padding: 2,
  },
  separator: {
    height: Spacing.sm,
  },
  empty: {
    alignItems: 'center',
    paddingVertical: Spacing.xxl,
    gap: Spacing.md,
  },
  emptyText: {
    fontSize: 14,
    textAlign: 'center',
  },
})
