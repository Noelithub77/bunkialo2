import { FacultyCard } from "@/components/faculty/faculty-card";
import { Container } from "@/components/ui/container";
import { Colors } from "@/constants/theme";
import { useColorScheme } from "@/hooks/use-color-scheme";
import {
    getTopFaculty,
    searchFacultyWithMatches,
    useFacultyStore,
} from "@/stores/faculty-store";
import type { Faculty } from "@/types";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { FlatList, Keyboard, Pressable, Text, TextInput, View } from "react-native";

export default function FacultyScreen() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";
  const theme = isDark ? Colors.dark : Colors.light;

  const {
    faculties,
    topFacultyIds,
    recentSearches,
    loadFaculty,
    addRecentSearch,
    removeRecentSearch,
    clearRecentSearches,
  } = useFacultyStore();

  const [searchQuery, setSearchQuery] = useState("");
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const inputRef = useRef<TextInput>(null);

  useEffect(() => {
    if (faculties.length === 0) loadFaculty();
  }, []);

  // instant search - no debounce needed for 136 items
  const searchResults = useMemo(() => {
    return searchFacultyWithMatches(searchQuery);
  }, [searchQuery]);
  const searchMatchMap = useMemo(() => {
    return new Map(
      searchResults.map((result) => [result.faculty.id, result.matchedFields]),
    );
  }, [searchResults]);

  const topFaculty = useMemo(() => {
    return getTopFaculty(faculties, topFacultyIds);
  }, [faculties, topFacultyIds]);

  const handleFacultyPress = useCallback(
    (faculty: Faculty) => {
      if (searchQuery.trim()) addRecentSearch(searchQuery.trim());
      Keyboard.dismiss();
      router.push({ pathname: "/faculty/[id]", params: { id: faculty.id } });
    },
    [searchQuery, addRecentSearch],
  );

  const handleRecentSearchPress = useCallback((query: string) => {
    setSearchQuery(query);
    inputRef.current?.focus();
  }, []);

  const handleClearSearch = useCallback(() => {
    setSearchQuery("");
    inputRef.current?.focus();
  }, []);

  const handleSubmit = useCallback(() => {
    Keyboard.dismiss();
  }, []);

  const isSearching = searchQuery.trim().length > 0;
  const showRecentSearches = !isSearching && recentSearches.length > 0;
  const showTopFaculty = !isSearching && topFaculty.length > 0;
  const displayData = isSearching
    ? searchResults.map((result) => result.faculty)
    : topFaculty;

  const renderItem = useCallback(
    ({ item }: { item: Faculty }) => (
      <FacultyCard
        faculty={item}
        onPress={() => handleFacultyPress(item)}
        matchedFields={
          isSearching ? searchMatchMap.get(item.id) : undefined
        }
      />
    ),
    [handleFacultyPress, isSearching, searchMatchMap],
  );

  const keyExtractor = useCallback((item: Faculty) => item.id, []);

  const ItemSeparator = useCallback(
    () => <View style={styles.separator} />,
    [],
  );

  return (
    <Container>
      {/* fixed search header - outside FlatList to prevent keyboard dismiss */}
      <View className="px-4 pt-4">
        <Text className="mb-4 text-[28px] font-bold" style={{ color: theme.text }}>
          Faculty
        </Text>

        <View
          className="h-11 flex-row items-center gap-3 rounded-xl border px-4"
          style={{
            backgroundColor: isDark ? Colors.gray[900] : Colors.gray[100],
            borderColor: isSearchFocused ? theme.text : "transparent",
          }}
        >
          <Ionicons name="search" size={18} color={theme.textSecondary} />
          <TextInput
            ref={inputRef}
            className="h-full flex-1 text-[15px]"
            style={{ color: theme.text }}
            placeholder="Search by name, phone, qualification, room, or expertise..."
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
              <Ionicons
                name="close-circle"
                size={18}
                color={theme.textSecondary}
              />
            </Pressable>
          )}
        </View>

        {/* recent searches */}
        {showRecentSearches && (
          <View className="mt-6">
            <View className="mb-2 flex-row items-center justify-between">
              <Text
                className="text-[13px] font-semibold uppercase tracking-[0.5px]"
                style={{ color: theme.textSecondary }}
              >
                Recent Searches
              </Text>
              <Pressable onPress={clearRecentSearches} hitSlop={8}>
                <Text className="text-[13px] font-medium" style={{ color: Colors.status.danger }}>
                  Clear
                </Text>
              </Pressable>
            </View>
            <View className="flex-row flex-wrap gap-2">
              {recentSearches.map((query) => (
                <Pressable
                  key={query}
                  className="flex-row items-center gap-1.5 rounded-full py-1.5 pl-2.5 pr-1.5"
                  style={{
                    backgroundColor: isDark ? Colors.gray[800] : Colors.gray[200],
                  }}
                  onPress={() => handleRecentSearchPress(query)}
                >
                  <Ionicons
                    name="time-outline"
                    size={14}
                    color={theme.textSecondary}
                  />
                  <Text className="text-[13px]" style={{ color: theme.text }}>
                    {query}
                  </Text>
                  <Pressable
                    onPress={() => removeRecentSearch(query)}
                    hitSlop={8}
                    className="p-0.5"
                  >
                    <Ionicons
                      name="close"
                      size={14}
                      color={theme.textSecondary}
                    />
                  </Pressable>
                </Pressable>
              ))}
            </View>
          </View>
        )}

        {/* section labels */}
        {showTopFaculty && !showRecentSearches && (
          <View className="mt-6">
            <Text
              className="text-[13px] font-semibold uppercase tracking-[0.5px]"
              style={{ color: theme.textSecondary }}
            >
              Top Faculty
            </Text>
          </View>
        )}

        {isSearching && (
          <View className="mt-6">
            <Text
              className="text-[13px] font-semibold uppercase tracking-[0.5px]"
              style={{ color: theme.textSecondary }}
            >
              {searchResults.length} result
              {searchResults.length !== 1 ? "s" : ""} found
            </Text>
          </View>
        )}
      </View>

      {/* results list */}
      <FlatList
        data={displayData}
        keyExtractor={keyExtractor}
        renderItem={renderItem}
        contentContainerStyle={{ padding: 16, paddingBottom: 32 }}
        ItemSeparatorComponent={ItemSeparator}
        keyboardShouldPersistTaps="always"
        removeClippedSubviews={true}
        maxToRenderPerBatch={15}
        windowSize={10}
        ListEmptyComponent={
          isSearching && searchResults.length === 0 ? (
            <View className="items-center gap-4 py-8">
              <Ionicons
                name="search-outline"
                size={48}
                color={theme.textSecondary}
              />
              <Text className="text-center text-sm" style={{ color: theme.textSecondary }}>
                No faculty found for &quot;{searchQuery}&quot;
              </Text>
            </View>
          ) : null
        }
      />
    </Container>
  );
}

const styles = {
  separator: { height: 8 },
};
