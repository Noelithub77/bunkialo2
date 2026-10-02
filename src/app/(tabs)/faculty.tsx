import { FacultyCard } from "@/components/faculty/faculty-card";
import { Container } from "@/components/ui/container";
import { SearchInput } from "@/components/ui/search-input";
import { Colors } from "@/constants/theme";
import { hostelGroups } from "@/data/hostels";
import { useColorScheme } from "@/hooks/use-color-scheme";
import {
  searchFacultyWithMatches,
  useFacultyStore,
} from "@/stores/faculty-store";
import { useHostelPreferenceStore } from "@/stores/hostel-preference-store";
import type { Faculty } from "@/types";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  FlatList,
  Keyboard,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from "react-native";

export default function FacultyScreen() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";
  const theme = isDark ? Colors.dark : Colors.light;
  const { height: windowHeight } = useWindowDimensions();

  const {
    faculties,
    recentSearches,
    loadFaculty,
    addRecentSearch,
    removeRecentSearch,
    clearRecentSearches,
  } = useFacultyStore();
  const { selectedHostelId, selectHostel, hasHydrated } =
    useHostelPreferenceStore();
  const selectedHostel =
    hostelGroups.find((hostel) => hostel.id === selectedHostelId) ||
    hostelGroups.find((hostel) => hostel.id === "manimala")!;
  const [hostelMenuOpen, setHostelMenuOpen] = useState(false);

  const [searchQuery, setSearchQuery] = useState("");
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const inputRef = useRef<React.ComponentRef<typeof TextInput>>(null);
  const searchBlurTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (searchBlurTimer.current) clearTimeout(searchBlurTimer.current);
    },
    [],
  );

  useEffect(() => {
    if (faculties.length === 0) loadFaculty();
  }, [faculties.length, loadFaculty]);

  // instant search - no debounce needed for 136 items
  const searchResults = useMemo(() => {
    return searchFacultyWithMatches(searchQuery);
  }, [searchQuery]);
  const searchMatchMap = useMemo(() => {
    return new Map(
      searchResults.map((result) => [result.faculty.id, result.matchedFields]),
    );
  }, [searchResults]);

  const wardens = useMemo(() => {
    return selectedHostel.wardenIds
      .map((id) => faculties.find((faculty) => faculty.id === id))
      .filter((faculty): faculty is Faculty => Boolean(faculty));
  }, [faculties, selectedHostel]);

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
    setIsSearchFocused(false);
    Keyboard.dismiss();
  }, []);

  const isSearching = searchQuery.trim().length > 0;
  const showRecentSearches =
    isSearchFocused && !isSearching && recentSearches.length > 0;
  const displayData = isSearching
    ? searchResults.map((result) => result.faculty)
    : wardens;

  const renderItem = useCallback(
    ({ item }: { item: Faculty }) => (
      <FacultyCard
        faculty={item}
        onPress={() => handleFacultyPress(item)}
        matchedFields={isSearching ? searchMatchMap.get(item.id) : undefined}
        role={
          isSearching
            ? undefined
            : item.hostelRoles?.find(
                (entry) => entry.hostelId === selectedHostel.id,
              )?.role
        }
      />
    ),
    [handleFacultyPress, isSearching, searchMatchMap, selectedHostel.id],
  );

  const keyExtractor = useCallback((item: Faculty) => item.id, []);

  const ItemSeparator = useCallback(() => <View className="h-2" />, []);

  return (
    <Container>
      {/* fixed search header - outside FlatList to prevent keyboard dismiss */}
      <View className="z-20 px-4 pt-4">
        <Text
          className="mb-4 text-[28px] font-bold"
          style={{ color: theme.text }}
        >
          Faculty
        </Text>

        <View className="relative z-30">
          <SearchInput
            ref={inputRef}
            focused={isSearchFocused}
            placeholder="Search"
            value={searchQuery}
            onChangeText={setSearchQuery}
            onFocus={() => {
              if (searchBlurTimer.current)
                clearTimeout(searchBlurTimer.current);
              setIsSearchFocused(true);
              setHostelMenuOpen(false);
            }}
            onBlur={() => {
              // Allow a dropdown row to receive its press before web focus moves.
              searchBlurTimer.current = setTimeout(
                () => setIsSearchFocused(false),
                150,
              );
            }}
            onSubmitEditing={handleSubmit}
            returnKeyType="search"
            autoCorrect={false}
            onClear={handleClearSearch}
          />
          {showRecentSearches && (
            <View
              className="absolute left-0 right-0 top-full z-30 mt-2 overflow-hidden rounded-2xl border"
              style={{
                backgroundColor: isDark ? Colors.gray[900] : theme.background,
                borderColor: theme.border,
                elevation: 12,
                shadowColor: Colors.black,
                shadowOffset: { width: 0, height: 6 },
                shadowOpacity: isDark ? 0.35 : 0.12,
                shadowRadius: 14,
              }}
            >
              <View className="flex-row items-center justify-between pl-4 pr-2">
                <Text
                  className="text-[11px] font-semibold uppercase tracking-[0.5px]"
                  style={{ color: theme.textSecondary }}
                >
                  Recent
                </Text>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Clear recent searches"
                  className="h-11 w-11 items-center justify-center"
                  onPress={() => {
                    clearRecentSearches();
                    inputRef.current?.focus();
                  }}
                >
                  <Ionicons
                    name="trash-outline"
                    size={16}
                    color={theme.textSecondary}
                  />
                </Pressable>
              </View>
              <ScrollView
                style={{ maxHeight: 224 }}
                keyboardShouldPersistTaps="always"
                nestedScrollEnabled
              >
                {recentSearches.map((query) => (
                  <View
                    key={query}
                    className="flex-row items-center border-t pl-4 pr-2"
                    style={{ borderColor: theme.border }}
                  >
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={`Search for ${query}`}
                      className="min-h-12 flex-1 flex-row items-center gap-3 py-3"
                      onPress={() => handleRecentSearchPress(query)}
                    >
                      <Ionicons
                        name="time-outline"
                        size={17}
                        color={theme.textSecondary}
                      />
                      <Text
                        className="flex-1 text-[14px]"
                        numberOfLines={1}
                        style={{ color: theme.text }}
                      >
                        {query}
                      </Text>
                    </Pressable>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={`Remove recent search ${query}`}
                      className="h-11 w-11 items-center justify-center"
                      onPress={() => {
                        removeRecentSearch(query);
                        inputRef.current?.focus();
                      }}
                    >
                      <Ionicons
                        name="close"
                        size={17}
                        color={theme.textSecondary}
                      />
                    </Pressable>
                  </View>
                ))}
              </ScrollView>
            </View>
          )}
        </View>

        {/* section labels */}
        {!isSearching && (
          <View className="mb-3 mt-5">
            <Text
              className="mb-1 text-[12px] font-semibold uppercase tracking-[0.5px]"
              style={{ color: theme.textSecondary }}
            >
              Wardens
            </Text>
            <Pressable
              className="min-h-12 flex-row items-center justify-between gap-3 rounded-xl border px-3 py-2.5"
              style={{
                backgroundColor: theme.backgroundSecondary,
                borderColor: theme.border,
              }}
              accessibilityRole="button"
              accessibilityLabel={`Hostel: ${selectedHostel.name}`}
              accessibilityState={{
                expanded: hostelMenuOpen,
                disabled: !hasHydrated,
              }}
              aria-expanded={hostelMenuOpen}
              aria-disabled={!hasHydrated}
              disabled={!hasHydrated}
              onPress={() => {
                setIsSearchFocused(false);
                Keyboard.dismiss();
                setHostelMenuOpen((open) => !open);
              }}
            >
              <Ionicons
                name="home-outline"
                size={18}
                color={theme.textSecondary}
              />
              <Text
                className="flex-1 text-[15px] font-semibold"
                style={{ color: theme.text }}
              >
                {selectedHostel.name}
              </Text>
              <Ionicons
                name={hostelMenuOpen ? "chevron-up" : "chevron-down"}
                size={20}
                color={theme.text}
              />
            </Pressable>
            {hostelMenuOpen && (
              <ScrollView
                className="mt-2 overflow-hidden rounded-2xl border"
                accessibilityRole="radiogroup"
                accessibilityLabel="Hostel groups"
                style={{
                  maxHeight: Math.min(360, Math.max(224, windowHeight * 0.43)),
                  backgroundColor: theme.backgroundSecondary,
                  borderColor: theme.border,
                }}
                nestedScrollEnabled
                showsVerticalScrollIndicator
                keyboardShouldPersistTaps="handled"
              >
                {hostelGroups.map((hostel, index) => {
                  const isSelected = selectedHostel.id === hostel.id;
                  return (
                    <View key={hostel.id}>
                      {index > 0 && (
                        <View
                          className="mx-4 h-px"
                          style={{ backgroundColor: theme.border }}
                        />
                      )}
                      <Pressable
                        className="m-1.5 min-h-14 flex-row items-center justify-between gap-3 rounded-xl px-3 py-3"
                        style={{
                          backgroundColor: isSelected
                            ? isDark
                              ? "#17243A"
                              : "#EAF2FF"
                            : "transparent",
                        }}
                        android_ripple={{ color: theme.border }}
                        accessibilityRole="radio"
                        accessibilityLabel={hostel.name}
                        accessibilityState={{
                          checked: isSelected,
                        }}
                        aria-checked={isSelected}
                        onPress={() => {
                          selectHostel(hostel.id);
                          setHostelMenuOpen(false);
                        }}
                      >
                        <Text
                          className={`flex-1 text-[14px] leading-[21px] ${isSelected ? "font-semibold" : "font-normal"}`}
                          style={{ color: theme.text }}
                        >
                          {hostel.name}
                        </Text>
                        <Ionicons
                          name={
                            isSelected ? "checkmark-circle" : "ellipse-outline"
                          }
                          size={20}
                          color={
                            isSelected
                              ? Colors.status.info
                              : theme.textSecondary
                          }
                        />
                      </Pressable>
                    </View>
                  );
                })}
              </ScrollView>
            )}
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
        contentContainerClassName="px-4 pb-8"
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
              <Text
                className="text-center text-sm"
                style={{ color: theme.textSecondary }}
              >
                No faculty found for &quot;{searchQuery}&quot;
              </Text>
            </View>
          ) : undefined
        }
      />
    </Container>
  );
}
