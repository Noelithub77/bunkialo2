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
  Keyboard,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native'

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
  const [isSearchFocused, setIsSearchFocused] = useState(false)
  const inputRef = useRef<TextInput>(null)

  useEffect(() => {
    if (faculties.length === 0) loadFaculty()
  }, [])

  // instant search - no debounce needed for 136 items
  const searchResults = useMemo(() => {
    if (!searchQuery.trim()) return []
    return searchFaculty(searchQuery)
  }, [searchQuery])

  const topFaculty = useMemo(() => {
    return getTopFaculty(faculties, topFacultyIds)
  }, [faculties, topFacultyIds])

  const handleFacultyPress = useCallback((faculty: Faculty) => {
    if (searchQuery.trim()) addRecentSearch(searchQuery.trim())
    Keyboard.dismiss()
    router.push({ pathname: '/faculty/[id]', params: { id: faculty.id } })
  }, [searchQuery, addRecentSearch])

  const handleRecentSearchPress = useCallback((query: string) => {
    setSearchQuery(query)
    inputRef.current?.focus()
  }, [])

  const handleClearSearch = useCallback(() => {
    setSearchQuery('')
    inputRef.current?.focus()
  }, [])

  const handleSubmit = useCallback(() => {
    Keyboard.dismiss()
  }, [])

  const isSearching = searchQuery.trim().length > 0
  const showRecentSearches = !isSearching && recentSearches.length > 0
  const showTopFaculty = !isSearching && topFaculty.length > 0
  const displayData = isSearching ? searchResults : topFaculty

  const renderItem = useCallback(({ item }: { item: Faculty }) => (
    <FacultyCard faculty={item} onPress={() => handleFacultyPress(item)} />
  ), [handleFacultyPress])

  const keyExtractor = useCallback((item: Faculty) => item.id, [])

  const ItemSeparator = useCallback(() => <View style={styles.separator} />, [])

  return (
    <Container>
      {/* fixed search header - outside FlatList to prevent keyboard dismiss */}
      <View style={styles.header}>
        <Text style={[styles.screenTitle, { color: theme.text }]}>Faculty</Text>

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
            ref={inputRef}
            style={[styles.searchInput, { color: theme.text }]}
            placeholder="Search by name, room, or expertise..."
            placeholderTextColor={theme.textSecondary}
            value={searchQuery}
            onChangeText={setSearchQuery}
            onFocus={() => setIsSearchFocused(true)}
            onBlur={() => setIsSearchFocused(false)}
            onSubmitEditing={handleSubmit}
            returnKeyType="search"
            autoCorrect={false}
          />
          {searchQuery.length > 0 && (
            <Pressable onPress={handleClearSearch} hitSlop={8}>
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

        {/* section labels */}
        {showTopFaculty && !showRecentSearches && (
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: theme.textSecondary }]}>
              Top Faculty
            </Text>
          </View>
        )}

        {isSearching && (
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: theme.textSecondary }]}>
              {searchResults.length} result{searchResults.length !== 1 ? 's' : ''} found
            </Text>
          </View>
        )}
      </View>

      {/* results list */}
      <FlatList
        data={displayData}
        keyExtractor={keyExtractor}
        renderItem={renderItem}
        contentContainerStyle={styles.list}
        ItemSeparatorComponent={ItemSeparator}
        keyboardShouldPersistTaps="always"
        removeClippedSubviews={true}
        maxToRenderPerBatch={15}
        windowSize={10}
        ListEmptyComponent={
          isSearching && searchResults.length === 0 ? (
            <View style={styles.empty}>
              <Ionicons name="search-outline" size={48} color={theme.textSecondary} />
              <Text style={[styles.emptyText, { color: theme.textSecondary }]}>
                No faculty found for "{searchQuery}"
              </Text>
            </View>
          ) : null
        }
      />
    </Container>
  )
}

const styles = StyleSheet.create({
  header: {
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.md,
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
  list: {
    padding: Spacing.md,
    paddingBottom: Spacing.xxl,
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
